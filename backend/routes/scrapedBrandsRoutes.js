const express = require('express');
const scrapedBrandsController = require('../controllers/scrapedBrandsController');

const router = express.Router();

// GET /api/scraped-brands - Get paginated scraped brands for current date
router.get('/', scrapedBrandsController.getScrapedBrands);

// GET /api/scraped-brands/search - Search scraped brands across all pages
router.get('/search', scrapedBrandsController.searchScrapedBrands);

// GET /api/scraped-brands/stats - Get scraped brands statistics for current date
router.get('/stats', scrapedBrandsController.getScrapedBrandsStats);

module.exports = router;
