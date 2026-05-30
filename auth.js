// ==================== AUTH.JS ====================

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
    if (!adminDoc.exists) return false;
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
    showToast('Logged in successfully.', 'success');
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
    case 'auth/user-not-found':     return 'No account found with that email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid email or password.';
    case 'auth/too-many-requests':  return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default: return error.message || 'Login failed. Please try again.';
  }
}

function logout() {
  if (!confirmAction('Logout from admin portal?')) return;

  auth.signOut().then(() => {
    currentAdmin = null;
    loginForm.reset();
    showLoginScreen();
  });
}

function showSection(sectionId) {
  // Close mobile sidebar if open
  closeSidebar();

  // Update nav active state
  document.querySelectorAll('#sidebar-menu li').forEach(item => {
    item.classList.remove('active');
    const action = item.getAttribute('onclick') || '';
    if (action.includes(sectionId)) item.classList.add('active');
  });

  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));

  const activeSection = document.getElementById(sectionId);
  if (!activeSection) return;
  activeSection.classList.remove('hidden');

  // Page title
  const titles = {
    dashboard: 'Dashboard',
    customers: 'Customers',
    billing:   'Billing & Payments',
    packages:  'Internet Packages',
    support:   'Support Tickets'
  };
  document.getElementById('page-title').textContent = titles[sectionId] || sectionId;

  // Track current section for refresh
  window._currentSection = sectionId;

  // Load section data
  if (sectionId === 'dashboard') loadDashboard();
  if (sectionId === 'customers') loadCustomers();
  if (sectionId === 'billing')   loadBilling();
  if (sectionId === 'packages')  loadPackages();
  if (sectionId === 'support')   loadSupport();
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
