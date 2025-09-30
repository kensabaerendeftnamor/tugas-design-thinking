const Order = require('../models/Order');
const Menu = require('../models/Menu');
const Ingredient = require('../models/Ingredient');
const StockHistory = require('../models/StockHistory');
const mongoose = require('mongoose');

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
 
  try {
    const { menuId, quantity } = req.body;
   
    const menu = await Menu.findById(menuId).session(session);
    if (!menu) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }
   
    const ingredientsUsed = [];
    const stockHistoryRecords = [];
   
    for (const requirement of menu.ingredients) {
      const totalNeeded = requirement.quantity * quantity;
      let remainingNeeded = totalNeeded;
     
      const ingredient = await Ingredient.findById(requirement.ingredientId).session(session);
      if (!ingredient) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Bahan ${requirement.ingredientId?.name || requirement.ingredientId} tidak ditemukan`
        });
      }
     
      // Filter out batches with zero quantity first
      const batchesWithStock = ingredient.batches.filter(batch => batch.currentQuantity > 0);
     
      // Sort batches by expiry date (FIFO) - yang kadaluarsa lebih dulu dipakai duluan
      batchesWithStock.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
     
      let totalAvailable = 0;
      const batchesToUpdate = [];
     
      // Calculate total available stock and prepare batches for update
      for (const batch of batchesWithStock) {
        if (remainingNeeded <= 0) break;
       
        const batchIndex = ingredient.batches.findIndex(b => b._id.toString() === batch._id.toString());
        const taken = Math.min(remainingNeeded, batch.currentQuantity);
       
        if (taken > 0) {
          const previousQuantity = batch.currentQuantity;
          batch.currentQuantity -= taken;
          remainingNeeded -= taken;
          totalAvailable += taken;
         
          batchesToUpdate.push({
            batchIndex,
            batch,
            taken,
            previousQuantity
          });
         
          ingredientsUsed.push({
            ingredientId: ingredient._id,
            batchId: batch._id,
            quantityUsed: taken,
            ingredientName: ingredient.name, // Simpan nama bahan
            unit: ingredient.unit // Simpan unit
          });
        }
      }
     
      if (remainingNeeded > 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Stok ${ingredient.name} tidak mencukupi. Dibutuhkan: ${totalNeeded}, Tersedia: ${totalAvailable}`
        });
      }
     
      // Apply the changes to the ingredient batches
      for (const { batchIndex, batch, taken, previousQuantity } of batchesToUpdate) {
        // Update the batch in the ingredient
        ingredient.batches[batchIndex].currentQuantity = batch.currentQuantity;
       
        // Record stock history
        stockHistoryRecords.push({
          type: 'out',
          ingredientId: ingredient._id,
          ingredientName: ingredient.name,
          batchId: batch._id,
          quantity: taken,
          previousStock: previousQuantity,
          newStock: batch.currentQuantity,
          reason: 'order'
        });
      }
     
      // Remove batches that are now empty
      ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);
     
      // Sort batches by expiry date (FIFO)
      ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
     
      await ingredient.save({ session });
    }
   
    const order = new Order({
      menuId,
      menuName: menu.name,
      quantity,
      ingredientsUsed
    });
   
    await order.save({ session });
    await StockHistory.insertMany(stockHistoryRecords, { session });
   
    await session.commitTransaction();
    session.endSession();
   
    res.status(201).json({
      success: true,
      data: order,
      message: 'Pesanan berhasil dibuat'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Order creation error:', error);
    res.status(400).json({
      success: false,
      message: 'Gagal membuat pesanan: ' + (error.message || 'Unknown error')
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
   
    let filter = {};
   
    if (req.query.menuName) {
      filter.menuName = { $regex: req.query.menuName, $options: 'i' };
    }
   
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate + 'T23:59:59.999Z')
      };
    }
   
    const orders = await Order.find(filter)
      .populate('menuId')
      .populate('ingredientsUsed.ingredientId') // Populate data ingredient
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
   
    const total = await Order.countDocuments(filter);
   
    res.json({
      success: true,
      data: orders,
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

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('menuId')
      .populate('ingredientsUsed.ingredientId'); // Populate data ingredient
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    }

    // Kembalikan stok bahan yang digunakan
    for (const ingredientUsed of order.ingredientsUsed) {
      const ingredient = await Ingredient.findById(ingredientUsed.ingredientId).session(session);
      
      if (ingredient) {
        // Cari batch yang sesuai
        const batchIndex = ingredient.batches.findIndex(
          batch => batch._id.toString() === ingredientUsed.batchId.toString()
        );

        if (batchIndex !== -1) {
          // Kembalikan stok
          ingredient.batches[batchIndex].currentQuantity += ingredientUsed.quantityUsed;
          ingredient.batches[batchIndex].initialQuantity += ingredientUsed.quantityUsed;

          // Record stock history untuk pengembalian stok
          const stockHistory = new StockHistory({
            type: 'in',
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            batchId: ingredientUsed.batchId,
            quantity: ingredientUsed.quantityUsed,
            previousStock: ingredient.batches[batchIndex].currentQuantity - ingredientUsed.quantityUsed,
            newStock: ingredient.batches[batchIndex].currentQuantity,
            reason: 'order_cancellation'
          });

          await stockHistory.save({ session });
        }

        // Hapus batch yang kosong
        ingredient.batches = ingredient.batches.filter(batch => batch.currentQuantity > 0);
        
        // Sort batches by expiry date (FIFO)
        ingredient.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        await ingredient.save({ session });
      }
    }

    // Hapus order
    await Order.findByIdAndDelete(req.params.id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: 'Pesanan berhasil dihapus dan stok dikembalikan' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fungsi untuk memperbaiki data order yang existing (run sekali saja)
const fixExistingOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('ingredientsUsed.ingredientId');
    let fixedCount = 0;

    for (const order of orders) {
      let needsUpdate = false;

      for (const ingUsed of order.ingredientsUsed) {
        // Jika ada ingredientId yang terpopulate tapi tidak ada data denormalized
        if (ingUsed.ingredientId && (!ingUsed.ingredientName || !ingUsed.unit)) {
          ingUsed.ingredientName = ingUsed.ingredientId.name;
          ingUsed.unit = ingUsed.ingredientId.unit;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await order.save();
        fixedCount++;
      }
    }

    res.json({
      success: true,
      message: `Berhasil memperbaiki ${fixedCount} order`,
      data: { fixedCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  deleteOrder,
  fixExistingOrders
};