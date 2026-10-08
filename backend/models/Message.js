const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'voice', 'sticker'], default: 'text' },
  aiVerdict: { type: String, default: null },
  aiConfidence: { type: Number, default: null },
  unsent: { type: Boolean, default: false },
  timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
