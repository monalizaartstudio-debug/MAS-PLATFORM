import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection, query, where, getDocs, deleteDoc, deleteField, addDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getStorage, ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCTCLcb1OfLABd7ZG6l917wKlp1rJJ0NOM",
  authDomain: "monaliza-studio.firebaseapp.com",
  projectId: "monaliza-studio",
  storageBucket: "monaliza-studio.firebasestorage.app",
  messagingSenderId: "779601471198",
  appId: "1:779601471198:web:3f1bfd4a9576ee7e7b044f",
  measurementId: "G-QD8BX8LQW1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence).catch(err => console.error("Persistence configuration failed:", err));
const storage = getStorage(app);

// Native SHA-256 Hashing helper
async function hashSHA256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Constants ---
const IMGBB_API_KEY = "b4299f4ab9a1625f703bb1fe459b650c";
const DEFAULT_COURSE_ID = "course_01";
const DEFAULT_COURSE_NAME = "كورس قدرات الفنون";
const COURSE_PRICE = 500;
const STUDENT_AUTH_DOMAIN = "students.monaliza.local";
const SUBSCRIPTION_WHATSAPP_NUMBER = "201098310340";

// --- Global State ---
let currentUser = null; // { uid, phone, role, name, courses, avatarUrl }
let watermarkInterval = null;
let sessionListenerUnsubscribe = null;
let studentAuthInProgress = false;
const SESSION_ID_KEY = 'user_session_id';
let isAuthResolved = false;

// ==========================================
// --- DOM ELEMENTS CACHE (Performance Optimized) ---
// ==========================================
const loader = document.getElementById('global-loader');
const views = document.querySelectorAll('.view');
const modalLogout = document.getElementById('logout-modal');
const btnThemeToggle = document.getElementById('btn-theme-toggle');

// Student Auth
const btnShowLogin = document.getElementById('btn-show-login');
const btnShowRegister = document.getElementById('btn-show-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const authToggleSlider = document.querySelector('.auth-toggle-slider');

// Student Auth Inputs
const inputLoginPhone = document.getElementById('login-phone');
const inputLoginPassword = document.getElementById('login-password');
const inputRegName = document.getElementById('reg-name');
const inputRegPhone = document.getElementById('reg-phone');
const inputRegPassword = document.getElementById('reg-password');
const inputRegConfirmPassword = document.getElementById('reg-confirm-password');

// Navigation Tabs
const studentTabViews = document.querySelectorAll('.student-tab-view');
const sidebarTabBtns = document.querySelectorAll('.sidebar-tab-btn');
const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
const navCards = document.querySelectorAll('.nav-grid .nav-card');

// Header elements
const btnNotifications = document.getElementById('btn-notifications');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationBadge = document.getElementById('noti-badge');
const notificationsContainer = document.getElementById('notifications-items-container');

// Course Action Buttons
const btnSubscribe = document.getElementById('btn-subscribe');
const btnWatchCourse = document.getElementById('btn-watch-course');
const sessionKickoutModal = document.getElementById('session-kickout-modal');

// Profile Tab Elements
const formStudentProfile = document.getElementById('form-student-profile');
const profileAvatarFile = document.getElementById('profile-avatar-file');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');
const userAvatarDisplay = document.getElementById('user-avatar-display');
const profileNameInput = document.getElementById('profile-name');
const profilePhoneInput = document.getElementById('profile-phone');
const profilePasswordInput = document.getElementById('profile-password');
const inputAdminPhone = document.getElementById('admin-login-phone');
 const inputAdminPassword = document.getElementById('admin-login-password');
const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');

// Video Player Elements are managed dynamically inside functions.
// Admin Elements
const formAdminLogin = document.getElementById('form-admin-login');
const btnAdminBackSite = document.getElementById('btn-admin-back-site');
const adminOrdersGrid = document.getElementById('admin-orders-grid');
const formAdminSettings = document.getElementById('form-admin-settings');
const adminNavBtns = document.querySelectorAll('.admin-nav-btn');
const adminTabViews = document.querySelectorAll('.admin-tab-view');
const btnAdminMenuToggle = document.getElementById('btn-admin-menu-toggle');
const adminSidebar = document.querySelector('.admin-sidebar');

// Admin Auth Cache
const btnToggleAdminLoginMode = document.getElementById('btn-toggle-admin-login-mode');
const adminPasswordLoginFields = document.getElementById('admin-password-login-fields');
const btnAdminSubmitLogin = document.getElementById('btn-admin-submit-login');

// Course Provisioning elements
const provisioningUsersList = document.getElementById('provisioning-users-list');
const provisioningSearchInput = document.getElementById('admin-student-search-input');
const provisioningModal = document.getElementById('provisioning-modal');
const btnCloseProvisioning = document.getElementById('btn-close-provisioning');
const btnUpdateProvisioning = document.getElementById('btn-update-provisioning');
const provisioningStudentName = document.getElementById('provisioning-student-name');
const provisioningStudentPhone = document.getElementById('provisioning-student-phone');
const toggleCourseFunoon = document.getElementById('toggle-course-funoon');
const toggleCourseOmara = document.getElementById('toggle-course-omara');

// Stats Elements
const statTotalStudents = document.getElementById('stat-total-students');
const statPendingOrders = document.getElementById('stat-pending-orders');
const statActiveCourses = document.getElementById('stat-active-courses');
const statCompletedSales = document.getElementById('stat-completed-sales');
const adminOrdersBadge = document.getElementById('admin-orders-badge');

// Logout Modal Buttons
const btnCancelLogout = document.getElementById('btn-cancel-logout');
const btnConfirmLogout = document.getElementById('btn-confirm-logout');

// --- Admin Setup Global Variables ---
let adminRealtimeStatsUnsubscribe = null;
let currentProvisioningStudentPhone = null;

// ==========================================
// 1. GLOBAL UX PROGRESS LOADING BAR + FULL-SCREEN LOADER
// ==========================================


function startLoader() {
    loader.classList.add('active');
    loader.style.width = '75%';
}

function finishLoader() {
    loader.style.width = '100%';
    setTimeout(() => {
        loader.classList.remove('active');
    }, 300);
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconHtml = '<i class="fa-solid fa-circle-info toast-icon"></i>';
    if (type === 'success') {
        iconHtml = '<i class="fa-solid fa-circle-check toast-icon"></i>';
    } else if (type === 'error') {
        iconHtml = '<i class="fa-solid fa-triangle-exclamation toast-icon"></i>';
    }

    toast.innerHTML = `
        <div class="toast-content">
            ${iconHtml}
            <span>${message}</span>
        </div>
        <button type="button" class="toast-close-btn" aria-label="إغلاق">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });
    }

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Redirect all window alerts to our custom toast
window.alert = function(message) {
    const isError = message.includes('فشل') || message.includes('خطأ') || message.includes('خاطئ') || message.includes('غير صحيح') || message.includes('لم يتم');
    showToast(message, isError ? 'error' : 'success');
};

function generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function saveLocalSessionId(sessionId) {
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
}

function getLocalSessionId() {
    return sessionStorage.getItem(SESSION_ID_KEY);
}

function getActiveAccountName() {
    return currentUser && currentUser.name ? currentUser.name : 'طالب موناليزا';
}

function updateWelcomeNotification() {
    if (!notificationsContainer) return;

    notificationsContainer.innerHTML = '';
    const welcomeItem = document.createElement('div');
    welcomeItem.className = 'dropdown-item active';
    welcomeItem.textContent = `مرحبا بك يا ${getActiveAccountName()} 👋`;
    notificationsContainer.appendChild(welcomeItem);

    if (notificationBadge) {
        notificationBadge.innerText = '1';
        notificationBadge.classList.remove('fade-out');
        notificationBadge.style.opacity = '1';
        notificationBadge.style.transform = 'scale(1)';
    }
}

function clearSessionLocalData() {
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem('monaliza_user');
}

function detachSessionListener() {
    if (typeof sessionListenerUnsubscribe === 'function') {
        sessionListenerUnsubscribe();
        sessionListenerUnsubscribe = null;
    }
}

function normalizePhoneNumber(phone = '') {
    return String(phone).replace(/\D+/g, '');
}

function getStudentAuthEmail(phone = '') {
    return `${normalizePhoneNumber(phone)}@${STUDENT_AUTH_DOMAIN}`;
}

function getCurrentStudentDocId() {
    return currentUser?.uid || currentUser?.phone || '';
}

function buildStudentSession(userDocId, data = {}) {
    return {
        uid: userDocId,
        phone: data.phone || userDocId,
        role: 'student',
        name: data.name || '',
        courses: data.courses || [],
        avatarUrl: data.avatarUrl || ''
    };
}

async function loadStudentDataByUid(uid) {
    if (!uid) return null;
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || userSnap.data().role !== 'student') return null;
    return { ref: userRef, data: userSnap.data() };
}

function logoutForSessionConflict() {
    if (sessionKickoutModal) {
        sessionKickoutModal.classList.remove('hidden');
    }
    detachSessionListener();
    clearSessionLocalData();
    currentUser = null;

    setTimeout(() => {
        if (sessionKickoutModal) {
            sessionKickoutModal.classList.add('hidden');
        }
        window.location.hash = '#/login';
    }, 3000);
}

async function attachSessionWatcher(userDocId) {
    detachSessionListener();
    if (!userDocId) return;

    const userDocRef = doc(db, 'users', userDocId);
    sessionListenerUnsubscribe = onSnapshot(userDocRef, (snapshot) => {
        if (!snapshot.exists()) {
            logoutForSessionConflict();
            return;
        }

        const data = snapshot.data();

        const remoteSessionId = data?.currentSessionId || null;
        const localSessionId = getLocalSessionId();

        if (!localSessionId || !remoteSessionId || localSessionId !== remoteSessionId) {
            logoutForSessionConflict();
            return;
        }

        const updatedName = data?.name || currentUser?.name || '';
        const updatedAvatar = data?.avatarUrl || currentUser?.avatarUrl || '';
        const updatedCourses = data?.courses || currentUser?.courses || [];
        const updatedPhone = data?.phone || currentUser?.phone || userDocId;
        let profileChanged = false;

        if (!currentUser) {
            currentUser = { uid: userDocId, phone: updatedPhone, role: 'student', name: updatedName, avatarUrl: updatedAvatar, courses: updatedCourses };
            profileChanged = true;
        } else {
            if (currentUser.uid !== userDocId) { currentUser.uid = userDocId; profileChanged = true; }
            if (currentUser.phone !== updatedPhone) { currentUser.phone = updatedPhone; profileChanged = true; }
            if (currentUser.name !== updatedName) { currentUser.name = updatedName; profileChanged = true; }
            if (currentUser.avatarUrl !== updatedAvatar) { currentUser.avatarUrl = updatedAvatar; profileChanged = true; }
            if (JSON.stringify(currentUser.courses) !== JSON.stringify(updatedCourses)) { currentUser.courses = updatedCourses; profileChanged = true; }
        }

        if (profileChanged) {
            sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));
            updateStudentSidebarUI();
            updateWelcomeNotification();
        }
    }, (error) => {
        console.error('Session watcher failed:', error);
    });
}

function setActiveSessionForUser(userRef, sessionId) {
    return updateDoc(userRef, { currentSessionId: sessionId });
}

// ==========================================

// ==========================================
// FIREBASE ERROR TRANSLATOR
// ==========================================
function getFirebaseErrorMessage(err) {
    const code = err?.code || '';
    const map = {
        'auth/too-many-requests':     'تم حجب الحساب مؤقتاً بسبب كثرة المحاولات الفاشلة. انتظر بضع دقائق ثم حاول مجدداً، أو أعد تعيين كلمة المرور.',
        'auth/wrong-password':        'كلمة المرور غير صحيحة. تأكد منها وحاول مرة أخرى.',
        'auth/invalid-credential':    'رقم الهاتف أو كلمة المرور غير صحيحة.',
        'auth/user-not-found':        'لا يوجد حساب مسجل بهذا الرقم. تحقق من الرقم أو أنشئ حساباً جديداً.',
        'auth/user-disabled':         'تم تعطيل هذا الحساب. تواصل مع الإدارة.',
        'auth/invalid-email':         'البريد الإلكتروني غير صالح.',
        'auth/email-already-in-use':  'رقم الهاتف هذا مسجل مسبقاً. جرب تسجيل الدخول بدلاً من إنشاء حساب.',
        'auth/weak-password':         'كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل.',
        'auth/network-request-failed':'فشل الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.',
        'auth/popup-closed-by-user':  'تم إغلاق نافذة تسجيل الدخول.',
        'auth/requires-recent-login': 'تحتاج إلى تسجيل الدخول مجدداً لإتمام هذه العملية.',
        'auth/operation-not-allowed': 'هذه الطريقة غير مفعّلة. تواصل مع الإدارة.',
    };
    return map[code] || 'حدث خطأ غير متوقع. تحقق من اتصالك بالإنترنت وحاول مجدداً.';
}

async function withLoading(asyncFn) {
    startLoader();
    try {
        const result = await asyncFn();
        return result;
    } finally {
        finishLoader();
    }
}

// ==========================================
// 2. THEME CONTROLLER (LIGHT/DARK SWITCHER)
// ==========================================
function updateLogosForTheme(theme) {
    const themeLogos = document.querySelectorAll('.theme-logo');
    themeLogos.forEach(logo => {
        if (theme === 'dark') {
            const darkSrc = logo.getAttribute('data-src-dark');
            if (darkSrc) logo.src = darkSrc;
        } else {
            const lightSrc = logo.getAttribute('data-src-light');
            if (lightSrc) logo.src = lightSrc;
        }
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('monaliza_theme') || 'light';
    const isDark = savedTheme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);
    const icon = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    if (btnThemeToggle) btnThemeToggle.innerHTML = icon;
    // Admin theme buttons
    const btnAdminTheme = document.getElementById('btn-admin-theme-toggle');
    const btnAdminThemeMobile = document.getElementById('btn-admin-theme-toggle-mobile');
    if (btnAdminTheme) btnAdminTheme.innerHTML = icon;
    if (btnAdminThemeMobile) btnAdminThemeMobile.innerHTML = icon;
    updateLogosForTheme(savedTheme);
}

function applyThemeToggle() {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('monaliza_theme', 'light');
        const icon = '<i class="fa-solid fa-moon"></i>';
        if (btnThemeToggle) btnThemeToggle.innerHTML = icon;
        const btnAdminTheme = document.getElementById('btn-admin-theme-toggle');
        const btnAdminThemeMobile = document.getElementById('btn-admin-theme-toggle-mobile');
        if (btnAdminTheme) btnAdminTheme.innerHTML = icon;
        if (btnAdminThemeMobile) btnAdminThemeMobile.innerHTML = icon;
        updateLogosForTheme('light');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('monaliza_theme', 'dark');
        const icon = '<i class="fa-solid fa-sun"></i>';
        if (btnThemeToggle) btnThemeToggle.innerHTML = icon;
        const btnAdminTheme = document.getElementById('btn-admin-theme-toggle');
        const btnAdminThemeMobile = document.getElementById('btn-admin-theme-toggle-mobile');
        if (btnAdminTheme) btnAdminTheme.innerHTML = icon;
        if (btnAdminThemeMobile) btnAdminThemeMobile.innerHTML = icon;
        updateLogosForTheme('dark');
    }
}

if (btnThemeToggle) btnThemeToggle.addEventListener('click', applyThemeToggle);

// Admin theme toggle buttons
document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-admin-theme-toggle') || e.target.closest('#btn-admin-theme-toggle-mobile')) {
        applyThemeToggle();
    }
});

attachInputSanitizers();
attachPasswordToggleButtons();

// ==========================================
// 3. ROUTING & TAB NAVIGATION CONTROLLER
// ==========================================
function showView(viewId) {
    views.forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.remove('hidden');

    if (viewId !== 'view-video') {
        stopWatermark();
    }

    // Footer: only visible on hub view (tab-home will further control)
    updateFooterVisibility(viewId === 'view-hub' ? null : 'hide');
}

// Show footer ONLY on the main home tab
function updateFooterVisibility(override) {
    const footer = document.getElementById('global-footer');
    if (!footer) return;
    if (override === 'hide') {
        footer.style.display = 'none';
        return;
    }
    // Check if tab-home is active
    const homeTab = document.getElementById('tab-home');
    const isHomeActive = homeTab && !homeTab.classList.contains('hidden');
    footer.style.display = isHomeActive ? 'block' : 'none';
}

function switchStudentTab(tabId) {
    studentTabViews.forEach(v => {
        if (v.id === tabId) {
            v.classList.remove('hidden');
        } else {
            v.classList.add('hidden');
        }
    });

    // Update Sidebar state
    sidebarTabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update Bottom Nav state
    bottomNavItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Footer: only visible on home tab
    updateFooterVisibility(null);

    if (tabId === 'tab-profile') {
        loadStudentProfileForm();
    } else if (tabId === 'tab-my-courses') {
        renderMyCourses();
    } else if (tabId === 'tab-store') {
        initStoreTab();
    }
}

// --- Store Multi-language (i18n) Data & Logic ---
const STORE_TRANSLATIONS = {
    ar: {
        lang_btn: 'EN',
        store_badge: '<i class="fa-solid fa-wand-magic-sparkles"></i> متجر المنتجات الفنية والهاند ميد',
        hero_badge: 'منتجات هاند ميد وإبداعات حصرية',
        hero_title: 'متجر موناليزا للأعمال الفنية والهاند ميد',
        hero_desc: 'منتجات فنية هاند ميد، لوح مصممة، أطباق فنية، ومطبوعات مخصصة بكل حب وإتقان لتضفي لمسة جمالية فريدة ومميزة لمساحتك الخاصة.',
        categories_heading: '<i class="fa-solid fa-layer-group"></i> تصفح حسب القسم',
        cat_all: 'جميع المنتجات',
        search_placeholder: 'ابحث عن لوحة، طبق، مطبوعة...',
        view_details_btn: 'عرض التفاصيل',
        in_stock: 'متوفر بالمخزون',
        out_of_stock: 'غير متوفر حالياً',
        egp_currency: 'جنيه مصري',
        egp_short: 'ج.م',
        detail_desc_heading: '<i class="fa-solid fa-circle-info"></i> تفاصيل ومواصفات العمل:',
        qty_label: 'الكمية المطلوبة:',
        total_label: 'الإجمالي المطلوب:',
        name_placeholder: 'الاسم (اختياري)',
        phone_placeholder: 'رقم التواصل (اختياري)',
        order_whatsapp_btn: 'طلب عبر الواتساب 💬',
        whatsapp_note: '<i class="fa-solid fa-shield-halved"></i> سيتم توجيهك لمحادثة واتساب مباشرة مع إدارة الاستوديو لتأكيد الطلب والعنوان.',
        no_products_found: 'لا توجد منتجات مطابقة في هذا القسم حالياً.',
        all_products_title: 'جميع الأعمال الفنية',
        all_products_subtitle: 'استعرض التشكيلة الكاملة من الإبداعات الحصرية والهاند ميد',
        sort_default: 'الافتراضي (أحدث المنتجات)',
        sort_asc: 'السعر: من الأقل للأعلى',
        sort_desc: 'السعر: من الأعلى للأقل',
        out_of_stock_exclusive: 'غير متوفر حالياً',
        out_of_stock_toast: 'عذراً، هذا المنتج غير متوفر حالياً!',
        out_of_stock_btn: 'غير متوفر حالياً 🚫'
    },
    en: {
        lang_btn: 'AR',
        store_badge: '<i class="fa-solid fa-wand-magic-sparkles"></i> Handmade Artworks',
        hero_badge: 'Exclusive Handmade Creations',
        hero_title: 'Monalisa Handmade & Art Studio Store',
        hero_desc: 'Handcrafted artworks, designed artboards, decorative plates, and custom prints made with passion and mastery to elevate your space.',
        categories_heading: '<i class="fa-solid fa-layer-group"></i> Browse by Category',
        cat_all: 'All Products',
        search_placeholder: 'Search for paintings, plates, prints...',
        view_details_btn: 'View Details',
        in_stock: 'In Stock',
        out_of_stock: 'Out of Stock',
        egp_currency: 'EGP',
        egp_short: 'EGP',
        detail_desc_heading: '<i class="fa-solid fa-circle-info"></i> Details & Specifications:',
        qty_label: 'Quantity:',
        total_label: 'Total Amount:',
        name_placeholder: 'Name (Optional)',
        phone_placeholder: 'Phone (Optional)',
        order_whatsapp_btn: 'Order via WhatsApp 💬',
        whatsapp_note: '<i class="fa-solid fa-shield-halved"></i> You will be redirected to WhatsApp with the studio management to confirm your order & delivery.',
        no_products_found: 'No artworks found in this category at the moment.',
        all_products_title: 'All Artworks',
        all_products_subtitle: 'Explore the full collection of exclusive handmade creations',
        sort_default: 'Default (Newest)',
        sort_asc: 'Price: Low to High',
        sort_desc: 'Price: High to Low',
        out_of_stock_exclusive: 'Out of Stock',
        out_of_stock_toast: 'Sorry, this product is currently out of stock!',
        out_of_stock_btn: 'Out of Stock 🚫'
    }
};

let currentStoreLang = localStorage.getItem('mas_store_lang') || 'ar';

function applyStoreTranslations(lang) {
    const tabStore = document.getElementById('tab-store');
    if (!tabStore) return;

    currentStoreLang = lang;
    localStorage.setItem('mas_store_lang', lang);
    tabStore.setAttribute('data-lang', lang);

    const langLabel = document.getElementById('store-lang-current-label');
    if (langLabel && STORE_TRANSLATIONS[lang]) {
        langLabel.textContent = STORE_TRANSLATIONS[lang].lang_btn;
    }

    const i18nElements = tabStore.querySelectorAll('[data-i18n]');
    i18nElements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (STORE_TRANSLATIONS[lang] && STORE_TRANSLATIONS[lang][key]) {
            el.innerHTML = STORE_TRANSLATIONS[lang][key];
        }
    });

    const i18nPlaceholders = tabStore.querySelectorAll('[data-i18n-placeholder]');
    i18nPlaceholders.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (STORE_TRANSLATIONS[lang] && STORE_TRANSLATIONS[lang][key]) {
            el.placeholder = STORE_TRANSLATIONS[lang][key];
        }
    });

    const i18nOptions = tabStore.querySelectorAll('[data-i18n-opt]');
    i18nOptions.forEach(el => {
        const key = el.getAttribute('data-i18n-opt');
        if (STORE_TRANSLATIONS[lang] && STORE_TRANSLATIONS[lang][key]) {
            el.textContent = STORE_TRANSLATIONS[lang][key];
        }
    });

    // Also update modal placeholders and texts if open
    const modalDetails = document.getElementById('modal-product-details');
    if (modalDetails) {
        modalDetails.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (STORE_TRANSLATIONS[lang] && STORE_TRANSLATIONS[lang][key]) {
                el.innerHTML = STORE_TRANSLATIONS[lang][key];
            }
        });
        modalDetails.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (STORE_TRANSLATIONS[lang] && STORE_TRANSLATIONS[lang][key]) {
                el.placeholder = STORE_TRANSLATIONS[lang][key];
            }
        });
    }

    // Refresh UI elements
    if (customerCategoriesCache.length) {
        renderCustomerCategoryChips();
        renderCustomerProductsGrid();
    }
}

function toggleStoreLanguage() {
    const nextLang = currentStoreLang === 'ar' ? 'en' : 'ar';
    applyStoreTranslations(nextLang);
}

// --- Customer Store State ---
let customerCategoriesCache = [];
let customerProductsCache = [];
let selectedStoreCategoryId = 'all';
let searchStoreKeyword = '';
let currentStoreSortOrder = 'default';
let currentDetailProduct = null;
let currentDetailQty = 1;

// WhatsApp Business Number for Studio orders: 01098310340 -> 201098310340
const STUDIO_WHATSAPP_PHONE = "201098310340";

async function loadCustomerStore() {
    setupCustomerStoreListeners();
    await refreshCustomerStoreData();
}

function setupCustomerStoreListeners() {
    // Search input with micro-debounce for performance
    let searchDebounceTimer = null;
    const searchInput = document.getElementById('store-product-search-input');
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.dataset.listenerAttached = 'true';
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchStoreKeyword = (e.target.value || '').trim().toLowerCase();
                renderCustomerProductsGrid();
            }, 120);
        });
    }

    // Price Sort Dropdown
    const priceSortSelect = document.getElementById('priceSortSelect');
    if (priceSortSelect && !priceSortSelect.dataset.listenerAttached) {
        priceSortSelect.dataset.listenerAttached = 'true';
        priceSortSelect.addEventListener('change', (e) => {
            currentStoreSortOrder = e.target.value;
            renderCustomerProductsGrid();
        });
    }

    // Product Details Modal: Close & Cancel buttons
    const btnCloseDetails = document.getElementById('btn-close-product-details');
    const modalDetails = document.getElementById('modal-product-details');
    if (btnCloseDetails && !btnCloseDetails.dataset.listenerAttached) {
        btnCloseDetails.dataset.listenerAttached = 'true';
        btnCloseDetails.addEventListener('click', () => {
            if (modalDetails) modalDetails.classList.add('hidden');
            currentDetailProduct = null;
        });
    }

    if (modalDetails && !modalDetails.dataset.listenerAttached) {
        modalDetails.dataset.listenerAttached = 'true';
        modalDetails.addEventListener('click', (e) => {
            if (e.target === modalDetails) {
                modalDetails.classList.add('hidden');
                currentDetailProduct = null;
            }
        });
    }

    // Quantity selectors
    const btnMinus = document.getElementById('btn-qty-minus');
    const btnPlus = document.getElementById('btn-qty-plus');
    if (btnMinus && !btnMinus.dataset.listenerAttached) {
        btnMinus.dataset.listenerAttached = 'true';
        btnMinus.addEventListener('click', () => {
            if (currentDetailQty > 1) {
                currentDetailQty--;
                updateProductDetailsCalculation();
            }
        });
    }
    if (btnPlus && !btnPlus.dataset.listenerAttached) {
        btnPlus.dataset.listenerAttached = 'true';
        btnPlus.addEventListener('click', () => {
            if (currentDetailQty < 99) {
                currentDetailQty++;
                updateProductDetailsCalculation();
            }
        });
    }

    // Order via WhatsApp button
    const btnOrderWhatsApp = document.getElementById('btn-order-whatsapp');
    if (btnOrderWhatsApp && !btnOrderWhatsApp.dataset.listenerAttached) {
        btnOrderWhatsApp.dataset.listenerAttached = 'true';
        btnOrderWhatsApp.addEventListener('click', handleWhatsAppOrder);
    }
}

async function refreshCustomerStoreData() {
    const productsGrid = document.getElementById('store-products-grid');
    if (productsGrid) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-sub);">
                <i class="fa-solid fa-wand-magic-sparkles fa-spin" style="font-size: 2.2rem; color: var(--accent-cyan); margin-bottom: 14px; display: block;"></i>
                <h4 style="font-weight: 700; color: var(--text-main); margin-bottom: 6px;">جاري تحميل الأعمال الفنية...</h4>
                <p style="font-size: 0.9rem; margin: 0;">يتم جلب أحدث المنتجات الهاند ميد من استوديو موناليزا</p>
            </div>
        `;
    }

    try {
        const [categories, products] = await Promise.all([
            getCategories(true),
            getProducts()
        ]);

        customerCategoriesCache = categories;
        customerProductsCache = products;

        renderCustomerCategoryChips();
        renderCustomerProductsGrid();
    } catch (err) {
        console.error("Error loading customer store data:", err);
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--danger);">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; margin-bottom: 14px; display: block;"></i>
                    <h4 style="font-weight: 700; margin-bottom: 6px;">تعذر تحميل المنتجات حالياً</h4>
                    <p style="font-size: 0.9rem; margin: 0;">يرجى المحاولة مرة أخرى أو مراجعة اتصال الإنترنت.</p>
                </div>
            `;
        }
    }
}

function renderCustomerCategoryChips() {
    const bar = document.getElementById('store-categories-bar');
    if (!bar) return;

    const allCount = customerProductsCache.length;
    const allChipCount = document.getElementById('chip-count-all');
    if (allChipCount) allChipCount.innerText = allCount;

    // Keep the "All" button
    const allBtn = bar.querySelector('[data-cat-id="all"]');
    if (allBtn && !allBtn.dataset.listenerAttached) {
        allBtn.dataset.listenerAttached = 'true';
        allBtn.addEventListener('click', () => {
            selectedStoreCategoryId = 'all';
            updateActiveCategoryChip();
            renderCustomerProductsGrid();
        });
    }

    // Remove old dynamic chips
    bar.querySelectorAll('.store-category-chip:not([data-cat-id="all"])').forEach(c => c.remove());

    customerCategoriesCache.forEach(cat => {
        const count = customerProductsCache.filter(p => p.categoryId === cat.id).length;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `store-category-chip ${selectedStoreCategoryId === cat.id ? 'active' : ''}`;
        chip.setAttribute('data-cat-id', cat.id);

        const iconHtml = cat.icon?.startsWith('http') 
            ? `<img src="${cat.icon}" alt="" style="width: 18px; height: 18px; border-radius: 4px; object-fit: cover;">`
            : `<i class="${cat.icon || 'fa-solid fa-shapes'}"></i>`;

        const nameLabel = currentStoreLang === 'en' && cat.name_en ? cat.name_en : cat.name_ar;

        chip.innerHTML = `
            ${iconHtml}
            <span>${nameLabel}</span>
            <span class="store-chip-count">${count}</span>
        `;

        chip.addEventListener('click', () => {
            selectedStoreCategoryId = cat.id;
            updateActiveCategoryChip();
            renderCustomerProductsGrid();
        });

        bar.appendChild(chip);
    });

    updateActiveCategoryChip();
}

function updateActiveCategoryChip() {
    const bar = document.getElementById('store-categories-bar');
    if (!bar) return;

    bar.querySelectorAll('.store-category-chip').forEach(chip => {
        const catId = chip.getAttribute('data-cat-id');
        if (catId === selectedStoreCategoryId) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    // Update section title & subtitle based on selected category
    const titleEl = document.getElementById('store-current-category-title');
    const subtitleEl = document.getElementById('store-current-category-subtitle');

    if (selectedStoreCategoryId === 'all') {
        if (titleEl) titleEl.innerText = STORE_TRANSLATIONS[currentStoreLang].all_products_title || 'جميع الأعمال الفنية';
        if (subtitleEl) subtitleEl.innerText = STORE_TRANSLATIONS[currentStoreLang].all_products_subtitle || 'استعرض التشكيلة الكاملة من الإبداعات الحصرية والهاند ميد';
    } else {
        const cat = customerCategoriesCache.find(c => c.id === selectedStoreCategoryId);
        if (cat) {
            const catName = currentStoreLang === 'en' && cat.name_en ? cat.name_en : cat.name_ar;
            const catDesc = currentStoreLang === 'en' && cat.description_en ? cat.description_en : (cat.description_ar || '');
            if (titleEl) titleEl.innerText = catName;
            if (subtitleEl) subtitleEl.innerText = catDesc || (currentStoreLang === 'en' ? `Art pieces in ${catName}` : `أعمال ومنتجات قسم ${catName}`);
        }
    }
}

function renderCustomerProductsGrid() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;

    let filtered = [...customerProductsCache];

    // Filter by Category
    if (selectedStoreCategoryId !== 'all') {
        filtered = filtered.filter(p => p.categoryId === selectedStoreCategoryId);
    }

    // Filter by Search Keyword
    if (searchStoreKeyword) {
        filtered = filtered.filter(p => {
            const titleAr = (p.title_ar || '').toLowerCase();
            const titleEn = (p.title_en || '').toLowerCase();
            const descAr = (p.desc_ar || '').toLowerCase();
            const descEn = (p.desc_en || '').toLowerCase();
            return titleAr.includes(searchStoreKeyword) ||
                   titleEn.includes(searchStoreKeyword) ||
                   descAr.includes(searchStoreKeyword) ||
                   descEn.includes(searchStoreKeyword);
        });
    }

    // Sort In-Memory
    if (currentStoreSortOrder === 'price-asc') {
        filtered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (currentStoreSortOrder === 'price-desc') {
        filtered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else {
        // Default: Sort by sortOrder / newest createdAt
        filtered.sort((a, b) => {
            if (a.sortOrder !== undefined && b.sortOrder !== undefined && a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder;
            }
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });
    }

    if (!filtered.length) {
        const noItemsMsg = STORE_TRANSLATIONS[currentStoreLang].no_products_found || 'لا توجد منتجات مطابقة في هذا القسم حالياً.';
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-sub); background: var(--card-bg); border-radius: 24px; border: 1.5px dashed var(--card-border);">
                <i class="fa-solid fa-palette" style="font-size: 2.8rem; margin-bottom: 16px; opacity: 0.4; display: block;"></i>
                <h3 style="font-weight: 800; color: var(--text-main); margin-bottom: 8px;">${noItemsMsg}</h3>
                <p style="font-size: 0.95rem; margin: 0;">يمكنك تصفح باقي الأقسام أو البحث بكلمات أخرى.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const isEn = currentStoreLang === 'en';
        const title = isEn && prod.title_en ? prod.title_en : prod.title_ar;
        const desc = isEn && prod.desc_en ? prod.desc_en : (prod.desc_ar || '');
        const cat = customerCategoriesCache.find(c => c.id === prod.categoryId);
        const catName = cat ? (isEn && cat.name_en ? cat.name_en : cat.name_ar) : (isEn && prod.categoryName_en ? prod.categoryName_en : (prod.categoryName_ar || 'Handmade'));
        const badge = isEn && prod.badge_en ? prod.badge_en : (prod.badge_ar || '');
        const imgUrl = prod.mainImage || 'assets/course_logo.jpeg';
        const priceFormatted = Number(prod.price || 0).toFixed(2);
        const currencyText = STORE_TRANSLATIONS[currentStoreLang].egp_short || 'ج.م';
        const viewDetailsText = STORE_TRANSLATIONS[currentStoreLang].view_details_btn || 'عرض التفاصيل';
        const isOutOfStock = prod.isAvailable === false;
        const outOfStockText = STORE_TRANSLATIONS[currentStoreLang].out_of_stock_exclusive || 'غير متوفر حالياً';
        const cardClass = `store-product-card ${isOutOfStock ? 'out-of-stock' : ''}`;

        return `
            <div class="${cardClass}" data-product-id="${prod.id}">
                <div class="product-card-thumb-wrap">
                    <img src="${imgUrl}" alt="${title}" class="product-card-thumb" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='assets/course_logo.jpeg'">
                    ${isOutOfStock 
                        ? `<div class="product-card-out-exclusive-badge"><i class="fa-solid fa-ban"></i> ${outOfStockText}</div>`
                        : (badge ? `<div class="product-card-badge">${badge}</div>` : '')
                    }
                </div>
                <div class="product-card-body">
                    <div class="product-card-category">
                        <i class="fa-solid fa-palette"></i> <span>${catName}</span>
                    </div>
                    <h3 class="product-card-title">${title}</h3>
                    <p class="product-card-desc">${desc || 'إبداع فني هاند ميد مصمم بكل حب وإتقان من استوديو موناليزا.'}</p>
                    <div class="product-card-footer">
                        <div class="product-card-pricing">
                            <div class="product-card-price">
                                <span>${priceFormatted}</span>
                                <span class="product-card-currency">${currencyText}</span>
                            </div>
                            ${prod.oldPrice ? `<span class="product-card-old-price">${Number(prod.oldPrice).toFixed(2)} ${currencyText}</span>` : ''}
                        </div>
                        <button type="button" class="btn-product-details">
                            <i class="fa-solid fa-eye"></i>
                            <span>${viewDetailsText}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach click handlers to open product modal
    grid.querySelectorAll('.store-product-card').forEach(card => {
        card.addEventListener('click', () => {
            const prodId = card.getAttribute('data-product-id');
            const product = customerProductsCache.find(p => p.id === prodId);
            if (product) openCustomerProductModal(product);
        });
    });
}

