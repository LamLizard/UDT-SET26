const form = document.getElementById('signupForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signupBtn');
const messageEl = document.getElementById('message');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type || ''}`;
}

// Same rules as the backend (the backend is the authoritative check).
function getPasswordProblems(password) {
  const problems = [];
  if (password.length < 8 || password.length > 20) problems.push('be 8 to 20 characters long');
  if (!/[A-Z]/.test(password)) problems.push('contain an uppercase letter');
  if (!/[a-z]/.test(password)) problems.push('contain a lowercase letter');
  if (!/[^A-Za-z0-9\s]/.test(password)) problems.push('contain a special character');
  return problems;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!name || !email || !password) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }
  const problems = getPasswordProblems(password);
  if (problems.length > 0) {
    showMessage(`Password must ${problems.join(', ')}.`, 'error');
    return;
  }

  signupBtn.disabled = true;
  showMessage('Creating account...', '');
  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    let data = null;
    try { data = await response.json(); } catch { /* not JSON */ }

    if (!response.ok) {
      showMessage((data && data.message) || 'Sign-up failed.', 'error');
      return;
    }
    showMessage(data.message, 'success');
    passwordInput.value = '';
  } catch {
    showMessage('Cannot reach the server. Please try again.', 'error');
  } finally {
    signupBtn.disabled = false;
  }
});
