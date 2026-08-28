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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// عنوان Cloudflare Worker وسر المزامنة — نفس القيم المضبوطة عبر
// "wrangler secret put" لخدمة /refreshMatches. السر هنا يُرسل فقط من
// المتصفح (بعد تسجيل دخول المالك) إلى الـ Worker مباشرة، ولا يُخزَّن بقاعدة البيانات.
const WORKER_BASE_URL = 'https://binsheikh-api.binsheikh.workers.dev';
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
const categoryForm = document.querySelector('#category-form');
const categorySaveButton = document.querySelector('#category-save-button');
const categoryFormMessage = document.querySelector('#category-form-message');
const categoryParent = document.querySelector('#category-parent');
const categoriesTitle = document.querySelector('#categories-title');
const categoriesContext = document.querySelector('#categories-context');
const categoryFormTitle = document.querySelector('#category-form-title');
const backToRoot = document.querySelector('#back-to-root');
const retryCategories = document.querySelector('#retry-categories');
const navButtons = document.querySelectorAll('[data-panel]');
const addMenuButton = document.querySelector('#add-menu-button');
const addMenu = document.querySelector('#add-menu');
const addMenuCategoryLabel = document.querySelector('#add-menu-category-label');
const addMenuChannelItem = document.querySelector('[data-add-type="channel"]');
const categoryFormCard = document.querySelector('#category-form-card');
const categoryFormClose = document.querySelector('#category-form-close');
const channelFormCard = document.querySelector('#channel-form-card');
const channelFormClose = document.querySelector('#channel-form-close');
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
const channelCancelButton = document.querySelector('#channel-cancel-button');
const channelFormMessage = document.querySelector('#channel-form-message');
const channelsRootHint = document.querySelector('#channels-root-hint');
const channelsSection = document.querySelector('#channels-section');
const channelsTitle = document.querySelector('#channels-title');
const channelsList = document.querySelector('#channels-list');
const channelsLoading = document.querySelector('#channels-loading');
const channelsEmpty = document.querySelector('#channels-empty');
const channelsCount = document.querySelector('#channels-count');
const messagesLoading = document.querySelector('#messages-loading');
const messagesError = document.querySelector('#messages-error');
const messagesEmpty = document.querySelector('#messages-empty');
const messagesList = document.querySelector('#messages-list');
const messagesCount = document.querySelector('#messages-count');
const messagesBadge = document.querySelector('#messages-badge');
const syncMatchesButton = document.querySelector('#sync-matches-button');
const syncMatchesMessage = document.querySelector('#sync-matches-message');
let currentChannels = [];
let currentCategories = [];
let currentParentId = null;
let unsubscribeMessages = null;

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
  renderChannelsForCurrentCategory();
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
    ? 'اختر قسماً لعرض ما بداخله، أو أضف قسماً رئيسياً.'
    : `كل قسم تضيفه هنا يصبح فرعياً داخل «${parentTitle}».`;
  categoryFormTitle.textContent = isRoot ? 'إضافة قسم رئيسي' : `إضافة قسم داخل «${parentTitle}»`;
  addMenuCategoryLabel.textContent = isRoot ? 'قسم رئيسي' : 'قسم فرعي';
  categoryParent.value = currentParentId || '';
  backToRoot.classList.toggle('hidden', isRoot);
  categoriesCount.textContent = `${visibleCategories.length} قسم`;
  if (visibleCategories.length === 0) {
    categoriesEmpty.classList.remove('hidden');
    categoriesList.classList.add('hidden');
    return;
  }

  categoriesEmpty.classList.add('hidden');
  categoriesList.innerHTML = visibleCategories.map(({ id, ...category }) => {
    const title = escapeHtml(category.title || 'قسم بلا اسم');
    const image = category.iconUrl
      ? `<img class="category-image" src="${escapeHtml(category.iconUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'category-image-placeholder', textContent: '⚽'}))">`
      : '<div class="category-image-placeholder" aria-hidden="true">⚽</div>';
    const childrenCount = currentCategories.filter((item) => item.parentId === id).length;
    const channelsCountForCategory = currentChannels.filter((item) => item.categoryId === id).length;
    const summary = childrenCount
      ? `${childrenCount} أقسام داخلية`
      : (channelsCountForCategory ? `${channelsCountForCategory} قناة` : 'لا توجد قنوات بعد');
    return `<article class="card category-card">${image}<div class="category-details"><h3>${title}</h3><p class="category-meta"><span>${summary}</span>${category.isPremium ? '<span class="premium-tag">اشتراك</span>' : '<span>عام</span>'}</p><button class="open-category-button" type="button" data-open-category="${escapeHtml(id)}">فتح القسم</button><div class="category-tools"><button type="button" data-edit-category="${escapeHtml(id)}">تعديل</button><button class="delete-category-button" type="button" data-delete-category="${escapeHtml(id)}">حذف</button></div></div></article>`;
  }).join('');
  categoriesList.classList.remove('hidden');
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
  channelsLoading.classList.remove('hidden');
  channelsList.classList.add('hidden');
  channelsEmpty.classList.add('hidden');
  try {
    const snapshot = await Promise.race([
      getDocs(collection(db, 'channels')),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);
    currentChannels = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    channelsLoading.classList.add('hidden');
    renderCurrentCategoryView();
    renderChannelsForCurrentCategory();
  } catch (_) {
    channelsLoading.classList.add('hidden');
    channelsEmpty.classList.remove('hidden');
    channelsEmpty.innerHTML = '<h2>تعذر تحميل القنوات</h2><p>تأكد من إضافة صلاحية channels في قواعد Firestore أدناه.</p>';
  }
}