function openCustomerProductModal(product) {
    currentDetailProduct = product;
    currentDetailQty = 1;

    const modal = document.getElementById('modal-product-details');
    const isEn = currentStoreLang === 'en';

    const title = isEn && product.title_en ? product.title_en : product.title_ar;
    const desc = isEn && product.desc_en ? product.desc_en : (product.desc_ar || '');
    const cat = customerCategoriesCache.find(c => c.id === product.categoryId);
    const catName = cat ? (isEn && cat.name_en ? cat.name_en : cat.name_ar) : (isEn && product.categoryName_en ? product.categoryName_en : (product.categoryName_ar || 'Handmade'));
    const badge = isEn && product.badge_en ? product.badge_en : (product.badge_ar || '');
    const imgUrl = product.mainImage || 'assets/course_logo.jpeg';
    const isOutOfStock = product.isAvailable === false;

    // Elements
    const imgEl = document.getElementById('detail-product-img');
    const badgeEl = document.getElementById('detail-product-badge');
    const stockEl = document.getElementById('detail-product-stock-tag');
    const catEl = document.querySelector('#detail-product-category span');
    const titleEl = document.getElementById('detail-product-title');
    const priceEl = document.getElementById('detail-product-price');
    const oldPriceEl = document.getElementById('detail-product-old-price');
    const descEl = document.getElementById('detail-product-desc');
    const nameInput = document.getElementById('detail-customer-name');
    const btnOrderWhatsApp = document.getElementById('btn-order-whatsapp');

    if (imgEl) imgEl.src = imgUrl;

    if (badgeEl) {
        if (isOutOfStock) {
            badgeEl.innerText = STORE_TRANSLATIONS[currentStoreLang].out_of_stock_exclusive || 'غير متوفر حالياً';
            badgeEl.classList.remove('hidden');
            badgeEl.style.background = '#ef4444';
        } else if (badge) {
            badgeEl.innerText = badge;
            badgeEl.classList.remove('hidden');
            badgeEl.style.background = '';
        } else {
            badgeEl.classList.add('hidden');
        }
    }

    if (stockEl) {
        if (isOutOfStock) {
            stockEl.className = 'product-details-stock-tag badge-out-stock';
            stockEl.innerHTML = `<i class="fa-solid fa-xmark" style="margin-left:4px;"></i> ${STORE_TRANSLATIONS[currentStoreLang].out_of_stock || 'غير متوفر حالياً'}`;
        } else {
            stockEl.className = 'product-details-stock-tag badge-in-stock';
            stockEl.innerHTML = `<i class="fa-solid fa-check" style="margin-left:4px;"></i> ${STORE_TRANSLATIONS[currentStoreLang].in_stock || 'متوفر بالمخزون'}`;
        }
    }

    if (catEl) catEl.innerText = catName;
    if (titleEl) titleEl.innerText = title;
    if (priceEl) priceEl.innerText = Number(product.price || 0).toFixed(2);

    if (oldPriceEl) {
        if (product.oldPrice) {
            oldPriceEl.innerText = `${Number(product.oldPrice).toFixed(2)} ${STORE_TRANSLATIONS[currentStoreLang].egp_short || 'ج.م'}`;
            oldPriceEl.classList.remove('hidden');
        } else {
            oldPriceEl.classList.add('hidden');
        }
    }

    if (descEl) {
        descEl.innerText = desc || (isEn ? 'Handmade exclusive artwork crafted with love and passion.' : 'قطعة فنية يدوية فريدة ومميزة صُممت بكل حب وإتقان من استوديو موناليزا.');
    }

    // Auto-fill student/user name and phone if logged in
    const phoneInput = document.getElementById('detail-customer-phone');
    if (nameInput) {
        nameInput.value = currentUser?.name || '';
    }
    if (phoneInput) {
        phoneInput.value = currentUser?.phone || '';
    }

    // Update WhatsApp Order Button style & state if out of stock
    if (btnOrderWhatsApp) {
        if (isOutOfStock) {
            btnOrderWhatsApp.classList.add('is-out-of-stock');
            btnOrderWhatsApp.innerHTML = `<i class="fa-solid fa-ban"></i> <span>${STORE_TRANSLATIONS[currentStoreLang].out_of_stock_btn || (isEn ? 'Out of Stock 🚫' : 'غير متوفر حالياً 🚫')}</span>`;
        } else {
            btnOrderWhatsApp.classList.remove('is-out-of-stock');
            btnOrderWhatsApp.innerHTML = `<i class="fa-brands fa-whatsapp"></i> <span>${STORE_TRANSLATIONS[currentStoreLang].order_whatsapp_btn || (isEn ? 'Order via WhatsApp 💬' : 'طلب عبر الواتساب 💬')}</span>`;
        }
    }

    updateProductDetailsCalculation();

    if (modal) modal.classList.remove('hidden');
}

