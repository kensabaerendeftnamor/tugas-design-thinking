const Ingredient = require('../models/Ingredient');
const StockHistory = require('../models/StockHistory');
const mongoose = require('mongoose');

const getAllIngredients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    
    let filter = {};
    
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' };
    }
    
    if (req.query.category && req.query.category !== '') {
      filter.category = req.query.category;
    }
    
    const ingredients = await Ingredient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Filter out batches with zero quantity and add total quantity
    const ingredientsWithQuantity = ingredients.map(ingredient => {
      const batchesWithStock = ingredient.batches.filter(batch => batch.currentQuantity > 0);
      const totalQuantity = batchesWithStock.reduce((total, batch) => total + batch.currentQuantity, 0);
      
      return {
        ...ingredient,
        batches: batchesWithStock,
        quantity: totalQuantity
      };
    });
    
    const total = await Ingredient.countDocuments(filter);
    
    res.json({
      success: true,
      data: ingredientsWithQuantity,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getIngredientById = async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ success: false, message: 'Bahan tidak ditemukan' });
    }
    
    // Filter out batches with zero quantity
    ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);
    
    // Sort batches by expiry date (FIFO)
    ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    // Tambahkan quantity manual
    const ingredientWithQuantity = ingredient.toObject();
    ingredientWithQuantity.quantity = ingredient.batches.reduce((total, batch) => total + batch.currentQuantity, 0);
    
    res.json({ success: true, data: ingredientWithQuantity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createIngredient = async (req, res) => {
  try {
    const { name, quantity, unit, category, expiryDate } = req.body;
    
    if (!name || !quantity || !unit || !category || !expiryDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Semua field harus diisi' 
      });
    }

    // Check if ingredient with same name and expiry date already exists
    const existingIngredient = await Ingredient.findOne({ 
      name: name,
      'batches.expiryDate': new Date(expiryDate)
    });

    if (existingIngredient) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gunakan fitur "Tambah Stok" untuk menambah stok bahan dengan tanggal kadaluarsa sama' 
      });
    }

    const newBatch = {
      initialQuantity: parseFloat(quantity),
      currentQuantity: parseFloat(quantity),
      expiryDate: new Date(expiryDate),
      entryDate: new Date()
    };
    
    const ingredient = new Ingredient({
      name,
      unit,
      category,
      batches: [newBatch]
    });
    
    const savedIngredient = await ingredient.save();
    
    // Record stock history
    const stockHistory = new StockHistory({
      type: 'in',
      ingredientId: savedIngredient._id,
      ingredientName: savedIngredient.name,
      batchId: savedIngredient.batches[0]._id,
      quantity: parseFloat(quantity),
      previousStock: 0,
      newStock: parseFloat(quantity),
      reason: 'new_stock'
    });
    
    await stockHistory.save();
    
    // Tambahkan quantity ke response
    const responseIngredient = savedIngredient.toObject();
    responseIngredient.quantity = parseFloat(quantity);
    
    res.status(201).json({ success: true, data: responseIngredient });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const addStockToIngredient = async (req, res) => {
  try {
    const { quantity, expiryDate } = req.body;
    const ingredientId = req.params.id;

    if (!quantity || !expiryDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Jumlah dan tanggal kadaluwarsa harus diisi' 
      });
    }

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) {
      return res.status(404).json({ success: false, message: 'Bahan tidak ditemukan' });
    }

    // Clean up empty batches first
    ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);

    // Check if there's a batch with the same expiry date
    const existingBatchIndex = ingredient.batches.findIndex(batch => 
      new Date(batch.expiryDate).toDateString() === new Date(expiryDate).toDateString()
    );

    let batchToUpdate;
    let isNewBatch = false;

    if (existingBatchIndex !== -1) {
      // Update existing batch
      batchToUpdate = ingredient.batches[existingBatchIndex];
      const previousQuantity = batchToUpdate.currentQuantity;
      
      batchToUpdate.initialQuantity += parseFloat(quantity);
      batchToUpdate.currentQuantity += parseFloat(quantity);
      
      // Record stock history
      const stockHistory = new StockHistory({
        type: 'in',
        ingredientId: ingredient._id,
        ingredientName: ingredient.name,
        batchId: batchToUpdate._id,
        quantity: parseFloat(quantity),
        previousStock: previousQuantity,
        newStock: batchToUpdate.currentQuantity,
        reason: 'restock'
      });
      await stockHistory.save();
    } else {
      // Create new batch
      const newBatch = {
        initialQuantity: parseFloat(quantity),
        currentQuantity: parseFloat(quantity),
        expiryDate: new Date(expiryDate),
        entryDate: new Date()
      };
      
      ingredient.batches.push(newBatch);
      batchToUpdate = ingredient.batches[ingredient.batches.length - 1];
      isNewBatch = true;
      
      // Record stock history
      const stockHistory = new StockHistory({
        type: 'in',
        ingredientId: ingredient._id,
        ingredientName: ingredient.name,
        batchId: batchToUpdate._id,
        quantity: parseFloat(quantity),
        previousStock: 0,
        newStock: parseFloat(quantity),
        reason: 'new_batch'
      });
      await stockHistory.save();
    }

    // Sort batches by expiry date (FIFO)
    ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    const updatedIngredient = await ingredient.save();
    
    // Tambahkan quantity ke response
    const responseIngredient = updatedIngredient.toObject();
    responseIngredient.quantity = updatedIngredient.batches.reduce((total, batch) => total + batch.currentQuantity, 0);
    
    res.json({ 
      success: true, 
      data: responseIngredient,
      message: isNewBatch ? 'Batch baru berhasil ditambahkan' : 'Stok batch berhasil ditambahkan'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateIngredient = async (req, res) => {
  try {
    const { name, unit, category } = req.body;
    const ingredientId = req.params.id;

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) {
      return res.status(404).json({ success: false, message: 'Bahan tidak ditemukan' });
    }

    // Clean up empty batches first
    ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);

    // Update basic fields
    ingredient.name = name || ingredient.name;
    ingredient.unit = unit || ingredient.unit;
    ingredient.category = category || ingredient.category;

    // Sort batches by expiry date (FIFO)
    ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    const updatedIngredient = await ingredient.save();
    
    // Tambahkan quantity ke response
    const responseIngredient = updatedIngredient.toObject();
    responseIngredient.quantity = updatedIngredient.batches.reduce((total, batch) => total + batch.currentQuantity, 0);
    
    res.json({ success: true, data: responseIngredient });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteIngredient = async (req, res) => {
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
    
    if (!ingredient) {
      return res.status(404).json({ success: false, message: 'Bahan tidak ditemukan' });
    }
    
    res.json({ success: true, message: 'Bahan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getIngredientAlerts = async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    // Only include batches with currentQuantity > 0
    const ingredients = await Ingredient.aggregate([
      {
        $unwind: '$batches'
      },
      {
        $match: {
          'batches.currentQuantity': { $gt: 0 },
          'batches.expiryDate': { 
            $lte: sevenDaysFromNow, 
            $gte: today 
          }
        }
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          unit: { $first: '$unit' },
          category: { $first: '$category' },
          batches: { $push: '$batches' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' }
        }
      }
    ]);
    
    const expiringSoon = ingredients.map(ingredient => ({
      ...ingredient,
      quantity: ingredient.batches.reduce((total, batch) => total + batch.currentQuantity, 0)
    }));
    
    const expiredIngredients = await Ingredient.aggregate([
      {
        $unwind: '$batches'
      },
      {
        $match: {
          'batches.currentQuantity': { $gt: 0 },
          'batches.expiryDate': { $lt: today }
        }
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          unit: { $first: '$unit' },
          category: { $first: '$category' },
          batches: { $push: '$batches' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' }
        }
      }
    ]);
    
    const expired = expiredIngredients.map(ingredient => ({
      ...ingredient,
      quantity: ingredient.batches.reduce((total, batch) => total + batch.currentQuantity, 0)
    }));
    
    const lowStockIngredients = await Ingredient.aggregate([
      {
        $unwind: '$batches'
      },
      {
        $match: {
          'batches.currentQuantity': { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          unit: { $first: '$unit' },
          category: { $first: '$category' },
          totalCurrent: { $sum: '$batches.currentQuantity' },
          batches: { $push: '$batches' }
        }
      },
      {
        $match: {
          totalCurrent: { $gt: 0, $lt: 10 }
        }
      }
    ]);
    
    const lowStock = lowStockIngredients.map(ingredient => ({
      ...ingredient,
      quantity: ingredient.totalCurrent
    }));
    
    res.json({ 
      success: true, 
      data: { 
        expiringSoon, 
        expired, 
        lowStock 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getIngredientBatches = async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ success: false, message: 'Bahan tidak ditemukan' });
    }
    
    // Filter out batches with zero quantity
    const batchesWithStock = ingredient.batches.filter(batch => batch.currentQuantity > 0);
    
    // Sort batches by expiry date (FIFO)
    const sortedBatches = batchesWithStock.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    res.json({ 
      success: true, 
      data: sortedBatches 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateIngredientBatch = async (req, res) => {
  try {
    const { batchId, quantity, expiryDate } = req.body;
    const ingredientId = req.params.id;

    if (!batchId || (!quantity && !expiryDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Batch ID dan data yang akan diupdate harus diisi' 
      });
    }

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) {
      return res.status(404).json({ success: false, message: 'Bahan tidak ditemukan' });
    }

    const batchIndex = ingredient.batches.findIndex(batch => batch._id.toString() === batchId);
    if (batchIndex === -1) {
      return res.status(404).json({ success: false, message: 'Batch tidak ditemukan' });
    }

    const batch = ingredient.batches[batchIndex];
    let stockHistoryRecord = null;

    // Update quantity if provided
    if (quantity !== undefined) {
      const quantityChange = parseFloat(quantity) - batch.currentQuantity;
      const previousQuantity = batch.currentQuantity;
      
      batch.initialQuantity = parseFloat(quantity);
      batch.currentQuantity = parseFloat(quantity);
      
      // Record stock history for quantity change
      if (quantityChange !== 0) {
        stockHistoryRecord = new StockHistory({
          type: quantityChange > 0 ? 'in' : 'out',
          ingredientId: ingredient._id,
          ingredientName: ingredient.name,
          batchId: batch._id,
          quantity: Math.abs(quantityChange),
          previousStock: previousQuantity,
          newStock: batch.currentQuantity,
          reason: 'manual_adjustment'
        });
        await stockHistoryRecord.save();
      }
    }

    // Update expiry date if provided
    if (expiryDate !== undefined) {
      batch.expiryDate = new Date(expiryDate);
    }

    // Clean up empty batches (if quantity becomes 0)
    ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);

    // Sort batches by expiry date (FIFO)
    ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    const updatedIngredient = await ingredient.save();
    
    res.json({ 
      success: true, 
      data: updatedIngredient,
      message: 'Batch berhasil diupdate'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const cleanupEmptyBatches = async (req, res) => {
  try {
    const ingredients = await Ingredient.find({});
    
    let totalRemoved = 0;
    let updatedIngredients = [];
    
    for (const ingredient of ingredients) {
      const initialBatchCount = ingredient.batches.length;
      
      // Filter out batches with zero quantity
      ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);
      
      const removedCount = initialBatchCount - ingredient.batches.length;
      if (removedCount > 0) {
        // Sort batches by expiry date (FIFO)
        ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        await ingredient.save();
        totalRemoved += removedCount;
        updatedIngredients.push({
          id: ingredient._id,
          name: ingredient.name,
          batchesRemoved: removedCount
        });
      }
    }
    
    res.json({
      success: true,
      message: `Berhasil membersihkan ${totalRemoved} batch yang kosong`,
      data: { 
        batchesRemoved: totalRemoved,
        updatedIngredients 
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllIngredients,
  getIngredientById,
  createIngredient,
  addStockToIngredient,
  updateIngredient,
  deleteIngredient,
  getIngredientAlerts,
  getIngredientBatches,
  updateIngredientBatch,
  cleanupEmptyBatches
};