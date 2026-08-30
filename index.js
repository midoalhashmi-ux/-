import { getDoc, setDoc } from './firestore.js';

// ============================================================================
// بديل Firebase Cloud Functions لهذا المشروع — يعمل على Cloudflare Workers،
// بدون الحاجة لخطة Blaze أو حساب فوترة سعودي عبر CNTXT، وبنفس فكرة الحماية
// تماماً: كل سرّ (مفتاح API-Football، بيانات حساب خدمة Google) يبقى هنا
// فقط، ولا يصل إطلاقاً لكود الموبايل أو المتصفح.
//
// نقطتان يخدمهما هذا الملف:
//   1) POST /getStreamUrl   — يُستدعى من تطبيق المشغل، يرجّع رابط m3u8 الحقيقي.
//   2) POST /refreshMatches — يُستدعى من لوحة التحكم (زر "مزامنة الآن").
//   3) scheduled()          — Cron Trigger كل ساعة، نفس منطق refreshMatches.
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ---------------------------------------------------------------------------
// 1) getStreamUrl — نفس منطق دالة Firebase الأصلية بالضبط.
// ---------------------------------------------------------------------------
async function handleGetStreamUrl(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'invalid-argument', message: 'body غير صالح.' }, 400);
  }

  const channelId = body && body.channelId;
  if (!channelId || typeof channelId !== 'string') {
    return json({ error: 'invalid-argument', message: 'channelId مطلوب.' }, 400);
  }

  const [streamDoc, channelDoc] = await Promise.all([
    getDoc(env, `privateStreams/${channelId}`),
    getDoc(env, `channels/${channelId}`),
  ]);

  if (channelDoc && channelDoc.status === 'disabled') {
    return json({ error: 'permission-denied', message: 'هذه القناة موقوفة مؤقتاً.' }, 403);
  }

  if (channelDoc && channelDoc.protected === false && channelDoc.directUrl) {
    return json({ url: channelDoc.directUrl, expiresIn: null });
  }

  if (!streamDoc) {
    return json({ error: 'not-found', message: 'لم يتم تسجيل مصدر بث لهذه القناة بعد.' }, 404);
  }

  const url = streamDoc.url;
  if (!url || typeof url !== 'string') {
    return json({ error: 'not-found', message: 'رابط البث لهذه القناة غير مضبوط.' }, 404);
  }

  return json({ url, expiresIn: 60 * 60 * 4 });
}

// ---------------------------------------------------------------------------
// 2) مباريات اليوم — API-Football
// ---------------------------------------------------------------------------
function mapFixtureStatus(shortStatus) {
  const s = (shortStatus || '').toString().toUpperCase();
  if (['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT'].includes(s)) return 'LIVE';
  if (['FT', 'AET', 'PEN'].includes(s)) return 'FT';
  if (['PST', 'CANC', 'ABD', 'SUSP', 'INT'].includes(s)) return 'PST';
  return 'NS';
}

// ---------------------------------------------------------------------------
// قائمة الدول المسموحة — نفس النمط الملحوظ في تطبيقات النتائج المرجعية
// (تعرض كل دوريات الدولة المهمة، وليس فقط الدرجة الأولى — مثلاً الدوري
// الإسباني يشمل الدرجة الثانية، والفرنسي يشمل الدرجة الثانية، وهكذا)،
// بدل قائمة أسماء دوريات محددة حرفياً كانت تستبعد أي دوري لا يطابق نصياً.
// المباريات الدولية/القارية (كأس العالم، دوري الأبطال بكل نسخه...) تصل
// من API-Football بقيمة country = "World" فتُقبل دائماً.
// ---------------------------------------------------------------------------
const ALLOWED_COUNTRIES = new Set([
  'saudi arabia',
  'iraq',
  'egypt',
  'united arab emirates',
  'qatar',
  'kuwait',
  'morocco',
  'tunisia',
  'algeria',
  'jordan',
  'england',
  'spain',
  'italy',
  'germany',
  'france',
  'portugal',
  'turkey',
  'brazil',
  'world',
]);