function updateProductDetailsCalculation() {
    const qtyDisplay = document.getElementById('display-product-qty');
    const totalEl = document.getElementById('detail-product-total-price');

    if (qtyDisplay) qtyDisplay.innerText = currentDetailQty;

    if (currentDetailProduct && totalEl) {
        const unitPrice = Number(currentDetailProduct.price || 0);
        const total = unitPrice * currentDetailQty;
        const currencyText = STORE_TRANSLATIONS[currentStoreLang].egp_short || 'ج.م';
        totalEl.innerText = `${total.toFixed(2)} ${currencyText}`;
    }
}

function handleWhatsAppOrder() {
    if (!currentDetailProduct) return;

    if (currentDetailProduct.isAvailable === false) {
        const errorMsg = STORE_TRANSLATIONS[currentStoreLang].out_of_stock_toast || 'عذراً، هذا المنتج غير متوفر حالياً!';
        showToast(errorMsg, 'error');
        return;
    }

    const productTitle = currentDetailProduct.title_ar || currentDetailProduct.title_en || 'عمل فني هاند ميد';
    const quantity = currentDetailQty || 1;
    const unitPrice = Number(currentDetailProduct.price || 0);
    const totalPrice = (unitPrice * quantity).toFixed(2);
    const userName = document.getElementById('detail-customer-name')?.value.trim() || currentUser?.name || 'عميل موناليزا';
    const userPhone = document.getElementById('detail-customer-phone')?.value.trim() || currentUser?.phone || 'غير محدد';

    const message = `أهلاً ستوديو موناليزا! 👋\nحابب أطلب العمل الفني ده:\n- المنتج: ${productTitle}\n- الكمية: ${quantity}\n- السعر الإجمالي: ${totalPrice} ج.م\n- الاسم: ${userName}\n- رقم التواصل: ${userPhone}\n\nيا ريت تأكدوا معايا التوفر وتفاصيل التوصيل. شكراً لكم!`;

    const whatsappUrl = `https://wa.me/${STUDIO_WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function initStoreTab() {
    applyStoreTranslations(currentStoreLang);
    const btnLangToggle = document.getElementById('btn-store-lang-toggle');
    if (btnLangToggle && !btnLangToggle.hasAttribute('data-initialized')) {
        btnLangToggle.setAttribute('data-initialized', 'true');
        btnLangToggle.addEventListener('click', toggleStoreLanguage);
    }

    loadCustomerStore();
}

// ==========================================
// STORE FIRESTORE DATABASE LOGIC (CATEGORIES & PRODUCTS)
// ==========================================

/**
 * Add a new store category (Admin only)
 * @param {Object} categoryData - { name_ar, name_en, icon, description_ar, description_en, sortOrder }
 * @returns {Promise<Object>} { success: true, id: string }
 */
async function addCategory(categoryData) {
    try {
        if (!categoryData || !categoryData.name_ar) {
            throw new Error('يرجى كتابة اسم القسم باللغة العربية.');
        }

        const categoriesRef = collection(db, "store_categories");
        const docData = {
            name_ar: (categoryData.name_ar || '').trim(),
            name_en: (categoryData.name_en || '').trim(),
            icon: categoryData.icon || 'fa-solid fa-shapes',
            description_ar: (categoryData.description_ar || '').trim(),
            description_en: (categoryData.description_en || '').trim(),
            sortOrder: Number(categoryData.sortOrder) || 0,
            isActive: categoryData.isActive !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(categoriesRef, docData);
        return { success: true, id: docRef.id };
    } catch (err) {
        console.error("Error adding store category:", err);
        throw err;
    }
}

/**
 * Update an existing store category (Admin only)
 * @param {string} categoryId - Document ID in store_categories
 * @param {Object} updateData - Updated category fields
 * @returns {Promise<Object>} { success: true }
 */
async function updateCategory(categoryId, updateData) {
    try {
        if (!categoryId) throw new Error('معرف القسم غير صالح.');

        const categoryRef = doc(db, "store_categories", categoryId);
        const payload = {
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        delete payload.createdAt;
        delete payload.id;

        await updateDoc(categoryRef, payload);
        return { success: true };
    } catch (err) {
        console.error("Error updating store category:", err);
        throw err;
    }
}

/**
 * Delete a store category (Admin only)
 * @param {string} categoryId - Document ID in store_categories
 * @returns {Promise<Object>} { success: true }
 */
async function deleteCategory(categoryId) {
    try {
        if (!categoryId) throw new Error('معرف القسم غير صالح.');
        const categoryRef = doc(db, "store_categories", categoryId);
        await deleteDoc(categoryRef);
        return { success: true };
    } catch (err) {
        console.error("Error deleting store category:", err);
        throw err;
    }
}

/**
 * Get all store categories
 * @param {boolean} onlyActive - If true, returns only active categories
 * @returns {Promise<Array>} List of category objects
 */
async function getCategories(onlyActive = false) {
    try {
        const categoriesRef = collection(db, "store_categories");
        let q;
        if (onlyActive) {
            q = query(categoriesRef, where("isActive", "==", true));
        } else {
            q = query(categoriesRef);
        }

        const snapshot = await getDocs(q);
        const categories = [];
        snapshot.forEach(docSnap => {
            categories.push({ id: docSnap.id, ...docSnap.data() });
        });

        return categories.sort((a, b) => {
            if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
                return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            }
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    } catch (err) {
        console.error("Error fetching store categories:", err);
        return [];
    }
}

/**
 * Add a new store product (Admin only)
 * @param {Object} productData - { title_ar, title_en, desc_ar, desc_en, price, oldPrice, categoryId, categoryName_ar, categoryName_en, mainImage, gallery, isAvailable, badge_ar, badge_en, sortOrder }
 * @returns {Promise<Object>} { success: true, id: string }
 */
async function addProduct(productData) {
    try {
        if (!productData || !productData.title_ar) {
            throw new Error('يرجى إدخال اسم المنتج باللغة العربية.');
        }
        if (productData.price === undefined || productData.price === null || isNaN(productData.price)) {
            throw new Error('يرجى إدخال سعر صالح للمنتج.');
        }

        const productsRef = collection(db, "store_products");
        const docData = {
            title_ar: (productData.title_ar || '').trim(),
            title_en: (productData.title_en || '').trim(),
            desc_ar: (productData.desc_ar || '').trim(),
            desc_en: (productData.desc_en || '').trim(),
            price: Number(productData.price) || 0,
            oldPrice: productData.oldPrice ? Number(productData.oldPrice) : null,
            categoryId: productData.categoryId || '',
            categoryName_ar: productData.categoryName_ar || '',
            categoryName_en: productData.categoryName_en || '',
            mainImage: productData.mainImage || '',
            gallery: Array.isArray(productData.gallery) ? productData.gallery : [],
            isAvailable: productData.isAvailable !== false,
            badge_ar: (productData.badge_ar || '').trim(),
            badge_en: (productData.badge_en || '').trim(),
            sortOrder: Number(productData.sortOrder) || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(productsRef, docData);
        return { success: true, id: docRef.id };
    } catch (err) {
        console.error("Error adding store product:", err);
        throw err;
    }
}

/**
 * Update an existing store product (Admin only)
 * @param {string} productId - Document ID in store_products
 * @param {Object} updateData - Updated product fields
 * @returns {Promise<Object>} { success: true }
 */
async function updateProduct(productId, updateData) {
    try {
        if (!productId) throw new Error('معرف المنتج غير صالح.');

        const productRef = doc(db, "store_products", productId);
        const payload = {
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        if (payload.price !== undefined) payload.price = Number(payload.price);
        if (payload.oldPrice !== undefined && payload.oldPrice !== null) payload.oldPrice = Number(payload.oldPrice);

        delete payload.createdAt;
        delete payload.id;

        await updateDoc(productRef, payload);
        return { success: true };
    } catch (err) {
        console.error("Error updating store product:", err);
        throw err;
    }
}

/**
 * Delete a store product (Admin only)
 * @param {string} productId - Document ID in store_products
 * @returns {Promise<Object>} { success: true }
 */
async function deleteProduct(productId) {
    try {
        if (!productId) throw new Error('معرف المنتج غير صالح.');
        const productRef = doc(db, "store_products", productId);
        await deleteDoc(productRef);
        return { success: true };
    } catch (err) {
        console.error("Error deleting store product:", err);
        throw err;
    }
}

/**
 * Get store products with optional filters
 * @param {Object} filters - { categoryId, onlyAvailable }
 * @returns {Promise<Array>} List of product objects
 */
async function getProducts(filters = {}) {
    try {
        const productsRef = collection(db, "store_products");
        let q = query(productsRef);

        if (filters.categoryId && filters.categoryId !== 'all') {
            q = query(productsRef, where("categoryId", "==", filters.categoryId));
        }

        const snapshot = await getDocs(q);
        let products = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (filters.onlyAvailable && data.isAvailable === false) {
                return;
            }
            products.push({ id: docSnap.id, ...data });
        });

        return products.sort((a, b) => {
            if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
                return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            }
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    } catch (err) {
        console.error("Error fetching store products:", err);
        return [];
    }
}

// Global exposure for UI & Modules
window.storeManager = {
    addCategory,
    updateCategory,
    deleteCategory,
    getCategories,
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    uploadImageToImgBB
};

sidebarTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchStudentTab(btn.getAttribute('data-tab'));
    });
});

bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
        switchStudentTab(item.getAttribute('data-tab'));
    });
});

// Robust navigation card click handler using event delegation
document.addEventListener('click', (e) => {
    const card = e.target.closest('.nav-card');
    if (card) {
        const targetTab = card.getAttribute('data-target-tab');
        if (targetTab) {
            switchStudentTab(targetTab);
        }
    }
});


function parseHashParams() {
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return { route: hash, params: {} };
    
    const route = hash.substring(0, qIndex);
    const queryString = hash.substring(qIndex + 1);
    const params = {};
    const pairs = queryString.split('&');
    for (const pair of pairs) {
        const parts = pair.split('=');
        if (parts.length === 2) {
            params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
        }
    }
    return { route, params };
}

function clearAdminDashboardSession() {
    if (activeAdminViewUnsub) {
        try {
            activeAdminViewUnsub.users();
            activeAdminViewUnsub.videos();
            activeAdminViewUnsub.publicSettings();
        } catch (e) {
            console.warn("Error unsubscribing admin listeners:", e);
        }
        activeAdminViewUnsub = null;
    }
    // Reset admin UI elements to blank or empty state for security
    const statTotalStudents = document.getElementById('stat-total-students');
    const statTotalVideos = document.getElementById('stat-total-videos');
    const statTotalSubscribers = document.getElementById('stat-total-subscribers');
    const courseContentsList = document.getElementById('course-contents-list');
    const usersProvisioningList = document.getElementById('users-provisioning-list');

    if (statTotalStudents) statTotalStudents.innerText = '—';
    if (statTotalVideos) statTotalVideos.innerText = '—';
    if (statTotalSubscribers) statTotalSubscribers.innerText = '—';
    if (courseContentsList) courseContentsList.innerHTML = '';
    if (usersProvisioningList) usersProvisioningList.innerHTML = '';
}

async function handleRouting() {
    if (!isAuthResolved) {
        return; // Strictly block routing until Firebase Auth is definitively confirmed
    }
    
    const parsed = parseHashParams();
    const storedUser = sessionStorage.getItem('monaliza_user');
    
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
        } catch (e) {
            console.error("Error parsing stored user JSON:", e);
            sessionStorage.removeItem('monaliza_user');
            currentUser = null;
        }
    } else {
        currentUser = null;
    }

    // Attach/detach session listeners strictly based on auth state
    if (currentUser && currentUser.role === 'student' && currentUser.uid) {
        attachSessionWatcher(currentUser.uid);
    } else {
        detachSessionListener();
        if (currentUser && currentUser.role === 'student') {
            clearSessionLocalData();
            currentUser = null;
        }
    }

    const rawHash = parsed.route;

    // Fetch dynamic admin login hash from Firestore
    let dynamicAdminHash = '';
    let isAdminHashMatch = false;
    try {
        const publicRef = doc(db, "admin_settings", "public");
        const publicSnap = await getDoc(publicRef);
        if (publicSnap.exists()) {
            dynamicAdminHash = publicSnap.data().loginHash || '';
            const cleanHash = rawHash ? rawHash.replace(/^#\/?/, '') : '';
            if (cleanHash === dynamicAdminHash && dynamicAdminHash !== '') {
                isAdminHashMatch = true;
            }
        }
    } catch (err) {
        console.error("Failed fetching dynamic admin settings:", err);
    }

    // Router Switch
    if (rawHash === '#/terms' || rawHash === '#terms') {
        document.title = 'MAS - شروط الاستخدام';
        showView('view-terms');
    }
    else if (rawHash === '#/instructions' || rawHash === '#instructions') {
        document.title = 'MAS - تعليمات الاشتراك';
        showView('view-instructions');
    } 
    else if (rawHash === '#/watch-course' || rawHash === '#watch-course' || rawHash === '#/watch-lecture' || rawHash === '#watch-lecture') {
        document.title = 'MAS - عرض الكورس';
        if (currentUser && currentUser.role === 'student') {
            const courseId = parsed.params.courseId || DEFAULT_COURSE_ID;
            const hasAccess = currentUser.courses && currentUser.courses.includes(courseId);
            if (hasAccess) {
                showView('view-video');
                if (rawHash === '#/watch-course' || rawHash === '#watch-course') {
                    renderCourseLectureList(courseId);
                } else {
                    const lectureId = parsed.params.lectureId;
                    renderLecturePlayer(courseId, lectureId);
                }
            } else {
                showToast('عذرًا، ليس لديك صلاحية للوصول لهذا الكورس. يرجى اتباع تعليمات الاشتراك للتفعيل.', 'error');
                window.location.hash = '#/instructions';
            }
        } else {
            window.location.hash = '#/login';
        }
    } 
    else if (rawHash === '#/login' || rawHash === '#login') {
        document.title = 'MAS - الدخول';
        if (currentUser && currentUser.role === 'student') {
            window.location.hash = '#/dashboard';
        } else {
            showView('view-student-auth');
        }
    } 
    else if (rawHash === '#/dashboard' || rawHash === '#dashboard') {
        document.title = 'MAS - لوحة الطالب';
        if (currentUser && currentUser.role === 'student') {
            showView('view-hub');
            const activeTabBtn = document.querySelector('.sidebar-tab-btn.active') || document.querySelector('.bottom-nav-item.active');
            const targetTab = activeTabBtn ? (activeTabBtn.getAttribute('data-tab') || activeTabBtn.getAttribute('data-target-tab')) : 'tab-home';
            switchStudentTab(targetTab || 'tab-home');
            updateStudentSidebarUI();
            initializeWelcomeNotification();
        } else {
            window.location.hash = '#/login';
        }
    } 
    else if (isAdminHashMatch) {
        document.title = 'MAS - لوحة الأدمن';
        if (currentUser && currentUser.role === 'admin') {
            showView('view-admin-dashboard');
            loadAdminDashboard();
        } else {
            showView('view-admin-auth');
        }
    } 
    else {
        // Fallback for empty/unknown route (e.g. "/" or "#")
        if (rawHash === '' || rawHash === '#' || rawHash === '#/') {
            if (currentUser && currentUser.role === 'student') {
                window.location.hash = '#/dashboard';
            } else if (currentUser && currentUser.role === 'admin') {
                window.location.hash = `#/${dynamicAdminHash}`;
            } else {
                window.location.hash = '#/login';
            }
        } else {
            // Mismatched or unauthorized route -> instant cleanup and show 404
            clearAdminDashboardSession();
            showView('view-404');
        }
    }
}

window.addEventListener('hashchange', handleRouting);


async function renderCourseLectureList(courseId) {
    const container = document.getElementById('video-dynamic-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align:center; padding:50px; color:var(--text-sub);">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top:15px;">جاري تحميل محاضرات الكورس...</p>
        </div>
    `;
    
    try {
        const contentsCol = collection(db, "course_contents");
        const q = query(contentsCol, where("courseId", "==", courseId), where("type", "==", "video"));
        const snap = await getDocs(q);
        
        const lectures = [];
        snap.forEach(docSnap => {
            lectures.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // Sort oldest first (ascending)
        lectures.sort((a, b) => a.createdAt - b.createdAt);
        
        const courseTitle = courseId === 'course_02' ? 'كورس قدرات العمارة' : 'كورس قدرات الفنون';
        
        let html = `
            <header class="lectures-header-container">
                <div class="header-left">
                    <button class="btn-back" onclick="window.location.hash = ''">
                        <i class="fa-solid fa-arrow-right"></i>
                        <span>العودة للمنصة</span>
                    </button>
                </div>
                <h3 class="lectures-header-title">${courseTitle} - قائمة المحاضرات</h3>
            </header>
        `;
        
        if (lectures.length === 0) {
            html += `
                <div style="text-align:center; padding:80px 20px; background:var(--card-bg); border:1.5px solid var(--card-border); border-radius:16px; margin-top:20px;">
                    <i class="fa-solid fa-video-slash" style="font-size:3rem; color:var(--text-sub); opacity:0.5; margin-bottom:15px;"></i>
                    <h3 style="font-weight:700; color:var(--text-main);">لا يوجد محاضرات</h3>
                    <p style="color:var(--text-sub); margin-top:8px;">لم يتم رفع أي محاضرات لهذا الكورس بعد.</p>
                </div>
            `;
            container.innerHTML = html;
            return;
        }
        
        html += `<div style="display:flex; flex-direction:column; gap:16px; margin-top:10px;">`;
        
        lectures.forEach((lecture, index) => {
            html += `
                <div class="playlist-item" style="display:flex; align-items:center; gap:20px; padding:18px; background:var(--card-bg); border:1.5px solid var(--card-border); border-radius:14px; cursor:pointer; transition:var(--transition-smooth);" onclick="window.location.hash = '#watch-lecture?courseId=${courseId}&lectureId=${lecture.id}'">
                    <div style="position:relative; width:120px; height:75px; border-radius:8px; overflow:hidden; flex-shrink:0; background:#000;">
                        <img src="${lecture.thumbnailUrl || 'assets/course_logo.jpeg'}" style="width:100%; height:100%; object-fit:cover;">
                        <div style="position:absolute; bottom:6px; left:6px; background:rgba(0,0,0,0.75); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700;">
                            الدرس ${index + 1}
                        </div>
                    </div>
                    <div style="flex-grow:1; min-width:0;">
                        <h4 style="font-weight:700; font-size:1.1rem; color:var(--text-main); margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${lecture.title}</h4>
                        <p style="color:var(--text-sub); font-size:0.88rem; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; margin:0;">${lecture.description || 'لا يوجد وصف متاح للمحاضرة.'}</p>
                    </div>
                    <div style="color:var(--accent-cyan); font-size:1.2rem; margin-right:auto; padding-right:10px;">
                        <i class="fa-solid fa-circle-play"></i>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        container.innerHTML = html;
        
    } catch (e) {
        console.error("Error rendering lecture list:", e);
        container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:50px;">فشل تحميل قائمة المحاضرات.</div>`;
    }
}

