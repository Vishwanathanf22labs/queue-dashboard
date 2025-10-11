const express = require("express");
const settingsController = require("../controllers/settingsController");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.get("/config", settingsController.getConfigSettings);

router.put("/config", adminAuth, settingsController.updateConfigSettings);

module.exports = router;