function isAllowedCountry(country) {
  return ALLOWED_COUNTRIES.has((country || '').trim().toLowerCase());
}

function normalizeFixture(fx) {
  const fixture = fx.fixture || {};
  const league = fx.league || {};
  const teams = fx.teams || {};
  const goals = fx.goals || {};

  const dateIso = (fixture.date || '').toString();
  const dateEvent = dateIso.split('T')[0] || '';
  const timePart = dateIso.split('T')[1] || '00:00:00';
  const strTime = timePart.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');

  return {
    idEvent: String(fixture.id ?? ''),
    strLeague: league.name || '',
    strLeagueBadge: league.logo || null,
    strCountry: league.country || '',
    strHomeTeam: (teams.home && teams.home.name) || '',
    strAwayTeam: (teams.away && teams.away.name) || '',
    strHomeTeamBadge: (teams.home && teams.home.logo) || null,
    strAwayTeamBadge: (teams.away && teams.away.logo) || null,
    // معرّفا الفريقين في API-Football — لازمان لجلب معلومات ما قبل
    // المباراة (getPreMatchInfo): آخر 5 مباريات لكل فريق + آخر مواجهات.
    homeTeamId: (teams.home && teams.home.id) ? String(teams.home.id) : null,
    awayTeamId: (teams.away && teams.away.id) ? String(teams.away.id) : null,
    dateEvent,
    strTime: strTime || '00:00:00',
    intHomeScore: goals.home ?? null,
    intAwayScore: goals.away ?? null,
    strStatus: mapFixtureStatus(fixture.status && fixture.status.short),
    strVenue: (fixture.venue && fixture.venue.name) || null,
    // الجولة وحكم المباراة: موجودان أصلاً في نفس استجابة /fixtures
    // (league.round و fixture.referee) — لا يحتاجان أي طلب API إضافي.
    strRound: league.round || null,
    strReferee: fixture.referee || null,
  };
}

