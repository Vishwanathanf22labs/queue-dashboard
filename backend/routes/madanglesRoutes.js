const express = require('express');
const multer = require('multer');
const adminAuth = require('../middleware/adminAuth');
const { uploadCsvToMadangles } = require('../controllers/madanglesCsvController');

const router = express.Router();

// Configure multer for CSV file uploads (same as existing CSV upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

/**
 * POST /api/madangles/upload-csv
 * Upload CSV file to madangles-scraper endpoint
 * Requires admin authentication
 */
router.post('/upload-csv', adminAuth, upload.single('file'), uploadCsvToMadangles);

module.exports = router;
