import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// عنوان Cloudflare Worker (بديل Firebase Cloud Functions — بدون خطة Blaze
// ولا حساب فوترة سعودي عبر CNTXT). استبدله بالعنوان الحقيقي بعد
// "wrangler deploy" — راجع cloudflare-worker/README.md.
const WORKER_BASE_URL = 'https://binsheikh-api.binsheikh.workers.dev';
// نفس القيمة اللي ضبطتها بأمر: wrangler secret put ADMIN_SYNC_SECRET
const ADMIN_SYNC_SECRET = 'Sh3ikh2026Sports!Admin#Sync99';

// إعدادات تطبيق الويب من مشروع Firebase نفسه. لا تضع هنا كلمات مرور المستخدمين.
const firebaseConfig = {
  apiKey: 'AIzaSyAhbhgXXfR7A9AGsDk0c8GCp0bvvhyzw2g',
  authDomain: 'sports-stream-app-36a7a.firebaseapp.com',
  projectId: 'sports-stream-app-36a7a',
  storageBucket: 'sports-stream-app-36a7a.firebasestorage.app',
  messagingSenderId: '207449859236',
  appId: '1:207449859236:web:b371a927db431000ceb231',
  measurementId: 'G-YX8E8NCN8F',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const views = {
  loading: document.querySelector('#loading-view'),
  login: document.querySelector('#login-view'),
  dashboard: document.querySelector('#dashboard-view'),
};
const loginForm = document.querySelector('#login-form');
const loginButton = document.querySelector('#login-button');
const loginError = document.querySelector('#login-error');
const categoriesLoading = document.querySelector('#categories-loading');
const categoriesError = document.querySelector('#categories-error');
const categoriesEmpty = document.querySelector('#categories-empty');
const categoriesList = document.querySelector('#categories-list');
const categoriesCount = document.querySelector('#categories-count');
const categoryFormCard = document.querySelector('#category-form-card');
const categoryForm = document.querySelector('#category-form');
const categoryEditId = document.querySelector('#category-edit-id');
const categorySaveButton = document.querySelector('#category-save-button');
const categoryCloseButton = document.querySelector('#category-close-button');
const categoryFormMessage = document.querySelector('#category-form-message');
const categoryParent = document.querySelector('#category-parent');
const categoriesTitle = document.querySelector('#categories-title');
const categoriesContext = document.querySelector('#categories-context');
const categoryFormTitle = document.querySelector('#category-form-title');
const backToRoot = document.querySelector('#back-to-root');
const retryCategories = document.querySelector('#retry-categories');
const navButtons = document.querySelectorAll('[data-panel]');

// ---- زر "+ إضافة" الموحّد وبطاقاته ----
const addMenuToggle = document.querySelector('#add-menu-toggle');
const addMenu = document.querySelector('#add-menu');
const addMenuChannelButton = addMenu.querySelector('[data-add-type="channel"]');
const addMenuMarqueeButton = addMenu.querySelector('[data-add-type="marquee"]');

const channelFormCard = document.querySelector('#channel-form-card');
const channelForm = document.querySelector('#channel-form');
const channelCategory = document.querySelector('#channel-category');
const channelTitle = document.querySelector('#channel-title');
const channelSubtitle = document.querySelector('#channel-subtitle');
const channelStatus = document.querySelector('#channel-status');
const channelLogo = document.querySelector('#channel-logo');
const channelPlayerKey = document.querySelector('#channel-player-key');
const channelEditId = document.querySelector('#channel-edit-id');
const channelFormTitle = document.querySelector('#channel-form-title');
const channelSaveButton = document.querySelector('#channel-save-button');
const channelCloseButton = document.querySelector('#channel-close-button');
const channelFormMessage = document.querySelector('#channel-form-message');
const channelsSection = document.querySelector('#channels-section');
const channelsTitle = document.querySelector('#channels-title');
const channelsList = document.querySelector('#channels-list');
const channelsLoading = document.querySelector('#channels-loading');
const channelsEmpty = document.querySelector('#channels-empty');
const channelsCount = document.querySelector('#channels-count');
const CHANNELS_EMPTY_HTML = channelsEmpty.innerHTML;

const marqueeFormCard = document.querySelector('#marquee-form-card');
const marqueeForm = document.querySelector('#marquee-form');
const marqueeFormTitle = document.querySelector('#marquee-form-title');
const marqueeText = document.querySelector('#marquee-text');
const marqueeFormMessage = document.querySelector('#marquee-form-message');
const marqueeSaveButton = document.querySelector('#marquee-save-button');
const marqueeCloseButton = document.querySelector('#marquee-close-button');
const marqueePreview = document.querySelector('#marquee-preview');

let currentChannels = [];
let currentCategories = [];
let currentParentId = null;

// ---- المباريات (API-Football عبر Cloud Function) ----
const syncMatchesButton = document.querySelector('#sync-matches-button');
const syncWindowButton = document.querySelector('#sync-window-button');
const matchesStatusText = document.querySelector('#matches-status-text');
const matchesDebugText = document.querySelector('#matches-debug-text');
const matchesMessage = document.querySelector('#matches-message');

// ---- الرسائل (contactMessages) ----
const messagesLoading = document.querySelector('#messages-loading');
const messagesEmpty = document.querySelector('#messages-empty');
const messagesList = document.querySelector('#messages-list');
const messagesCount = document.querySelector('#messages-count');
const messagesBadge = document.querySelector('#messages-badge');
let currentMessages = [];

// ---- الشروط والأحكام / سياسة الخصوصية ----
const legalForm = document.querySelector('#legal-form');
const legalTerms = document.querySelector('#legal-terms');
const legalPrivacy = document.querySelector('#legal-privacy');
const legalMessage = document.querySelector('#legal-message');

// ---- الإعلانات (settings/ads) ----
const adsForm = document.querySelector('#ads-form');
const adsEnabled = document.querySelector('#ads-enabled');
const adsMessage = document.querySelector('#ads-message');
const admobAppId = document.querySelector('#admob-app-id');
const admobBannerId = document.querySelector('#admob-banner-id');
const admobInterstitialId = document.querySelector('#admob-interstitial-id');
const admobRewardedId = document.querySelector('#admob-rewarded-id');
const applovinSdkKey = document.querySelector('#applovin-sdk-key');
const applovinBannerId = document.querySelector('#applovin-banner-id');
const applovinInterstitialId = document.querySelector('#applovin-interstitial-id');
const applovinRewardedId = document.querySelector('#applovin-rewarded-id');
const unityGameId = document.querySelector('#unity-game-id');
const unityBannerId = document.querySelector('#unity-banner-id');
const unityInterstitialId = document.querySelector('#unity-interstitial-id');
const unityRewardedId = document.querySelector('#unity-rewarded-id');

// عناصر الرابط المخفي
const hiddenLinkForm = document.querySelector('#hidden-link-form');
const hiddenLinkInput = document.querySelector('#hidden-link-input');
const hiddenParamsInput = document.querySelector('#hidden-params-input');
const hiddenHeadersInput = document.querySelector('#hidden-headers-input');
const hiddenLinkOutput = document.querySelector('#hidden-link-output');
const hiddenLinkSaveButton = document.querySelector('#hidden-link-save-button');
const hiddenLinkPlayButton = document.querySelector('#hidden-link-play-button');
const hiddenLinkMessage = document.querySelector('#hidden-link-message');

function showView(name) {
  Object.entries(views).forEach(([key, element]) => element.classList.toggle('hidden', key !== name));
}

function resetCategories() {
  categoriesLoading.classList.remove('hidden');
  categoriesError.classList.add('hidden');
  categoriesEmpty.classList.add('hidden');
  categoriesList.classList.add('hidden');
  categoriesList.innerHTML = '';
  categoriesCount.textContent = 'جارٍ التحميل…';
  retryCategories.classList.add('hidden');
}

function showCategories(categories) {
  currentCategories = categories;
  categoriesLoading.classList.add('hidden');
  categoriesError.classList.add('hidden');
  renderCurrentCategoryView();
}

function closeAllFormCards() {
  categoryFormCard.classList.add('hidden');
  channelFormCard.classList.add('hidden');
  marqueeFormCard.classList.add('hidden');
}

function updateAddMenuAvailability() {
  const disabled = currentParentId === null;
  addMenuChannelButton.disabled = disabled;
  addMenuMarqueeButton.disabled = disabled;
  addMenuChannelButton.classList.toggle('disabled-hint', disabled);
  addMenuMarqueeButton.classList.toggle('disabled-hint', disabled);
}

function openCategoryForm(existingId) {
  closeAllFormCards();
  const parent = currentCategories.find((item) => item.id === currentParentId);
  const parentTitle = parent?.title || '';
  categoryFormMessage.textContent = '';
  categoryFormMessage.classList.remove('error');
  if (existingId) {
    const category = currentCategories.find((item) => item.id === existingId);
    categoryEditId.value = existingId;
    categoryForm.elements.title.value = category?.title || '';
    categoryForm.elements.image.value = category?.iconUrl || '';
    categoryFormTitle.textContent = `تعديل: ${category?.title || ''}`;
    categorySaveButton.textContent = 'حفظ التعديل';
  } else {
    categoryEditId.value = '';
    categoryForm.reset();
    categoryFormTitle.textContent = currentParentId ? `إضافة قسم داخل «${parentTitle}»` : 'إضافة قسم رئيسي';
    categorySaveButton.textContent = 'إضافة القسم';
  }
  categoryParent.value = currentParentId || '';
  categoryFormCard.classList.remove('hidden');
}

function openChannelForm(existingId) {
  if (currentParentId === null) return;
  closeAllFormCards();
  const parent = currentCategories.find((item) => item.id === currentParentId);
  channelCategory.value = currentParentId;
  channelFormMessage.textContent = '';
  channelFormMessage.classList.remove('error');
  if (existingId) {
    const channel = currentChannels.find((item) => item.id === existingId);
    if (!channel) return;
    channelEditId.value = channel.id;
    channelTitle.value = channel.title || '';
    channelSubtitle.value = channel.subtitle || '';
    channelStatus.value = channel.status || 'upcoming';
    channelLogo.value = channel.logoUrl || '';
    channelPlayerKey.value = channel.playerChannelKey || '';
    channelFormTitle.textContent = `تعديل: ${channel.title || ''}`;
    channelSaveButton.textContent = 'حفظ التعديل';
  } else {
    channelForm.reset();
    channelEditId.value = '';
    channelCategory.value = currentParentId;
    channelFormTitle.textContent = `إضافة قناة داخل «${parent?.title || ''}»`;
    channelSaveButton.textContent = 'إضافة القناة';
  }
  channelFormCard.classList.remove('hidden');
}

function openMarqueeForm() {
  if (currentParentId === null) return;
  closeAllFormCards();
  const parent = currentCategories.find((item) => item.id === currentParentId);
  marqueeFormTitle.textContent = `نص متحرك لقسم «${parent?.title || ''}»`;
  marqueeText.value = parent?.marqueeText || '';
  marqueeFormMessage.textContent = '';
  marqueeFormMessage.classList.remove('error');
  marqueeFormCard.classList.remove('hidden');
}

function renderMarqueePreview() {
  const parent = currentCategories.find((item) => item.id === currentParentId);
  if (currentParentId !== null && parent?.marqueeText) {
    marqueePreview.textContent = `🔄 ${parent.marqueeText}`;
    marqueePreview.classList.remove('hidden');
  } else {
    marqueePreview.classList.add('hidden');
  }
}

function renderChannelsForCurrentCategory() {
  if (currentParentId === null) {
    channelsSection.classList.add('hidden');
    return;
  }
  channelsSection.classList.remove('hidden');
  channelsLoading.classList.add('hidden');
  channelsEmpty.innerHTML = CHANNELS_EMPTY_HTML;
  const parent = currentCategories.find((item) => item.id === currentParentId);
  channelsTitle.textContent = parent?.title ? `قنوات «${parent.title}»` : 'القنوات';
  const list = currentChannels.filter((channel) => channel.categoryId === currentParentId);
  channelsCount.textContent = `${list.length} قناة`;
  if (!list.length) {
    channelsEmpty.classList.remove('hidden');
    channelsList.classList.add('hidden');
    return;
  }
  channelsEmpty.classList.add('hidden');
  channelsList.innerHTML = list.map((channel) => {
    const logo = channel.logoUrl ? `<img class="channel-logo" src="${escapeHtml(channel.logoUrl)}" alt="">` : '<div class="channel-logo category-image-placeholder">⚽</div>';
    return `<article class="card channel-item">${logo}<div class="channel-info"><h3>${escapeHtml(channel.title || 'قناة بلا اسم')}</h3><p>${escapeHtml(channel.subtitle || 'بدون وصف')}</p><div class="channel-source"><label class="protect-toggle"><input type="checkbox" data-protected-toggle="${escapeHtml(channel.id)}" ${channel.protected === false ? '' : 'checked'}> حماية برابط مؤقت</label><input type="text" class="source-input" data-source-input="${escapeHtml(channel.id)}" placeholder="الصق رابط m3u8 هنا"><button type="button" data-save-source="${escapeHtml(channel.id)}">حفظ المصدر</button><span class="source-status" data-source-status="${escapeHtml(channel.id)}"></span></div></div><div class="channel-actions"><button type="button" data-edit-channel="${escapeHtml(channel.id)}">تعديل</button><button class="delete-category-button" type="button" data-delete-channel="${escapeHtml(channel.id)}">حذف</button></div></article>`;
  }).join('');
  channelsList.classList.remove('hidden');
  loadChannelSources(list);
}

function renderCurrentCategoryView() {
  const parent = currentCategories.find((category) => category.id === currentParentId);
  if (currentParentId && !parent) currentParentId = null;
  const visibleCategories = currentCategories.filter(
    (category) => (category.parentId || null) === currentParentId,
  );
  const isRoot = currentParentId === null;
  const parentTitle = parent?.title || '';
  categoriesTitle.textContent = isRoot ? 'الأقسام الرئيسية' : `داخل قسم: ${parentTitle}`;
  categoriesContext.textContent = isRoot
    ? 'اختر قسماً لعرض ما بداخله، أو أضف عنصراً من زر «+ إضافة».'
    : `كل قسم تضيفه هنا يصبح فرعياً داخل «${parentTitle}».`;
  backToRoot.classList.toggle('hidden', isRoot);
  categoriesCount.textContent = `${visibleCategories.length} قسم`;

  if (visibleCategories.length === 0) {
    categoriesEmpty.classList.remove('hidden');
    categoriesList.classList.add('hidden');
  } else {
    categoriesEmpty.classList.add('hidden');
    categoriesList.innerHTML = visibleCategories.map(({ id, ...category }) => {
      const title = escapeHtml(category.title || 'قسم بلا اسم');
      const image = category.iconUrl
        ? `<img class="category-image" src="${escapeHtml(category.iconUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'category-image-placeholder', textContent: '⚽'}))">`
        : '<div class="category-image-placeholder" aria-hidden="true">⚽</div>';
      const childrenCount = currentCategories.filter((item) => item.parentId === id).length;
      return `<article class="card category-card">${image}<div class="category-details"><h3>${title}</h3><p class="category-meta"><span>${childrenCount ? `${childrenCount} أقسام داخلية` : 'لا توجد أقسام داخلية'}</span>${category.isPremium ? '<span class="premium-tag">اشتراك</span>' : '<span>عام</span>'}</p><button class="open-category-button" type="button" data-open-category="${escapeHtml(id)}">فتح القسم</button><div class="category-tools"><button type="button" data-edit-category="${escapeHtml(id)}">تعديل</button><button class="delete-category-button" type="button" data-delete-category="${escapeHtml(id)}">حذف</button></div></div></article>`;
    }).join('');
    categoriesList.classList.remove('hidden');
  }

  renderMarqueePreview();
  renderChannelsForCurrentCategory();
  updateAddMenuAvailability();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

async function loadCategories() {
  resetCategories();
  const categoriesQuery = query(collection(db, 'categories'), orderBy('order'));
  try {
    const snapshot = await Promise.race([
      getDocs(categoriesQuery),
      new Promise((_, reject) => window.setTimeout(
        () => reject(new Error('timeout')), 12000,
      )),
    ]);
    showCategories(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  } catch (_) {
    categoriesLoading.classList.add('hidden');
    categoriesCount.textContent = 'تعذر التحميل';
    categoriesError.textContent = 'تعذر الاتصال بقاعدة الأقسام. اضغط زر إعادة المحاولة. إذا تكرر الخطأ، أعد تسجيل الدخول ثم جرّب مرة أخرى.';
    categoriesError.classList.remove('hidden');
    retryCategories.classList.remove('hidden');
  }
}

async function loadChannels() {
  if (currentParentId !== null) {
    channelsSection.classList.remove('hidden');
    channelsLoading.classList.remove('hidden');
    channelsList.classList.add('hidden');
    channelsEmpty.classList.add('hidden');
  }
  try {
    const snapshot = await Promise.race([
      getDocs(collection(db, 'channels')),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);
    currentChannels = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    renderChannelsForCurrentCategory();
  } catch (_) {
    currentChannels = [];
    if (currentParentId !== null) {
      channelsLoading.classList.add('hidden');
      channelsList.classList.add('hidden');
      channelsEmpty.classList.remove('hidden');
      channelsEmpty.innerHTML = '<h2>تعذر تحميل القنوات</h2><p>تأكد من إضافة صلاحية channels في قواعد Firestore أدناه.</p>';
    }
  }
}

// مصادر البث الحقيقية (روابط m3u8) محفوظة في مجموعة منفصلة privateStreams
// لا يقرأها تطبيق المحتوى أبداً — فقط لوحة التحكم (بعد تسجيل الدخول) والـ Cloud Function.
// القنوات غير المحمية تُحفظ مباشرة داخل channels.directUrl (قراءة عامة، بدون تأخير التوكن).
async function loadChannelSources(channels) {
  await Promise.all(channels.map(async (channel) => {
    const input = document.querySelector(`[data-source-input="${channel.id}"]`);
    const status = document.querySelector(`[data-source-status="${channel.id}"]`);
    if (!input) return;
    const isProtected = channel.protected !== false;
    if (!isProtected) {
      if (channel.directUrl) { input.value = channel.directUrl; if (status) status.textContent = 'محفوظ بدون حماية (بدون تأخير)'; }
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, 'privateStreams', channel.id));
      const data = snapshot.data();
      if (data?.url) {
        input.value = data.url;
        if (status) status.textContent = 'محفوظ ومحمي برابط مؤقت';
      }
    } catch (_) {
      if (status) status.textContent = 'تعذر تحميل المصدر الحالي';
    }
  }));
}

async function saveChannelSource(channelId) {
  const input = document.querySelector(`[data-source-input="${channelId}"]`);
  const status = document.querySelector(`[data-source-status="${channelId}"]`);
  const button = document.querySelector(`[data-save-source="${channelId}"]`);
  const protectedToggle = document.querySelector(`[data-protected-toggle="${channelId}"]`);
  if (!input) return;
  const url = input.value.trim();
  if (!url) { if (status) { status.textContent = 'الصق رابط m3u8 أولاً'; status.classList.add('error'); } return; }
  const isProtected = protectedToggle ? protectedToggle.checked : true;
  if (button) { button.disabled = true; button.textContent = 'جارٍ الحفظ…'; }
  if (status) status.classList.remove('error');
  try {
    if (isProtected) {
      await setDoc(doc(db, 'privateStreams', channelId), { url, updatedAt: serverTimestamp() }, { merge: true });
      await updateDoc(doc(db, 'channels', channelId), { protected: true, directUrl: null });
      if (status) status.textContent = 'تم الحفظ ✓ محمي برابط مؤقت';
    } else {
      await updateDoc(doc(db, 'channels', channelId), { protected: false, directUrl: url });
      if (status) status.textContent = 'تم الحفظ ✓ بدون حماية — تشغيل فوري بدون تأخير';
    }
  } catch (_) {
    if (status) { status.textContent = 'تعذر الحفظ. تحقق من قواعد Firestore.'; status.classList.add('error'); }
  } finally {
    if (button) { button.disabled = false; button.textContent = 'حفظ المصدر'; }
  }
}

async function loadPlayerSettings() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'player'));
    const data = snapshot.data();
    if (!data) return;
    document.querySelector('#player-scheme').value = data.deepLinkScheme || 'sportsplayer';
    document.querySelector('#player-package').value = data.androidPackage || '';
    document.querySelector('#player-store-url').value = data.storeUrl || '';
    document.querySelector('#player-min-version').value = data.minVersion || '';
    document.querySelector('#player-update-url').value = data.updateUrl || '';
    document.querySelector('#premium-enabled').checked = data.premiumEnabled === true;
    document.querySelector('#premium-url').value = data.premiumUrl || '';
    document.querySelector('#premium-button-text').value = data.premiumButtonText || '';
  } catch (_) {
    // إعدادات المشغل اختيارية إلى أن ينشر تطبيق المشغل في Google Play.
  }
}