async function fetchFixturesOnce(env, dateStr) {
  const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${dateStr}`,
      { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } },
  );

  if (!response.ok) {
    throw new Error(`تعذر الاتصال بـ API-Football (${response.status}).`);
  }

  const body = await response.json();

  // API-Football يرجّع HTTP 200 حتى في حالة خطأ فعلي (مفتاح غير صالح،
  // انتهاء الحصة اليومية/الدقيقية، معامل غير صحيح...) — الخطأ يظهر فقط
  // داخل body.errors مع response فاضية. بدون هذا الفحص كانت كل هذه
  // الحالات تُعامَل بصمت على أنها "0 مباراة اليوم" بدل إظهار السبب
  // الحقيقي، وهذا على الأغلب هو سبب اختفاء كل المباريات فجأة.
  const apiErrors = body.errors;
  const hasApiErrors = apiErrors &&
      (Array.isArray(apiErrors) ? apiErrors.length > 0 : Object.keys(apiErrors).length > 0);
  if (hasApiErrors) {
    throw new Error(`API-Football رجّع خطأ: ${JSON.stringify(apiErrors)}`);
  }

  return (body.response || []).map(normalizeFixture);
}

async function fetchAndStoreFixtures(env, dateStr, { finalize = false, retryOnEmpty = false } = {}) {
  let allEvents = await fetchFixturesOnce(env, dateStr);

  // ملاحظة مهمة: لوحظ أن مزامنة الساعة تُرجع أحياناً 0 مباراة تماماً
  // بينما إعادة تشغيل نفس المزامنة يدوياً بعد دقائق قليلة (لنفس اليوم)
  // ترجع مئات المباريات فوراً. هذا سلوك معروف من API-Football نفسه عند
  // بعض الطلبات (استجابة فارغة مؤقتة وليست خطأ HTTP ولا خطأ ضمن body.errors)
  // وليس خللاً في هذا الكود. لذلك نعيد المحاولة مرة واحدة بعد مهلة قصيرة
  // قبل تخزين نتيجة فارغة أثناء المزامنة التلقائية فقط.
  if (allEvents.length === 0 && retryOnEmpty) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    try {
      allEvents = await fetchFixturesOnce(env, dateStr);
    } catch (_) {
      // تجاهل فشل إعادة المحاولة — نكمل بالنتيجة الفارغة الأصلية ونطبّق
      // حماية "عدم الكتابة فوق بيانات جيدة سابقة" أدناه.
    }
  }

  // الطلب بدون أي تصفية يرجّع مئات المباريات يومياً (كل درجات ودوريات
  // العالم). نستبعد الآن حسب الدولة (راجع ALLOWED_COUNTRIES أعلاه) بدل
  // اسم الدوري الحرفي — هذا يطابق سلوك تطبيقات النتائج المعروفة (تعرض كل
  // دوريات الدول المهمة بكل درجاتها، وليس فقط أسماء دوريات بعينها) — ثم
  // نحتفظ فقط بالمباريات التي تملك شعارات كاملة (فريقين + دوري) تفادياً
  // لصور مكسورة.
  const events = allEvents.filter((event) =>
    isAllowedCountry(event.strCountry) &&
    event.strHomeTeamBadge && event.strAwayTeamBadge && event.strLeagueBadge,
  );

  // حماية إضافية: إن رجعت هذه المزامنة بصفر مباراة رغم إعادة المحاولة،
  // ولدينا فعلاً بيانات جيدة مخزّنة سابقاً لنفس اليوم، لا نمسحها — على
  // الأرجح هذه استجابة مؤقتة من API-Football وليست حقيقة "لا مباريات
  // اليوم". تُحدَّث updatedAt فقط ليعكس وقت آخر محاولة.
  if (events.length === 0 && retryOnEmpty) {
    const existing = await getDoc(env, `matches_daily/${dateStr}`);
    if (existing && Array.isArray(existing.events) && existing.events.length > 0) {
      await setDoc(env, `matches_daily/${dateStr}`, {
        ...existing,
        updatedAt: new Date(),
      });
      return { count: existing.events.length, rawCount: existing.rawResultsCount ?? existing.events.length, keptExisting: true };
    }
  }

  await setDoc(env, `matches_daily/${dateStr}`, {
    events,
    updatedAt: new Date(),
    source: 'api-football',
    rawResultsCount: allEvents.length,
    // finalized = true يعني "يوم ماضٍ اكتملت نتائجه ولن يُعاد جلبه مرة
    // أخرى" — هذا هو أساس توفير حصة API-Football عند تفعيل نافذة الأيام
    // الماضية (راجع runScheduledSync أدناه).
    finalized: finalize,
  });

  return { count: events.length, rawCount: allEvents.length };
}

function todayDateKey() {
  return dateKeyOffset(0);
}

// يرجّع مفتاح تاريخ (YYYY-MM-DD) بإزاحة أيام عن اليوم الحالي (UTC).
// offset موجب = أيام قادمة، سالب = أيام ماضية.
function dateKeyOffset(offsetDays) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// مزامنة نافذة 7 أيام (من -3 إلى +3) بأقل استهلاك ممكن لحصة API-Football:
//   - اليوم: تُجلب كل ساعة (نفس ما كان سابقاً) لأنها الوحيدة التي تحتاج
//     تحديث نتائج مباشر خلال اليوم.
//   - الأيام القادمة (+1 إلى +3): تُجلب مرة واحدة فقط يومياً (عند الساعة
//     0 بتوقيت UTC) — الجدول لا يتغير كل ساعة، يكفي تحديث يومي (يلتقط
//     أي تأجيل/تعديل موعد).
//   - الأيام الماضية (-1 إلى -3): تُجلب مرة واحدة واحدة فقط طوال عمرها
//     (عند تحوّلها لأول مرة إلى "يوم ماضٍ")، ثم تُعلَّم finalized=true
//     ولا يُعاد الاتصال بـ API-Football لأجلها إطلاقاً بعد ذلك — نتيجة
//     مباراة منتهية لن تتغير.
//
// الحصيلة: 24 طلب/يوم (اليوم كل ساعة) + ~4 طلبات إضافية فقط مرة واحدة
// يومياً (3 أيام قادمة + يوم ماضٍ واحد جديد) ≈ 28 طلب/يوم، بدل 168 لو
// جُلبت كل الأيام السبعة كل ساعة.
async function runScheduledSync(env) {
  try {
    // retryOnEmpty: true — هذه هي المزامنة التلقائية غير المراقَبة (لا يوجد
    // مستخدم ينتظر الرد فوراً كما في زر "مزامنة الآن")، فمن الأفضل تحمّل
    // ثانية إضافية لإعادة محاولة عند استجابة فارغة بدل تخزين "0 مباراة"
    // خاطئة قد تبقى ظاهرة للمستخدمين ساعة كاملة حتى المزامنة التالية.
    await fetchAndStoreFixtures(env, dateKeyOffset(0), { retryOnEmpty: true });
  } catch (_) {
    // فشل مزامنة اليوم لا يجب أن يمنع محاولة مزامنة الأيام القادمة/الماضية
    // أدناه (كانت سابقاً تتوقف بالكامل لأن هذا الاستدعاء لم يكن ضمن try/catch).
  }

  const hour = new Date().getUTCHours();
  if (hour !== 0) return;

  for (const offset of [1, 2, 3]) {
    try {
      await fetchAndStoreFixtures(env, dateKeyOffset(offset), { retryOnEmpty: true });
    } catch (_) {
      // تجاهل فشل يوم قادم واحد، لا نوقف بقية المزامنة بسببه.
    }
  }

  for (const offset of [-1, -2, -3]) {
    const dateStr = dateKeyOffset(offset);
    try {
      const existing = await getDoc(env, `matches_daily/${dateStr}`);
      if (existing && existing.finalized === true) continue;
      await fetchAndStoreFixtures(env, dateStr, { finalize: true, retryOnEmpty: true });
    } catch (_) {
      // نفس الشيء — يوم ماضٍ واحد يفشل لا يوقف البقية، وسيُعاد المحاولة
      // غداً تلقائياً لأنه لن يكون finalized بعد.
    }
  }
}

async function handleRefreshMatches(request, env) {
  const adminKey = request.headers.get('x-admin-key');
  if (!env.ADMIN_SYNC_SECRET || adminKey !== env.ADMIN_SYNC_SECRET) {
    return json({ error: 'permission-denied', message: 'غير مصرح.' }, 403);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    // body اختياري — لو ما أُرسل، نستخدم تاريخ اليوم.
  }

  // يدعم مزامنة يوم واحد (body.date) أو نافذة الأيام كاملة دفعة واحدة
  // (body.syncWindow = true) — مفيد لزر "مزامنة الآن" بلوحة التحكم بعد
  // نشر هذا التحديث لأول مرة، حتى تمتلئ الأيام السبعة فوراً بدل انتظار
  // المزامنة التلقائية اليومية.
  if (body.syncWindow === true) {
    const results = {};
    for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
      const dateStr = dateKeyOffset(offset);
      try {
        results[dateStr] = await fetchAndStoreFixtures(env, dateStr, { finalize: offset < 0, retryOnEmpty: true });
      } catch (error) {
        results[dateStr] = `error: ${String(error && error.message || error)}`;
      }
    }
    return json({ ok: true, results });
  }

  const dateStr = body.date || todayDateKey();
  try {
    const { count, rawCount } = await fetchAndStoreFixtures(env, dateStr, { retryOnEmpty: true });
    return json({ ok: true, count, rawCount, date: dateStr });
  } catch (error) {
    return json({ ok: false, message: String(error && error.message || error) }, 500);
  }
}

// ---------------------------------------------------------------------------
// 3) إحصائيات مباراة واحدة عند فتحها من التطبيق (استحواذ، تسديدات،
//    ركنيات، بطاقات...) — مع كاش بـ Firestore حتى يشترك كل المستخدمين
//    بنفس النتيجة المخزّنة بدل أن يستهلك كل ضغطة من كل مستخدم طلب
//    API-Football منفصل:
//      - مباراة منتهية: تُخزّن نهائياً، لا يُعاد جلبها أبداً بعد أول مرة.
//      - مباراة مباشرة: كاش لمدة دقيقة واحدة فقط قبل إعادة الجلب.
//      - مباراة لم تبدأ: لا يُرسل أي طلب لـ API-Football أصلاً (العميل
//        يتحقق من الحالة محلياً قبل الاتصال بهذه النقطة).
// ---------------------------------------------------------------------------
const LIVE_STATS_CACHE_MS = 60 * 1000;

async function handleGetMatchStats(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'invalid-argument', message: 'body غير صالح.' }, 400);
  }

  const fixtureId = body && body.fixtureId;
  if (!fixtureId || typeof fixtureId !== 'string') {
    return json({ error: 'invalid-argument', message: 'fixtureId مطلوب.' }, 400);
  }

  const cacheKey = `matches_stats/${fixtureId}`;
  const cached = await getDoc(env, cacheKey);
  const now = Date.now();

  if (cached) {
    const isFresh = cached.matchFinished === true
        || (now - (cached.fetchedAtMs || 0)) < LIVE_STATS_CACHE_MS;
    if (isFresh) {
      return json({ statistics: cached.statistics, cached: true });
    }
  }

  let response;
  try {
    response = await fetch(
        `https://v3.football.api-sports.io/fixtures/statistics?fixture=${encodeURIComponent(fixtureId)}`,
        { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } },
    );
  } catch (_) {
    if (cached) return json({ statistics: cached.statistics, cached: true, stale: true });
    return json({ error: 'upstream-error', message: 'تعذر الاتصال بمصدر الإحصائيات.' }, 502);
  }

  if (!response.ok) {
    if (cached) return json({ statistics: cached.statistics, cached: true, stale: true });
    return json({ error: 'upstream-error', message: 'تعذر جلب الإحصائيات حالياً.' }, 502);
  }

  const data = await response.json();
  const rawTeams = data.response || [];

  if (rawTeams.length === 0) {
    return json({ statistics: null, message: 'لا توجد إحصائيات متاحة لهذه المباراة بعد.' });
  }

  const statistics = rawTeams.map((team) => ({
    teamId: (team.team && team.team.id) ?? null,
    teamName: (team.team && team.team.name) || '',
    stats: (team.statistics || []).map((s) => ({ type: s.type, value: s.value })),
  }));

  // نعتمد على العميل لإخبارنا هل المباراة انتهت (body.finished) بدل
  // طلب API إضافي فقط لمعرفة الحالة — الحالة أصلاً معروفة عند العميل
  // من matches_daily.
  const matchFinished = body.finished === true;

  await setDoc(env, cacheKey, {
    statistics,
    matchFinished,
    fetchedAtMs: now,
  });

  return json({ statistics, cached: false });
}

