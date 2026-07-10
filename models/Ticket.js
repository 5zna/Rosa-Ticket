const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId:        { type: String, required: true },
  threadId:      { type: String, required: true, unique: true },
  type:          { type: String, required: true },
  openedAt:      { type: Date, default: Date.now },
  guildId:       { type: String, required: true },
  mentionMessageId: String,
  closed:        { type: Boolean, default: false },
  claimedBy:     { type: String, default: null },
});

module.exports = mongoose.model('Ticket', ticketSchema);
