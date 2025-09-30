const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryStats
} = require('../controllers/categoryController');

router.get('/', getCategories);
router.get('/stats', getCategoryStats);

module.exports = router;