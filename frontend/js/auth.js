/* ═══════════════════════════════════════════════
   GUTI 2.0 — Auth Module
   ═══════════════════════════════════════════════ */

const Auth = {
  user: null,

  init() {
    const token = localStorage.getItem('guti_token');
    const user  = localStorage.getItem('guti_user');
    if (token && user) {
      this.user = JSON.parse(user);
      API.setToken(token);
      return true;
    }
    return false;
  },

  save(token, user) {
    localStorage.setItem('guti_token', token);
    localStorage.setItem('guti_user', JSON.stringify(user));
    API.setToken(token);
    this.user = user;
  },

  clear() {
    localStorage.removeItem('guti_token');
    localStorage.removeItem('guti_user');
    API.clearToken();
    this.user = null;
  },

  isLoggedIn() { return !!this.user; },

  getInitials() {
    if (!this.user?.email) return '?';
    return this.user.email[0].toUpperCase();
  },

  async register(email, password) {
    const fd = new FormData();
    fd.append('email', email);
    fd.append('password', password);
    return API.post('/auth/register', fd);
  },

  async login(email, password) {
    const fd = new FormData();
    fd.append('email', email);
    fd.append('password', password);
    const res = await API.post('/auth/login', fd);
    this.save(res.access_token, res.user);
    return res;
  },

  async logout() {
    try { await API.post('/auth/logout', new FormData()); } catch {}
    this.clear();
  },
};

// ── Auth UI ─────────────────────────────────────
function showAuthModal(tab = 'login') {
  const overlay = document.getElementById('auth-modal');
  overlay.classList.add('open');
  switchAuthTab(tab);
}

function hideAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.getElementById('auth-login-form').style.display  = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  if (!email || !password) { Toast.error('Email and password required'); return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    await Auth.login(email, password);
    hideAuthModal();
    onAuthSuccess();
    Toast.success('Welcome back! 👋');
  } catch (err) {
    let msg = 'Login failed';
    try { msg = JSON.parse(err.message)?.detail || msg; } catch {}
    Toast.error(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const btn      = document.getElementById('register-btn');

  if (!email || !password) { Toast.error('All fields required'); return; }
  if (password !== confirm) { Toast.error('Passwords do not match'); return; }
  if (password.length < 8)  { Toast.error('Password must be 8+ characters'); return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    await Auth.register(email, password);
    Toast.success('Registered! Check your email to verify, then log in.');
    switchAuthTab('login');
    document.getElementById('login-email').value = email;
  } catch (err) {
    let msg = 'Registration failed';
    try { msg = JSON.parse(err.message)?.detail || msg; } catch {}
    Toast.error(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

async function handleLogout() {
  await Auth.logout();
  updateUserUI();
  Sidebar.clearHistory();
  Toast.info('Logged out');
}

function onAuthSuccess() {
  updateUserUI();
  Sidebar.loadHistory();
}

function updateUserUI() {
  const loggedIn = Auth.isLoggedIn();
  const avatar   = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userPlan = document.getElementById('user-plan');
  const loginBtn = document.getElementById('header-login-btn');

  if (loggedIn) {
    avatar.textContent  = Auth.getInitials();
    userName.textContent = Auth.user.email.split('@')[0];
    userPlan.textContent = 'Free Plan';
    if (loginBtn) loginBtn.style.display = 'none';
  } else {
    avatar.textContent  = '?';
    userName.textContent = 'Guest';
    userPlan.textContent = 'Not logged in';
    if (loginBtn) loginBtn.style.display = '';
  }
}
