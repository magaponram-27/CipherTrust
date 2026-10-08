const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

function issueToken(user) {
  return jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!usernamePattern.test(username) || password.length < 6) {
      return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, or underscores; password must be at least 6 characters.' });
    }
    if (await User.exists({ username })) return res.status(409).json({ error: 'Username is already taken' });

    const user = await User.create({ username, passwordHash: await bcrypt.hash(password, 10) });
    return res.status(201).json({ token: issueToken(user), userId: user.id, username: user.username });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Username is already taken' });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    return res.json({ token: issueToken(user), userId: user.id, username: user.username });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
