const express = require('express');
const Message = require('../models/Message');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/:user1/:user2', authenticate, async (req, res, next) => {
  try {
    const { user1, user2 } = req.params;
    if (![user1, user2].map((name) => name.toLowerCase()).includes(req.user.username)) {
      return res.status(403).json({ error: 'You can only access your own conversations' });
    }
    const messages = await Message.find({
      unsent: { $ne: true },
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ]
    }).sort({ timestamp: 1 }).limit(200).lean();
    return res.json(messages);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
