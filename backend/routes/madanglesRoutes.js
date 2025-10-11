const express = require("express");
const multer = require("multer");
const adminAuth = require("../middleware/adminAuth");
const {
  uploadCsvToMadangles,
  checkScrapingStatus,
  addScrapedBrandsToQueue,
} = require("../controllers/madanglesCsvController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

router.post(
  "/upload-csv",
  adminAuth,
  upload.single("file"),
  uploadCsvToMadangles
);

router.post("/check-scraping-status", adminAuth, checkScrapingStatus);

router.post("/add-to-queue", adminAuth, addScrapedBrandsToQueue);

module.exports = router;
