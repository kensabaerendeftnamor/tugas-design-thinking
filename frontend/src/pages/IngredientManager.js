import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, IconButton, Chip, Alert,
  CircularProgress, Grid, Card, CardContent, Tab, Tabs,
  Tooltip, TableSortLabel
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Inventory, BatchPrediction, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import api from '../services/api';
import { UNITS, CATEGORIES, TABLE_PAGINATION_OPTIONS } from '../utils/constants';
import { formatDate, getCategoryLabel, getExpiryStatusColor, getExpiryStatusText } from '../utils/helpers';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ingredient-tabpanel-${index}`}
      aria-labelledby={`ingredient-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const IngredientManager = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [openStockDialog, setOpenStockDialog] = useState(false);
  const [openBatchesDialog, setOpenBatchesDialog] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [batches, setBatches] = useState([]);
  const [formData, setFormData] = useState({
    name: '', 
    quantity: '', 
    unit: 'gram', 
    category: '', 
    expiryDate: ''
  });
  const [stockFormData, setStockFormData] = useState({
    quantity: '',
    expiryDate: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'nearestExpiry', direction: 'asc' });

  useEffect(() => {
    fetchIngredients();
  }, [page, rowsPerPage, searchTerm, categoryFilter]);

  const fetchIngredients = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { name: searchTerm }),
        ...(categoryFilter && { category: categoryFilter })
      };

      const response = await api.get('/ingredients', { params });
      setIngredients(response.data.data);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      setError('Gagal memuat data bahan: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async (ingredientId) => {
    try {
      const response = await api.get(`/ingredients/${ingredientId}/batches`);
      setBatches(response.data.data);
    } catch (error) {
      setError('Gagal memuat data batch: ' + (error.message || 'Unknown error'));
    }
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted ingredients
  const getSortedIngredients = () => {
    if (!sortConfig.key) return ingredients;

    return [...ingredients].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'totalStock':
          aValue = getTotalQuantity(a);
          bValue = getTotalQuantity(b);
          break;
        case 'nearestExpiry':
          aValue = getNearestExpiryDate(a);
          bValue = getNearestExpiryDate(b);
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getNearestExpiryDate = (ingredient) => {
    const batchesWithStock = ingredient.batches?.filter(batch => batch.currentQuantity > 0) || [];
    if (batchesWithStock.length === 0) return new Date('9999-12-31');
    
    const nearestBatch = batchesWithStock.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
    return new Date(nearestBatch.expiryDate);
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Nama bahan harus diisi';
    }
    
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      errors.quantity = 'Jumlah harus lebih dari 0';
    }
    
    if (!formData.unit) {
      errors.unit = 'Satuan harus dipilih';
    }
    
    if (!formData.category) {
      errors.category = 'Kategori harus dipilih';
    }
    
    if (!formData.expiryDate) {
      errors.expiryDate = 'Tanggal kadaluwarsa harus diisi';
    } else {
      const expiryDate = new Date(formData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate <= today) {
        errors.expiryDate = 'Tanggal kadaluwarsa harus lebih dari hari ini';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStockForm = () => {
    const errors = {};
    
    if (!stockFormData.quantity || parseFloat(stockFormData.quantity) <= 0) {
      errors.quantity = 'Jumlah harus lebih dari 0';
    }
    
    if (!stockFormData.expiryDate) {
      errors.expiryDate = 'Tanggal kadaluwarsa harus diisi';
    } else {
      const expiryDate = new Date(stockFormData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate <= today) {
        errors.expiryDate = 'Tanggal kadaluwarsa harus lebih dari hari ini';
      }
    }
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const submitData = {
        name: formData.name,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        category: formData.category,
        expiryDate: formData.expiryDate
      };
      
      if (editingIngredient) {
        // Untuk edit, kita update batch pertama yang ada stok
        const batchesWithStock = editingIngredient.batches?.filter(batch => batch.currentQuantity > 0) || [];
        let batchToUpdate = batchesWithStock[0];

        if (batchToUpdate) {
          // Update batch yang sudah ada
          const batchUpdateData = {
            batchId: batchToUpdate._id,
            quantity: parseFloat(formData.quantity),
            expiryDate: formData.expiryDate
          };
          
          await api.put(`/ingredients/${editingIngredient._id}/batch`, batchUpdateData);
          
          // Juga update info dasar bahan
          const basicInfoData = {
            name: formData.name,
            unit: formData.unit,
            category: formData.category
          };
          await api.put(`/ingredients/${editingIngredient._id}`, basicInfoData);
          
          setSuccess('Bahan dan stok berhasil diupdate!');
        } else {
          // Jika tidak ada batch dengan stok, buat batch baru
          const newIngredientData = {
            name: formData.name,
            unit: formData.unit,
            category: formData.category,
            quantity: parseFloat(formData.quantity),
            expiryDate: formData.expiryDate
          };
          await api.post('/ingredients', newIngredientData);
          setSuccess('Bahan baru berhasil dibuat!');
        }
      } else {
        await api.post('/ingredients', submitData);
        setSuccess('Bahan berhasil ditambahkan!');
      }
      
      setOpenDialog(false);
      resetForm();
      fetchIngredients();
    } catch (error) {
      setError('Gagal menyimpan bahan: ' + (error.message || 'Unknown error'));
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateStockForm()) {
      return;
    }
    
    try {
      const submitData = {
        quantity: parseFloat(stockFormData.quantity),
        expiryDate: stockFormData.expiryDate
      };
      
      await api.post(`/ingredients/${selectedIngredient._id}/stock`, submitData);
      setSuccess('Stok berhasil ditambahkan!');
      setOpenStockDialog(false);
      resetStockForm();
      fetchIngredients();
    } catch (error) {
      setError('Gagal menambah stok: ' + (error.message || 'Unknown error'));
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      quantity: '', 
      unit: 'gram', 
      category: '', 
      expiryDate: '' 
    });
    setFormErrors({});
    setEditingIngredient(null);
  };

  const resetStockForm = () => {
    setStockFormData({
      quantity: '',
      expiryDate: ''
    });
    setSelectedIngredient(null);
  };

  const handleEdit = (ingredient) => {
    setEditingIngredient(ingredient);
    
    // Ambil total quantity dan tanggal kadaluwarsa terdekat
    const totalQuantity = getTotalQuantity(ingredient);
    const nearestBatch = ingredient.batches
      ?.filter(batch => batch.currentQuantity > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
    
    setFormData({
      name: ingredient.name,
      quantity: totalQuantity.toString(),
      unit: ingredient.unit,
      category: ingredient.category,
      expiryDate: nearestBatch ? nearestBatch.expiryDate.split('T')[0] : ''
    });
    
    setOpenDialog(true);
  };

  const handleAddStockClick = (ingredient) => {
    setSelectedIngredient(ingredient);
    setOpenStockDialog(true);
  };

  const handleViewBatches = async (ingredient) => {
    setSelectedIngredient(ingredient);
    await fetchBatches(ingredient._id);
    setOpenBatchesDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus bahan ini?')) {
      try {
        await api.delete(`/ingredients/${id}`);
        setSuccess('Bahan berhasil dihapus!');
        fetchIngredients();
      } catch (error) {
        setError('Gagal menghapus bahan: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleStockDialogClose = () => {
    setOpenStockDialog(false);
    resetStockForm();
  };

  const handleBatchesDialogClose = () => {
    setOpenBatchesDialog(false);
    setSelectedIngredient(null);
    setBatches([]);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleStockInputChange = (field, value) => {
    setStockFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getTotalQuantity = (ingredient) => {
    return ingredient.batches?.reduce((total, batch) => total + batch.currentQuantity, 0) || 0;
  };

  const getBatchCount = (ingredient) => {
    return ingredient.batches?.filter(batch => batch.currentQuantity > 0).length || 0;
  };

  const sortedIngredients = getSortedIngredients();

  return (
    <Box className="fade-in">
      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </Box>
      )}

      {success && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="success" onClose={() => setSuccess('')}>
            {success}
          </Alert>
        </Box>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Manajemen Stok Bahan
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />} 
            onClick={fetchIngredients}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => setOpenDialog(true)}
          >
            Tambah Bahan
          </Button>
        </Box>
      </Box>

      {/* Search and Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Cari berdasarkan nama"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <TextField
            select
            label="Filter Kategori"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Semua Kategori</MenuItem>
            {CATEGORIES.map(category => (
              <MenuItem key={category} value={category}>
                {getCategoryLabel(category)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Daftar Bahan" icon={<Inventory />} iconPosition="start" />
          <Tab label="Ringkasan Stok" icon={<BatchPrediction />} iconPosition="start" />
        </Tabs>

        {loading && (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="200px">
            <CircularProgress />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              Memuat...
            </Typography>
          </Box>
        )}

        {!loading && (
          <>
            {/* Ingredients List Tab */}
            <TabPanel value={tabValue} index={0}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.key === 'name'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('name')}
                        >
                          <strong>Nama Bahan</strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.key === 'totalStock'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('totalStock')}
                        >
                          <strong>Total Stok</strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell><strong>Satuan</strong></TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.key === 'category'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('category')}
                        >
                          <strong>Kategori</strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.key === 'nearestExpiry'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('nearestExpiry')}
                          IconComponent={sortConfig.direction === 'asc' ? ArrowUpward : ArrowDownward}
                        >
                          <strong>Kadaluwarsa </strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell><strong>Aksi</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedIngredients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="textSecondary">
                            Tidak ada data bahan
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedIngredients.map((ingredient) => {
                        const totalQuantity = getTotalQuantity(ingredient);
                        const batchCount = getBatchCount(ingredient);
                        const nearestBatch = ingredient.batches
                          ?.filter(batch => batch.currentQuantity > 0)
                          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
                        
                        return (
                          <TableRow key={ingredient._id} hover className="table-row-hover">
                            <TableCell>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {ingredient.name}
                              </Typography>
                              {/* Informasi batch aktif dihapus */}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={`${totalQuantity} ${ingredient.unit}`} 
                                color={totalQuantity < 10 ? "error" : "primary"} 
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{ingredient.unit}</TableCell>
                            <TableCell>
                              <Chip 
                                label={getCategoryLabel(ingredient.category)} 
                                variant="outlined" 
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {nearestBatch ? (
                                <Box>
                                  <Typography variant="body2">
                                    {formatDate(nearestBatch.expiryDate)}
                                  </Typography>
                                  <Chip 
                                    label={getExpiryStatusText(nearestBatch.expiryDate)} 
                                    color={getExpiryStatusColor(nearestBatch.expiryDate)}
                                    size="small"
                                  />
                                </Box>
                              ) : (
                                <Typography variant="body2" color="textSecondary">
                                  -
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box display="flex" gap={1}>
                                <Tooltip title="Tambah Stok">
                                  <IconButton 
                                    onClick={() => handleAddStockClick(ingredient)}
                                    color="primary"
                                    size="small"
                                  >
                                    <Add />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton 
                                    onClick={() => handleEdit(ingredient)}
                                    color="primary"
                                    size="small"
                                  >
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Lihat Batch">
                                  <IconButton 
                                    onClick={() => handleViewBatches(ingredient)}
                                    color="info"
                                    size="small"
                                  >
                                    <BatchPrediction />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Hapus">
                                  <IconButton 
                                    onClick={() => handleDelete(ingredient._id)}
                                    color="error"
                                    size="small"
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={TABLE_PAGINATION_OPTIONS}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                labelRowsPerPage="Baris per halaman:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${from}-${to} dari ${count}`
                }
              />
            </TabPanel>

            {/* Stock Summary Tab */}
            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={2}>
                {sortedIngredients.map((ingredient) => {
                  const totalQuantity = getTotalQuantity(ingredient);
                  const batchesWithStock = ingredient.batches?.filter(batch => batch.currentQuantity > 0) || [];
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={ingredient._id}>
                      <Card variant="outlined" className="hover-card">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {ingredient.name}
                          </Typography>
                          
                          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="body2" color="textSecondary">
                              Total Stok:
                            </Typography>
                            <Chip 
                              label={`${totalQuantity} ${ingredient.unit}`} 
                              color={totalQuantity < 10 ? "error" : "primary"} 
                              size="small"
                            />
                          </Box>

                          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            Kategori: {getCategoryLabel(ingredient.category)}
                          </Typography>

                          {batchesWithStock.length > 0 ? (
                            <Box>
                              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                Tanggal Kadaluwarsa:
                              </Typography>
                              {batchesWithStock.map((batch, index) => (
                                <Box 
                                  key={batch._id}
                                  sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.5,
                                    borderBottom: index < batchesWithStock.length - 1 ? '1px dashed' : 'none',
                                    borderColor: 'divider'
                                  }}
                                >
                                  <Typography variant="caption">
                                    {formatDate(batch.expiryDate)}
                                  </Typography>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography variant="caption">
                                      {batch.currentQuantity} {ingredient.unit}
                                    </Typography>
                                    <Chip 
                                      label={getExpiryStatusText(batch.expiryDate)} 
                                      color={getExpiryStatusColor(batch.expiryDate)}
                                      size="small"
                                    />
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                              Tidak ada stok
                            </Typography>
                          )}
                          
                          <Box display="flex" gap={1} sx={{ mt: 2 }}>
                            <Button 
                              size="small" 
                              variant="outlined"
                              onClick={() => handleAddStockClick(ingredient)}
                            >
                              Tambah Stok
                            </Button>
                            <Button 
                              size="small" 
                              variant="text"
                              onClick={() => handleViewBatches(ingredient)}
                            >
                              Lihat Detail
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </TabPanel>
          </>
        )}
      </Paper>

      {/* Add/Edit Ingredient Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIngredient ? 'Edit Bahan' : 'Tambah Bahan Baru'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Nama Bahan"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!formErrors.name}
              helperText={formErrors.name}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Jumlah Stok"
              type="number"
              fullWidth
              required
              inputProps={{ min: 0, step: 0.01 }}
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              error={!!formErrors.quantity}
              helperText={formErrors.quantity}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              select
              label="Satuan"
              fullWidth
              required
              value={formData.unit}
              onChange={(e) => handleInputChange('unit', e.target.value)}
              error={!!formErrors.unit}
              helperText={formErrors.unit}
              sx={{ mb: 2 }}
            >
              {UNITS.map(unit => (
                <MenuItem key={unit} value={unit}>{unit}</MenuItem>
              ))}
            </TextField>
            <TextField
              margin="dense"
              select
              label="Kategori"
              fullWidth
              required
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              error={!!formErrors.category}
              helperText={formErrors.category}
              sx={{ mb: 2 }}
            >
              {CATEGORIES.map(category => (
                <MenuItem key={category} value={category}>
                  {getCategoryLabel(category)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              margin="dense"
              label="Tanggal Kadaluwarsa"
              type="date"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={formData.expiryDate}
              onChange={(e) => handleInputChange('expiryDate', e.target.value)}
              error={!!formErrors.expiryDate}
              helperText={formErrors.expiryDate}
            />
            {editingIngredient && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Catatan: Perubahan stok dan tanggal kadaluwarsa akan mempengaruhi batch dengan tanggal terdekat
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>Batal</Button>
            <Button type="submit" variant="contained">
              {editingIngredient ? 'Update' : 'Simpan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={openStockDialog} onClose={handleStockDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Tambah Stok - {selectedIngredient?.name}
        </DialogTitle>
        <form onSubmit={handleAddStock}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Jumlah Stok"
              type="number"
              fullWidth
              required
              inputProps={{ min: 0.01, step: 0.01 }}
              value={stockFormData.quantity}
              onChange={(e) => handleStockInputChange('quantity', e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Tanggal Kadaluwarsa"
              type="date"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={stockFormData.expiryDate}
              onChange={(e) => handleStockInputChange('expiryDate', e.target.value)}
              helperText="Stok akan digabung dengan batch yang memiliki tanggal kadaluwarsa sama"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleStockDialogClose}>Batal</Button>
            <Button type="submit" variant="contained">
              Tambah Stok
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Batches Dialog */}
      <Dialog open={openBatchesDialog} onClose={handleBatchesDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Detail - {selectedIngredient?.name}
        </DialogTitle>
        <DialogContent>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Tanggal Masuk</strong></TableCell>
                  <TableCell><strong>Tanggal Kadaluwarsa</strong></TableCell>
                  <TableCell><strong>Stok Awal</strong></TableCell>
                  <TableCell><strong>Stok Saat Ini</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="textSecondary">
                        Tidak ada batch
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch._id} hover className="table-row-hover">
                      <TableCell>{formatDate(batch.entryDate)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {formatDate(batch.expiryDate)}
                          <Chip 
                            label={getExpiryStatusText(batch.expiryDate)} 
                            color={getExpiryStatusColor(batch.expiryDate)}
                            size="small"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        {batch.initialQuantity} {selectedIngredient?.unit}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${batch.currentQuantity} ${selectedIngredient?.unit}`} 
                          color={batch.currentQuantity > 0 ? "primary" : "default"}
                          size="small"
                          variant={batch.currentQuantity > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell>
                        {batch.currentQuantity === 0 ? (
                          <Chip label="Habis" color="default" size="small" />
                        ) : batch.currentQuantity < batch.initialQuantity ? (
                          <Chip label="Terpakai Sebagian" color="warning" size="small" />
                        ) : (
                          <Chip label="Masih Penuh" color="success" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBatchesDialogClose}>Tutup</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IngredientManager;