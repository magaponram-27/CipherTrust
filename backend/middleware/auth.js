const jwt = require('jsonwebtoken');

module.exports = function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    if (!claims.username) return res.status(401).json({ error: 'Invalid token' });
    req.user = { username: claims.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
