const Ingredient = require('../models/Ingredient');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = await Ingredient.distinct('category');
    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saat mengambil data kategori'
    });
  }
};

// @desc    Get category statistics
// @route   GET /api/categories/stats
// @access  Public
const getCategoryStats = async (req, res) => {
  try {
    const stats = await Ingredient.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQuantity: { $sum: { $sum: '$batches.currentQuantity' } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saat mengambil statistik kategori'
    });
  }
};

module.exports = {
  getCategories,
  getCategoryStats
};