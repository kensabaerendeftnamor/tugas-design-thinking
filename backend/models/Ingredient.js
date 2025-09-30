const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  initialQuantity: { type: Number, required: true },
  currentQuantity: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
  entryDate: { type: Date, default: Date.now }
});

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unit: { type: String, required: true },
  category: { type: String, required: true },
  batches: [batchSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware untuk update updatedAt
ingredientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Sort batches by expiry date (FIFO) setiap kali menyimpan
  this.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  
  next();
});

// Virtual untuk total quantity
ingredientSchema.virtual('quantity').get(function() {
  return this.batches.reduce((total, batch) => total + batch.currentQuantity, 0);
});

// Method untuk menggunakan stok dengan FIFO
ingredientSchema.methods.useStock = function(quantityNeeded) {
  let remainingNeeded = quantityNeeded;
  const usedBatches = [];
  
  // Sort by expiry date (FIFO)
  this.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  
  for (const batch of this.batches) {
    if (remainingNeeded <= 0) break;
    
    if (batch.currentQuantity > 0) {
      const taken = Math.min(remainingNeeded, batch.currentQuantity);
      batch.currentQuantity -= taken;
      remainingNeeded -= taken;
      
      usedBatches.push({
        batchId: batch._id,
        quantityUsed: taken,
        previousQuantity: batch.currentQuantity + taken
      });
    }
  }
  
  return {
    usedBatches,
    remainingNeeded,
    success: remainingNeeded === 0
  };
};

// Aktifkan virtuals untuk JSON output
ingredientSchema.set('toJSON', { virtuals: true });
ingredientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ingredient', ingredientSchema);