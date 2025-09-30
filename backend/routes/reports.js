const express = require('express');
const router = express.Router();
const {
  getCategoryReports,
  getDetailedCategoryReport,
  getStockInHistory,
  getStockOutHistory,
  getExpiryAlerts
} = require('../controllers/reportController');

router.get('/categories', getCategoryReports);
router.get('/categories/detailed', getDetailedCategoryReport);
router.get('/stock-history/in', getStockInHistory);
router.get('/stock-history/out', getStockOutHistory);
router.get('/expiry-alerts', getExpiryAlerts);

module.exports = router;