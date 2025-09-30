const express = require('express');
const router = express.Router();
const {
  getAllIngredients,
  getIngredientById,
  createIngredient,
  addStockToIngredient,
  updateIngredient,
  deleteIngredient,
  getIngredientAlerts,
  getIngredientBatches,
  updateIngredientBatch
} = require('../controllers/ingredientController');

router.get('/', getAllIngredients);
router.get('/:id', getIngredientById);
router.get('/:id/batches', getIngredientBatches);
router.post('/', createIngredient);
router.post('/:id/stock', addStockToIngredient);
router.put('/:id', updateIngredient);
router.put('/:id/batch', updateIngredientBatch);
router.delete('/:id', deleteIngredient);
router.get('/alerts/expired', getIngredientAlerts);

module.exports = router;