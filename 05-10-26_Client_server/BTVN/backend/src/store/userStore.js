// In-memory index over users.csv so every operation is O(1) instead of O(n).
// Trade-off: the whole users table is held in RAM. See notes in the answer.

const { readRows, appendRow } = require('../utils/csvUtils');

let byEmail = new Map(); 
let byId = new Map();    
let usedIds = new Set(); 
let nextFree = 1;        

// Loads users.csv once at startup. If a row appears twice with the same id,
// the later row wins (this file is append-only, so updates are written as new lines).
async function load() {
  const rows = await readRows('users');
  byEmail = new Map();
  byId = new Map();
  usedIds = new Set();
  nextFree = 1;
  for (const row of rows) {
    byEmail.set(String(row.email).toLowerCase(), row);
    byId.set(String(row.id), row);
    const n = Number(row.id);
    if (Number.isInteger(n)) usedIds.add(n);
  }
  while (usedIds.has(nextFree)) nextFree += 1;
}

// Smallest unused positive integer, then moves the cursor forward. Amortized O(1).
function takeId() {
  while (usedIds.has(nextFree)) nextFree += 1;
  const id = nextFree;
  usedIds.add(id);
  nextFree += 1;
  return id;
}

function getByEmail(email) {
  return byEmail.get(String(email).toLowerCase()) || null;
}

function getById(id) {
  return byId.get(String(id)) || null;
}

// Linear scan in RAM (a few ms even for 1M rows). Use only for rare lookups.
function find(predicate) {
  for (const user of byId.values()) {
    if (predicate(user)) return user;
  }
  return null;
}

function all() {
  return [...byId.values()];
}

// Synchronous insert: duplicate check + id allocation are atomic because JS is
// single-threaded and there is no await in between. Returns null on duplicate email.
function add(fields) {
  const email = String(fields.email).toLowerCase();
  if (byEmail.has(email)) return null;
  const id = takeId();
  const row = { ...fields, id: String(id) };
  byEmail.set(email, row);
  byId.set(String(id), row);
  return row;
}

// Appends one line to disk. The file is never rewritten, so cost is independent
// of how many users already exist.
async function persist(row) {
  await appendRow('users', row);
}

// Upsert: updates the in-memory index immediately, then appends the row.
async function save(row) {
  const email = String(row.email).toLowerCase();
  byEmail.set(email, row);
  byId.set(String(row.id), row);
  const n = Number(row.id);
  if (Number.isInteger(n)) usedIds.add(n);
  await appendRow('users', row);
}

module.exports = { load, getByEmail, getById, find, all, add, persist, save };
