const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { loadConfig } = require('../config');

const SCHEMAS = {
  users: {
    file: 'users.csv',
    headers: [
      'id', 'email', 'passwordSalt', 'passwordHash', 'name', 'status',
      'verificationTokenHash', 'verificationExpiresAt', 'verificationSentAt', 'createdAt',
    ],
  },
  tasks: {
    file: 'tasks.csv',
    headers: ['id', 'content', 'createdBy', 'assignedTo', 'completed', 'createdAt', 'updatedAt'],
  },
};

// One promise chain per file: every read-modify-write runs one at a time.
// This only protects a single Node.js process, not several processes.
const queues = new Map();

function getSchema(name) {
  const schema = SCHEMAS[name];
  if (!schema) throw new Error(`Unknown CSV table: ${name}`);
  return schema;
}

function filePathFor(name) {
  return path.join(loadConfig().dbDir, getSchema(name).file);
}

function serialize(headers, rows) {
  return stringify(rows, { header: true, columns: headers });
}

function enqueue(name, task) {
  const previous = queues.get(name) || Promise.resolve();
  const next = previous.then(task);
  queues.set(name, next.catch(() => {})); // a failed task must not block the queue
  return next;
}

// Creates missing CSV files with the correct header. Existing files are never touched.
async function initCsvFiles() {
  await fs.mkdir(loadConfig().dbDir, { recursive: true });
  for (const name of Object.keys(SCHEMAS)) {
    try {
      // 'wx' fails if the file already exists, so existing data is safe.
      await fs.writeFile(filePathFor(name), serialize(getSchema(name).headers, []), { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

// Reads all rows. Any read/parse/header problem throws; it is never treated as "no data".
async function readRows(name) {
  const { headers, file } = getSchema(name);
  const text = await fs.readFile(filePathFor(name), 'utf8');
  const records = parse(text, { bom: true, skip_empty_lines: true });

  if (records.length === 0) {
    throw new Error(`${file} has no header row`);
  }
  const header = records[0];
  if (header.length !== headers.length || header.some((h, i) => h !== headers[i])) {
    throw new Error(`${file} has an unexpected header`);
  }

  return records.slice(1).map((record) => {
    if (record.length !== headers.length) {
      throw new Error(`${file} contains a row with the wrong number of columns`);
    }
    const row = {};
    headers.forEach((key, i) => { row[key] = record[i]; });
    return row;
  });
}

// Writes to a temp file, flushes it, then renames it over the real file.
async function writeRows(name, rows) {
  const { headers } = getSchema(name);
  const target = filePathFor(name);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    const handle = await fs.open(temp, 'w');
    try {
      await handle.writeFile(serialize(headers, rows), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, target);
  } catch (err) {
    await fs.unlink(temp).catch(() => {});
    throw err;
  }
}

// Safe read-modify-write.
// mutator(rows) must return { rows: <new rows>, result: <value to return> }.
// If it throws, or returns no rows, nothing is written.
function updateRows(name, mutator) {
  return enqueue(name, async () => {
    const rows = await readRows(name);
    const outcome = await mutator(rows);
    if (outcome && outcome.rows) {
      await writeRows(name, outcome.rows);
    }
    return outcome ? outcome.result : undefined;
  });
}

// Appends one row to the end of the file without a header. O(1) in file size,
// which is what keeps signup fast even with a very large users.csv.
async function appendRow(name, row) {
  const { headers } = getSchema(name);
  await fs.appendFile(filePathFor(name), stringify([row], { header: false, columns: headers }), 'utf8');
}

module.exports = { SCHEMAS, initCsvFiles, readRows, updateRows, appendRow };