function renderChannelsForCurrentCategory() {
  const isRoot = currentParentId === null;
  channelsRootHint.classList.toggle('hidden', !isRoot);
  channelsSection.classList.toggle('hidden', isRoot);
  channelCategory.value = currentParentId || '';
  addMenuChannelItem.disabled = isRoot;
  addMenuChannelItem.title = isRoot ? 'افتح قسماً أولاً لإضافة قناة إليه' : '';
  if (isRoot) return;

  const category = currentCategories.find((item) => item.id === currentParentId);
  channelsTitle.textContent = category?.title ? `قنوات قسم: ${category.title}` : 'قنوات القسم';

  const channelsInCategory = currentChannels.filter((channel) => channel.categoryId === currentParentId);
  channelsCount.textContent = `${channelsInCategory.length} قناة`;
  channelsLoading.classList.add('hidden');

  if (!channelsInCategory.length) {
    channelsEmpty.classList.remove('hidden');
    channelsList.classList.add('hidden');
    return;
  }

  channelsEmpty.classList.add('hidden');
  channelsList.innerHTML = channelsInCategory.map((channel) => {
    const logo = channel.logoUrl ? `<img class="channel-logo" src="${escapeHtml(channel.logoUrl)}" alt="">` : '<div class="channel-logo category-image-placeholder">⚽</div>';
    return `<article class="card channel-item">${logo}<div class="channel-info"><h3>${escapeHtml(channel.title || 'قناة بلا اسم')}</h3><p>${escapeHtml(channel.subtitle || 'بدون وصف')}</p><div class="channel-source"><label class="protect-toggle"><input type="checkbox" data-protected-toggle="${escapeHtml(channel.id)}" ${channel.protected === false ? '' : 'checked'}> حماية برابط مؤقت</label><input type="text" class="source-input" data-source-input="${escapeHtml(channel.id)}" placeholder="الصق رابط m3u8 هنا"><button type="button" data-save-source="${escapeHtml(channel.id)}">حفظ المصدر</button><span class="source-status" data-source-status="${escapeHtml(channel.id)}"></span></div></div><div class="channel-actions"><button type="button" data-edit-channel="${escapeHtml(channel.id)}">تعديل</button><button class="delete-category-button" type="button" data-delete-channel="${escapeHtml(channel.id)}">حذف</button></div></article>`;
  }).join('');
  channelsList.classList.remove('hidden');
  loadChannelSources(channelsInCategory);
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

// رسائل "تواصل معنا" و"الإبلاغ عن رابط معطوب" — استماع لحظي حتى تظهر
// الرسائل الجديدة فور وصولها دون الحاجة لإعادة تحميل الصفحة.
function watchMessages() {
  if (unsubscribeMessages) return;
  messagesLoading.classList.remove('hidden');
  messagesError.classList.add('hidden');
  const messagesQuery = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'));
  unsubscribeMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      renderMessages(messages);
    },
    () => {
      messagesLoading.classList.add('hidden');
      messagesCount.textContent = 'تعذر التحميل';
      messagesError.textContent = 'تعذر الاتصال بمجموعة الرسائل. تأكد من نشر قواعد Firestore الجديدة (contactMessages) ثم أعد تسجيل الدخول.';
      messagesError.classList.remove('hidden');
    },
  );
}

