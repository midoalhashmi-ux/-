import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
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
let stopWatchingCategories = null;

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
    return `<article class="card category-card">${image}<div class="category-details"><h3>${title}</h3><p class="category-meta"><span>الترتيب: ${order}</span>${category.isPremium ? '<span class="premium-tag">اشتراك</span>' : '<span>عام</span>'}</p></div></article>`;
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
