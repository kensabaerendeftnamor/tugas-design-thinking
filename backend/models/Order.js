const mongoose = require('mongoose');

const usedIngredientSchema = new mongoose.Schema({
  ingredientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ingredient', 
    required: true 
  },
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantityUsed: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema({
  menuId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Menu', 
    required: true 
  },
  menuName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'cancelled'], 
    default: 'completed' 
  },
  ingredientsUsed: [usedIngredientSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);