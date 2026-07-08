const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'blacklist.json');

function getAll() {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function add(userId) {
  const data = getAll();
  if (!data.includes(userId)) {
    data.push(userId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

function remove(userId) {
  const data = getAll();
  const filtered = data.filter(id => id !== userId);
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
}

function isBlacklisted(userId) {
  return getAll().includes(userId);
}

module.exports = { getAll, add, remove, isBlacklisted };
