const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');

function get() {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { get, save };