// ---------------------------------------------------------------------------
// 4) معلومات ما قبل المباراة: آخر 5 مباريات لكل فريق + آخر مواجهات مباشرة
//    بينهما. كاش مشترك بين كل المستخدمين لمدة 12 ساعة، بمفتاح مبني على
//    رقمي الفريقين فقط (بدون ترتيب مضيف/ضيف) — بهذا الشكل أي عدد من
//    المستخدمين يفتحون أي مباراة بين نفس الفريقين خلال نفس اليوم يشتركون
//    في 3 طلبات API-Football واحدة فقط بدل 3 طلبات لكل فتحة شاشة.
// ---------------------------------------------------------------------------
async function fetchApiFootballJson(env, path) {
  const response = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
  });
  if (!response.ok) {
    throw new Error(`API-Football HTTP ${response.status}`);
  }
  const body = await response.json();
  const apiErrors = body.errors;
  const hasApiErrors = apiErrors &&
      (Array.isArray(apiErrors) ? apiErrors.length > 0 : Object.keys(apiErrors).length > 0);
  if (hasApiErrors) {
    throw new Error(`API-Football رجّع خطأ: ${JSON.stringify(apiErrors)}`);
  }
  return body.response || [];
}

// يحوّل مباراة سابقة (من fixtures أو headtohead) إلى نتيجة مبسّطة من
// منظور فريق واحد (perspectiveTeamId) — فوز/تعادل/خسارة + الخصم + التاريخ.
// يتجاهل المباريات غير المنتهية (لا نتيجة نهائية بعد).
function buildFormEntry(fx, perspectiveTeamId) {
  const fixture = fx.fixture || {};
  const league = fx.league || {};
  const teams = fx.teams || {};
  const goals = fx.goals || {};
  const statusShort = (fixture.status && fixture.status.short) || '';
  if (!['FT', 'AET', 'PEN'].includes(statusShort)) return null;
  if (goals.home == null || goals.away == null) return null;

  const homeId = teams.home && teams.home.id;
  const isHome = String(homeId) === String(perspectiveTeamId);
  const dateIso = (fixture.date || '').toString();

  return {
    opponentEn: isHome ? ((teams.away && teams.away.name) || '') : ((teams.home && teams.home.name) || ''),
    teamScore: isHome ? goals.home : goals.away,
    opponentScore: isHome ? goals.away : goals.home,
    dateEvent: dateIso.split('T')[0] || '',
    leagueNameEn: league.name || '',
  };
}

