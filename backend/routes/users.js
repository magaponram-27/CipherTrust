const express = require('express');
const User = require('../models/User');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/me/public-key', authenticate, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.user.username }).select('publicKey').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ publicKey: user.publicKey || '' });
  } catch (error) {
    return next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const currentUser = await User.findOne({ username: req.user.username }).select('contacts blockedUsers').lean();
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    const users = await User.find({ username: { $in: currentUser.contacts || [] } })
      .select('username publicKey createdAt blockedUsers')
      .sort({ username: 1 })
      .lean();
    const blockedUsers = new Set(currentUser.blockedUsers || []);
    return res.json(users.map((contact) => ({
      username: contact.username,
      publicKey: contact.publicKey,
      createdAt: contact.createdAt,
      blockedByMe: blockedUsers.has(contact.username),
      blockedMe: (contact.blockedUsers || []).includes(req.user.username)
    })));
  } catch (error) {
    return next(error);
  }
});

router.post('/contacts', authenticate, async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({ error: 'Enter a username that is 3-24 letters, numbers, or underscores.' });
    }
    if (username === req.user.username) return res.status(400).json({ error: 'You cannot add yourself as a contact.' });

    const contact = await User.findOne({ username }).select('username publicKey createdAt').lean();
    if (!contact) return res.status(404).json({ error: 'No account found with that username.' });
    await User.updateOne({ username: req.user.username }, { $addToSet: { contacts: username } });
    return res.status(201).json(contact);
  } catch (error) {
    return next(error);
  }
});

router.post('/:username/block', authenticate, async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    if (username === req.user.username) return res.status(400).json({ error: 'You cannot block yourself.' });
    const contact = await User.findOne({ username }).select('username').lean();
    if (!contact) return res.status(404).json({ error: 'User not found.' });
    await User.updateOne({ username: req.user.username }, { $addToSet: { blockedUsers: username } });
    return res.json({ username, blocked: true });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:username/block', authenticate, async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    await User.updateOne({ username: req.user.username }, { $pull: { blockedUsers: username } });
    return res.json({ username, blocked: false });
  } catch (error) {
    return next(error);
  }
});

router.put('/me/public-key', authenticate, async (req, res, next) => {
  try {
    const publicKey = typeof req.body.publicKey === 'string' ? req.body.publicKey : '';
    if (!publicKey || publicKey.length > 2048) return res.status(400).json({ error: 'Invalid public key' });
    const user = await User.findOneAndUpdate(
      {
        username: req.user.username,
        $or: [{ publicKey: '' }, { publicKey: { $exists: false } }, { publicKey }]
      },
      { publicKey },
      { new: true, select: 'username publicKey createdAt' }
    ).lean();
    if (!user) {
      if (await User.exists({ username: req.user.username })) {
        return res.status(409).json({ error: 'An encryption identity is already registered for this account and cannot be replaced from this browser.' });
      }
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

router.get('/:username', authenticate, async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username }).select('username publicKey createdAt').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
