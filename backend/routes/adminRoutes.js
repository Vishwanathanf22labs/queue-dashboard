const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.post("/login", adminController.login);
router.post("/logout", adminController.logout);
router.get("/status", adminController.getStatus);

module.exports = router;
