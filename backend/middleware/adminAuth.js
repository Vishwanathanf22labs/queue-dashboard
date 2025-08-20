const logger = require("../utils/logger");

const adminAuth = (req, res, next) => {
  try {
    const adminSession = req.cookies.adminSession;

    if (!adminSession) {
      logger.warn("Admin access attempt without valid session cookie");
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
        error: "No valid admin session found",
      });
    }

    if (isValidSessionToken(adminSession)) {
      // Note: Admin status endpoint is now cached to reduce repeated API calls
      // This middleware still logs on every protected route access
      logger.info("Admin access granted via session cookie");
      req.isAdmin = true;
      req.adminUser = "admin";
      req.adminSession = adminSession;
      next();
    } else {
      logger.warn("Admin access denied - invalid session token");
      return res.status(403).json({
        success: false,
        message: "Access denied",
        error: "Invalid or expired admin session",
      });
    }
  } catch (error) {
    logger.error("Error in admin authentication middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: "Internal server error during authentication",
    });
  }
};

const isValidSessionToken = (token) => {
  try {
    if (!token || typeof token !== "string") {
      return false;
    }

    const decoded = Buffer.from(token, "base64").toString("ascii");
    const parts = decoded.split("-");

    if (parts.length !== 2) {
      return false;
    }

    const timestamp = parseInt(parts[0]);
    const now = Date.now();

    if (now - timestamp > 24 * 60 * 60 * 1000) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error validating session token:", error);
    return false;
  }
};

module.exports = adminAuth;