const PRE_MATCH_CACHE_MS = 12 * 60 * 60 * 1000; // 12 ساعة

async function handleGetPreMatchInfo(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'invalid-argument', message: 'body غير صالح.' }, 400);
  }

  const homeTeamId = body && body.homeTeamId;
  const awayTeamId = body && body.awayTeamId;
  if (!homeTeamId || !awayTeamId) {
    return json({ error: 'invalid-argument', message: 'homeTeamId و awayTeamId مطلوبان.' }, 400);
  }

  // مفتاح الكاش لا يعتمد على ترتيب مضيف/ضيف — نفس زوج الفريقين يعيد
  // استخدام نفس النتيجة المخزّنة بغض النظر عن مين المضيف في هذه المباراة.
  const pairKey = [String(homeTeamId), String(awayTeamId)].sort().join('_');
  const cacheKey = `prematch_info/${pairKey}`;

  const cached = await getDoc(env, cacheKey);
  const now = Date.now();
  if (cached && (now - (cached.fetchedAtMs || 0)) < PRE_MATCH_CACHE_MS) {
    return json({ info: cached.info, cached: true });
  }

  try {
    const [h2hRaw, homeRaw, awayRaw] = await Promise.all([
      fetchApiFootballJson(env, `/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=5`),
      fetchApiFootballJson(env, `/fixtures?team=${homeTeamId}&last=5`),
      fetchApiFootballJson(env, `/fixtures?team=${awayTeamId}&last=5`),
    ]);

    const info = {
      h2h: h2hRaw.map((fx) => buildFormEntry(fx, homeTeamId)).filter(Boolean),
      homeForm: homeRaw.map((fx) => buildFormEntry(fx, homeTeamId)).filter(Boolean),
      awayForm: awayRaw.map((fx) => buildFormEntry(fx, awayTeamId)).filter(Boolean),
    };

    await setDoc(env, cacheKey, { info, fetchedAtMs: now });
    return json({ info, cached: false });
  } catch (error) {
    if (cached) return json({ info: cached.info, cached: true, stale: true });
    return json({ error: 'upstream-error', message: 'تعذر جلب معلومات ما قبل المباراة حالياً.' }, 502);
  }
}

// ---------------------------------------------------------------------------
// التوجيه (Routing)
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/getStreamUrl') {
      return handleGetStreamUrl(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/refreshMatches') {
      return handleRefreshMatches(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/getMatchStats') {
      return handleGetMatchStats(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/getPreMatchInfo') {
      return handleGetPreMatchInfo(request, env);
    }

    return json({ error: 'not-found', message: 'مسار غير معروف.' }, 404);
  },

  // Cron Trigger — مضبوط في wrangler.toml ليعمل كل ساعة تلقائياً.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
  },
};
