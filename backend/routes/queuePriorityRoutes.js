const express = require("express");
const queuePriorityController = require("../controllers/queuePriorityController");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

// All priority management routes require admin authentication
router.use(adminAuth);

/**
 * Priority Queue Management Routes
 * 
 * POST /api/queue/priority/change - Change brand priority by name to any position (1, 1000, 456, etc.)
 */

// Change brand priority to any position (single endpoint for all operations)
router.post("/change", queuePriorityController.changeBrandPriority);







module.exports = router;
