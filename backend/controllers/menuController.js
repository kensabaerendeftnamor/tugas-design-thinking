const Menu = require('../models/Menu');
const Ingredient = require('../models/Ingredient');

const getAllMenus = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    
    let filter = {};
    
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' };
    }
    
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate + 'T23:59:59.999Z')
      };
    }
    
    const menus = await Menu.find(filter)
      .populate('ingredients.ingredientId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Menu.countDocuments(filter);
    
    res.json({
      success: true,
      data: menus,
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

const getMenuById = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id).populate('ingredients.ingredientId');
    if (!menu) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createMenu = async (req, res) => {
  try {
    const { name, description, price, ingredients } = req.body;
    
    if (!name || !ingredients || ingredients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nama dan bahan harus diisi' 
      });
    }
    
    // Validate all ingredients exist and add ingredient names
    const ingredientsWithDetails = [];
    for (const ingredientReq of ingredients) {
      const ingredientExists = await Ingredient.findById(ingredientReq.ingredientId);
      if (!ingredientExists) {
        return res.status(404).json({ 
          success: false, 
          message: `Bahan dengan ID ${ingredientReq.ingredientId} tidak ditemukan` 
        });
      }
      
      ingredientsWithDetails.push({
        ingredientId: ingredientReq.ingredientId,
        quantity: ingredientReq.quantity,
        unit: ingredientExists.unit,
        name: ingredientExists.name
      });
    }
    
    const menu = new Menu({
      name,
      description,
      price,
      ingredients: ingredientsWithDetails
    });
    
    const savedMenu = await menu.save();
    const populatedMenu = await Menu.findById(savedMenu._id).populate('ingredients.ingredientId');
    
    res.status(201).json({ success: true, data: populatedMenu });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nama menu sudah ada' 
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateMenu = async (req, res) => {
  try {
    const { name, description, price, ingredients } = req.body;
    
    // Validate ingredients if provided
    let ingredientsWithDetails = [];
    if (ingredients) {
      for (const ingredientReq of ingredients) {
        const ingredientExists = await Ingredient.findById(ingredientReq.ingredientId);
        if (!ingredientExists) {
          return res.status(404).json({ 
            success: false, 
            message: `Bahan dengan ID ${ingredientReq.ingredientId} tidak ditemukan` 
          });
        }
        
        ingredientsWithDetails.push({
          ingredientId: ingredientReq.ingredientId,
          quantity: ingredientReq.quantity,
          unit: ingredientExists.unit,
          name: ingredientExists.name
        });
      }
    }
    
    const updateData = { name, description, price };
    if (ingredients) {
      updateData.ingredients = ingredientsWithDetails;
    }
    
    const menu = await Menu.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('ingredients.ingredientId');
    
    if (!menu) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }
    
    res.json({ success: true, data: menu });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nama menu sudah ada' 
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findByIdAndDelete(req.params.id);
    
    if (!menu) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }
    
    res.json({ success: true, message: 'Menu berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu
};