// ==================== AUTH.JS — NEXTLINK ADMIN AUTH + NAVIGATION ====================

let currentAdmin = null;
const ADMIN_DISPLAY_NAME = 'Nextlink Administrator';

const loginScreen = document.getElementById('login-screen');
const mainApp     = document.getElementById('main-app');
const loginForm   = document.getElementById('login-form');
const loginError  = document.getElementById('login-error');
const welcomeText = document.getElementById('welcome-text');

function showMainApp() {
  loginScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');
  showSection('dashboard');
}

function showLoginScreen() {
  mainApp.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

async function checkAdminRole(uid) {
  try {
    const adminDoc = await db.collection('admin').doc(uid).get();

    if (!adminDoc.exists) {
      return false;
    }

    const data = adminDoc.data();

    return data.role === 'admin' || data.isAdmin === true;
  } catch (error) {
    console.error('Admin check failed:', error);
    return false;
  }
}

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('login-btn');

  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Checking access…';

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    const isAdmin = await checkAdminRole(user.uid);

    if (!isAdmin) {
      await auth.signOut();
      loginError.textContent = 'Access denied. This account is not registered as an admin.';
      return;
    }

    currentAdmin = user;
    welcomeText.textContent = `Welcome back, ${ADMIN_DISPLAY_NAME}`;

    showMainApp();

    if (typeof showToast === 'function') {
      showToast('Logged in successfully.', 'success');
    }

  } catch (error) {
    console.error(error);
    loginError.textContent = friendlyAuthError(error);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login to Dashboard';
  }
});

function friendlyAuthError(error) {
  switch (error.code) {
    case 'auth/user-not-found':
      return 'No account found with that email.';

    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';

    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';

    default:
      return error.message || 'Login failed. Please try again.';
  }
}

function logout() {
  if (typeof confirmAction === 'function') {
    if (!confirmAction('Logout from admin portal?')) return;
  }

  auth.signOut().then(() => {
    currentAdmin = null;
    loginForm.reset();
    showLoginScreen();
  });
}

function showSection(sectionId) {
  if (typeof closeSidebar === 'function') {
    closeSidebar();
  }

  document.querySelectorAll('#sidebar-menu li').forEach(item => {
    item.classList.remove('active');

    const action = item.getAttribute('onclick') || '';

    if (action.includes(sectionId)) {
      item.classList.add('active');
    }
  });

  document.querySelectorAll('.section').forEach(section => {
    section.classList.add('hidden');
  });

  const activeSection = document.getElementById(sectionId);

  if (!activeSection) {
    console.warn(`Section not found: ${sectionId}`);
    return;
  }

  activeSection.classList.remove('hidden');

  const titles = {
    dashboard: 'Dashboard',
    customers: 'Customers',
    billing: 'Billing & Payments',
    packages: 'Internet Packages',
    support: 'Support Tickets',
    analytics: 'Analytics',
    operations: 'Operations Center',
    settings: 'Settings'
  };

  const pageTitle = document.getElementById('page-title');

  if (pageTitle) {
    pageTitle.textContent = titles[sectionId] || sectionId;
  }

  window._currentSection = sectionId;

  try {
    if (sectionId === 'dashboard' && typeof loadDashboard === 'function') {
      loadDashboard();
    }

    if (sectionId === 'customers' && typeof loadCustomers === 'function') {
      loadCustomers();
    }

    if (sectionId === 'billing' && typeof loadBilling === 'function') {
      loadBilling();
    }

    if (sectionId === 'packages' && typeof loadPackages === 'function') {
      loadPackages();
    }

    if (sectionId === 'support' && typeof loadSupport === 'function') {
      loadSupport();
    }

    if (sectionId === 'analytics' && typeof loadAnalytics === 'function') {
      loadAnalytics();
    }

    if (sectionId === 'operations' && typeof loadOperations === 'function') {
      loadOperations();
    }

    if (sectionId === 'settings' && typeof loadSettings === 'function') {
      loadSettings();
    }

  } catch (error) {
    console.error(`Failed to load section: ${sectionId}`, error);

    if (typeof showToast === 'function') {
      showToast(`Failed to load ${titles[sectionId] || sectionId}.`, 'error');
    }
  }
}

auth.onAuthStateChanged(async function (user) {
  if (!user) {
    currentAdmin = null;
    showLoginScreen();
    return;
  }

  const isAdmin = await checkAdminRole(user.uid);

  if (!isAdmin) {
    await auth.signOut();
    showLoginScreen();
    return;
  }

  currentAdmin = user;
  welcomeText.textContent = `Welcome back, ${ADMIN_DISPLAY_NAME}`;

  showMainApp();
});

window.logout = logout;
window.showSection = showSection;