function extractGoogleDriveFolderId(url = '') {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('drive.google.com')) return '';

        const folderMatch = parsed.pathname.match(/\/folders\/([^/?#]+)/);
        if (folderMatch?.[1]) return decodeURIComponent(folderMatch[1]);

        return parsed.searchParams.get('id') || '';
    } catch (_) {
        return '';
    }
}

function buildGoogleDriveFolderEmbedUrl(folderUrl = '') {
    const folderId = extractGoogleDriveFolderId(folderUrl);
    return folderId ? `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid` : '';
}

function extractGoogleDriveFileId(url = '') {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('drive.google.com')) return '';

        const fileMatch = parsed.pathname.match(/\/file\/d\/([^/?#]+)/);
        if (fileMatch?.[1]) return decodeURIComponent(fileMatch[1]);

        const openMatch = parsed.pathname.match(/\/open$/);
        if (openMatch) {
            return parsed.searchParams.get('id') || '';
        }

        return parsed.searchParams.get('id') || '';
    } catch (_) {
        if (url.trim().match(/^[a-zA-Z0-9_-]{25,}$/)) {
            return url.trim();
        }
        return '';
    }
}

function buildGoogleDriveDirectVideoUrl(url = '') {
    const fileId = extractGoogleDriveFileId(url);
    return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : '';
}

function buildGoogleDriveFilePreviewUrl(url = '') {
    const fileId = extractGoogleDriveFileId(url);
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
}


function getFileIconAndColor(mimeType, name) {
    const mime = mimeType || '';
    const filename = name || '';
    
    if (mime === 'application/pdf' || filename.endsWith('.pdf')) {
        return { icon: 'fa-file-pdf', color: '#ef4444' };
    }
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
        return { icon: 'fa-file-image', color: '#06b6d4' };
    }
    if (mime === 'application/zip' || mime === 'application/x-zip-compressed' || mime === 'application/x-rar-compressed' || /\.(zip|rar|7z)$/i.test(filename)) {
        return { icon: 'fa-file-zipper', color: '#f59e0b' };
    }
    return { icon: 'fa-file', color: '#9ca3af' };
}

async function renderLecturePlayer(courseId, lectureId) {
    const container = document.getElementById('video-dynamic-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align:center; padding:50px; color:var(--text-sub);">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top:15px;">جاري تحميل المحاضرة والملفات المرفقة...</p>
        </div>
    `;
    
    try {
        const contentsCol = collection(db, "course_contents");
        const lectureRef = doc(db, "course_contents", lectureId);
        const lectureSnap = await getDoc(lectureRef);
        
        if (!lectureSnap.exists()) {
            container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:50px;">عذرًا، المحاضرة المطلوبة غير موجودة.</div>`;
            return;
        }
        
        const currentLecture = { id: lectureSnap.id, ...lectureSnap.data() };
        if (currentLecture.courseId !== courseId || currentLecture.type !== 'video') {
            container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:50px;">عذرًا، لا يمكنك الوصول لهذه المحاضرة.</div>`;
            return;
        }
        
        const qLectures = query(contentsCol, where("courseId", "==", courseId), where("type", "==", "video"));
        const snapLectures = await getDocs(qLectures);
        const allLectures = [];
        snapLectures.forEach(docSnap => {
            allLectures.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        allLectures.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const currentIndex = allLectures.findIndex(l => l.id === lectureId);
        const lessonNumber = currentIndex >= 0 ? currentIndex + 1 : 1;
        const suggestions = currentIndex >= 0 ? allLectures.slice(currentIndex + 1) : [];
        
        let sidebarHtml = '';
        if (suggestions.length > 0) {
            sidebarHtml = `
                <div class="video-playlist-panel" style="margin: 0;">
                    <h3 style="font-weight: 700; font-size: 1.1rem; color:var(--text-main); border-bottom:1px solid var(--card-border); padding-bottom:10px; margin-bottom:15px;">المحاضرات التالية</h3>
                    <div class="playlist-items" style="display:flex; flex-direction:column; gap:12px;">
            `;
            suggestions.forEach((item, index) => {
                const suggestionIndex = lessonNumber + index + 1;
                sidebarHtml += `
                    <div class="playlist-item" onclick="window.location.hash = '#watch-lecture?courseId=${courseId}&lectureId=${item.id}'" style="display:flex; align-items:center; gap:12px; padding:10px; border-radius:10px; background:var(--bg-color); border:1px solid transparent; cursor:pointer; transition:var(--transition-smooth);">
                        <div style="position:relative; width:80px; height:50px; border-radius:6px; overflow:hidden; flex-shrink:0; background:#000;">
                            <img src="${item.thumbnailUrl || DEFAULT_COURSE_THUMBNAIL}" style="width:100%; height:100%; object-fit:cover;">
                            <div style="position:absolute; bottom:2px; left:2px; background:rgba(0,0,0,0.75); color:#fff; font-size:0.6rem; padding:1px 4px; border-radius:3px; font-weight:700;">
                                الدرس ${suggestionIndex}
                            </div>
                        </div>
                        <div style="flex-grow:1; min-width:0;">
                            <h5 style="font-weight:700; font-size:0.85rem; color:var(--text-main); margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title || '')}</h5>
                            <p style="color:var(--text-sub); font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${escapeHtml(item.description || 'لا يوجد وصف.')}</p>
                        </div>
                    </div>
                `;
            });
            sidebarHtml += `</div></div>`;
        } else {
            sidebarHtml = `
                <div class="video-playlist-panel" style="margin: 0; text-align:center; padding:25px 15px;">
                    <i class="fa-solid fa-flag-checkered" style="font-size:2rem; color:var(--text-sub); opacity:0.3; margin-bottom:10px;"></i>
                    <h4 style="font-weight:700; color:var(--text-main); font-size:0.9rem;">لقد وصلت لآخر محاضرة!</h4>
                    <p style="color:var(--text-sub); font-size:0.75rem; margin-top:4px;">تابع لوحة التحكم بانتظام لأي دروس جديدة.</p>
                </div>
            `;
        }

        const videoUrl = currentLecture.videoUrl || '';
        const folderUrl = currentLecture.folderUrl || currentLecture.driveFolderUrl || '';

        // Extract YouTube ID
        let youtubeId = null;
        if (videoUrl) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = videoUrl.match(regExp);
            if (match && match[2].length === 11) {
                youtubeId = match[2];
            }
        }

        let frameHtml = '';
        if (youtubeId) {
            const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&showinfo=0`;
            // Deliberately omitting 'allowfullscreen' so native YouTube fullscreen is disabled,
            // forcing users to use our secure fullscreen button which keeps the watermark visible.
            frameHtml = `<iframe
                id="course-youtube-iframe"
                class="youtube-iframe"
                src="${embedUrl}"
                width="100%" height="100%"
                frameborder="0"
                allow="autoplay; encrypted-media; picture-in-picture"
                loading="lazy"
            ></iframe>`;
        } else {
            frameHtml = `<div style="color:var(--text-muted); text-align:center; padding: 40px;">رابط يوتيوب غير صالح</div>`;
        }

        let actionsHtml = `<div class="player-actions">`;
        
        if (folderUrl) {
            actionsHtml += `
                <a href="${escapeHtml(folderUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary">
                    <i class="fa-solid fa-folder-open"></i> الملفات والموارد
                </a>
            `;
        } else {
             // Fallback to internal companion files if no external folder is provided
             const companionFiles = currentLecture.companionFiles || [];
             if (companionFiles.length > 0) {
                 actionsHtml += `
                     <a href="#companion-files?courseId=${courseId}&lectureIdx=${currentIndex}" class="btn-primary">
                         <i class="fa-solid fa-file-pdf"></i> الملفات والموارد
                     </a>
                 `;
             }
        }
        
        actionsHtml += `
            <button id="btn-secure-fullscreen" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <i class="fa-solid fa-expand"></i> تكبير الشاشة بأمان
            </button>
        </div>`;

        container.innerHTML = `
            <header class="player-nav-header">
                <button class="btn-back" onclick="window.location.hash = '#watch-course?courseId=${courseId}'">
                    <i class="fa-solid fa-arrow-right"></i> العودة لقائمة الدروس
                </button>
                <div class="player-lesson-title" style="margin: 0; text-align: right; flex: 1;">
                    الدرس ${lessonNumber}: ${escapeHtml(currentLecture.title || 'محاضرة')}
                </div>
            </header>
            <div class="watch-course-container">
                <div class="video-layout">
                    <div class="video-main-panel">
                        <div id="drive-iframe-wrapper" class="embedded-player-wrapper">
                            ${frameHtml}
                            <div id="video-watermark" class="video-watermark"></div>
                        </div>
                        
                        ${actionsHtml}
                        
                        <div class="video-info-box">
                            <h2>${escapeHtml(currentLecture.title || '')}</h2>
                            <p>${escapeHtml(currentLecture.description || 'لا يوجد وصف متاح للمحاضرة.')}</p>
                        </div>
                    </div>
                    ${sidebarHtml}
                </div>
            </div>
        `;
        
        startWatermark();
        
        const btnSecureFullscreen = document.getElementById('btn-secure-fullscreen');
        if (btnSecureFullscreen) {
            btnSecureFullscreen.addEventListener('click', () => {
                const wrapper = document.getElementById('drive-iframe-wrapper');
                if (!wrapper) return;
                
                if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    if (wrapper.requestFullscreen) wrapper.requestFullscreen();
                    else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
                    else if (wrapper.msRequestFullscreen) wrapper.msRequestFullscreen();
                } else {
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    else if (document.msExitFullscreen) document.msExitFullscreen();
                }
            });
            
            const updateFullscreenUI = () => {
                const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
                if (isFs) {
                    btnSecureFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i> تصغير الشاشة';
                } else {
                    btnSecureFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i> تكبير الشاشة بأمان';
                }
            };
            document.addEventListener('fullscreenchange', updateFullscreenUI);
            document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
            document.addEventListener('msfullscreenchange', updateFullscreenUI);
        }
        
    } catch (e) {
        console.error("Error rendering lecture player:", e);
        container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:50px;">فشل تحميل المحاضرة.</div>`;
    }
}
// 4. CUSTOM INLINE FORM VALIDATIONS
// ==========================================
function showError(inputEl, errorElId, message) {
    const errorEl = document.getElementById(errorElId);
    if (errorEl) {
        errorEl.innerText = message;
        errorEl.classList.add('active');
    }
    if (inputEl) {
        inputEl.classList.add('input-error');
    }
}

function clearError(inputEl, errorElId) {
    const errorEl = document.getElementById(errorElId);
    if (errorEl) {
        errorEl.innerText = '';
        errorEl.classList.remove('active');
    }
    if (inputEl) {
        inputEl.classList.remove('input-error');
    }
}

function clearAllErrors() {
    document.querySelectorAll('.error-feedback').forEach(el => {
        el.innerText = '';
        el.classList.remove('active');
    });
    document.querySelectorAll('.input-group input').forEach(el => {
        el.classList.remove('input-error');
    });
}

function isNumeric(value) {
    return /^\d+$/.test(value);
}

function containsArabicText(value) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
}

function validatePhoneField(inputEl, errorElId) {
    const value = inputEl.value.trim();
    if (!value) {
        showError(inputEl, errorElId, 'لا يمكنك ترك هذا الحقل فارغاً');
        return false;
    }
    if (!isNumeric(value)) {
        showError(inputEl, errorElId, 'الرقم يجب أن يحتوي على أرقام فقط');
        return false;
    }
    if (value.length < 11) {
        showError(inputEl, errorElId, 'يجب أن يكون الرقم 11 رقمًا أو أكثر');
        return false;
    }
    return true;
}

function validatePasswordField(inputEl, errorElId) {
    const value = inputEl.value.trim();
    if (!value) {
        showError(inputEl, errorElId, 'لا يمكنك ترك هذا الحقل فارغاً');
        return false;
    }
    if (containsArabicText(value)) {
        showError(inputEl, errorElId, 'كلمة المرور لا يمكن أن تحتوي على أحرف عربية');
        return false;
    }
    return true;
}

function attachInputSanitizers() {
    [inputLoginPhone, inputRegPhone, inputAdminPhone].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D+/g, '');
        });
    });
}

function attachPasswordToggleButtons() {
    passwordToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;
            if (targetInput.type === 'password') {
                targetInput.type = 'text';
                button.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                targetInput.type = 'password';
                button.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    });
}

// --- STUDENT AUTHENTICATION FLOW ---
if (btnShowLogin && btnShowRegister) {
    btnShowLogin.addEventListener('click', () => {
        clearAllErrors();
        btnShowLogin.classList.add('active');
        btnShowRegister.classList.remove('active');
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
        if (authToggleSlider) authToggleSlider.style.right = '5px';
    });

    btnShowRegister.addEventListener('click', () => {
        clearAllErrors();
        btnShowRegister.classList.add('active');
        btnShowLogin.classList.remove('active');
        formRegister.classList.remove('hidden');
        formLogin.classList.add('hidden');
        if (authToggleSlider) authToggleSlider.style.right = 'calc(50% - 5px)';
    });
}

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        let isValid = true;
        const phone = normalizePhoneNumber(inputLoginPhone.value.trim());
        const password = inputLoginPassword.value.trim();

        if (!validatePhoneField(inputLoginPhone, 'err-login-phone')) {
            isValid = false;
        }
        if (!validatePasswordField(inputLoginPassword, 'err-login-password')) {
            isValid = false;
        }

        if (!isValid) return;

        await withLoading(async () => {
            studentAuthInProgress = true;
            try {
                const email = getStudentAuthEmail(phone);
                const authCredential = await signInWithEmailAndPassword(auth, email, password);
                const studentRecord = await loadStudentDataByUid(authCredential.user.uid);
                if (!studentRecord) {
                    await signOut(auth);
                    showError(inputLoginPhone, 'err-login-phone', 'لم يتم العثور على ملف الطالب. تواصل مع الإدارة.');
                    return;
                }

                const sessionId = generateSessionId();
                currentUser = buildStudentSession(authCredential.user.uid, studentRecord.data);
                sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));
                saveLocalSessionId(sessionId);
                isAuthResolved = true;

                // Navigate instantly to dashboard and trigger route view
                if (window.location.hash !== '#/dashboard') {
                    window.location.hash = '#/dashboard';
                }
                await handleRouting();

                // Fire-and-forget background tasks
                setActiveSessionForUser(studentRecord.ref, sessionId).catch(e => console.warn('Session write:', e));
                initializeWelcomeNotification();
                attachSessionWatcher(authCredential.user.uid);
            } catch (err) {
                console.error("Login Error:", err);
                showError(inputLoginPassword, 'err-login-password', getFirebaseErrorMessage(err));
            } finally {
                studentAuthInProgress = false;
            }
        });
    });
}

if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        let isValid = true;
        const name = inputRegName.value.trim();
        const phone = normalizePhoneNumber(inputRegPhone.value.trim());
        const password = inputRegPassword.value.trim();
        const confirmPassword = inputRegConfirmPassword.value.trim();

        if (!name) {
            showError(inputRegName, 'err-reg-name', 'لا يمكنك ترك هذا الحقل فارغاً');
            isValid = false;
        }
        if (!validatePhoneField(inputRegPhone, 'err-reg-phone')) {
            isValid = false;
        }
        if (!validatePasswordField(inputRegPassword, 'err-reg-password')) {
            isValid = false;
        }
        if (!confirmPassword) {
            showError(inputRegConfirmPassword, 'err-reg-confirm-password', 'لا يمكنك ترك هذا الحقل فارغاً');
            isValid = false;
        } else if (password !== confirmPassword) {
            showError(inputRegConfirmPassword, 'err-reg-confirm-password', 'كلمات المرور غير متطابقة');
            isValid = false;
        } else if (containsArabicText(confirmPassword)) {
            showError(inputRegConfirmPassword, 'err-reg-confirm-password', 'كلمة المرور لا يمكن أن تحتوي على أحرف عربية');
            isValid = false;
        }

        if (!isValid) return;

        await withLoading(async () => {
            studentAuthInProgress = true;
            try {
                const authCredential = await createUserWithEmailAndPassword(auth, getStudentAuthEmail(phone), password);
                const sessionId = generateSessionId();
                const newUserData = {
                    name,
                    phone,
                    role: 'student',
                    courses: [],
                    avatarUrl: '',
                    currentSessionId: sessionId,
                    authProvider: 'firebase_email_password',
                    createdAt: Date.now()
                };
                currentUser = buildStudentSession(authCredential.user.uid, newUserData);
                sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));
                saveLocalSessionId(sessionId);
                isAuthResolved = true;

                // Navigate instantly to dashboard and trigger route view
                if (window.location.hash !== '#/dashboard') {
                    window.location.hash = '#/dashboard';
                }
                await handleRouting();

                // Fire-and-forget background tasks
                const userRef = doc(db, "users", authCredential.user.uid);
                setDoc(userRef, newUserData).catch(e => console.warn('User doc write:', e));
                initializeWelcomeNotification();
                attachSessionWatcher(authCredential.user.uid);
            } catch (err) {
                console.error("Register Error:", err);
                if (err?.code === 'auth/email-already-in-use') {
                    showError(inputRegPhone, 'err-reg-phone', 'هذا الرقم مسجل بالفعل، يرجى تسجيل الدخول بدلاً من إنشاء حساب');
                } else {
                    showError(inputRegPhone, 'err-reg-phone', getFirebaseErrorMessage(err));
                }
            } finally {
                studentAuthInProgress = false;
            }
        });
    });
}

// --- LOGOUT CONFIRMATION DIALOG HANDLERS ---
document.querySelectorAll('.btn-logout-action').forEach(btn => {
    btn.addEventListener('click', () => {
        if (modalLogout) {
            modalLogout.classList.remove('hidden');
        }
    });
});

if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => {
        if (modalLogout) {
            modalLogout.classList.add('hidden');
        }
    });
}

if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', async () => {
        if (modalLogout) {
            modalLogout.classList.add('hidden');
        }
        if (auth.currentUser) {
            try {
                await signOut(auth);
            } catch (e) {
                console.error("SignOut failed:", e);
            }
        }
        clearSessionLocalData();
        detachSessionListener();
        currentUser = null;
        window.location.hash = '#/login';
    });
}

// ==========================================
// 5. HUB LAYOUT CONTROLS & SIDEBARS
// ==========================================
if (btnNotifications) {
    btnNotifications.addEventListener('click', (e) => {
        e.stopPropagation();
        if (notificationsDropdown) {
            const isHidden = notificationsDropdown.classList.contains('hidden');
            notificationsDropdown.classList.toggle('hidden');

            if (isHidden) {
                if (notificationBadge) {
                    notificationBadge.innerText = '';
                    notificationBadge.classList.add('fade-out');
                    notificationBadge.style.opacity = '0';
                    notificationBadge.style.transform = 'scale(0.8)';
                }
            }
        }
    });
}

document.addEventListener('click', () => {
    if (notificationsDropdown) notificationsDropdown.classList.add('hidden');
    if (notificationBadge) {
        notificationBadge.classList.add('fade-out');
        notificationBadge.style.opacity = '0';
        notificationBadge.style.transform = 'scale(0.8)';
    }
});

// Dynamic fresh welcome notification system
function initializeWelcomeNotification() {
    updateWelcomeNotification();
}

function getStudentCourseInfo(courses = []) {
    const hasFunoon = courses.includes(DEFAULT_COURSE_ID);
    const hasOmara = courses.includes('course_02');

    if (hasOmara) {
        return {
            id: 'course_02',
            title: 'كورس قدرات العمارة',
            category: '<i class="fa-solid fa-compass-drafting"></i> الهندسة والعمارة',
            hasAccess: true
        };
    }

    if (hasFunoon) {
        return {
            id: DEFAULT_COURSE_ID,
            title: 'كورس قدرات الفنون',
            category: '<i class="fa-solid fa-palette"></i> الفنون التشكيلية',
            hasAccess: true
        };
    }

    return {
        id: DEFAULT_COURSE_ID,
        title: 'كورس قدرات الفنون والعمارة',
        category: '<i class="fa-solid fa-palette"></i> الفنون والعمارة',
        hasAccess: false
    };
}

