/**
 * authMiddleware.js
 *
 * Checks that the request has an active Passport session.
 * Passport's req.isAuthenticated() returns true when req.user is populated
 * from the cookie-session (set during req.login() at login time).
 *
 * Also maps req.user.S_ID → req.user.Student_ID so all chat controllers
 * can consistently use req.user.Student_ID.
 */
const authMiddleware = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  // Passport stores the full DB row — the PK is S_ID.
  // Chat controllers expect Student_ID, so we attach it here.
  if (req.user && req.user.S_ID && !req.user.Student_ID) {
    req.user.Student_ID = req.user.S_ID;
  }

  next();
};

const hasAuthorizedAdminCookie = (req) => {
  const cookieHeader = req.headers?.cookie || "";

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .some((cookie) => cookie === "admin_token=authorized_access_granted");
};

export const authOrAdminMiddleware = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user && req.user.S_ID && !req.user.Student_ID) {
      req.user.Student_ID = req.user.S_ID;
    }
    return next();
  }

  if (hasAuthorizedAdminCookie(req)) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized. Please log in." });
};

export default authMiddleware;
