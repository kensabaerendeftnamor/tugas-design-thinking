const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['in', 'out'],
    required: true
  },
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  ingredientName: { type: String, required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  reason: {
    type: String,
    enum: ['order', 'manual_adjustment', 'expired', 'new_stock', 'restock', 'new_batch', 'order_cancellation'],
    required: true
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StockHistory', stockHistorySchema);