function updateStudentSidebarUI(user = currentUser) {
    if (!user) return;
    const nameEl = document.getElementById('user-display-name');
    const phoneEl = document.getElementById('user-display-phone');
    
    if (nameEl) nameEl.innerText = user.name || "طالب موناليزا";
    if (phoneEl) phoneEl.innerText = user.phone || "01xxxxxxxxx";

    if (userAvatarDisplay) {
        if (user.avatarUrl) {
            userAvatarDisplay.style.backgroundImage = `url(${user.avatarUrl})`;
            userAvatarDisplay.innerHTML = '';
        } else {
            userAvatarDisplay.style.backgroundImage = '';
            userAvatarDisplay.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
    }

    const hasFunoon = user.courses && user.courses.includes(DEFAULT_COURSE_ID);
    const hasOmara = user.courses && user.courses.includes('course_02');
    const courseInfo = getStudentCourseInfo(user.courses || []);

    // Home recommended card update
    const homeTitle = document.getElementById('home-course-title');
    const homeImg = document.getElementById('home-course-img');
    const homeCategory = document.getElementById('home-course-category');

    if (homeImg) {
        homeImg.src = "assets/course_logo.jpeg";
    }

    if (homeTitle) homeTitle.innerText = courseInfo.title;
    if (homeCategory) homeCategory.innerHTML = courseInfo.category;

    if (hasFunoon || hasOmara) {
        if (btnSubscribe) btnSubscribe.classList.add('hidden');
        if (btnWatchCourse) btnWatchCourse.classList.remove('hidden');
    } else {
        if (btnSubscribe) btnSubscribe.classList.remove('hidden');
        if (btnWatchCourse) btnWatchCourse.classList.add('hidden');
    }
}

function renderMyCourses() {
    const container = document.getElementById('my-courses-container');
    if (!container) return;

    container.innerHTML = '';

    const hasFunoon = currentUser.courses && currentUser.courses.includes(DEFAULT_COURSE_ID);
    const hasOmara = currentUser.courses && currentUser.courses.includes('course_02');
    const courseInfo = getStudentCourseInfo(currentUser.courses || []);

    if (hasFunoon || hasOmara) {
        container.innerHTML = `
            <div class="premium-course-card">
                <div class="course-thumbnail">
                    <img src="assets/course_logo.jpeg" alt="Course Logo" class="course-thumbnail-img">
                    <div class="course-thumbnail-overlay"></div>
                </div>
                <div class="course-content">
                    <span class="course-category">${courseInfo.category} — مفعّل لحسابك</span>
                    <h3 class="course-title">${courseInfo.title}</h3>
                    <button class="btn-primary btn-glow" id="btn-watch-my-course">
                        <i class="fa-solid fa-circle-play"></i>
                        <span>ابدأ مشاهدة الدروس</span>
                    </button>
                </div>
            </div>
        `;
        document.getElementById('btn-watch-my-course').addEventListener('click', () => {
            window.location.hash = `#watch-course?courseId=${courseInfo.id}`;
        });
    } else {
        container.innerHTML = '<p class="empty-state-text"><i class="fa-solid fa-circle-exclamation" style="font-size: 1.25rem;"></i> <span>ليس لديك أي كورسات نشطة حالياً. اشترك في الكورس المقترح لتفعيل حسابك.</span></p>';
    }
}

// ==========================================
// 6. PROFILE & PHOTO SETTING
// ==========================================
function loadStudentProfileForm() {
    if (profileNameInput) profileNameInput.value = currentUser.name || '';
    if (profilePhoneInput) profilePhoneInput.value = currentUser.phone || '';
    if (profilePasswordInput) profilePasswordInput.value = '';

    if (profileAvatarPreview) {
        if (currentUser.avatarUrl) {
            profileAvatarPreview.style.backgroundImage = `url(${currentUser.avatarUrl})`;
            profileAvatarPreview.innerHTML = '';
        } else {
            profileAvatarPreview.style.backgroundImage = '';
            profileAvatarPreview.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
    }
}

async function uploadImageToImgBB(file) {
    if (!file || !file.type?.startsWith('image/')) {
        throw new Error('اختر ملف صورة صالح.');
    }

    const base64Content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });

    const bodyData = new FormData();
    bodyData.append('image', base64Content);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: bodyData
    });

    const resJson = await response.json();
    if (!resJson.success || !resJson.data?.url) {
        throw new Error('فشل رفع الصورة إلى ImgBB.');
    }

    return resJson.data.url;
}
if (profileAvatarFile) {
    profileAvatarFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        await withLoading(async () => {
            try {
                const imageUrl = await uploadImageToImgBB(file);

                currentUser.avatarUrl = imageUrl;
                sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));

                const userRef = doc(db, "users", getCurrentStudentDocId());
                await updateDoc(userRef, { avatarUrl: imageUrl });

                loadStudentProfileForm();
                updateStudentSidebarUI();
                alert('تم تغيير صورتك الشخصية بنجاح.');
            } catch (err) {
                console.error("Avatar Upload Error:", err);
                alert('فشل رفع الصورة الشخصية.');
            }
        });
    });
}

if (formStudentProfile) {
    formStudentProfile.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = profileNameInput.value.trim();
        const newPassword = profilePasswordInput.value.trim();

        if (!newName) {
            alert('يرجى إدخال الاسم الكامل.');
            return;
        }

        if (newPassword) {
            if (!validatePasswordField(profilePasswordInput, 'err-profile-password')) {
                return;
            }
        }

        await withLoading(async () => {
            try {
                const userRef = doc(db, "users", getCurrentStudentDocId());
                const updates = { name: newName };

                if (newPassword) {
                    if (!auth.currentUser) {
                        throw new Error('جلسة الطالب غير موثقة. سجل الدخول مرة أخرى.');
                    }
                    await updatePassword(auth.currentUser, newPassword);
                }

                await updateDoc(userRef, updates);

                currentUser.name = newName;
                sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));

                loadStudentProfileForm();
                updateStudentSidebarUI();
                updateWelcomeNotification();
                alert('تم حفظ تعديلات الملف الشخصي بنجاح.');
            } catch (err) {
                console.error("Profile Save Error:", err);
                alert('فشل حفظ البيانات.');
            }
        });
    });
}

if (btnSubscribe) {
    btnSubscribe.addEventListener('click', () => {
        const instructionsHash = '#/instructions';
        if (window.location.hash === instructionsHash) {
            handleRouting();
        } else {
            window.location.hash = instructionsHash;
        }
    });
}

// ==========================================
// 7. PURCHASE INSTRUCTION VIEW
// ==========================================

// ==========================================
// 8. VIDEO WATERMARK LAYER (ANTI-PIRACY)
// ==========================================
if (btnWatchCourse) {
    btnWatchCourse.addEventListener('click', async () => {
        await withLoading(async () => {
            try {
                const userRef = doc(db, "users", getCurrentStudentDocId());
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const courses = userSnap.data().courses || [];
                    const hasAccess = courses.includes(DEFAULT_COURSE_ID) || courses.includes('course_02');
                    
                    if (hasAccess) {
                        const hasOmara = courses.includes('course_02');
                        window.location.hash = `#watch-course?courseId=${hasOmara ? 'course_02' : DEFAULT_COURSE_ID}`;
                    } else {
                        alert('عذرًا، لم يتم تفعيل هذا الكورس لحسابك بعد. يرجى التواصل مع لوحة الادمن.');
                    }
                } else {
                    alert('عذرًا، لم يتم العثور على حسابك.');
                }
            } catch (e) {
                console.error("Verification Error:", e);
                alert('فشل التحقق من صلاحيات الوصول.');
            }
        });
    });
}

function startWatermark() {
    const wmEl = document.getElementById('video-watermark');
    if (!wmEl) return;
    wmEl.innerText = currentUser?.phone || '01xxxxxxxxx';

    // Clear any previous interval
    if (watermarkInterval) {
        clearInterval(watermarkInterval);
        watermarkInterval = null;
    }

    const updateWatermarkPosition = () => {
        const videoEl = document.getElementById('drive-iframe-wrapper');
        if (!videoEl || !wmEl) return;
        
        const videoWidth = videoEl.clientWidth;
        const videoHeight = videoEl.clientHeight;
        
        const watermarkWidth = wmEl.clientWidth || 100;
        const watermarkHeight = wmEl.clientHeight || 20;

        if (videoWidth > 0 && videoHeight > 0) {
            // Constrain between 15% and 80% to avoid native controls (top right / bottom bar)
            const minX = videoWidth * 0.15;
            const minY = videoHeight * 0.15;
            
            const maxX = Math.max(minX, (videoWidth * 0.80) - watermarkWidth);
            const maxY = Math.max(minY, (videoHeight * 0.80) - watermarkHeight);

            const randomX = Math.max(minX, Math.floor(Math.random() * (maxX - minX + 1)) + minX);
            const randomY = Math.max(minY, Math.floor(Math.random() * (maxY - minY + 1)) + minY);

            wmEl.style.left = `${randomX}px`;
            wmEl.style.top = `${randomY}px`;
        }
    };

    updateWatermarkPosition();
    watermarkInterval = setInterval(updateWatermarkPosition, 4000);
}

function stopWatermark() {
    if (watermarkInterval) {
        clearInterval(watermarkInterval);
        watermarkInterval = null;
    }
}

// ==========================================
// 9. ADMINISTRATIVE PORTAL WORKSTATION
// ==========================================

// --- State and Listeners ---
let currentSelectedCourseId = 'course_01'; // Default
let adminDeviceLogs = [];
let activeAdminViewUnsub = null;

// Firebase Authentication State listener
// Firebase Authentication State listener with cyclical call prevention
let lastAuthUid = null;
let lastAuthEmail = null;

onAuthStateChanged(auth, async (user) => {
    const currentUid = user ? user.uid : null;
    const currentEmail = user ? user.email : null;

    if (currentUid === lastAuthUid && currentEmail === lastAuthEmail) {
        if (!isAuthResolved) {
            isAuthResolved = true;
            handleRouting();
        }
        return;
    }

    lastAuthUid = currentUid;
    lastAuthEmail = currentEmail;

    if (user && user.email === 'admin@monaliza.com') {
        currentUser = { phone: 'admin', role: 'admin', email: user.email };
        sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));
        isAuthResolved = true;
        await handleRouting();
    } else if (user && user.email?.endsWith(`@${STUDENT_AUTH_DOMAIN}`)) {
        try {
            const studentRecord = await loadStudentDataByUid(user.uid);
            if (studentRecord) {
                currentUser = buildStudentSession(user.uid, studentRecord.data);
                sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));
                attachSessionWatcher(user.uid);
                isAuthResolved = true;
                await handleRouting();
            } else {
                isAuthResolved = true;
                await handleRouting();
            }
        } catch (err) {
            console.error('Student auth restore failed:', err);
            isAuthResolved = true;
            await handleRouting();
        }
    } else {
        detachSessionListener();
        clearSessionLocalData();
        currentUser = null;
        sessionStorage.removeItem('monaliza_user');
        isAuthResolved = true;
        await handleRouting();
    }
});

// Admin Navigation listeners
adminNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        adminNavBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTab = btn.getAttribute('data-tab');
        adminTabViews.forEach(v => {
            if (v.id === targetTab) {
                v.classList.remove('hidden');
            } else {
                v.classList.add('hidden');
            }
        });

        if (targetTab === 'tab-stats') {
            loadProvisioningStudents();
        } else if (targetTab === 'tab-courses') {
            loadCourseManagement();
        } else if (targetTab === 'tab-store-admin') {
            loadStoreAdmin();
        } else if (targetTab === 'tab-settings') {
            loadAdminSettingsForm();
        }

        if (window.innerWidth <= 1024 && adminSidebar) {
            adminSidebar.classList.remove('active');
        }
    });
});

if (btnAdminBackSite) {
    btnAdminBackSite.addEventListener('click', () => {
        window.location.hash = '#/login';
    });
}

if (btnAdminMenuToggle) {
    btnAdminMenuToggle.addEventListener('click', () => {
        if (adminSidebar) {
            adminSidebar.classList.toggle('active');
        }
    });
}

// 404 Back Button
const btn404Back = document.getElementById('btn-404-back-site');
if (btn404Back) {
    btn404Back.addEventListener('click', () => {
        window.location.hash = '#/login';
    });
}

// Keydown input listeners to reject Arabic entries
if (inputAdminPhone) {
    inputAdminPhone.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D+/g, ''); // Numeric only
    });
}
if (inputAdminPassword) {
    inputAdminPassword.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, ''); // Reject Arabic characters
    });
}

// Admin login form submit
if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        let isValid = true;
        const phone = inputAdminPhone.value.trim();
        const password = inputAdminPassword.value.trim();

        if (!validatePhoneField(inputAdminPhone, 'err-admin-phone')) {
            isValid = false;
        }
        if (!validatePasswordField(inputAdminPassword, 'err-admin-password')) {
            isValid = false;
        }

        if (!isValid) return;

        if (!navigator.onLine) {
            showToast('لا يوجد اتصال بالإنترنت حالياً.', 'error');
            return;
        }

        await withLoading(async () => {
            try {
                try {
                    await signInWithEmailAndPassword(auth, 'admin@monaliza.com', password);
                } catch (firstErr) {
                    // Try with a trailing space as a fallback
                    try {
                        await signInWithEmailAndPassword(auth, 'admin@monaliza.com', password + ' ');
                    } catch (secErr) {
                        throw firstErr;
                    }
                }

                const authRef = doc(db, "admin_settings", "auth");
                const authSnap = await getDoc(authRef);
                
                if (!authSnap.exists()) {
                    await signOut(auth);
                    showError(inputAdminPhone, 'err-admin-phone', 'لا توجد بيانات إعدادات الأدمن.');
                    return;
                }
                
                const adminData = authSnap.data();
                
                if (adminData.phone !== phone) {
                    await signOut(auth);
                    showError(inputAdminPhone, 'err-admin-phone', 'رقم الهاتف هذا غير مطابق لبيانات الأدمن.');
                    return;
                }

                currentUser = { phone, role: 'admin' };
                sessionStorage.setItem('monaliza_user', JSON.stringify(currentUser));
                isAuthResolved = true;
                showToast('تم تسجيل الدخول بنجاح.', 'success');

                const targetAdminHash = `#/${adminData.loginHash || 'admin'}`;
                if (window.location.hash !== targetAdminHash) {
                    window.location.hash = targetAdminHash;
                }
                await handleRouting();
            } catch (err) {
                console.error("Admin Login Auth Error:", err);
                if (err?.code === 'auth/too-many-requests') {
                    showError(inputAdminPassword, 'err-admin-password', getFirebaseErrorMessage(err));
                } else {
                    showError(inputAdminPassword, 'err-admin-password', 'بيانات لوحة الادمن غير صحيحة.');
                }
            }
        });
    });
}

// Parse userAgent into clean device label — REMOVED
// logAdminLoginDevice — REMOVED

async function loadAdminDashboard() {
    if (activeAdminViewUnsub) {
        activeAdminViewUnsub.users();
        activeAdminViewUnsub.videos();
        activeAdminViewUnsub.publicSettings();
    }

    // Force reset search input on dashboard initialization
    const searchInput = document.getElementById('admin-student-search-input');
    if (searchInput) searchInput.value = '';

    // 1. Listen to total users count and active subscribers count
    const usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
        let studentCount = 0;
        let subscriberCount = 0;
        snap.forEach(d => {
            const data = d.data();
            if (data.role === 'student') {
                studentCount++;
                const courses = data.courses || [];
                if (courses.includes(DEFAULT_COURSE_ID) || courses.includes('course_02')) {
                    subscriberCount++;
                }
            }
        });
        if (statTotalStudents) statTotalStudents.innerText = `${studentCount} طالب`;
        const statTotalSubscribers = document.getElementById('stat-total-subscribers');
        if (statTotalSubscribers) statTotalSubscribers.innerText = `${subscriberCount} مشترك`;
        
        // Render provisioning list if currently open
        if (!document.getElementById('tab-stats').classList.contains('hidden')) {
            renderProvisioningUsers(snap);
        }
    });

    // 2. Listen to course contents count (only videos)
    const contentsUnsub = onSnapshot(collection(db, "course_contents"), (snap) => {
        let videos = 0;
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.type === 'video') videos++;
        });
        const statTotalVideos = document.getElementById('stat-total-videos');
        if (statTotalVideos) statTotalVideos.innerText = `${videos} فيديو`;
    });

    activeAdminViewUnsub = {
        users: usersUnsub,
        videos: contentsUnsub,
        publicSettings: () => {}
    };
}

// ==========================================
// 10. COURSE PROVISIONING LOGIC (MAPPED TAB)
// ==========================================
let provisioningUsersData = [];
let provisioningUnsub = null;

// Standalone loader called when the tab is opened
async function loadProvisioningStudents() {
    if (!provisioningUsersList) return;
    provisioningUsersList.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-sub);"><i class="fa-solid fa-spinner fa-spin" style="margin-left:8px;"></i>جاري تحميل بيانات الطلاب...</td></tr>`;

    const searchInput = document.getElementById('admin-student-search-input');
    if (searchInput) {
        // Add readonly immediately to block Chrome autofill from placing values
        searchInput.setAttribute('readonly', 'true');
        searchInput.value = '';
        // After a short delay (after browser might autofill), force clear again and restore readonly
        setTimeout(() => {
            searchInput.value = '';
            searchInput.setAttribute('autocomplete', 'new-password');
        }, 100);
        setTimeout(() => {
            searchInput.value = '';
        }, 300);
    }

    // Unsubscribe from any previous listener
    if (provisioningUnsub) { provisioningUnsub(); provisioningUnsub = null; }

    try {
        const usersCol = collection(db, "users");
        // Real-time listener so changes reflect instantly
        provisioningUnsub = onSnapshot(usersCol, (snap) => {
            provisioningUsersData = [];
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.role === 'student') {
                    provisioningUsersData.push({ uid: docSnap.id, phone: data.phone || docSnap.id, ...data });
                }
            });
            updateProvisioningTable('');
        }, (err) => {
            console.error('Provisioning snapshot error:', err);
            if (provisioningUsersList) {
                provisioningUsersList.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--danger);">فشل تحميل بيانات الطلاب — تحقق من صلاحيات Firestore.</td></tr>`;
            }
        });
    } catch (e) {
        console.error('loadProvisioningStudents error:', e);
    }
}

function renderProvisioningUsers(allUsersSnap) {
    if (!provisioningUsersList) return;
    
    provisioningUsersData = [];
    allUsersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.role === 'student') {
            provisioningUsersData.push({ uid: docSnap.id, phone: data.phone || docSnap.id, ...data });
        }
    });
    
    updateProvisioningTable(provisioningSearchInput ? provisioningSearchInput.value : '');
}

