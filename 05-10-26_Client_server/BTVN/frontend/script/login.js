const TOKEN_KEY = 'todoToken';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const resendBtn = document.getElementById('resendBtn');
const messageEl = document.getElementById('message');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type || ''}`;
}

async function request(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response;
  try {
    response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw { status: 0, message: 'Cannot reach the server. Please try again.' };
  }

  let data = await response.json();
  if (!response.ok) {
    throw { status: response.status, message: (data && data.message) || 'Request failed', code: data && data.code };
  }
  return data;
}

// If a valid token is already stored, go straight to the task page.
async function redirectIfLoggedIn() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await request('/api/me', { token });
    window.location.replace('/page/assign-task.html');
  } catch (err) {
    if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  resendBtn.hidden = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    showMessage('Please enter your email and password.', 'error');
    return;
  }

  loginBtn.disabled = true;
  showMessage('Logging in...', '');
  try {
    const result = await request('/api/login', { method: 'POST', body: { email, password } });
    localStorage.setItem(TOKEN_KEY, result.data.token);
    window.location.replace('/page/assign-task.html');
  } catch (err) {
    showMessage(err.message, 'error');
    if (err.code === 'EMAIL_NOT_VERIFIED') resendBtn.hidden = false;
    loginBtn.disabled = false;
  }
});

resendBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    showMessage('Please enter your email first.', 'error');
    return;
  }
  resendBtn.disabled = true;
  try {
    const result = await request('/api/resend-verification', { method: 'POST', body: { email } });
    showMessage(result.message, 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    resendBtn.disabled = false;
  }
});

redirectIfLoggedIn();
