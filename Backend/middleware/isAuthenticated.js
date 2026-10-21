
import jwt from "jsonwebtoken";

const authenticateToken = (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "No token provided. Please log in.",
        success: false,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check which property your login controller puts in the token
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        message: "User ID missing from token",
        success: false,
      });
    }

    req.id = userId;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
      success: false,
    });
  }
};

export default authenticateToken;
  