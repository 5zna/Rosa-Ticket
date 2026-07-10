const Blacklist = require('../models/Blacklist');

async function getAll() {
  const docs = await Blacklist.find().lean();
  return docs.map(d => d.userId);
}

async function add(userId) {
  await Blacklist.findOneAndUpdate(
    { userId },
    { userId, addedAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

async function remove(userId) {
  await Blacklist.deleteOne({ userId });
}

async function isBlacklisted(userId) {
  const doc = await Blacklist.findOne({ userId }).lean();
  return !!doc;
}

module.exports = { getAll, add, remove, isBlacklisted };
