const TOKEN_KEY = 'todoToken';
const LOGIN_URL = '/page/login.html';

const userNameEl = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const addForm = document.getElementById('addForm');
const taskContentInput = document.getElementById('taskContent');
const addBtn = document.getElementById('addBtn');
const addMessageEl = document.getElementById('addMessage');
const listMessageEl = document.getElementById('listMessage');
const taskListEl = document.getElementById('taskList');
const emptyMessageEl = document.getElementById('emptyMessage');

let users = [];
let tasks = [];
let editingId = null; // which task row is in edit mode
let busy = false;     // blocks duplicate requests while one is running

// ---------- helpers ----------
function redirectToLogin() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace(LOGIN_URL);
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message ${type || ''}`;
}

// Sends a request with the stored JWT. Any 401 means the login is no longer valid.
async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    redirectToLogin();
    throw { status: 401, message: 'Not logged in' };
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

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

  let data = null;
  try { data = await response.json(); } catch { /* not JSON */ }

  if (response.status === 401) {
    redirectToLogin();
    throw { status: 401, message: 'Session expired' };
  }
  if (!response.ok) {
    throw { status: response.status, message: (data && data.message) || 'Request failed' };
  }
  return data;
}

function replaceTask(updated) {
  tasks = tasks.map((t) => (t.id === updated.id ? updated : t));
}

// Runs one action at a time. keepViewOnFail=true leaves the screen as it is when the
// action fails (used by Save, so the typed text is not lost).
async function runAction(action, successText, keepViewOnFail = false) {
  if (busy) return;
  busy = true;
  taskListEl.classList.add('busy');
  let ok = false;
  try {
    await action();
    ok = true;
    if (successText) showMessage(listMessageEl, successText, 'success');
  } catch (err) {
    if (err.status !== 401) showMessage(listMessageEl, err.message, 'error');
  } finally {
    busy = false;
    taskListEl.classList.remove('busy');
    if (ok || !keepViewOnFail) render();
  }
}

// ---------- rendering (textContent only, never innerHTML) ----------
function createUserSelect(selectedId) {
  const select = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Unassigned';
  select.appendChild(none);
  for (const user of users) {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    select.appendChild(option);
  }
  select.value = selectedId || '';
  return select;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

function createTaskItem(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' completed' : ''}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.addEventListener('change', () => {
    runAction(async () => {
      const result = await request(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: { completed: checkbox.checked },
      });
      replaceTask(result.data);
    });
  });
  li.appendChild(checkbox);

  if (editingId === task.id) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.maxLength = 100;
    input.value = task.content;
    const select = createUserSelect(task.assignedTo);

    li.appendChild(input);
    li.appendChild(select);
    li.appendChild(createButton('Save', '', () => {
      const content = input.value.trim();
      if (content.length < 1 || Array.from(content).length > 100) {
        showMessage(listMessageEl, 'Task content must be between 1 and 100 characters', 'error');
        return;
      }
      runAction(async () => {
        const result = await request(`/api/tasks/${encodeURIComponent(task.id)}`, {
          method: 'PATCH',
          body: { content, assignedTo: select.value },
        });
        replaceTask(result.data);
        editingId = null;
      }, 'Task saved', true);
    }));
    li.appendChild(createButton('Cancel', 'secondary', () => {
      editingId = null;
      render();
    }));
    return li;
  }

  const content = document.createElement('span');
  content.className = 'task-content';
  content.textContent = task.content;
  li.appendChild(content);

  const assignee = document.createElement('span');
  assignee.className = 'assignee';
  assignee.textContent = task.assignedToName ? `Assigned to: ${task.assignedToName}` : 'Unassigned';
  li.appendChild(assignee);

  // Changing this select assigns, re-assigns or un-assigns right away.
  const assignSelect = createUserSelect(task.assignedTo);
  assignSelect.title = 'Assign this task';
  assignSelect.addEventListener('change', () => {
    runAction(async () => {
      const result = await request(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: { assignedTo: assignSelect.value },
      });
      replaceTask(result.data);
    }, 'Assignment updated');
  });
  li.appendChild(assignSelect);

  li.appendChild(createButton('Edit', 'secondary', () => {
    editingId = task.id;
    render();
  }));

  li.appendChild(createButton('Delete', 'danger', () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    runAction(async () => {
      await request(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      tasks = tasks.filter((t) => t.id !== task.id); // only after the server confirmed
      if (editingId === task.id) editingId = null;
    }, 'Task deleted');
  }));

  return li;
}

function render() {
  taskListEl.replaceChildren(...tasks.map(createTaskItem));
  emptyMessageEl.hidden = tasks.length > 0;
}

// ---------- events ----------
addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;

  const content = taskContentInput.value.trim();
  if (content.length < 1 || Array.from(content).length > 100) {
    showMessage(addMessageEl, 'Task content must be between 1 and 100 characters', 'error');
    return;
  }

  busy = true;
  addBtn.disabled = true;
  try {
    const result = await request('/api/tasks', { method: 'POST', body: { content } });
    tasks.push(result.data);
    taskContentInput.value = '';
    showMessage(addMessageEl, 'Task added', 'success');
    render();
  } catch (err) {
    if (err.status !== 401) showMessage(addMessageEl, err.message, 'error');
  } finally {
    busy = false;
    addBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await request('/api/logout', { method: 'POST' });
  } catch { /* we log out locally anyway */ }
  redirectToLogin();
});

// ---------- start ----------
async function init() {
  try {
    const [me, userList, taskList] = await Promise.all([
      request('/api/me'),
      request('/api/users'),
      request('/api/tasks'),
    ]);
    userNameEl.textContent = me.data.name;
    users = userList.data;
    tasks = taskList.data;
    render();
  } catch (err) {
    if (err.status !== 401) showMessage(listMessageEl, err.message, 'error');
  }
}

init();
