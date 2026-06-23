const jwt = require('jsonwebtoken');

module.exports = function verifyToken(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // { admin_id, lot_id, username }
    next();
  } catch (err) {
    const isSecure = process.env.COOKIE_SECURE === 'true' || 
      (process.env.COOKIE_SECURE !== 'false' && req.secure);
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: isSecure });
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