// ==========================================================================
// مباريات اليوم — حالة المزامنة وزر "مزامنة الآن"
// ==========================================================================
// تُقرأ فقط للعرض هنا (نفس مستند matches_daily/{today} الذي يقرأه التطبيق).
// الكتابة الفعلية تتم حصراً داخل Cloud Function refreshMatches (Admin SDK)،
// وليس من هذا الملف — راجع firestore.rules (allow write: if false;).
function todayDateKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function formatTimestamp(value) {
  if (!value?.toDate) return 'غير معروف';
  return value.toDate().toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// يعرض بالضبط لماذا اختفت مباريات دوري معيّن من النتيجة النهائية، بدل
// التخمين: rawResultsCount = كل ما رجع من API-Football قبل أي فلترة،
// debugExcludedByLeague = عدد المباريات المستبعدة لأن اسم دوريها غير
// موجود في القائمة المعتمدة بالووركر (cloudflare-worker/src/index.js —
// ALLOWED_LEAGUE_NAMES)، وdebugExcludedLeagueSample أسماء فعلية من
// المصدر لم تُطابق القائمة — لو ظهر هنا اسم دوري تتوقعه (مثلاً الدوري
// المصري أو السعودي)، يعني اسم API-Football الفعلي مختلف عن المتوقع
// بالقائمة ويحتاج تحديث هناك.
function renderMatchesDebug(data) {
  const excludedLeague = data.debugExcludedByLeague ?? 0;
  const excludedBadge = data.debugExcludedByBadge ?? 0;
  const sample = Array.isArray(data.debugExcludedLeagueSample) ? data.debugExcludedLeagueSample : [];
  if (!excludedLeague && !excludedBadge) {
    matchesDebugText.classList.add('hidden');
    matchesDebugText.textContent = '';
    return;
  }
  const parts = [];
  if (typeof data.rawResultsCount === 'number') parts.push(`إجمالي من المصدر: ${data.rawResultsCount}`);
  if (excludedLeague) parts.push(`مستبعدة (دوري غير مدعوم): ${excludedLeague}`);
  if (excludedBadge) parts.push(`مستبعدة (شعار ناقص): ${excludedBadge}`);
  let text = parts.join(' · ');
  if (sample.length) text += ` — أمثلة أسماء دوريات مستبعدة: ${sample.join('، ')}`;
  matchesDebugText.textContent = text;
  matchesDebugText.classList.remove('hidden');
}

async function loadMatchesStatus() {
  matchesStatusText.textContent = 'جارٍ التحميل…';
  matchesDebugText.classList.add('hidden');
  try {
    const snapshot = await getDoc(doc(db, 'matches_daily', todayDateKey()));
    const data = snapshot.data();
    if (!data) {
      matchesStatusText.textContent = 'لا توجد مزامنة اليوم بعد. اضغط «مزامنة الآن».';
      return;
    }
    const count = Array.isArray(data.events) ? data.events.length : 0;
    matchesStatusText.textContent = `آخر تحديث: ${formatTimestamp(data.updatedAt)} · ${count} مباراة اليوم`;
    renderMatchesDebug(data);
  } catch (_) {
    matchesStatusText.textContent = 'تعذر قراءة حالة المزامنة.';
  }
}

// دالة مشتركة بين الزرين: "مزامنة الآن" (يوم اليوم فقط، body: {date})
// و"إعادة مزامنة كل الأيام" (النافذة كاملة -3..+3، body: {syncWindow: true}).
// نفس نقطة /refreshMatches بجسم مختلف — راجع cloudflare-worker/src/index.js.
async function runMatchesSync(button, body, { busyText, idleText, successMessage }) {
  button.disabled = true;
  button.textContent = busyText;
  matchesMessage.classList.add('hidden');
  matchesMessage.classList.remove('error-card');
  try {
    const response = await fetch(`${WORKER_BASE_URL}/refreshMatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_SYNC_SECRET },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }
    matchesMessage.textContent = successMessage(result);
    matchesMessage.classList.remove('hidden');
    await loadMatchesStatus();
  } catch (error) {
    matchesMessage.textContent = error?.message
      ? `تعذرت المزامنة: ${error.message}`
      : 'تعذرت المزامنة. تأكد من ضبط أسرار Worker (راجع cloudflare-worker/README.md) ومن تحديث WORKER_BASE_URL في هذا الملف.';
    matchesMessage.classList.remove('hidden');
    matchesMessage.classList.add('error-card');
  } finally {
    button.disabled = false;
    button.textContent = idleText;
  }
}

syncMatchesButton?.addEventListener('click', () => runMatchesSync(
  syncMatchesButton,
  { date: todayDateKey() },
  {
    busyText: 'جارٍ المزامنة…',
    idleText: 'مزامنة الآن',
    successMessage: (result) => `تمت المزامنة بنجاح — ${result.count ?? 0} مباراة.`,
  },
));

syncWindowButton?.addEventListener('click', () => runMatchesSync(
  syncWindowButton,
  { syncWindow: true },
  {
    busyText: 'جارٍ مزامنة كل الأيام… (قد تستغرق وقتاً أطول)',
    idleText: 'إعادة مزامنة كل الأيام (-3 إلى +3)',
    successMessage: (result) => {
      const entries = Object.entries(result.results || {});
      const okDays = entries.filter(([, value]) => typeof value === 'object' && value !== null);
      const totalMatches = okDays.reduce((sum, [, value]) => sum + (value.count ?? 0), 0);
      const failedDays = entries.filter(([, value]) => typeof value === 'string');
      let message = `تمت مزامنة نافذة الأيام (-3 إلى +3) — ${totalMatches} مباراة إجمالاً عبر ${okDays.length} يوم.`;
      if (failedDays.length) {
        const details = failedDays.map(([date, value]) => `${date} (${value})`).join('، ');
        message += ` تعذر جلب ${failedDays.length} يوم: ${details}.`;
      }
      return message;
    },
  },
));

// ==========================================================================
// الرسائل الواردة (contactMessages) — تواصل معنا / إبلاغ عن رابط معطوب
// ==========================================================================
const MESSAGE_TYPE_LABELS = { general: 'تواصل معنا', broken_link: 'رابط معطوب' };

async function loadMessages() {
  messagesLoading.classList.remove('hidden');
  messagesEmpty.classList.add('hidden');
  messagesList.classList.add('hidden');
  try {
    const messagesQuery = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(messagesQuery);
    currentMessages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    messagesLoading.classList.add('hidden');

    const newCount = currentMessages.filter((message) => message.status !== 'read').length;
    messagesCount.textContent = `${currentMessages.length} رسالة`;
    if (newCount > 0) {
      messagesBadge.textContent = String(newCount);
      messagesBadge.classList.remove('hidden');
    } else {
      messagesBadge.classList.add('hidden');
    }

    if (!currentMessages.length) {
      messagesEmpty.classList.remove('hidden');
      return;
    }

    messagesList.innerHTML = currentMessages.map((message) => {
      const isBroken = message.type === 'broken_link';
      const typeLabel = MESSAGE_TYPE_LABELS[message.type] || 'رسالة';
      const isRead = message.status === 'read';
      const channelInfo = message.channelInfo
        ? `<p class="message-channel-info">القناة/الرابط المُبلَّغ عنه: ${escapeHtml(message.channelInfo)}</p>`
        : '';
      return `<article class="card message-item">
        <div class="message-item-head">
          <span class="message-type-tag${isBroken ? ' broken-link' : ''}">${typeLabel}</span>
          <span class="message-status-tag ${isRead ? 'read' : 'new'}">${isRead ? 'تمت القراءة' : 'جديدة'}</span>
          <span class="message-date">${formatTimestamp(message.createdAt)}</span>
        </div>
        <p class="message-body">${escapeHtml(message.message || '')}</p>
        ${channelInfo}
        <div class="message-actions">
          ${isRead
            ? ''
            : `<button type="button" data-mark-read="${escapeHtml(message.id)}">تحديد كمقروءة</button>`}
          <button class="delete-category-button" type="button" data-delete-message="${escapeHtml(message.id)}">حذف</button>
        </div>
      </article>`;
    }).join('');
    messagesList.classList.remove('hidden');
  } catch (_) {
    messagesLoading.classList.add('hidden');
    messagesEmpty.classList.remove('hidden');
    messagesEmpty.innerHTML = '<h2>تعذر تحميل الرسائل</h2><p>تأكد من صلاحيات القراءة على contactMessages في قواعد Firestore.</p>';
  }
}

messagesList?.addEventListener('click', async (event) => {
  const markRead = event.target.closest('[data-mark-read]');
  const remove = event.target.closest('[data-delete-message]');
  if (markRead) {
    try { await updateDoc(doc(db, 'contactMessages', markRead.dataset.markRead), { status: 'read' }); await loadMessages(); }
    catch (_) { window.alert('تعذر تحديث حالة الرسالة.'); }
    return;
  }
  if (remove) {
    if (!window.confirm('حذف هذه الرسالة نهائياً؟')) return;
    try { await deleteDoc(doc(db, 'contactMessages', remove.dataset.deleteMessage)); await loadMessages(); }
    catch (_) { window.alert('تعذر حذف الرسالة.'); }
  }
});

// ==========================================================================
// الشروط والأحكام وسياسة الخصوصية (settings/legal)
// ==========================================================================
async function loadLegalSettings() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'legal'));
    const data = snapshot.data();
    if (!data) return;
    legalTerms.value = data.terms || '';
    legalPrivacy.value = data.privacy || '';
  } catch (_) {
    // النصوص القانونية اختيارية إلى أن تُضاف لأول مرة من هنا.
  }
}

legalForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  legalMessage.textContent = '';
  legalMessage.classList.remove('error');
  try {
    await setDoc(doc(db, 'settings', 'legal'), {
      terms: legalTerms.value.trim(),
      privacy: legalPrivacy.value.trim(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    legalMessage.textContent = 'تم حفظ النصوص، وستظهر فوراً في التطبيق.';
  } catch (_) {
    legalMessage.textContent = 'تعذر الحفظ. تحقق من قواعد Firestore.';
    legalMessage.classList.add('error');
  }
});

// ==========================================================================
// الإعلانات — أكواد الشبكات ومفتاح التشغيل/الإيقاف (settings/ads)
// ==========================================================================
async function loadAdsSettings() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'ads'));
    const data = snapshot.data();
    if (!data) return;
    adsEnabled.checked = data.enabled !== false;
    admobAppId.value = data.admob?.appId || '';
    admobBannerId.value = data.admob?.bannerId || '';
    admobInterstitialId.value = data.admob?.interstitialId || '';
    admobRewardedId.value = data.admob?.rewardedId || '';
    applovinSdkKey.value = data.applovin?.sdkKey || '';
    applovinBannerId.value = data.applovin?.bannerId || '';
    applovinInterstitialId.value = data.applovin?.interstitialId || '';
    applovinRewardedId.value = data.applovin?.rewardedId || '';
    unityGameId.value = data.unity?.gameId || '';
    unityBannerId.value = data.unity?.bannerId || '';
    unityInterstitialId.value = data.unity?.interstitialId || '';
    unityRewardedId.value = data.unity?.rewardedId || '';
  } catch (_) {
    // إعدادات الإعلانات اختيارية إلى أن تُضاف لأول مرة من هنا.
  }
}

adsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  adsMessage.textContent = '';
  adsMessage.classList.remove('error');
  try {
    await setDoc(doc(db, 'settings', 'ads'), {
      enabled: adsEnabled.checked,
      admob: {
        appId: admobAppId.value.trim(),
        bannerId: admobBannerId.value.trim(),
        interstitialId: admobInterstitialId.value.trim(),
        rewardedId: admobRewardedId.value.trim(),
      },
      applovin: {
        sdkKey: applovinSdkKey.value.trim(),
        bannerId: applovinBannerId.value.trim(),
        interstitialId: applovinInterstitialId.value.trim(),
        rewardedId: applovinRewardedId.value.trim(),
      },
      unity: {
        gameId: unityGameId.value.trim(),
        bannerId: unityBannerId.value.trim(),
        interstitialId: unityInterstitialId.value.trim(),
        rewardedId: unityRewardedId.value.trim(),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    adsMessage.textContent = 'تم حفظ إعدادات الإعلانات، وستُطبَّق فوراً في التطبيق.';
  } catch (_) {
    adsMessage.textContent = 'تعذر الحفظ. تحقق من قواعد Firestore.';
    adsMessage.classList.add('error');
  }
});

// ==========================================================================
// إضافة ميزة الرابط المخفي (Hidden Link)
// ==========================================================================
// سنضيف هنا الدوال والعناصر الخاصة بحفظ رابط مخفي (رابط أصلي + معاملات)
// وعرضه وتشغيله.
// ==========================================================================

// تحميل آخر رابط مخفي محفوظ من Firestore (مجموعة hiddenLinks)
async function loadHiddenLink() {
  if (!hiddenLinkOutput) return;
  try {
    const q = query(collection(db, 'hiddenLinks'), orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      hiddenLinkOutput.value = data.hiddenUrl || '';
      hiddenLinkInput.value = data.originalUrl || '';
      hiddenParamsInput.value = data.parameters || '';
      if (hiddenHeadersInput) {
        hiddenHeadersInput.value = data.headers ? JSON.stringify(data.headers, null, 2) : '';
      }
      if (hiddenLinkMessage) { hiddenLinkMessage.textContent = 'آخر رابط مخفي محفوظ:'; hiddenLinkMessage.classList.remove('error'); }
    } else {
      if (hiddenLinkMessage) hiddenLinkMessage.textContent = 'لا يوجد رابط مخفي محفوظ بعد.';
    }
  } catch (_) {
    if (hiddenLinkMessage) { hiddenLinkMessage.textContent = 'تعذر تحميل الرابط المخفي من قاعدة البيانات.'; hiddenLinkMessage.classList.add('error'); }
  }
}

// تحويل نص JSON إلى كائن، مع التحقق من الصحة
function parseHeadersInput() {
  if (!hiddenHeadersInput || !hiddenHeadersInput.value.trim()) return null;
  try {
    const parsed = JSON.parse(hiddenHeadersInput.value.trim());
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    throw new Error('Invalid headers object');
  } catch (_) {
    if (hiddenLinkMessage) { hiddenLinkMessage.textContent = 'صيغة الهيدرات غير صحيحة. يجب أن تكون JSON صحيح.'; hiddenLinkMessage.classList.add('error'); }
    return null;
  }
}

// حفظ الرابط المخفي في Firestore
async function saveHiddenLink(event) {
  event.preventDefault();
  if (!hiddenLinkInput || !hiddenParamsInput || !hiddenLinkSaveButton) return;
  const originalUrl = hiddenLinkInput.value.trim();
  const parameters = hiddenParamsInput.value.trim();
  if (!originalUrl) {
    if (hiddenLinkMessage) { hiddenLinkMessage.textContent = 'الرجاء إدخال الرابط الأصلي.'; hiddenLinkMessage.classList.add('error'); }
    return;
  }
  const headers = parseHeadersInput();
  if (headers === null) return; // توقف إذا كانت الهيدرات غير صالحة

  const hiddenUrl = parameters ? `${originalUrl}?${parameters}` : originalUrl;
  hiddenLinkSaveButton.disabled = true;
  hiddenLinkSaveButton.textContent = 'جارٍ الحفظ…';
  try {
    await addDoc(collection(db, 'hiddenLinks'), {
      originalUrl,
      parameters,
      hiddenUrl,
      headers,
      createdAt: serverTimestamp(),
    });
    if (hiddenLinkOutput) {
      hiddenLinkOutput.value = hiddenUrl;
      // إجبار التحديث البصري
      hiddenLinkOutput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // إظهار الرابط في رسالة النجاح أيضًا كنسخة احتياطية
    if (hiddenLinkMessage) {
      hiddenLinkMessage.textContent = `تم حفظ الرابط المخفي بنجاح ✓ الرابط: ${hiddenUrl}`;
      hiddenLinkMessage.classList.remove('error');
    }
  } catch (_) {
    if (hiddenLinkMessage) { hiddenLinkMessage.textContent = 'تعذر حفظ الرابط المخفي. تحقق من قواعد Firestore.'; hiddenLinkMessage.classList.add('error'); }
  } finally {
    hiddenLinkSaveButton.disabled = false;
    hiddenLinkSaveButton.textContent = 'حفظ الرابط المخفي';
  }
}

// تشغيل الرابط المخفي (يفتح في نافذة جديدة)
function playHiddenLink() {
  if (!hiddenLinkOutput) return;
  const hiddenUrl = hiddenLinkOutput.value.trim();
  if (!hiddenUrl) {
    if (hiddenLinkMessage) { hiddenLinkMessage.textContent = 'لا يوجد رابط للتشغيل.'; hiddenLinkMessage.classList.add('error'); }
    return;
  }
  window.open(hiddenUrl, '_blank');
}

// تعبئة الحقول بمثال جاهز (الرابط الذي أرسلته)
function fillExample() {
  if (hiddenLinkInput) hiddenLinkInput.value = 'http://h58.xelorino.buzz/live/918454578001/index.m3u8';
  if (hiddenParamsInput) hiddenParamsInput.value = 't=ScGEzq_hRW4KJejGUOCFNw&e=1788398260';
  if (hiddenHeadersInput) {
    hiddenHeadersInput.value = JSON.stringify({
      "Referer": "https://x.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    }, null, 2);
  }
  // تحديث حقل الناتج بشكل فوري
  if (hiddenLinkOutput) {
    const combined = hiddenParamsInput.value ? `${hiddenLinkInput.value}?${hiddenParamsInput.value}` : hiddenLinkInput.value;
    hiddenLinkOutput.value = combined;
    hiddenLinkOutput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (hiddenLinkMessage) {
    hiddenLinkMessage.textContent = 'تم تعبئة المثال. اضغط حفظ لتخزينه.';
    hiddenLinkMessage.classList.remove('error');
  }
}

// ربط الأحداث
if (hiddenLinkForm) {
  hiddenLinkForm.addEventListener('submit', saveHiddenLink);
}
if (hiddenLinkPlayButton) {
  hiddenLinkPlayButton.addEventListener('click', playHiddenLink);
}
const fillExampleButton = document.querySelector('#fill-example-button');
if (fillExampleButton) {
  fillExampleButton.addEventListener('click', fillExample);
}

// ==========================================================================
// تهيئة التطبيق عند تسجيل الدخول
// ==========================================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.querySelector('#owner-email').textContent = user.email || 'المالك';
    showView('dashboard');
    loadCategories();
    loadChannels();
    loadPlayerSettings();
    loadMatchesStatus();
    loadMessages();
    loadLegalSettings();
    loadAdsSettings();
    // استدعاء تحميل الرابط المخفي
    loadHiddenLink();
    return;
  }
  showView('login');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  loginButton.disabled = true;
  loginButton.textContent = 'جارٍ تسجيل الدخول…';
  try {
    await signInWithEmailAndPassword(auth, loginForm.email.value.trim(), loginForm.password.value);
  } catch (error) {
    loginError.textContent = 'تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور، ومن تفعيل تسجيل الدخول بالبريد الإلكتروني في Firebase.';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'تسجيل الدخول';
  }
});

document.querySelector('#logout-button').addEventListener('click', () => signOut(auth));
retryCategories.addEventListener('click', loadCategories);
navButtons.forEach((button) => button.addEventListener('click', () => {
  navButtons.forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== button.dataset.panel));
}));

categoriesList.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-category]');
  const remove = event.target.closest('[data-delete-category]');
  if (edit) return editCategory(edit.dataset.editCategory);
  if (remove) return deleteCategory(remove.dataset.deleteCategory);
  const button = event.target.closest('[data-open-category]');
  if (!button) return;
  currentParentId = button.dataset.openCategory;
  closeAllFormCards();
  renderCurrentCategoryView();
});

function editCategory(id) {
  openCategoryForm(id);
}

async function deleteCategory(id) {
  const category = currentCategories.find((item) => item.id === id);
  if (currentCategories.some((item) => item.parentId === id)) return window.alert('لا يمكن حذف قسم يحتوي أقساماً داخلية.');
  if (currentChannels.some((item) => item.categoryId === id)) return window.alert('لا يمكن حذف قسم يحتوي قنوات. احذف القنوات أولاً.');
  if (!window.confirm(`حذف «${category?.title || ''}»؟`)) return;
  try { await deleteDoc(doc(db, 'categories', id)); await loadCategories(); }
  catch (_) { window.alert('تعذر الحذف.'); }
}

backToRoot.addEventListener('click', () => {
  currentParentId = null;
  closeAllFormCards();
  renderCurrentCategoryView();
});

// ---- زر "+ إضافة" الموحّد: فتح/إغلاق القائمة واختيار نوع العنصر ----
addMenuToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  const willOpen = addMenu.classList.contains('hidden');
  addMenu.classList.toggle('hidden', !willOpen);
  addMenuToggle.setAttribute('aria-expanded', String(willOpen));
});
document.addEventListener('click', (event) => {
  if (addMenu.classList.contains('hidden')) return;
  if (event.target.closest('.add-menu-wrap')) return;
  addMenu.classList.add('hidden');
  addMenuToggle.setAttribute('aria-expanded', 'false');
});
addMenu.addEventListener('click', (event) => {
  const item = event.target.closest('[data-add-type]');
  if (!item || item.disabled) return;
  addMenu.classList.add('hidden');
  addMenuToggle.setAttribute('aria-expanded', 'false');
  const type = item.dataset.addType;
  if (type === 'category') openCategoryForm(null);
  else if (type === 'channel') openChannelForm(null);
  else if (type === 'marquee') openMarqueeForm();
});
categoryCloseButton.addEventListener('click', () => {
  categoryForm.reset();
  categoryEditId.value = '';
  closeAllFormCards();
});
marqueeCloseButton.addEventListener('click', () => {
  marqueeForm.reset();
  closeAllFormCards();
});
marqueeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (currentParentId === null) return;
  const text = marqueeText.value.trim();
  marqueeFormMessage.textContent = '';
  marqueeFormMessage.classList.remove('error');
  marqueeSaveButton.disabled = true;
  try {
    await updateDoc(doc(db, 'categories', currentParentId), { marqueeText: text || null });
    const parent = currentCategories.find((item) => item.id === currentParentId);
    if (parent) parent.marqueeText = text || null;
    marqueeFormMessage.textContent = text ? 'تم حفظ النص المتحرك ✓' : 'تم حذف النص المتحرك ✓';
    renderMarqueePreview();
    window.setTimeout(() => closeAllFormCards(), 700);
  } catch (_) {
    marqueeFormMessage.textContent = 'تعذر الحفظ. تحقق من قواعد Firestore.';
    marqueeFormMessage.classList.add('error');
  } finally {
    marqueeSaveButton.disabled = false;
  }
});

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = categoryForm.elements.title.value.trim();
  const iconUrl = categoryForm.elements.image.value.trim();
  if (!title) return;

  categoryFormMessage.textContent = '';
  categoryFormMessage.classList.remove('error');
  categorySaveButton.disabled = true;
  const isEdit = Boolean(categoryEditId.value);
  categorySaveButton.textContent = isEdit ? 'جارٍ الحفظ…' : 'جارٍ الإضافة…';
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'categories', categoryEditId.value), { title, iconUrl: iconUrl || null });
    } else {
      await addDoc(collection(db, 'categories'), {
        title,
        iconUrl: iconUrl || null,
        parentId: currentParentId,
        order: Date.now(),
        isPremium: false,
        createdAt: serverTimestamp(),
      });
    }
    categoryForm.reset();
    categoryEditId.value = '';
    closeAllFormCards();
    await loadCategories();
  } catch (error) {
    categoryFormMessage.textContent = isEdit
      ? 'تعذر حفظ التعديل. تأكد أنك دخلت بحساب المالك ثم أعد المحاولة.'
      : 'تعذر حفظ القسم. تأكد أنك دخلت بحساب المالك ثم أعد المحاولة.';
    categoryFormMessage.classList.add('error');
  } finally {
    categorySaveButton.disabled = false;
    categorySaveButton.textContent = isEdit ? 'حفظ التعديل' : 'إضافة القسم';
  }
});

function resetChannelForm() {
  channelForm.reset(); channelEditId.value = ''; channelFormTitle.textContent = 'إضافة قناة';
  channelSaveButton.textContent = 'إضافة القناة'; channelFormMessage.textContent = '';
}

channelForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentParentId || !channelTitle.value.trim()) return;
  const data = { categoryId: currentParentId, title: channelTitle.value.trim(), subtitle: channelSubtitle.value.trim(), status: channelStatus.value, logoUrl: channelLogo.value.trim() || null, playerChannelKey: channelPlayerKey.value.trim() || null, updatedAt: serverTimestamp() };
  channelSaveButton.disabled = true;
  try {
    if (channelEditId.value) await updateDoc(doc(db, 'channels', channelEditId.value), data);
    else await addDoc(collection(db, 'channels'), { ...data, viewCount: 0, createdAt: serverTimestamp() });
    resetChannelForm(); closeAllFormCards(); await loadChannels();
  } catch (_) { channelFormMessage.textContent = 'تعذر حفظ القناة. تحقق من قواعد Firestore.'; channelFormMessage.classList.add('error'); }
  finally { channelSaveButton.disabled = false; }
});
channelCloseButton.addEventListener('click', () => { resetChannelForm(); closeAllFormCards(); });
channelsList.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-channel]'); const remove = event.target.closest('[data-delete-channel]'); const saveSource = event.target.closest('[data-save-source]');
  if (edit) return openChannelForm(edit.dataset.editChannel);
  if (remove) { const channel = currentChannels.find((item) => item.id === remove.dataset.deleteChannel); if (!window.confirm(`حذف «${channel?.title || ''}»؟`)) return; try { await deleteDoc(doc(db, 'channels', remove.dataset.deleteChannel)); await loadChannels(); } catch (_) { window.alert('تعذر الحذف.'); } return; }
  if (saveSource) { await saveChannelSource(saveSource.dataset.saveSource); }
});

document.querySelector('#theme-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const message = document.querySelector('#theme-message');
  try { await setDoc(doc(db, 'settings', 'theme'), { primaryColor: document.querySelector('#primary-color').value, backgroundColor: document.querySelector('#background-color').value }, { merge: true }); message.textContent = 'تم حفظ الألوان، وستظهر في التطبيق.'; }
  catch (_) { message.textContent = 'تعذر حفظ الألوان. تحقق من قواعد Firestore.'; message.classList.add('error'); }
});

document.querySelector('#player-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#player-message');
  const scheme = document.querySelector('#player-scheme').value.trim().replaceAll('://', '');
  const androidPackage = document.querySelector('#player-package').value.trim();
  const storeUrl = document.querySelector('#player-store-url').value.trim();
  const minVersion = document.querySelector('#player-min-version').value.trim();
  const updateUrl = document.querySelector('#player-update-url').value.trim();
  const premiumEnabled = document.querySelector('#premium-enabled').checked;
  const premiumUrl = document.querySelector('#premium-url').value.trim();
  const premiumButtonText = document.querySelector('#premium-button-text').value.trim();
  try {
    await setDoc(doc(db, 'settings', 'player'), {
      deepLinkScheme: scheme,
      androidPackage,
      storeUrl,
      minVersion,
      updateUrl,
      premiumEnabled,
      premiumUrl,
      premiumButtonText,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    message.classList.remove('error');
    message.textContent = 'تم حفظ إعدادات المشغل.';
  } catch (_) {
    message.classList.add('error');
    message.textContent = 'تعذر حفظ إعدادات المشغل. تحقق من قواعد Firestore.';
  }
});
