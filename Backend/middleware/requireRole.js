export const requireRole = (...roles) => (req, res, next) => {
  if (!req.userRole || !roles.includes(req.userRole)) {
    return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
  }
  next();
};
