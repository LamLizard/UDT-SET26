const { readRows, updateRows } = require('../utils/csvUtils');
const userStore = require('../store/userStore');
const { HttpError } = require('../utils/responseUtils');
const { validateTaskContent } = require('../utils/validationUtils');

const ALLOWED_PATCH_FIELDS = ['content', 'assignedTo', 'completed'];

function toPublicTask(row, usersById) {
  const assignee = row.assignedTo ? usersById.get(row.assignedTo) : null;
  return {
    id: row.id,
    content: row.content,
    createdBy: row.createdBy,
    assignedTo: row.assignedTo || null,
    assignedToName: assignee ? assignee.name : null,
    completed: row.completed === 'true',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapUsersById(userRows) {
  return new Map(userRows.map((u) => [u.id, u]));
}

async function listAssignableUsers() {
  const users = userStore.all();
  return users
    .filter((u) => u.status === 'active')
    .map((u) => ({ id: u.id, name: u.name, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listTasks() {
  const tasks = await readRows('tasks');
  const usersById = mapUsersById(userStore.all());
  return tasks.map((t) => toPublicTask(t, usersById));
}

// Smallest unused positive integer, computed inside the queued read-modify-write
// so concurrent creates can never hand out the same id.
function takeTaskId(rows) {
  const used = new Set();
  for (const row of rows) {
    const n = Number(row.id);
    if (Number.isInteger(n)) used.add(n);
  }
  let next = 1;
  while (used.has(next)) next += 1;
  return String(next);
}

async function createTask(content, currentUser) {
  const cleanContent = validateTaskContent(content);
  const now = new Date().toISOString();
  const row = await updateRows('tasks', (rows) => {
    const newRow = {
      id: takeTaskId(rows),
      content: cleanContent,
      createdBy: currentUser.id, // always from the JWT, never from the request body
      assignedTo: '',
      completed: 'false',
      createdAt: now,
      updatedAt: now,
    };
    rows.push(newRow);
    return { rows, result: newRow };
  });
  return toPublicTask(row, new Map());
}

async function updateTask(id, patch) {
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  const unknown = keys.filter((k) => !ALLOWED_PATCH_FIELDS.includes(k));
  if (unknown.length > 0) {
    throw new HttpError(400, `These fields cannot be updated: ${unknown.join(', ')}`);
  }

  const users = userStore.all();
  const changes = {};

  if ('content' in patch) {
    changes.content = validateTaskContent(patch.content);
  }
  if ('completed' in patch) {
    if (typeof patch.completed !== 'boolean') {
      throw new HttpError(400, 'completed must be true or false');
    }
    changes.completed = String(patch.completed);
  }
  if ('assignedTo' in patch) {
    const value = patch.assignedTo;
    if (value === '' || value === null) {
      changes.assignedTo = '';
    } else if (typeof value !== 'string') {
      throw new HttpError(400, 'assignedTo must be a user ID or an empty string');
    } else if (!users.some((u) => u.id === value && u.status === 'active')) {
      throw new HttpError(400, 'Assignee must be an existing active user');
    } else {
      changes.assignedTo = value;
    }
  }

  const updated = await updateRows('tasks', (rows) => {
    const row = rows.find((t) => t.id === id);
    if (!row) throw new HttpError(404, 'Task not found');
    Object.assign(row, changes);
    row.updatedAt = new Date().toISOString();
    return { rows, result: { ...row } };
  });

  return toPublicTask(updated, mapUsersById(users));
}

async function deleteTask(id) {
  await updateRows('tasks', (rows) => {
    const remaining = rows.filter((t) => t.id !== id);
    if (remaining.length === rows.length) throw new HttpError(404, 'Task not found');
    return { rows: remaining, result: null };
  });
}

module.exports = { listAssignableUsers, listTasks, createTask, updateTask, deleteTask };
