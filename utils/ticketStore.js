const Ticket = require('../models/Ticket');

async function getAll() {
  return Ticket.find().lean();
}

async function add(entry) {
  await Ticket.create(entry);
}

async function remove(threadId) {
  await Ticket.deleteOne({ threadId });
}

async function getByThreadId(threadId) {
  return Ticket.findOne({ threadId }).lean();
}

async function update(threadId, changes) {
  await Ticket.updateOne({ threadId }, { $set: changes });
}

module.exports = { getAll, add, remove, getByThreadId, update };
