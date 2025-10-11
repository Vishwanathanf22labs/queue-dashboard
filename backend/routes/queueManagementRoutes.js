const express = require("express");
const queueManagementController = require("../controllers/queueManagementController");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.use(adminAuth);

router.delete("/clear-all", queueManagementController.clearAllQueues);

router.delete("/pending/clear", queueManagementController.clearPendingQueue);

router.delete("/failed/clear", queueManagementController.clearFailedQueue);

router.delete("/pending/:id", queueManagementController.removePendingBrand);
router.delete("/failed/:id", queueManagementController.removeFailedBrand);

router.put(
  "/pending/:id/move-to-failed",
  queueManagementController.movePendingToFailed
);
router.put(
  "/failed/:id/move-to-pending",
  queueManagementController.moveFailedToPending
);

router.put(
  "/pending/move-all-to-failed",
  queueManagementController.moveAllPendingToFailed
);
router.put(
  "/failed/move-all-to-pending",
  queueManagementController.moveAllFailedToPending
);

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

router.delete(
  "/watchlist/pending/clear",
  queueManagementController.clearWatchlistPendingQueue
);

router.delete(
  "/watchlist/failed/clear",
  queueManagementController.clearWatchlistFailedQueue
);

router.put(
  "/watchlist/pending/move-all-to-failed",
  queueManagementController.moveAllWatchlistPendingToFailed
);

router.put(
  "/watchlist/failed/move-all-to-pending",
  queueManagementController.moveAllWatchlistFailedToPending
);

router.post(
  "/watchlist/failed/cleanup",
  queueManagementController.cleanupWatchlistFailedQueue
);

router.get("/stats", queueManagementController.getQueueManagementStats);

module.exports = router;
