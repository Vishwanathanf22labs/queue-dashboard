const express = require("express");
const scrapedBrandsController = require("../controllers/scrapedBrandsController");

const router = express.Router();

router.get("/", scrapedBrandsController.getScrapedBrands);

router.get("/search", scrapedBrandsController.searchScrapedBrands);

router.get("/stats", scrapedBrandsController.getScrapedBrandsStats);

module.exports = router;
