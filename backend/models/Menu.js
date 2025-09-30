const mongoose = require('mongoose');

const ingredientRequirementSchema = new mongoose.Schema({
  ingredientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ingredient', 
    required: true 
  },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true }
});

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  price: { type: Number, min: 0 },
  ingredients: [ingredientRequirementSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

menuSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Menu', menuSchema);