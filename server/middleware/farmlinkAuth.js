const jwt = require("jsonwebtoken");
const User = require("../models/User"); // ADAPT: path to your User model

const COOKIE_NAME = process.env.COOKIE_NAME || "token"; // ADAPT: the name of your session cookie

function fail(res, code, msg) {
  return res.status(code).json({ error: msg, message: msg });
}

// Reads the JWT cookie, then loads the user from MongoDB so the role is always current.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return fail(res, 401, "Not logged in.");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // ADAPT: whichever field your login puts the user id in
    const id = payload.id || payload.userId || payload._id || payload.sub;
    const user = id && (await User.findById(id));
    if (!user) return fail(res, 401, "Session expired.");
    req.user = user;
    next();
  } catch (e) {
    return fail(res, 401, "Session expired.");
  }
}

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : fail(res, 403, "You don't have access to this.");

module.exports = { requireAuth, allow };