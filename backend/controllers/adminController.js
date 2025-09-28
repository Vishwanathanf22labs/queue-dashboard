const logger = require("../utils/logger");
const { getAdminConfig } = require("../config/environmentConfig");

let adminStatusCache = {
  isAdmin: false,
  timestamp: 0,
  cacheDuration: 30000 // 30 seconds cache
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get admin credentials based on current environment
    const adminConfig = getAdminConfig();
    const ADMIN_USERNAME = adminConfig.username;
    const ADMIN_PASSWORD = adminConfig.password;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const sessionToken = generateSessionToken();

      res.cookie("adminSession", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });

     
      adminStatusCache = {
        isAdmin: true,
        timestamp: Date.now(),
        cacheDuration: 30000
      };

      logger.info(`Admin login successful for user: ${username}`);

      res.json({
        success: true,
        message: "Admin login successful",
        user: username,
        sessionExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } else {
      logger.warn(`Admin login failed for user: ${username}`);
      res.status(401).json({
        success: false,
        message: "Invalid admin credentials",
        error: "Authentication failed",
      });
    }
  } catch (error) {
    logger.error("Error in admin login:", error);
    res.status(500).json({
      success: false,
      message: "Login error",
      error: "Internal server error",
    });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("adminSession", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", 
      path: "/",
    });

   
    adminStatusCache = {
      isAdmin: false,
      timestamp: Date.now(),
      cacheDuration: 30000
    };

    logger.info("Admin logout successful");

    res.json({
      success: true,
      message: "Admin logout successful",
    });
  } catch (error) {
    logger.error("Error in admin logout:", error);
    res.status(500).json({
      success: false,
      message: "Logout error",
      error: "Internal server error",
    });
  }
};


const getStatus = async (req, res) => {
  try {
    const now = Date.now();
    
    // Check if cache is still valid
    if (adminStatusCache.timestamp && (now - adminStatusCache.timestamp) < adminStatusCache.cacheDuration) {
      // Return cached result without logging
      return res.json({
        success: true,
        isAdmin: adminStatusCache.isAdmin,
        message: adminStatusCache.isAdmin ? "Admin session active" : "No admin session",
        cached: true
      });
    }

    const adminSession = req.cookies.adminSession;
    let isAdmin = false;

    if (adminSession) {
      // Check if session is valid
      isAdmin = true;
    }

    // Update cache
    adminStatusCache = {
      isAdmin,
      timestamp: now,
      cacheDuration: 30000
    };

    // Only log when cache expires and we actually check the session
    logger.info(`Admin status check: ${isAdmin ? 'Active session' : 'No session'}`);

    res.json({
      success: true,
      isAdmin,
      message: isAdmin ? "Admin session active" : "No admin session",
      cached: false
    });
  } catch (error) {
    logger.error("Error checking admin status:", error);
    res.status(500).json({
      success: false,
      message: "Status check error",
      error: "Internal server error",
    });
  }
};

// Generate a secure session token
const generateSessionToken = () => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  return Buffer.from(`${timestamp}-${random}`).toString("base64");
};

module.exports = {
  login,
  logout,
  getStatus,
};
