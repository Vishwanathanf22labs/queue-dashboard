const express = require("express");
const router = express.Router();
const {
  getCurrentEnvironmentInfo,
  switchEnvironment,
  getEnvironments,
  testRedisKeys,
} = require("../controllers/environmentController");

router.get("/current", getCurrentEnvironmentInfo);

router.get("/", getEnvironments);

router.post("/switch", switchEnvironment);

router.get("/test-redis-keys", testRedisKeys);

module.exports = router;
