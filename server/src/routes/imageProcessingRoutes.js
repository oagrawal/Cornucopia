const express = require('express');
const router = express.Router();
const { processImage } = require('../controllers/imageProcessingController');

// POST an image for processing
router.post('/', processImage);

module.exports = router; 