function updateProvisioningTable(searchTerm) {
    if (!provisioningUsersList) return;
    provisioningUsersList.innerHTML = '';
    
    const term = searchTerm.trim().toLowerCase();
    const filtered = provisioningUsersData.filter(u => {
        if (term === '') return true;
        const nameMatch = u.name && u.name.toLowerCase().includes(term);
        const phoneMatch = u.phone && u.phone.includes(term);
        return nameMatch || phoneMatch;
    });

    if (filtered.length === 0) {
        provisioningUsersList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">لا يوجد طلاب مطابقين للبحث.</td></tr>';
        return;
    }

    filtered.forEach(u => {
        const tr = document.createElement('tr');
        const activeCourseBadges = [];
        if (u.courses && u.courses.includes(DEFAULT_COURSE_ID)) {
            activeCourseBadges.push(`<span class="status-active-badge" style="background-color: var(--accent-purple); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">كورس قدرات الفنون</span>`);
        }
        if (u.courses && u.courses.includes('course_02')) {
            activeCourseBadges.push(`<span class="status-active-badge" style="background-color: var(--accent-cyan); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">كورس قدرات العمارة</span>`);
        }
        const courseBadge = activeCourseBadges.length > 0
            ? `<div style="display:flex; flex-wrap:wrap; gap:6px;">${activeCourseBadges.join('')}</div>`
            : `<span class="status-pending-badge" style="background-color: var(--card-border); color: var(--text-sub); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">لا يوجد كورس مفعّل</span>`;

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : 'var(--accent-cyan)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink:0;">
                        ${u.avatarUrl ? '' : '<i class="fa-solid fa-user"></i>'}
                    </div>
                    <strong>${u.name || 'غير مسجل'}</strong>
                </div>
            </td>
            <td dir="ltr" style="text-align: right;">${u.phone}</td>
            <td>
                ${courseBadge}
            </td>
            <td>
                <button class="btn-primary edit-provisioning-btn" data-user-id="${u.uid}" style="padding: 5px 12px; font-size: 0.8rem; border-radius: 6px; box-shadow: none;">إدارة</button>
            </td>
        `;
        provisioningUsersList.appendChild(tr);
    });

    document.querySelectorAll('.edit-provisioning-btn').forEach(btn => {
        btn.onclick = () => {
            const userId = btn.getAttribute('data-user-id');
            openStudentProvisioningModal(userId);
        };
    });
}

if (provisioningSearchInput) {
    // Remove readonly on first user interaction so Chrome can't autofill before that
    provisioningSearchInput.addEventListener('focus', () => {
        provisioningSearchInput.removeAttribute('readonly');
    }, { once: false });

    provisioningSearchInput.addEventListener('input', (e) => {
        updateProvisioningTable(e.target.value);
    });
}

// Student edit provisioning details modal
function openStudentProvisioningModal(userId) {
    const student = provisioningUsersData.find(u => u.uid === userId);
    if (!student) return;

    currentProvisioningStudentPhone = student.phone;

    const modal = document.getElementById('provisioning-modal');
    const avatar = document.getElementById('provisioning-student-avatar');
    const nameText = document.getElementById('provisioning-student-name');
    const phoneText = document.getElementById('provisioning-student-phone');

    const toggleFunoon = document.getElementById('toggle-course-funoon');
    const toggleOmara = document.getElementById('toggle-course-omara');
    const btnSave = document.getElementById('btn-save-provisioning');

    if (!modal) return;

    // Fill details
    if (avatar) {
        if (student.avatarUrl) {
            avatar.style.backgroundImage = `url(${student.avatarUrl})`;
            avatar.innerHTML = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
    }
    if (nameText) nameText.innerText = student.name || 'طالب موناليزا';
    if (phoneText) phoneText.innerText = student.phone || userId;

    // Actual values from database
    const dbHasFunoon = student.courses && student.courses.includes(DEFAULT_COURSE_ID);
    const dbHasOmara = student.courses && student.courses.includes('course_02');

    // Initialize toggles with actual values
    toggleFunoon.checked = dbHasFunoon;
    toggleOmara.checked = dbHasOmara;

    // Local state variables represent current toggle states
    let localHasFunoon = dbHasFunoon;
    let localHasOmara = dbHasOmara;

    // Function to check if changes were made and enable/disable Save button
    const checkIfChanged = () => {
        const changed = (localHasFunoon !== dbHasFunoon) || (localHasOmara !== dbHasOmara);
        if (btnSave) {
            btnSave.disabled = !changed;
            if (changed) {
                btnSave.style.backgroundColor = 'var(--accent-purple)';
                btnSave.style.color = '#fff';
                btnSave.style.cursor = 'pointer';
                btnSave.style.opacity = '1';
            } else {
                btnSave.style.backgroundColor = 'var(--card-border)';
                btnSave.style.color = 'var(--text-sub)';
                btnSave.style.cursor = 'not-allowed';
                btnSave.style.opacity = '0.5';
            }
        }
    };

    // Exclusive radio behavior: turing one ON turns the other OFF
    toggleFunoon.onchange = () => {
        if (toggleFunoon.checked) {
            toggleOmara.checked = false;
        }
        localHasFunoon = toggleFunoon.checked;
        localHasOmara = toggleOmara.checked;
        checkIfChanged();
    };

    toggleOmara.onchange = () => {
        if (toggleOmara.checked) {
            toggleFunoon.checked = false;
        }
        localHasFunoon = toggleFunoon.checked;
        localHasOmara = toggleOmara.checked;
        checkIfChanged();
    };

    // Initial check
    checkIfChanged();

    // Save action
    if (btnSave) {
        btnSave.onclick = async () => {
            btnSave.disabled = true;
            const studentRef = doc(db, "users", userId);
            const courses = [];
            if (localHasFunoon) courses.push(DEFAULT_COURSE_ID);
            if (localHasOmara) courses.push('course_02');

            try {
                await withLoading(async () => {
                    await updateDoc(studentRef, { courses: courses });
                    student.courses = courses;
                    showToast("تم تحديث صلاحيات الطالب بنجاح.", "success");
                    modal.classList.add('hidden');
                });
            } catch (e) {
                console.error("Failed to save student provisioning:", e);
                showToast("حدث خطأ أثناء حفظ الصلاحيات.", "error");
                btnSave.disabled = false;
            }
        };
    }

    modal.classList.remove('hidden');
}

if (btnCloseProvisioning) {
    btnCloseProvisioning.onclick = () => {
        if (provisioningModal) provisioningModal.classList.add('hidden');
    };
}

// ==========================================
// 11. COURSE CONTENT UPLOAD & MANAGEMENT
// ==========================================
const courseSelectorTabs = document.querySelectorAll('.course-select-tab');
const formUploadSteppedLecture = document.getElementById('form-upload-stepped-lecture');
const courseContentsList = document.getElementById('course-contents-list');
const deleteContentModal = document.getElementById('delete-content-modal');
const deleteContentMessage = document.getElementById('delete-content-message');
const btnCancelDeleteContent = document.getElementById('btn-cancel-delete-content');
const btnConfirmDeleteContent = document.getElementById('btn-confirm-delete-content');
const editContentModal = document.getElementById('edit-content-modal');
const formEditContent = document.getElementById('form-edit-content');
const btnCloseEditContent = document.getElementById('btn-close-edit-content');
const btnCancelEditContent = document.getElementById('btn-cancel-edit-content');
const editContentThumbFile = document.getElementById('edit-content-thumb-file');
const editContentThumbUrl = document.getElementById('edit-content-thumb-url');
const editContentThumbDropzone = document.getElementById('edit-content-thumb-dropzone');
const editContentThumbTitle = document.getElementById('edit-content-thumb-dropzone-title');
const editContentThumbNote = document.getElementById('edit-content-thumb-dropzone-note');
const editContentThumbPreview = document.getElementById('edit-content-thumb-preview');
let pendingDeleteResolver = null;
let courseContentItems = new Map();
let currentEditingContent = null;

courseSelectorTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        courseSelectorTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentSelectedCourseId = tab.getAttribute('data-course-id');
        const uploadCourseInput = document.getElementById('stepped-selected-course');
        if (uploadCourseInput) uploadCourseInput.value = currentSelectedCourseId;
        loadCourseManagement();
    });
});

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isFirebaseStorageUrl(url) {
    return Boolean(url && (
        url.includes('firebasestorage.googleapis.com') ||
        url.includes('firebasestorage.app') ||
        url.startsWith('gs://')
    ));
}

function hasFirebaseStorageAsset(item, urlKey, pathKey) {
    return Boolean(item?.[pathKey] || isFirebaseStorageUrl(item?.[urlKey]));
}

function getPrimaryContentUrl(item) {
    return item.type === 'video' ? (item.videoUrl || item.driveFolderUrl || item.folderUrl) : item.fileUrl;
}

const DEFAULT_COURSE_THUMBNAIL = 'assets/course_logo.jpeg';

function getContentStorageStatus(item) {
    if (item.storageProvider === 'external_link') {
        return item.type === 'video'
            ? { className: 'safe', icon: 'fa-brands fa-youtube', label: 'YouTube' }
            : { className: 'safe', icon: 'fa-link', label: 'رابط خارجي' };
    }
    const primarySafe = item.type === 'video'
        ? hasFirebaseStorageAsset(item, 'videoUrl', 'videoStoragePath')
        : hasFirebaseStorageAsset(item, 'fileUrl', 'fileStoragePath');
    const hasThumb = Boolean(item.thumbnailUrl || item.thumbnailStoragePath);
    const thumbSafe = !hasThumb || hasFirebaseStorageAsset(item, 'thumbnailUrl', 'thumbnailStoragePath');

    if (primarySafe && thumbSafe) {
        return { className: 'safe', icon: 'fa-circle-check', label: 'Firebase آمن' };
    }
    if (primarySafe && !thumbSafe) {
        return { className: 'warning', icon: 'fa-triangle-exclamation', label: 'الصورة خارج Firebase' };
    }
    return { className: 'danger', icon: 'fa-circle-exclamation', label: 'راجع التخزين' };
}

function openDeleteConfirmation(message) {
    return new Promise((resolve) => {
        pendingDeleteResolver = resolve;
        if (deleteContentMessage) deleteContentMessage.innerText = message;
        if (deleteContentModal) deleteContentModal.classList.remove('hidden');
    });
}

function closeDeleteConfirmation(result) {
    if (deleteContentModal) deleteContentModal.classList.add('hidden');
    if (pendingDeleteResolver) pendingDeleteResolver(result);
    pendingDeleteResolver = null;
}

if (btnCancelDeleteContent) {
    btnCancelDeleteContent.addEventListener('click', () => closeDeleteConfirmation(false));
}

if (btnConfirmDeleteContent) {
    btnConfirmDeleteContent.addEventListener('click', () => closeDeleteConfirmation(true));
}

if (deleteContentModal) {
    deleteContentModal.addEventListener('click', (e) => {
        if (e.target === deleteContentModal) closeDeleteConfirmation(false);
    });
}

async function deleteStorageAsset(url, storagePath) {
    try {
        if (storagePath) {
            await deleteObject(ref(storage, storagePath));
            return;
        }
        if (isFirebaseStorageUrl(url)) {
            await deleteObject(ref(storage, url));
        }
    } catch (errStorage) {
        console.warn('Storage delete warning:', errStorage);
    }
}

function collectStorageAssets(item) {
    const assets = [];
    if (item.type === 'video') {
        assets.push({ url: item.videoUrl, path: item.videoStoragePath });
    } else {
        assets.push({ url: item.fileUrl, path: item.fileStoragePath });
    }

    assets.push({ url: item.thumbnailUrl, path: item.thumbnailStoragePath });
    return assets.filter(asset => asset.url || asset.path);
}

async function confirmAndDeleteContent(item) {
    const itemLabel = item.type === 'video' ? 'المحاضرة' : 'الملف';
    const ok = await openDeleteConfirmation(
        `هل أنت متأكد من حذف ${itemLabel} "${item.title || 'بدون عنوان'}"؟\n\nسيتم حذف السجل من قاعدة البيانات وحذف أي أصول قديمة مرتبطة من Firebase Storage عندما تكون محفوظة عليه. هذه العملية نهائية ولا يمكن التراجع عنها.`
    );
    if (!ok) return;

    await withLoading(async () => {
        try {
            const assetsToDelete = collectStorageAssets(item);

            await deleteDoc(doc(db, 'course_contents', item.id));

            for (const asset of assetsToDelete) {
                await deleteStorageAsset(asset.url, asset.path);
            }

            showToast('تم الحذف النهائي بنجاح.', 'success');
        } catch (e) {
            console.error('Delete content failed:', e);
            showToast('فشل الحذف. لم يتم استكمال العملية.', 'error');
        }
    });
}

function resetEditThumbnailDropzone(imageUrl = '') {
    if (editContentThumbFile) editContentThumbFile.value = '';
    if (editContentThumbUrl) editContentThumbUrl.value = imageUrl || '';
    if (editContentThumbDropzone) editContentThumbDropzone.classList.toggle('has-image', Boolean(imageUrl));
    if (editContentThumbPreview) {
        editContentThumbPreview.src = imageUrl || '';
        editContentThumbPreview.classList.toggle('hidden', !imageUrl);
    }
    if (editContentThumbTitle) editContentThumbTitle.innerText = imageUrl ? 'صورة الغلاف الحالية' : 'ارفع صورة غلاف جديدة';
    if (editContentThumbNote) editContentThumbNote.innerText = 'اختر صورة جديدة لرفعها إلى ImgBB تلقائياً.';
}

if (editContentThumbFile) {
    editContentThumbFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type?.startsWith('image/')) {
            showToast('اختر ملف صورة صالح.', 'error');
            return;
        }

        await withLoading(async () => {
            try {
                if (editContentThumbDropzone) editContentThumbDropzone.classList.add('is-uploading');
                if (editContentThumbTitle) editContentThumbTitle.innerText = 'جاري رفع الصورة إلى ImgBB...';
                if (editContentThumbNote) editContentThumbNote.innerText = file.name;
                const imageUrl = await uploadImageToImgBB(file);
                resetEditThumbnailDropzone(imageUrl);
                if (editContentThumbTitle) editContentThumbTitle.innerText = 'تم رفع صورة الغلاف بنجاح';
                showToast('تم رفع صورة الغلاف إلى ImgBB.', 'success');
            } catch (err) {
                console.error('Edit thumbnail upload error:', err);
                showToast(err.message || 'فشل رفع صورة الغلاف.', 'error');
            } finally {
                if (editContentThumbDropzone) editContentThumbDropzone.classList.remove('is-uploading');
            }
        });
    });
}

function openEditContentModal(item) {
    currentEditingContent = item;
    document.getElementById('edit-content-id').value = item.id;
    document.getElementById('edit-content-type').value = item.type;
    document.getElementById('edit-content-course').value = item.courseId || currentSelectedCourseId;
    document.getElementById('edit-content-title').value = item.title || '';
    document.getElementById('edit-content-desc').value = item.description || '';
    resetEditThumbnailDropzone(item.thumbnailUrl || '');
    
    document.getElementById('edit-lecture-video').value = item.videoUrl || '';
    document.getElementById('edit-lecture-folder').value = item.folderUrl || item.driveFolderUrl || '';
    
    if (editContentModal) editContentModal.classList.remove('hidden');
}

function closeEditContentModal() {
    if (editContentModal) editContentModal.classList.add('hidden');
    currentEditingContent = null;
    if (formEditContent) formEditContent.reset();
    resetEditThumbnailDropzone('');
}

if (btnCloseEditContent) btnCloseEditContent.addEventListener('click', closeEditContentModal);
if (btnCancelEditContent) btnCancelEditContent.addEventListener('click', closeEditContentModal);
if (editContentModal) {
    editContentModal.addEventListener('click', (e) => {
        if (e.target === editContentModal) closeEditContentModal();
    });
}

if (formEditContent) {
    formEditContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditingContent) return;

        const contentId = document.getElementById('edit-content-id').value;
        const type = document.getElementById('edit-content-type').value;
        const newCourseId = document.getElementById('edit-content-course').value;
        const title = document.getElementById('edit-content-title').value.trim();
        const description = document.getElementById('edit-content-desc').value.trim();
        const thumbnailUrl = document.getElementById('edit-content-thumb-url').value.trim() || DEFAULT_COURSE_THUMBNAIL;
        const videoUrl = document.getElementById('edit-lecture-video').value.trim();
        const folderUrl = document.getElementById('edit-lecture-folder').value.trim();

        if (!title) {
            showToast('اكتب عنوان المحتوى قبل الحفظ.', 'error');
            return;
        }

        if (!videoUrl) {
            showToast('ضع رابط فيديو المحاضرة (جوجل درايف).', 'error');
            return;
        }
        if (!folderUrl) {
            showToast('ضع رابط مجلد المرفقات والملفات.', 'error');
            return;
        }

        await withLoading(async () => {
            try {
                const updateData = {
                    courseId: newCourseId,
                    title,
                    description,
                    thumbnailUrl,
                    videoUrl,
                    folderUrl,
                    driveFolderUrl: folderUrl,
                    storageProvider: 'external_link',
                    contentSource: 'google_drive_folder',
                    updatedAt: Date.now(),
                    videoStoragePath: deleteField(),
                    thumbnailStoragePath: deleteField()
                };

                await updateDoc(doc(db, 'course_contents', contentId), updateData);
                showToast('تم تعديل المحتوى بنجاح.', 'success');
                closeEditContentModal();
            } catch (err) {
                console.error('Edit content failed:', err);
                showToast(err.message || 'فشل تعديل المحتوى.', 'error');
            }
        });
    });
}

let courseContentsUnsub = null;
async function loadCourseManagement() {
    try {
        if (courseContentsUnsub) courseContentsUnsub();

        const contentsCol = collection(db, 'course_contents');
        const contentsQuery = query(contentsCol, where('courseId', '==', currentSelectedCourseId));

        courseContentsUnsub = onSnapshot(contentsQuery, (snap) => {
            if (!courseContentsList) return;
            courseContentsList.innerHTML = '';
            courseContentItems = new Map();

            const list = [];
            snap.forEach(d => {
                list.push({ id: d.id, ...d.data() });
            });

            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            if (list.length === 0) {
                courseContentsList.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-sub);">لا يوجد محتوى منشور حالياً في هذا الكورس.</td></tr>`;
                return;
            }

            list.forEach(item => {
                courseContentItems.set(item.id, item);
                const tr = document.createElement('tr');
                const typeIcon = item.type === 'video'
                    ? '<i class="fa-solid fa-video" style="color:var(--accent-purple);"></i> محاضرة'
                    : '<i class="fa-solid fa-file-lines" style="color:#d97706;"></i> ملف';
                const status = getContentStorageStatus(item);
                const previewUrl = getPrimaryContentUrl(item) || '#';
                const thumbnailUrl = item.thumbnailUrl || 'assets/course_logo.jpeg';

                tr.innerHTML = `
                    <td><strong>${typeIcon}</strong></td>
                    <td>
                        <img src="${escapeHtml(thumbnailUrl)}" alt="" style="width: 56px; height: 38px; border-radius: 6px; object-fit: cover; border:1px solid var(--card-border);">
                    </td>
                    <td>
                        <div style="font-weight:800;">${escapeHtml(item.title || '')}</div>
                        <div style="font-size:0.75rem; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;">${escapeHtml(item.description || '')}</div>
                    </td>
                    <td>
                        <span class="storage-status-badge ${status.className}"><i class="fa-solid ${status.icon}"></i>${status.label}</span>
                    </td>
                    <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG') : ''}</td>
                    <td>
                        <div class="content-actions" style="display: flex; gap: 8px;">
                            <a href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener" class="btn-primary" style="background-color: #2563eb; font-size: 0.8rem; padding: 6px 12px; gap: 6px;"><i class="fa-solid fa-eye"></i> معاينة</a>
                            <button type="button" class="btn-primary edit-content-btn" data-id="${escapeHtml(item.id)}" style="background-color: #7c3aed; font-size: 0.8rem; padding: 6px 12px; gap: 6px;"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
                            <button type="button" class="btn-primary delete-content-btn" data-id="${escapeHtml(item.id)}" style="background-color: var(--danger); font-size: 0.8rem; padding: 6px 12px; gap: 6px;"><i class="fa-solid fa-trash"></i> حذف</button>
                        </div>
                    </td>
                `;
                courseContentsList.appendChild(tr);
            });

            courseContentsList.querySelectorAll('.edit-content-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const item = courseContentItems.get(btn.getAttribute('data-id'));
                    if (item) openEditContentModal(item);
                });
            });
            courseContentsList.querySelectorAll('.delete-content-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const item = courseContentItems.get(btn.getAttribute('data-id'));
                    if (item) confirmAndDeleteContent(item);
                });
            });
        });
    } catch (e) {
        console.error('Failed to load course contents', e);
    }
}

