const express = require("express");
const router = express.Router();
const { 
  getCurrentEnvironmentInfo, 
  switchEnvironment, 
  getEnvironments,
  testRedisKeys
} = require("../controllers/environmentController");

// Get current environment information
router.get("/current", getCurrentEnvironmentInfo);

// Get available environments
router.get("/", getEnvironments);

// Switch environment
router.post("/switch", switchEnvironment);

// Test Redis keys
router.get("/test-redis-keys", testRedisKeys);

module.exports = router;
