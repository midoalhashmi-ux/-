import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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

const auth = getAuth(initializeApp(firebaseConfig));
const views = {
  loading: document.querySelector('#loading-view'),
  login: document.querySelector('#login-view'),
  dashboard: document.querySelector('#dashboard-view'),
};
const loginForm = document.querySelector('#login-form');
const loginButton = document.querySelector('#login-button');
const loginError = document.querySelector('#login-error');

function showView(name) {
  Object.entries(views).forEach(([key, element]) => element.classList.toggle('hidden', key !== name));
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.querySelector('#owner-email').textContent = user.email || 'المالك';
    showView('dashboard');
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