function formatMessageDate(timestamp) {
  if (!timestamp?.toDate) return '';
  return timestamp.toDate().toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderMessages(messages) {
  messagesLoading.classList.add('hidden');
  messagesError.classList.add('hidden');
  const newCount = messages.filter((item) => item.status !== 'read').length;
  messagesCount.textContent = `${messages.length} رسالة${newCount ? ` (${newCount} جديدة)` : ''}`;
  if (newCount) {
    messagesBadge.textContent = String(newCount);
    messagesBadge.classList.remove('hidden');
  } else {
    messagesBadge.classList.add('hidden');
  }
  if (!messages.length) {
    messagesEmpty.classList.remove('hidden');
    messagesList.classList.add('hidden');
    return;
  }
  messagesEmpty.classList.add('hidden');
  messagesList.innerHTML = messages.map((item) => {
    const isRead = item.status === 'read';
    const typeLabel = item.type === 'broken_link' ? '🔗 رابط معطوب' : '💬 استفسار عام';
    const channelInfo = item.channelInfo ? `<p><strong>القناة/القسم:</strong> ${escapeHtml(item.channelInfo)}</p>` : '';
    return `<article class="card channel-item message-item">
      <div class="channel-info">
        <h3>${typeLabel} ${isRead ? '' : '<span class="premium-tag">جديدة</span>'}</h3>
        ${channelInfo}
        <p>${escapeHtml(item.message || '')}</p>
        <p class="muted" style="font-size:.78rem;margin-top:6px;">${formatMessageDate(item.createdAt)}</p>
      </div>
      <div class="channel-actions">
        <button type="button" data-toggle-read="${escapeHtml(item.id)}">${isRead ? 'إعادة لغير مقروءة' : 'تعليم كمقروءة'}</button>
        <button class="delete-category-button" type="button" data-delete-message="${escapeHtml(item.id)}">حذف</button>
      </div>
    </article>`;
  }).join('');
  messagesList.classList.remove('hidden');
}

messagesList.addEventListener('click', async (event) => {
  const toggle = event.target.closest('[data-toggle-read]');
  const remove = event.target.closest('[data-delete-message]');
  if (toggle) {
    const id = toggle.dataset.toggleRead;
    const currentlyRead = toggle.textContent.includes('غير مقروءة');
    try { await updateDoc(doc(db, 'contactMessages', id), { status: currentlyRead ? 'new' : 'read' }); }
    catch (_) { window.alert('تعذر تحديث حالة الرسالة.'); }
    return;
  }
  if (remove) {
    if (!window.confirm('حذف هذه الرسالة نهائياً؟')) return;
    try { await deleteDoc(doc(db, 'contactMessages', remove.dataset.deleteMessage)); }
    catch (_) { window.alert('تعذر حذف الرسالة.'); }
  }
});

async function loadPlayerSettings() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'player'));
    const data = snapshot.data();
    if (!data) return;
    document.querySelector('#player-scheme').value = data.deepLinkScheme || 'sportsplayer';
    document.querySelector('#player-store-url').value = data.storeUrl || '';
  } catch (_) {
    // إعدادات المشغل اختيارية إلى أن ينشر تطبيق المشغل في Google Play.
  }
}

// الشروط وسياسة الخصوصية — تُقرأ وتُعدّل من settings/legal، ويقرأها تطبيق
// المحتوى مباشرة عبر legal_service.dart بدون تحديث التطبيق.
async function loadLegalSettings() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'legal'));
    const data = snapshot.data();
    if (!data) return;
    document.querySelector('#legal-terms').value = data.terms || '';
    document.querySelector('#legal-privacy').value = data.privacy || '';
  } catch (_) {
    // النصوص اختيارية إلى أن يضيفها المالك أول مرة.
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.querySelector('#owner-email').textContent = user.email || 'المالك';
    showView('dashboard');
    loadCategories();
    loadChannels();
    loadPlayerSettings();
    loadLegalSettings();
    watchMessages();
    return;
  }
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
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

function closeAddMenu() {
  addMenu.classList.add('hidden');
  addMenuButton.setAttribute('aria-expanded', 'false');
}

addMenuButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const willOpen = addMenu.classList.contains('hidden');
  closeAddMenu();
  if (willOpen) {
    addMenu.classList.remove('hidden');
    addMenuButton.setAttribute('aria-expanded', 'true');
  }
});

document.addEventListener('click', (event) => {
  if (!addMenu.classList.contains('hidden') && !event.target.closest('.add-menu-wrap')) closeAddMenu();
});

addMenu.addEventListener('click', (event) => {
  const item = event.target.closest('[data-add-type]');
  if (!item || item.disabled) return;
  closeAddMenu();
  if (item.dataset.addType === 'category') {
    channelFormCard.classList.add('hidden');
    categoryFormCard.classList.remove('hidden');
    categoryFormCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector('#category-title').focus();
  } else if (item.dataset.addType === 'channel') {
    categoryFormCard.classList.add('hidden');
    channelFormCard.classList.remove('hidden');
    channelFormCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    channelTitle.focus();
  }
});

categoryFormClose.addEventListener('click', () => categoryFormCard.classList.add('hidden'));
channelFormClose.addEventListener('click', () => { channelFormCard.classList.add('hidden'); resetChannelForm(); });

categoriesList.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-category]');
  const remove = event.target.closest('[data-delete-category]');
  if (edit) return editCategory(edit.dataset.editCategory);
  if (remove) return deleteCategory(remove.dataset.deleteCategory);
  const button = event.target.closest('[data-open-category]');
  if (!button) return;
  currentParentId = button.dataset.openCategory;
  categoryFormMessage.textContent = '';
  categoryFormCard.classList.add('hidden');
  channelFormCard.classList.add('hidden');
  resetChannelForm();
  renderCurrentCategoryView();
  renderChannelsForCurrentCategory();
});

async function editCategory(id) {
  const category = currentCategories.find((item) => item.id === id);
  const title = window.prompt('الاسم الجديد:', category?.title || '');
  if (!title?.trim()) return;
  try { await updateDoc(doc(db, 'categories', id), { title: title.trim() }); await loadCategories(); }
  catch (_) { window.alert('تعذر التعديل.'); }
}

async function deleteCategory(id) {
  const category = currentCategories.find((item) => item.id === id);
  if (currentCategories.some((item) => item.parentId === id)) return window.alert('لا يمكن حذف قسم يحتوي أقساماً داخلية.');
  if (currentChannels.some((item) => item.categoryId === id)) return window.alert('لا يمكن حذف قسم يحتوي قنوات. احذف قنواته أولاً.');
  if (!window.confirm(`حذف «${category?.title || ''}»؟`)) return;
  try { await deleteDoc(doc(db, 'categories', id)); await loadCategories(); }
  catch (_) { window.alert('تعذر الحذف.'); }
}

backToRoot.addEventListener('click', () => {
  currentParentId = null;
  categoryFormMessage.textContent = '';
  categoryFormCard.classList.add('hidden');
  channelFormCard.classList.add('hidden');
  resetChannelForm();
  renderCurrentCategoryView();
  renderChannelsForCurrentCategory();
});

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = categoryForm.elements.title.value.trim();
  const iconUrl = categoryForm.elements.image.value.trim();
  const parentId = currentParentId;
  if (!title) return;

  categoryFormMessage.textContent = '';
  categoryFormMessage.classList.remove('error');
  categorySaveButton.disabled = true;
  categorySaveButton.textContent = 'جارٍ الإضافة…';
  try {
    await addDoc(collection(db, 'categories'), {
      title,
      iconUrl: iconUrl || null,
      parentId,
      order: Date.now(),
      isPremium: false,
      createdAt: serverTimestamp(),
    });
    categoryForm.reset();
    categoryParent.value = currentParentId || '';
    categoryFormMessage.textContent = 'تمت إضافة القسم. سيظهر فوراً في قائمة الأقسام والتطبيق.';
    await loadCategories();
  } catch (error) {
    categoryFormMessage.textContent = 'تعذر حفظ القسم. تأكد أنك دخلت بحساب المالك ثم أعد المحاولة.';
    categoryFormMessage.classList.add('error');
  } finally {
    categorySaveButton.disabled = false;
    categorySaveButton.textContent = 'إضافة القسم';
  }
});

