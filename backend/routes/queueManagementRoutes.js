const express = require("express");
const queueManagementController = require("../controllers/queueManagementController");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.use(adminAuth);

// Clear all queues (both pending and failed)
router.delete("/clear-all", queueManagementController.clearAllQueues);

// Clear only pending queue
router.delete("/pending/clear", queueManagementController.clearPendingQueue);

// Clear only failed queue
router.delete("/failed/clear", queueManagementController.clearFailedQueue);

// Individual brand removal
router.delete("/pending/:id", queueManagementController.removePendingBrand);
router.delete("/failed/:id", queueManagementController.removeFailedBrand);

// Move operations - PUT methods
router.put(
  "/pending/:id/move-to-failed",
  queueManagementController.movePendingToFailed
);
router.put(
  "/failed/:id/move-to-pending",
  queueManagementController.moveFailedToPending
);

// Bulk move operations
router.put(
  "/pending/move-all-to-failed",
  queueManagementController.moveAllPendingToFailed
);
router.put(
  "/failed/move-all-to-pending",
  queueManagementController.moveAllFailedToPending
);

// Watchlist specific operations
router.put(
  "/watchlist/move-failed-to-pending",
  queueManagementController.moveWatchlistFailedToPending
);

router.put(
  "/watchlist/move-to-pending",
  queueManagementController.moveWatchlistToPending
);

router.put(
  "/watchlist/failed/:id/move-to-pending",
  queueManagementController.moveIndividualWatchlistFailedToPending
);



// Get queue management statistics
router.get("/stats", queueManagementController.getQueueManagementStats);

module.exports = router;
