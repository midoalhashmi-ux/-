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
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
let stopWatchingCategories = null;
let currentCategories = [];
let currentParentId = null;

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
}

function showCategories(categories) {
  currentCategories = categories;
  categoriesLoading.classList.add('hidden');
  categoriesError.classList.add('hidden');
  renderCurrentCategoryView();
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
    return `<article class="card category-card">${image}<div class="category-details"><h3>${title}</h3><p class="category-meta"><span>${childrenCount ? `${childrenCount} أقسام داخلية` : 'لا توجد أقسام داخلية'}</span>${category.isPremium ? '<span class="premium-tag">اشتراك</span>' : '<span>عام</span>'}</p><button class="open-category-button" type="button" data-open-category="${escapeHtml(id)}">فتح القسم</button></div></article>`;
  }).join('');
  categoriesList.classList.remove('hidden');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function watchCategories() {
  stopWatchingCategories?.();
  resetCategories();
  const categoriesQuery = query(collection(db, 'categories'), orderBy('order'));
  stopWatchingCategories = onSnapshot(categoriesQuery, (snapshot) => {
    showCategories(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  }, () => {
    categoriesLoading.classList.add('hidden');
    categoriesCount.textContent = 'تعذر التحميل';
    categoriesError.textContent = 'تعذر قراءة الأقسام. تأكد من قواعد Firestore، ثم أعد فتح الصفحة.';
    categoriesError.classList.remove('hidden');
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.querySelector('#owner-email').textContent = user.email || 'المالك';
    showView('dashboard');
    watchCategories();
    return;
  }
  stopWatchingCategories?.();
  stopWatchingCategories = null;
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

categoriesList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-category]');
  if (!button) return;
  currentParentId = button.dataset.openCategory;
  categoryFormMessage.textContent = '';
  renderCurrentCategoryView();
});

backToRoot.addEventListener('click', () => {
  currentParentId = null;
  categoryFormMessage.textContent = '';
  renderCurrentCategoryView();
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
  } catch (error) {
    categoryFormMessage.textContent = 'تعذر حفظ القسم. تأكد أنك دخلت بحساب المالك ثم أعد المحاولة.';
    categoryFormMessage.classList.add('error');
  } finally {
    categorySaveButton.disabled = false;
    categorySaveButton.textContent = 'إضافة القسم';
  }
});