function resetChannelForm() {
  channelForm.reset(); channelEditId.value = ''; channelCategory.value = currentParentId || ''; channelFormTitle.textContent = 'إضافة قناة';
  channelSaveButton.textContent = 'إضافة القناة'; channelCancelButton.classList.add('hidden'); channelFormMessage.textContent = '';
}

channelForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentParentId || !channelTitle.value.trim()) return;
  const data = { categoryId: currentParentId, title: channelTitle.value.trim(), subtitle: channelSubtitle.value.trim(), status: channelStatus.value, logoUrl: channelLogo.value.trim() || null, playerChannelKey: channelPlayerKey.value.trim() || null, updatedAt: serverTimestamp() };
  channelSaveButton.disabled = true;
  try {
    if (channelEditId.value) await updateDoc(doc(db, 'channels', channelEditId.value), data);
    else await addDoc(collection(db, 'channels'), { ...data, viewCount: 0, createdAt: serverTimestamp() });
    resetChannelForm(); await loadChannels();
  } catch (_) { channelFormMessage.textContent = 'تعذر حفظ القناة. تحقق من قواعد Firestore.'; channelFormMessage.classList.add('error'); }
  finally { channelSaveButton.disabled = false; }
});
channelCancelButton.addEventListener('click', resetChannelForm);
channelsList.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-channel]'); const remove = event.target.closest('[data-delete-channel]'); const saveSource = event.target.closest('[data-save-source]');
  if (edit) {
    const channel = currentChannels.find((item) => item.id === edit.dataset.editChannel);
    if (!channel) return;
    categoryFormCard.classList.add('hidden');
    channelFormCard.classList.remove('hidden');
    channelEditId.value = channel.id; channelCategory.value = channel.categoryId || ''; channelTitle.value = channel.title || ''; channelSubtitle.value = channel.subtitle || ''; channelStatus.value = channel.status || 'upcoming'; channelLogo.value = channel.logoUrl || ''; channelPlayerKey.value = channel.playerChannelKey || ''; channelFormTitle.textContent = `تعديل: ${channel.title}`; channelSaveButton.textContent = 'حفظ التعديل'; channelCancelButton.classList.remove('hidden');
    channelFormCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
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
  const storeUrl = document.querySelector('#player-store-url').value.trim();
  try {
    await setDoc(doc(db, 'settings', 'player'), {
      deepLinkScheme: scheme,
      storeUrl,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    message.classList.remove('error');
    message.textContent = 'تم حفظ إعدادات المشغل.';
  } catch (_) {
    message.classList.add('error');
    message.textContent = 'تعذر حفظ إعدادات المشغل. تحقق من قواعد Firestore.';
  }
});

// زر "مزامنة الآن" — يستدعي /refreshMatches على Cloudflare Worker مباشرة
// من المتصفح، مع هيدر x-admin-key، ويعرض عدد المباريات المُحدَّثة أو رسالة الخطأ.
syncMatchesButton?.addEventListener('click', async () => {
  syncMatchesButton.disabled = true;
  syncMatchesButton.textContent = 'جارٍ المزامنة…';
  syncMatchesMessage.classList.remove('error');
  syncMatchesMessage.textContent = '';
  try {
    const response = await fetch(`${WORKER_BASE_URL}/refreshMatches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_SYNC_SECRET,
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || `فشل الطلب (${response.status})`);
    }
    syncMatchesMessage.textContent = `تم التحديث ✓ عدد المباريات: ${data.count} (${data.date})`;
  } catch (error) {
    syncMatchesMessage.classList.add('error');
    syncMatchesMessage.textContent = `تعذرت المزامنة: ${error.message || error}`;
  } finally {
    syncMatchesButton.disabled = false;
    syncMatchesButton.textContent = 'مزامنة الآن';
  }
});

document.querySelector('#legal-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#legal-message');
  const terms = document.querySelector('#legal-terms').value.trim();
  const privacy = document.querySelector('#legal-privacy').value.trim();
  message.classList.remove('error');
  try {
    await setDoc(doc(db, 'settings', 'legal'), {
      terms,
      privacy,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    message.textContent = 'تم حفظ النصوص، وستظهر في التطبيق فوراً.';
  } catch (_) {
    message.classList.add('error');
    message.textContent = 'تعذر حفظ النصوص. تحقق من قواعد Firestore.';
  }
});