if (formUploadSteppedLecture) {
    const inputSelectedCourse = document.getElementById('stepped-selected-course');
    const submitLabel = document.getElementById('btn-submit-stepped-label');
    const titleLabel = document.getElementById('stepped-title-label');
    const descLabel = document.getElementById('stepped-desc-label');
    const thumbLabel = document.getElementById('stepped-thumb-label');
    const thumbFileInput = document.getElementById('stepped-lecture-thumb-file');
    const thumbUrlInput = document.getElementById('stepped-lecture-thumb-url');
    const thumbDropzone = document.getElementById('stepped-lecture-thumb-dropzone');
    const thumbDropzoneTitle = document.getElementById('stepped-lecture-thumb-dropzone-title');
    const thumbDropzoneNote = document.getElementById('stepped-lecture-thumb-dropzone-note');
    const thumbPreview = document.getElementById('stepped-lecture-thumb-preview');

    if (inputSelectedCourse) inputSelectedCourse.value = currentSelectedCourseId;

    function updateThumbProgress(percent, statusText) {
        const progressContainer = document.getElementById('stepped-progress-container');
        const percentText = document.getElementById('stepped-thumb-percent');
        const bar = document.getElementById('stepped-thumb-bar');
        const status = document.getElementById('stepped-thumb-status');
        const roundedPercent = Math.max(0, Math.min(100, Math.round(percent)));
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (percentText) percentText.innerText = `${roundedPercent}%`;
        if (bar) bar.style.width = `${roundedPercent}%`;
        if (status) status.innerText = statusText;
    }

    function resetThumbnailDropzone() {
        if (thumbFileInput) thumbFileInput.value = '';
        if (thumbUrlInput) thumbUrlInput.value = '';
        if (thumbDropzone) thumbDropzone.classList.remove('has-image', 'is-uploading');
        if (thumbPreview) {
            thumbPreview.src = '';
            thumbPreview.classList.add('hidden');
        }
        if (thumbDropzoneTitle) thumbDropzoneTitle.innerText = 'ارفع صورة غلاف المحاضرة';
        if (thumbDropzoneNote) thumbDropzoneNote.innerText = 'سيتم رفع الصورة تلقائياً إلى ImgBB، أو اتركها لاستخدام صورة الكورس الافتراضية.';
        const progressContainer = document.getElementById('stepped-progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
    }

    async function handleThumbnailFileUpload(file) {
        if (!file) return;
        if (!file.type?.startsWith('image/')) {
            showToast('اختر ملف صورة صالح لغلاف المحاضرة.', 'error');
            resetThumbnailDropzone();
            return;
        }

        try {
            if (thumbDropzone) thumbDropzone.classList.add('is-uploading');
            if (thumbDropzoneTitle) thumbDropzoneTitle.innerText = 'جاري رفع الصورة إلى ImgBB...';
            if (thumbDropzoneNote) thumbDropzoneNote.innerText = file.name;
            updateThumbProgress(15, 'جاري رفع صورة الغلاف إلى ImgBB...');

            const imageUrl = await uploadImageToImgBB(file);
            if (thumbUrlInput) thumbUrlInput.value = imageUrl;
            if (thumbPreview) {
                thumbPreview.src = imageUrl;
                thumbPreview.classList.remove('hidden');
            }
            if (thumbDropzone) thumbDropzone.classList.add('has-image');
            if (thumbDropzoneTitle) thumbDropzoneTitle.innerText = 'تم رفع صورة الغلاف بنجاح';
            if (thumbDropzoneNote) thumbDropzoneNote.innerText = 'سيتم حفظ رابط ImgBB تلقائياً مع المحاضرة.';
            updateThumbProgress(100, 'اكتمل رفع صورة الغلاف');
            showToast('تم رفع صورة الغلاف إلى ImgBB.', 'success');
        } catch (err) {
            console.error('Lecture thumbnail upload error:', err);
            showToast(err.message || 'فشل رفع صورة الغلاف.', 'error');
            resetThumbnailDropzone();
        } finally {
            if (thumbDropzone) thumbDropzone.classList.remove('is-uploading');
        }
    }

    if (thumbFileInput) {
        thumbFileInput.addEventListener('change', (e) => {
            handleThumbnailFileUpload(e.target.files?.[0]);
        });
    }

    document.getElementById('stepped-lecture-title').required = true;
    const lectureVideoInput = document.getElementById('admin-lecture-video');
    if (lectureVideoInput) lectureVideoInput.required = true;
    const lectureFolderInput = document.getElementById('admin-lecture-folder');
    if (lectureFolderInput) lectureFolderInput.required = true;

    formUploadSteppedLecture.addEventListener('submit', async (e) => {
        e.preventDefault();

        const courseId = inputSelectedCourse.value;
        const lectureTitle = document.getElementById('stepped-lecture-title').value.trim();
        const lectureDesc = document.getElementById('stepped-lecture-desc').value.trim();
        const lectureThumbUrl = document.getElementById('stepped-lecture-thumb-url').value.trim() || DEFAULT_COURSE_THUMBNAIL;
        const lectureVideoUrl = document.getElementById('admin-lecture-video').value.trim();
        const lectureFolderUrl = document.getElementById('admin-lecture-folder').value.trim();

        if (!courseId || !lectureTitle) {
            showToast('اختر الكورس واكتب العنوان.', 'error');
            return;
        }

        if (!lectureVideoUrl) {
            showToast('ضع رابط فيديو المحاضرة (جوجل درايف).', 'error');
            return;
        }
        if (!lectureFolderUrl) {
            showToast('ضع رابط مجلد المرفقات والملفات.', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-stepped-lecture');
        submitBtn.disabled = true;

        await withLoading(async () => {
            try {
                await setDoc(doc(collection(db, 'course_contents')), {
                    courseId: courseId,
                    type: 'video',
                    title: lectureTitle,
                    description: lectureDesc,
                    thumbnailUrl: lectureThumbUrl,
                    videoUrl: lectureVideoUrl,
                    folderUrl: lectureFolderUrl,
                    driveFolderUrl: lectureFolderUrl,
                    storageProvider: 'external_link',
                    contentSource: 'google_drive_folder',
                    createdAt: Date.now()
                });

                showToast('تم نشر المحاضرة بنجاح.', 'success');

                formUploadSteppedLecture.reset();
                resetThumbnailDropzone();
                if (inputSelectedCourse) inputSelectedCourse.value = currentSelectedCourseId;

                loadCourseManagement();
            } catch (err) {
                console.error('Stepped lecture publish error:', err);
                showToast(err.message || 'فشل نشر المحتوى.', 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
    });
}
// 12. ADMIN SETTINGS MANAGEMENT
// ==========================================
const inputSettingsPhone = document.getElementById('settings-admin-phone');
const inputSettingsPassword = document.getElementById('settings-admin-password');
const inputSettingsHash = document.getElementById('settings-admin-hash');
const previewFinalLink = document.getElementById('settings-preview-link');
const btnSaveSettings = document.querySelector('#form-admin-settings button[type="submit"]');

if (inputSettingsPhone) {
    inputSettingsPhone.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D+/g, '');
    });
}
if (inputSettingsPassword) {
    inputSettingsPassword.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, '');
    });
}

let storedSettingsPhone = '';
let storedSettingsHash = '';

async function loadAdminSettingsForm() {
    try {
        const authDocRef = doc(db, "admin_settings", "auth");
        const authSnap = await getDoc(authDocRef);
        
        if (authSnap.exists()) {
            const data = authSnap.data();
            storedSettingsPhone = data.phone || '';
            storedSettingsHash = data.loginHash || '';
            
            if (inputSettingsPhone) inputSettingsPhone.value = storedSettingsPhone;
            if (inputSettingsHash) inputSettingsHash.value = storedSettingsHash;
            if (inputSettingsPassword) inputSettingsPassword.value = '';
            
            updateLivePreviewAndSaveState();
        }
    } catch (e) {
        console.error("Load settings failed:", e);
    }
}

function updateLivePreviewAndSaveState() {
    const enteredPhone = inputSettingsPhone ? inputSettingsPhone.value.trim() : '';
    const enteredHash = inputSettingsHash ? inputSettingsHash.value.trim().replace(/[^a-zA-Z0-9_\-]/g, '') : '';
    const enteredPassword = inputSettingsPassword ? inputSettingsPassword.value.trim() : '';

    if (inputSettingsHash) {
        inputSettingsHash.value = enteredHash;
    }

    const currentUrl = window.location.href.split('#')[0];
    const finalUrl = `${currentUrl}#${enteredHash}`;

    // Update the existing preview link element already in HTML
    const previewEl = document.getElementById('settings-preview-link');
    if (previewEl) {
        const spanEl = previewEl.querySelector('span');
        if (spanEl) {
            spanEl.textContent = finalUrl;
        } else {
            previewEl.textContent = finalUrl;
        }
    }

    const phoneChanged = enteredPhone !== storedSettingsPhone;
    const hashChanged = enteredHash !== storedSettingsHash;
    const passwordChanged = enteredPassword.length > 0;

    if (btnSaveSettings) {
        if (phoneChanged || hashChanged || passwordChanged) {
            btnSaveSettings.disabled = false;
            btnSaveSettings.style.opacity = '1';
            btnSaveSettings.style.cursor = 'pointer';
        } else {
            btnSaveSettings.disabled = true;
            btnSaveSettings.style.opacity = '0.45';
            btnSaveSettings.style.cursor = 'not-allowed';
        }
    }
}


[inputSettingsPhone, inputSettingsHash, inputSettingsPassword].forEach(input => {
    if (input) {
        input.addEventListener('input', updateLivePreviewAndSaveState);
    }
});

// ==========================================
// ADMIN SETTINGS — Save with old-password confirmation modal
// ==========================================

// Pending save data (set when user clicks Save, used after old-password confirmed)
let _pendingSettingsData = null;

if (formAdminSettings) {
    formAdminSettings.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPhone = inputSettingsPhone.value.trim();
        const newHash = inputSettingsHash.value.trim();
        const newPassword = inputSettingsPassword.value.trim();

        if (newPhone.length < 11) {
            showToast("رقم الهاتف يجب أن يتكون من 11 رقماً على الأقل.", "error");
            return;
        }
        if (!newHash) {
            showToast("رابط الهاش لا يمكن أن يكون فارغاً.", "error");
            return;
        }
        if (newPassword.length > 0 && newPassword.length < 6) {
            showToast("كلمة المرور يجب أن تتكون من 6 رموز على الأقل.", "error");
            return;
        }

        // Store pending data and open confirm-old-password modal
        _pendingSettingsData = { newPhone, newHash, newPassword };
        const confirmModal = document.getElementById('confirm-old-password-modal');
        const confirmInput = document.getElementById('confirm-old-password-input');
        const confirmError = document.getElementById('confirm-old-password-error');
        if (confirmModal) {
            if (confirmInput) confirmInput.value = '';
            if (confirmError) confirmError.classList.add('hidden');
            confirmModal.classList.remove('hidden');
            setTimeout(() => confirmInput && confirmInput.focus(), 100);
        }
    });
}

// Close / Cancel confirm old password modal
const btnCancelConfirmOldPw = document.getElementById('btn-cancel-confirm-old-password');
if (btnCancelConfirmOldPw) {
    btnCancelConfirmOldPw.addEventListener('click', () => {
        const modal = document.getElementById('confirm-old-password-modal');
        if (modal) modal.classList.add('hidden');
        _pendingSettingsData = null;
    });
}

// Submit confirm old password — verify then save
const btnSubmitConfirmOldPw = document.getElementById('btn-submit-confirm-old-password');
if (btnSubmitConfirmOldPw) {
    btnSubmitConfirmOldPw.addEventListener('click', async () => {
        const confirmInput = document.getElementById('confirm-old-password-input');
        const confirmError = document.getElementById('confirm-old-password-error');
        const enteredOldPw = confirmInput ? confirmInput.value.trim() : '';

        if (!enteredOldPw) {
            if (confirmError) confirmError.classList.remove('hidden');
            return;
        }

        await withLoading(async () => {
            try {
                // Fetch current stored hash from Firestore
                const authRef = doc(db, "admin_settings", "auth");
                const authSnap = await getDoc(authRef);
                if (!authSnap.exists()) {
                    showToast("تعذر التحقق من البيانات. حاول مجدداً.", "error");
                    return;
                }
                const storedHash = authSnap.data().password || '';
                const enteredHash = await hashSHA256(enteredOldPw);

                const isPlainMatch = (storedHash.trim() === enteredOldPw.trim());
                const isHashMatch = (enteredHash === storedHash);

                if (storedHash && !isPlainMatch && !isHashMatch) {
                    if (confirmError) confirmError.classList.remove('hidden');
                    return;
                }

                // Old password verified → proceed with saving
                const modal = document.getElementById('confirm-old-password-modal');
                if (modal) modal.classList.add('hidden');

                const { newPhone, newHash, newPassword } = _pendingSettingsData || {};
                _pendingSettingsData = null;

                const updateData = { phone: newPhone, loginHash: newHash };

                if (newPassword && newPassword.length >= 6) {
                    const hashedNewPw = await hashSHA256(newPassword);
                    updateData.password = hashedNewPw;
                    // Update Firebase Auth password
                    if (auth.currentUser) {
                        await updatePassword(auth.currentUser, newPassword);
                    }
                }

                await updateDoc(authRef, updateData);
                await setDoc(doc(db, "admin_settings", "public"), { loginHash: newHash }, { merge: true });

                showToast("✅ تم حفظ الإعدادات بنجاح! جارٍ تسجيل الخروج لتأكيد البيانات...", "success");

                setTimeout(async () => {
                    await signOut(auth);
                    sessionStorage.removeItem('monaliza_user');
                    currentUser = null;
                    // Redirect to new hash URL
                    window.location.hash = '#' + newHash;
                    handleRouting();
                }, 1800);

            } catch (err) {
                console.error("Save settings error:", err);
                showToast("فشل حفظ البيانات. ربما انتهت صلاحية الجلسة، أعد تسجيل الدخول.", "error");
            }
        });
    });
}

function injectCustomHashInputToHtml() {
    const parentForm = document.getElementById('form-admin-settings');
    if (!parentForm) return;

    // Hash input is now in HTML directly, no need to inject
    const hashInput = document.getElementById('settings-admin-hash');
    if (hashInput && !hashInput.dataset.listenerAttached) {
        hashInput.addEventListener('input', updateLivePreviewAndSaveState);
        hashInput.dataset.listenerAttached = 'true';
    }
}

function setupStudentMobileBurgerMenu() {
    const burgerBtn = document.getElementById('btn-student-burger-toggle');
    const sidebar = document.getElementById('student-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const tabBtns = document.querySelectorAll('.student-sidebar .sidebar-tab-btn, .student-sidebar .btn-logout-sidebar');

    if (!burgerBtn || !sidebar || !overlay) return;

    const toggleMenu = () => {
        burgerBtn.classList.toggle('active');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    };

    const closeMenu = () => {
        burgerBtn.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    };

    burgerBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMenu();
            }
        });
    });
}

// ==========================================
// 10. STORE ADMINISTRATIVE CONTROLLER (لوحة إدارة المتجر)
// ==========================================

let adminStoreCategoriesCache = [];
let adminStoreProductsCache = [];
let pendingStoreDeleteAction = null; // { type: 'category' | 'product', id: string, name: string }

// Initialize and load store admin data
async function loadStoreAdmin() {
    setupStoreAdminSubTabs();
    setupStoreAdminModals();
    setupStoreImageDropzones();
    
    await Promise.all([
        refreshAdminCategoriesList(),
        refreshAdminProductsList()
    ]);
}

// Sub-tabs switching (Products vs Categories)
function setupStoreAdminSubTabs() {
    const btnTabProducts = document.getElementById('btn-store-tab-products');
    const btnTabCategories = document.getElementById('btn-store-tab-categories');
    const panelProducts = document.getElementById('panel-admin-products');
    const panelCategories = document.getElementById('panel-admin-categories');

    if (btnTabProducts && !btnTabProducts.dataset.listenerAttached) {
        btnTabProducts.dataset.listenerAttached = 'true';
        btnTabProducts.addEventListener('click', () => {
            btnTabProducts.classList.add('active');
            if (btnTabCategories) btnTabCategories.classList.remove('active');
            if (panelProducts) panelProducts.classList.remove('hidden');
            if (panelCategories) panelCategories.classList.add('hidden');
        });
    }

    if (btnTabCategories && !btnTabCategories.dataset.listenerAttached) {
        btnTabCategories.dataset.listenerAttached = 'true';
        btnTabCategories.addEventListener('click', () => {
            btnTabCategories.classList.add('active');
            if (btnTabProducts) btnTabProducts.classList.remove('active');
            if (panelCategories) panelCategories.classList.remove('hidden');
            if (panelProducts) panelProducts.classList.add('hidden');
        });
    }
}

// Setup Modals and Forms
function setupStoreAdminModals() {
    // Open Add Category Modal
    const btnOpenAddCategory = document.getElementById('btn-open-add-category');
    if (btnOpenAddCategory && !btnOpenAddCategory.dataset.listenerAttached) {
        btnOpenAddCategory.dataset.listenerAttached = 'true';
        btnOpenAddCategory.addEventListener('click', () => openStoreCategoryModal());
    }

    // Close Category Modal
    const btnCloseCategory = document.getElementById('btn-close-store-category');
    const btnCancelCategory = document.getElementById('btn-cancel-store-category');
    const modalCategory = document.getElementById('modal-store-category');
    [btnCloseCategory, btnCancelCategory].forEach(btn => {
        if (btn && !btn.dataset.listenerAttached) {
            btn.dataset.listenerAttached = 'true';
            btn.addEventListener('click', () => {
                if (modalCategory) modalCategory.classList.add('hidden');
            });
        }
    });

    // Form Submit: Store Category
    const formCategory = document.getElementById('form-store-category');
    if (formCategory && !formCategory.dataset.listenerAttached) {
        formCategory.dataset.listenerAttached = 'true';
        formCategory.addEventListener('submit', handleCategoryFormSubmit);
    }

    // Open Add Product Modal
    const btnOpenAddProduct = document.getElementById('btn-open-add-product');
    if (btnOpenAddProduct && !btnOpenAddProduct.dataset.listenerAttached) {
        btnOpenAddProduct.dataset.listenerAttached = 'true';
        btnOpenAddProduct.addEventListener('click', () => openStoreProductModal());
    }

    // Close Product Modal
    const btnCloseProduct = document.getElementById('btn-close-store-product');
    const btnCancelProduct = document.getElementById('btn-cancel-store-product');
    const modalProduct = document.getElementById('modal-store-product');
    [btnCloseProduct, btnCancelProduct].forEach(btn => {
        if (btn && !btn.dataset.listenerAttached) {
            btn.dataset.listenerAttached = 'true';
            btn.addEventListener('click', () => {
                if (modalProduct) modalProduct.classList.add('hidden');
            });
        }
    });

    // Form Submit: Store Product
    const formProduct = document.getElementById('form-store-product');
    if (formProduct && !formProduct.dataset.listenerAttached) {
        formProduct.dataset.listenerAttached = 'true';
        formProduct.addEventListener('submit', handleProductFormSubmit);
    }

    // Product Category Filter Change
    const filterCategorySelect = document.getElementById('admin-product-filter-category');
    if (filterCategorySelect && !filterCategorySelect.dataset.listenerAttached) {
        filterCategorySelect.dataset.listenerAttached = 'true';
        filterCategorySelect.addEventListener('change', () => {
            renderAdminProductsTable(filterCategorySelect.value);
        });
    }

    // Delete Confirmation Modal
    const btnCancelDelete = document.getElementById('btn-cancel-delete-store-item');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-store-item');
    const modalDelete = document.getElementById('modal-delete-store-item');

    if (btnCancelDelete && !btnCancelDelete.dataset.listenerAttached) {
        btnCancelDelete.dataset.listenerAttached = 'true';
        btnCancelDelete.addEventListener('click', () => {
            if (modalDelete) modalDelete.classList.add('hidden');
            pendingStoreDeleteAction = null;
        });
    }

    if (btnConfirmDelete && !btnConfirmDelete.dataset.listenerAttached) {
        btnConfirmDelete.dataset.listenerAttached = 'true';
        btnConfirmDelete.addEventListener('click', executePendingStoreDelete);
    }
}

// Image Dropzones & Uploads for Category Icon and Product Image
function setupStoreImageDropzones() {
    // 1. Category Icon
    const catFileInput = document.getElementById('category-icon-file');
    const catUrlInput = document.getElementById('category-icon-url');
    const catPreview = document.getElementById('category-icon-preview');
    const catDropzone = document.getElementById('category-icon-dropzone');
    const catTitle = document.getElementById('category-icon-dropzone-title');

    if (catFileInput && !catFileInput.dataset.listenerAttached) {
        catFileInput.dataset.listenerAttached = 'true';
        catFileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type?.startsWith('image/')) {
                showToast('يرجى اختيار ملف صورة صالح.', 'error');
                return;
            }

            try {
                if (catDropzone) catDropzone.classList.add('is-uploading');
                if (catTitle) catTitle.innerText = 'جاري رفع الأيقونة إلى ImgBB...';

                const url = await uploadImageToImgBB(file);
                if (catUrlInput) catUrlInput.value = url;
                if (catPreview) {
                    catPreview.src = url;
                    catPreview.classList.remove('hidden');
                }
                if (catTitle) catTitle.innerText = 'تم رفع الأيقونة بنجاح!';
                showToast('تم رفع أيقونة القسم بنجاح عبر ImgBB.', 'success');
            } catch (err) {
                console.error("Category icon upload error:", err);
                showToast('فشل رفع الأيقونة إلى ImgBB: ' + (err.message || ''), 'error');
            } finally {
                if (catDropzone) catDropzone.classList.remove('is-uploading');
            }
        });
    }

    // 2. Product Image
    const prodFileInput = document.getElementById('product-image-file');
    const prodUrlInput = document.getElementById('product-image-url');
    const prodPreview = document.getElementById('product-image-preview');
    const prodDropzone = document.getElementById('product-image-dropzone');
    const prodTitle = document.getElementById('product-image-dropzone-title');

    if (prodFileInput && !prodFileInput.dataset.listenerAttached) {
        prodFileInput.dataset.listenerAttached = 'true';
        prodFileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type?.startsWith('image/')) {
                showToast('يرجى اختيار ملف صورة صالح.', 'error');
                return;
            }

            try {
                if (prodDropzone) prodDropzone.classList.add('is-uploading');
                if (prodTitle) prodTitle.innerText = 'جاري رفع صورة المنتج إلى ImgBB...';

                const url = await uploadImageToImgBB(file);
                if (prodUrlInput) prodUrlInput.value = url;
                if (prodPreview) {
                    prodPreview.src = url;
                    prodPreview.classList.remove('hidden');
                }
                if (prodTitle) prodTitle.innerText = 'تم رفع صورة المنتج بنجاح!';
                showToast('تم رفع صورة المنتج بنجاح عبر ImgBB.', 'success');
            } catch (err) {
                console.error("Product image upload error:", err);
                showToast('فشل رفع صورة المنتج إلى ImgBB: ' + (err.message || ''), 'error');
            } finally {
                if (prodDropzone) prodDropzone.classList.remove('is-uploading');
            }
        });
    }
}

