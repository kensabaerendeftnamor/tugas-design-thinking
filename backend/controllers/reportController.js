const Ingredient = require('../models/Ingredient');
const Order = require('../models/Order');
const StockHistory = require('../models/StockHistory');

const getCategoryReports = async (req, res) => {
  try {
    const ingredients = await Ingredient.find({});
    
    const categoryReport = {};
    
    ingredients.forEach(ingredient => {
      if (!categoryReport[ingredient.category]) {
        categoryReport[ingredient.category] = [];
      }
      
      // Group batches by expiry date
      const batchMap = {};
      
      ingredient.batches.forEach(batch => {
        if (batch.currentQuantity > 0) {
          const expiryDateKey = batch.expiryDate.toISOString().split('T')[0];
          
          if (!batchMap[expiryDateKey]) {
            batchMap[expiryDateKey] = {
              name: ingredient.name,
              unit: ingredient.unit,
              expiryDate: batch.expiryDate,
              totalQuantity: 0,
              batches: []
            };
          }
          
          batchMap[expiryDateKey].totalQuantity += batch.currentQuantity;
          batchMap[expiryDateKey].batches.push({
            batchId: batch._id,
            quantity: batch.currentQuantity,
            entryDate: batch.entryDate
          });
        }
      });
      
      // Add grouped batches to category report
      Object.values(batchMap).forEach(item => {
        categoryReport[ingredient.category].push(item);
      });
    });
    
    // Sort each category by expiry date
    for (const category in categoryReport) {
      categoryReport[category].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    }
    
    res.json({ success: true, data: categoryReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDetailedCategoryReport = async (req, res) => {
  try {
    const { category } = req.query;
    
    let filter = {};
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    const ingredients = await Ingredient.find(filter);
    
    const detailedReport = [];
    
    ingredients.forEach(ingredient => {
      // Group batches by expiry date for this ingredient
      const batchMap = {};
      
      ingredient.batches.forEach(batch => {
        if (batch.currentQuantity > 0) {
          const expiryDateKey = batch.expiryDate.toISOString().split('T')[0];
          
          if (!batchMap[expiryDateKey]) {
            batchMap[expiryDateKey] = {
              ingredientId: ingredient._id,
              ingredientName: ingredient.name,
              unit: ingredient.unit,
              category: ingredient.category,
              expiryDate: batch.expiryDate,
              totalQuantity: 0,
              batches: []
            };
          }
          
          batchMap[expiryDateKey].totalQuantity += batch.currentQuantity;
          batchMap[expiryDateKey].batches.push({
            batchId: batch._id,
            quantity: batch.currentQuantity,
            entryDate: batch.entryDate
          });
        }
      });
      
      // Add to detailed report
      Object.values(batchMap).forEach(item => {
        detailedReport.push(item);
      });
    });
    
    // Sort by category and expiry date
    detailedReport.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });
    
    res.json({ success: true, data: detailedReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStockInHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    
    const history = await StockHistory.find({ type: 'in' })
      .populate('ingredientId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await StockHistory.countDocuments({ type: 'in' });
    
    res.json({
      success: true,
      data: history,
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

const getStockOutHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    
    const history = await StockHistory.find({ type: 'out' })
      .populate('ingredientId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await StockHistory.countDocuments({ type: 'out' });
    
    res.json({
      success: true,
      data: history,
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

const getExpiryAlerts = async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    const ingredients = await Ingredient.aggregate([
      { $unwind: '$batches' },
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
          batches: { $push: '$batches' }
        }
      }
    ]);
    
    // Group by expiry date
    const expiryAlerts = [];
    
    ingredients.forEach(ingredient => {
      const batchMap = {};
      
      ingredient.batches.forEach(batch => {
        const expiryDateKey = batch.expiryDate.toISOString().split('T')[0];
        
        if (!batchMap[expiryDateKey]) {
          batchMap[expiryDateKey] = {
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            unit: ingredient.unit,
            category: ingredient.category,
            expiryDate: batch.expiryDate,
            totalQuantity: 0
          };
        }
        
        batchMap[expiryDateKey].totalQuantity += batch.currentQuantity;
      });
      
      Object.values(batchMap).forEach(item => {
        expiryAlerts.push(item);
      });
    });
    
    // Sort by expiry date
    expiryAlerts.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    res.json({ success: true, data: expiryAlerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategoryReports,
  getDetailedCategoryReport,
  getStockInHistory,
  getStockOutHistory,
  getExpiryAlerts
};