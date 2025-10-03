const express = require("express");
const settingsController = require("../controllers/settingsController");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

// Get config settings from Redis (accessible to all users - read-only)
router.get("/config", settingsController.getConfigSettings);

// Update config settings in Redis (admin only)
router.put("/config", adminAuth, settingsController.updateConfigSettings);

module.exports = router;