// Refresh Categories List from Firestore
async function refreshAdminCategoriesList() {
    const listContainer = document.getElementById('admin-store-categories-list');
    const badgeCount = document.getElementById('badge-admin-categories-count');
    const filterSelect = document.getElementById('admin-product-filter-category');
    const modalSelect = document.getElementById('product-category-select');

    if (listContainer) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 24px; color: var(--text-sub);">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-left:8px;"></i> جاري تحميل الأقسام...
                </td>
            </tr>
        `;
    }

    try {
        adminStoreCategoriesCache = await getCategories(false);

        if (badgeCount) {
            badgeCount.innerText = adminStoreCategoriesCache.length;
        }

        // Populate Category Dropdowns
        if (filterSelect) {
            const currentFilterVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="all">جميع الأقسام</option>';
            adminStoreCategoriesCache.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = `${cat.name_ar} (${cat.name_en || ''})`;
                filterSelect.appendChild(opt);
            });
            if (currentFilterVal && filterSelect.querySelector(`option[value="${currentFilterVal}"]`)) {
                filterSelect.value = currentFilterVal;
            }
        }

        if (modalSelect) {
            modalSelect.innerHTML = '<option value="">-- اختر القسم --</option>';
            adminStoreCategoriesCache.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = `${cat.name_ar} (${cat.name_en || ''})`;
                modalSelect.appendChild(opt);
            });
        }

        renderAdminCategoriesTable();
    } catch (err) {
        console.error("Error refreshing categories:", err);
        if (listContainer) {
            listContainer.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 24px; color: var(--danger);">
                        فشل تحميل الأقسام: ${err.message || ''}
                    </td>
                </tr>
            `;
        }
    }
}

// Render Categories Table
function renderAdminCategoriesTable() {
    const listContainer = document.getElementById('admin-store-categories-list');
    if (!listContainer) return;

    if (!adminStoreCategoriesCache.length) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 36px; color: var(--text-sub);">
                    <i class="fa-solid fa-layer-group" style="font-size:2rem; margin-bottom:10px; display:block; opacity:0.5;"></i>
                    لا توجد أقسام مسجلة حتى الآن. اضغط على "+ إضافة قسم جديد" لإنشاء أول قسم.
                </td>
            </tr>
        `;
        return;
    }

    listContainer.innerHTML = adminStoreCategoriesCache.map(cat => {
        const iconHtml = cat.icon?.startsWith('http') 
            ? `<img src="${cat.icon}" alt="${cat.name_ar}" class="store-table-thumb">`
            : `<div class="store-table-icon-preview"><i class="${cat.icon || 'fa-solid fa-shapes'}"></i></div>`;

        return `
            <tr>
                <td>${iconHtml}</td>
                <td>
                    <span class="store-table-title">${cat.name_ar || '—'}</span>
                    ${cat.description_ar ? `<small style="color:var(--text-sub); display:block;">${cat.description_ar}</small>` : ''}
                </td>
                <td>
                    <span class="store-table-subtitle" dir="ltr">${cat.name_en || '—'}</span>
                </td>
                <td>
                    <span style="font-weight:700; color:var(--text-main);">${cat.sortOrder ?? 0}</span>
                </td>
                <td>
                    <span class="badge-in-stock">نشط</span>
                </td>
                <td>
                    <div class="store-actions-group">
                        <button type="button" class="btn-table-edit" data-category-edit="${cat.id}" title="تعديل القسم">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-table-delete" data-category-delete="${cat.id}" data-category-name="${cat.name_ar}" title="حذف القسم">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach row action listeners
    listContainer.querySelectorAll('[data-category-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
            const catId = btn.getAttribute('data-category-edit');
            const category = adminStoreCategoriesCache.find(c => c.id === catId);
            if (category) openStoreCategoryModal(category);
        });
    });

    listContainer.querySelectorAll('[data-category-delete]').forEach(btn => {
        btn.addEventListener('click', () => {
            const catId = btn.getAttribute('data-category-delete');
            const catName = btn.getAttribute('data-category-name');
            requestStoreDelete('category', catId, catName);
        });
    });
}

// Open Category Modal (Add / Edit)
function openStoreCategoryModal(category = null) {
    const modal = document.getElementById('modal-store-category');
    const title = document.getElementById('store-category-modal-title');
    const idInput = document.getElementById('category-modal-id');
    const nameArInput = document.getElementById('category-name-ar');
    const nameEnInput = document.getElementById('category-name-en');
    const sortOrderInput = document.getElementById('category-sort-order');
    const urlInput = document.getElementById('category-icon-url');
    const fileInput = document.getElementById('category-icon-file');
    const preview = document.getElementById('category-icon-preview');
    const dropzoneTitle = document.getElementById('category-icon-dropzone-title');

    if (!modal) return;

    if (fileInput) fileInput.value = '';

    if (category) {
        if (title) title.innerText = 'تعديل القسم';
        if (idInput) idInput.value = category.id;
        if (nameArInput) nameArInput.value = category.name_ar || '';
        if (nameEnInput) nameEnInput.value = category.name_en || '';
        if (sortOrderInput) sortOrderInput.value = category.sortOrder ?? 0;
        if (urlInput) urlInput.value = category.icon || '';
        
        if (category.icon && category.icon.startsWith('http') && preview) {
            preview.src = category.icon;
            preview.classList.remove('hidden');
            if (dropzoneTitle) dropzoneTitle.innerText = 'تغيير صورة الأيقونة الحالية';
        } else {
            if (preview) preview.classList.add('hidden');
            if (dropzoneTitle) dropzoneTitle.innerText = 'ارفع أيقونة أو صورة القسم';
        }
    } else {
        if (title) title.innerText = 'إضافة قسم جديد';
        if (idInput) idInput.value = '';
        if (nameArInput) nameArInput.value = '';
        if (nameEnInput) nameEnInput.value = '';
        if (sortOrderInput) sortOrderInput.value = '0';
        if (urlInput) urlInput.value = '';
        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        if (dropzoneTitle) dropzoneTitle.innerText = 'ارفع أيقونة أو صورة القسم';
    }

    modal.classList.remove('hidden');
}

// Handle Category Form Submission
async function handleCategoryFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('category-modal-id')?.value.trim();
    const name_ar = document.getElementById('category-name-ar')?.value.trim();
    const name_en = document.getElementById('category-name-en')?.value.trim();
    const sortOrder = Number(document.getElementById('category-sort-order')?.value) || 0;
    const icon = document.getElementById('category-icon-url')?.value.trim() || 'fa-solid fa-shapes';
    const modal = document.getElementById('modal-store-category');
    const submitBtn = document.getElementById('btn-submit-store-category');

    if (!name_ar || !name_en) {
        showToast('يرجى ملء اسم القسم بالعربية والإنجليزية.', 'error');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;

    await withLoading(async () => {
        try {
            if (id) {
                // Update
                await updateCategory(id, { name_ar, name_en, sortOrder, icon });
                showToast('تم تحديث القسم بنجاح!', 'success');
            } else {
                // Add
                await addCategory({ name_ar, name_en, sortOrder, icon });
                showToast('تمت إضافة القسم الجديد بنجاح!', 'success');
            }

            if (modal) modal.classList.add('hidden');
            await refreshAdminCategoriesList();
        } catch (err) {
            console.error("Save category error:", err);
            showToast('حدث خطأ أثناء حفظ القسم: ' + (err.message || ''), 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Refresh Products List from Firestore
async function refreshAdminProductsList() {
    const listContainer = document.getElementById('admin-store-products-list');
    const badgeCount = document.getElementById('badge-admin-products-count');
    const filterSelect = document.getElementById('admin-product-filter-category');

    if (listContainer) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 24px; color: var(--text-sub);">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-left:8px;"></i> جاري تحميل المنتجات...
                </td>
            </tr>
        `;
    }

    try {
        adminStoreProductsCache = await getProducts();

        if (badgeCount) {
            badgeCount.innerText = adminStoreProductsCache.length;
        }

        renderAdminProductsTable(filterSelect?.value || 'all');
    } catch (err) {
        console.error("Error refreshing products:", err);
        if (listContainer) {
            listContainer.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 24px; color: var(--danger);">
                        فشل تحميل المنتجات: ${err.message || ''}
                    </td>
                </tr>
            `;
        }
    }
}

// Render Products Table
function renderAdminProductsTable(selectedCategoryId = 'all') {
    const listContainer = document.getElementById('admin-store-products-list');
    if (!listContainer) return;

    let filtered = adminStoreProductsCache;
    if (selectedCategoryId && selectedCategoryId !== 'all') {
        filtered = filtered.filter(p => p.categoryId === selectedCategoryId);
    }

    if (!filtered.length) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 36px; color: var(--text-sub);">
                    <i class="fa-solid fa-box-open" style="font-size:2rem; margin-bottom:10px; display:block; opacity:0.5;"></i>
                    لا توجد منتجات معروضة ${selectedCategoryId !== 'all' ? 'في هذا القسم' : 'حالياً'}. اضغط على "+ إضافة منتج جديد".
                </td>
            </tr>
        `;
        return;
    }

    listContainer.innerHTML = filtered.map(prod => {
        const cat = adminStoreCategoriesCache.find(c => c.id === prod.categoryId);
        const categoryLabel = cat ? cat.name_ar : (prod.categoryName_ar || 'عام');
        const imgUrl = prod.mainImage || 'assets/course_logo.jpeg';

        return `
            <tr>
                <td>
                    <img src="${imgUrl}" alt="${prod.title_ar}" class="store-table-thumb" onerror="this.src='assets/course_logo.jpeg'">
                </td>
                <td>
                    <span class="store-table-title">${prod.title_ar || '—'}</span>
                    <span class="store-table-subtitle" dir="ltr">${prod.title_en || ''}</span>
                    ${prod.badge_ar ? `<span style="font-size:0.75rem; background:var(--accent-light); color:var(--accent-cyan); padding:2px 8px; border-radius:6px; font-weight:700;">${prod.badge_ar}</span>` : ''}
                </td>
                <td>
                    <span style="font-weight:600; color:var(--text-main); font-size:0.9rem;">${categoryLabel}</span>
                </td>
                <td>
                    <div class="store-price-tag">
                        <span>${Number(prod.price).toFixed(2)}</span>
                        <small style="font-size:0.75rem; color:var(--text-sub);">ج.م</small>
                    </div>
                    ${prod.oldPrice ? `<span class="store-old-price-tag">${Number(prod.oldPrice).toFixed(2)} ج.م</span>` : ''}
                </td>
                <td>
                    ${prod.isAvailable !== false 
                        ? '<span class="badge-in-stock"><i class="fa-solid fa-check" style="margin-left:4px;"></i>متوفر</span>' 
                        : '<span class="badge-out-stock"><i class="fa-solid fa-xmark" style="margin-left:4px;"></i>غير متوفر</span>'}
                </td>
                <td>
                    <div class="store-actions-group">
                        <button type="button" class="btn-table-edit" data-product-edit="${prod.id}" title="تعديل المنتج">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-table-delete" data-product-delete="${prod.id}" data-product-name="${prod.title_ar}" title="حذف المنتج">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Row Actions Listeners
    listContainer.querySelectorAll('[data-product-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
            const prodId = btn.getAttribute('data-product-edit');
            const product = adminStoreProductsCache.find(p => p.id === prodId);
            if (product) openStoreProductModal(product);
        });
    });

    listContainer.querySelectorAll('[data-product-delete]').forEach(btn => {
        btn.addEventListener('click', () => {
            const prodId = btn.getAttribute('data-product-delete');
            const prodName = btn.getAttribute('data-product-name');
            requestStoreDelete('product', prodId, prodName);
        });
    });
}

// Open Product Modal (Add / Edit)
function openStoreProductModal(product = null) {
    const modal = document.getElementById('modal-store-product');
    const title = document.getElementById('store-product-modal-title');
    const idInput = document.getElementById('product-modal-id');
    const catSelect = document.getElementById('product-category-select');
    const titleArInput = document.getElementById('product-title-ar');
    const titleEnInput = document.getElementById('product-title-en');
    const priceInput = document.getElementById('product-price-input');
    const oldPriceInput = document.getElementById('product-old-price-input');
    const descArInput = document.getElementById('product-desc-ar');
    const descEnInput = document.getElementById('product-desc-en');
    const badgeArInput = document.getElementById('product-badge-ar');
    const badgeEnInput = document.getElementById('product-badge-en');
    const urlInput = document.getElementById('product-image-url');
    const fileInput = document.getElementById('product-image-file');
    const preview = document.getElementById('product-image-preview');
    const dropzoneTitle = document.getElementById('product-image-dropzone-title');
    const availableCheck = document.getElementById('product-is-available');

    if (!modal) return;

    if (fileInput) fileInput.value = '';

    if (product) {
        if (title) title.innerText = 'تعديل المنتج';
        if (idInput) idInput.value = product.id;
        if (catSelect) catSelect.value = product.categoryId || '';
        if (titleArInput) titleArInput.value = product.title_ar || '';
        if (titleEnInput) titleEnInput.value = product.title_en || '';
        if (priceInput) priceInput.value = product.price ?? '';
        if (oldPriceInput) oldPriceInput.value = product.oldPrice ?? '';
        if (descArInput) descArInput.value = product.desc_ar || '';
        if (descEnInput) descEnInput.value = product.desc_en || '';
        if (badgeArInput) badgeArInput.value = product.badge_ar || '';
        if (badgeEnInput) badgeEnInput.value = product.badge_en || '';
        if (urlInput) urlInput.value = product.mainImage || '';
        if (availableCheck) availableCheck.checked = product.isAvailable !== false;

        if (product.mainImage && preview) {
            preview.src = product.mainImage;
            preview.classList.remove('hidden');
            if (dropzoneTitle) dropzoneTitle.innerText = 'تغيير صورة المنتج الحالية';
        } else {
            if (preview) preview.classList.add('hidden');
            if (dropzoneTitle) dropzoneTitle.innerText = 'ارفع صورة المنتج بدقة عالية';
        }
    } else {
        if (title) title.innerText = 'إضافة منتج جديد';
        if (idInput) idInput.value = '';
        if (catSelect) catSelect.value = '';
        if (titleArInput) titleArInput.value = '';
        if (titleEnInput) titleEnInput.value = '';
        if (priceInput) priceInput.value = '';
        if (oldPriceInput) oldPriceInput.value = '';
        if (descArInput) descArInput.value = '';
        if (descEnInput) descEnInput.value = '';
        if (badgeArInput) badgeArInput.value = '';
        if (badgeEnInput) badgeEnInput.value = '';
        if (urlInput) urlInput.value = '';
        if (availableCheck) availableCheck.checked = true;
        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        if (dropzoneTitle) dropzoneTitle.innerText = 'ارفع صورة المنتج بدقة عالية';
    }

    modal.classList.remove('hidden');
}

// Handle Product Form Submission
async function handleProductFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('product-modal-id')?.value.trim();
    const categoryId = document.getElementById('product-category-select')?.value.trim();
    const title_ar = document.getElementById('product-title-ar')?.value.trim();
    const title_en = document.getElementById('product-title-en')?.value.trim();
    const priceVal = document.getElementById('product-price-input')?.value;
    const oldPriceVal = document.getElementById('product-old-price-input')?.value;
    const desc_ar = document.getElementById('product-desc-ar')?.value.trim() || '';
    const desc_en = document.getElementById('product-desc-en')?.value.trim() || '';
    const badge_ar = document.getElementById('product-badge-ar')?.value.trim() || '';
    const badge_en = document.getElementById('product-badge-en')?.value.trim() || '';
    const mainImage = document.getElementById('product-image-url')?.value.trim() || '';
    const isAvailable = document.getElementById('product-is-available')?.checked !== false;
    const modal = document.getElementById('modal-store-product');
    const submitBtn = document.getElementById('btn-submit-store-product');

    if (!categoryId) {
        showToast('يرجى اختيار القسم التابع له المنتج.', 'error');
        return;
    }
    if (!title_ar || !title_en) {
        showToast('يرجى إدخال اسم المنتج بالعربية والإنجليزية.', 'error');
        return;
    }
    if (priceVal === '' || isNaN(Number(priceVal)) || Number(priceVal) < 0) {
        showToast('يرجى إدخال سعر صالح للمنتج بالجنيه.', 'error');
        return;
    }
    if (!mainImage) {
        showToast('يرجى رفع صورة المنتج عبر ImgBB.', 'error');
        return;
    }

    const price = Number(priceVal);
    const oldPrice = oldPriceVal !== '' && !isNaN(Number(oldPriceVal)) ? Number(oldPriceVal) : null;
    const catObj = adminStoreCategoriesCache.find(c => c.id === categoryId);
    const categoryName_ar = catObj ? catObj.name_ar : '';
    const categoryName_en = catObj ? catObj.name_en : '';

    const productPayload = {
        categoryId,
        categoryName_ar,
        categoryName_en,
        title_ar,
        title_en,
        price,
        oldPrice,
        desc_ar,
        desc_en,
        badge_ar,
        badge_en,
        mainImage,
        isAvailable
    };

    if (submitBtn) submitBtn.disabled = true;

    await withLoading(async () => {
        try {
            if (id) {
                // Update
                await updateProduct(id, productPayload);
                showToast('تم تحديث بيانات المنتج بنجاح!', 'success');
            } else {
                // Add
                await addProduct(productPayload);
                showToast('تمت إضافة المنتج الجديد بنجاح!', 'success');
            }

            if (modal) modal.classList.add('hidden');
            await refreshAdminProductsList();
        } catch (err) {
            console.error("Save product error:", err);
            showToast('حدث خطأ أثناء حفظ المنتج: ' + (err.message || ''), 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Request Store Delete (Open Confirmation Modal)
function requestStoreDelete(type, id, name) {
    pendingStoreDeleteAction = { type, id, name };
    const modal = document.getElementById('modal-delete-store-item');
    const msgEl = document.getElementById('delete-store-item-message');

    if (!modal) return;

    if (msgEl) {
        const itemTypeLabel = type === 'category' ? 'القسم' : 'المنتج';
        msgEl.innerHTML = `هل أنت متأكد من رغبتك في حذف ${itemTypeLabel} "<strong>${name || ''}</strong>" نهائياً؟`;
    }

    modal.classList.remove('hidden');
}

// Execute Pending Store Delete
async function executePendingStoreDelete() {
    if (!pendingStoreDeleteAction) return;

    const { type, id } = pendingStoreDeleteAction;
    const modal = document.getElementById('modal-delete-store-item');
    const confirmBtn = document.getElementById('btn-confirm-delete-store-item');

    if (confirmBtn) confirmBtn.disabled = true;

    await withLoading(async () => {
        try {
            if (type === 'category') {
                await deleteCategory(id);
                showToast('تم حذف القسم بنجاح!', 'success');
                await refreshAdminCategoriesList();
            } else if (type === 'product') {
                await deleteProduct(id);
                showToast('تم حذف المنتج بنجاح!', 'success');
                await refreshAdminProductsList();
            }

            if (modal) modal.classList.add('hidden');
            pendingStoreDeleteAction = null;
        } catch (err) {
            console.error("Delete error:", err);
            showToast('فشل حذف العنصر: ' + (err.message || ''), 'error');
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
        }
    });
}

// --- Run Init ---
injectCustomHashInputToHtml();
setupStudentMobileBurgerMenu();
initTheme();
initStoreTab();
handleRouting();




