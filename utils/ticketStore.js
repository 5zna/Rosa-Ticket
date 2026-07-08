const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'openedtickets.json');

function getAll() {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function add(entry) {
  const data = getAll();
  data.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function remove(threadId) {
  const data = getAll();
  const filtered = data.filter(t => t.threadId !== threadId);
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
}

function getByThreadId(threadId) {
  return getAll().find(t => t.threadId === threadId) || null;
}

function update(threadId, changes) {
  const data = getAll();
  const idx = data.findIndex(t => t.threadId === threadId);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...changes };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return data[idx];
}

module.exports = { getAll, add, remove, getByThreadId, update };
