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
let stopWatchingCategories = null;
let currentCategories = [];

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
  updateParentOptions();
  categoriesLoading.classList.add('hidden');
  categoriesError.classList.add('hidden');
  categoriesCount.textContent = `${categories.length} قسم`;
  if (categories.length === 0) {
    categoriesEmpty.classList.remove('hidden');
    categoriesList.classList.add('hidden');
    return;
  }

  categoriesEmpty.classList.add('hidden');
  categoriesList.innerHTML = categories.map(({ id, ...category }) => {
    const title = escapeHtml(category.title || 'قسم بلا اسم');
    const order = Number.isFinite(category.order) ? category.order : 0;
    const image = category.iconUrl
      ? `<img class="category-image" src="${escapeHtml(category.iconUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'category-image-placeholder', textContent: '⚽'}))">`
      : '<div class="category-image-placeholder" aria-hidden="true">⚽</div>';
    const parent = categories.find((item) => item.id === category.parentId);
    const location = parent ? `داخل: ${escapeHtml(parent.title || 'قسم')}` : 'قسم رئيسي';
    return `<article class="card category-card">${image}<div class="category-details"><h3>${title}</h3><p class="category-meta"><span>${location}</span>${category.isPremium ? '<span class="premium-tag">اشتراك</span>' : '<span>عام</span>'}</p></div></article>`;
  }).join('');
  categoriesList.classList.remove('hidden');
}

function updateParentOptions() {
  const selectedId = categoryParent.value;
  categoryParent.innerHTML = '<option value="">قسم رئيسي</option>' + currentCategories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.title || 'قسم بلا اسم')}</option>`)
    .join('');
  categoryParent.value = currentCategories.some((category) => category.id === selectedId)
    ? selectedId
    : '';
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

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = categoryForm.elements.title.value.trim();
  const iconUrl = categoryForm.elements.image.value.trim();
  const parentId = categoryForm.elements.parentId.value || null;
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
    categoryFormMessage.textContent = 'تمت إضافة القسم. سيظهر فوراً في قائمة الأقسام والتطبيق.';
  } catch (error) {
    categoryFormMessage.textContent = 'تعذر حفظ القسم. تأكد أنك دخلت بحساب المالك ثم أعد المحاولة.';
    categoryFormMessage.classList.add('error');
  } finally {
    categorySaveButton.disabled = false;
    categorySaveButton.textContent = 'إضافة القسم';
  }
});
