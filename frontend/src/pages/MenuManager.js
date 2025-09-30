import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, IconButton, Chip, Alert,
  CircularProgress, Grid, FormControl, InputLabel,
  Select, OutlinedInput
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Close } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format as dateFnsFormat } from 'date-fns';
import id from 'date-fns/locale/id';
import api from '../services/api';
import { TABLE_PAGINATION_OPTIONS } from '../utils/constants';
import { formatDate, formatCurrency } from '../utils/helpers';

const MenuManager = () => {
  const [menus, setMenus] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    ingredients: []
  });
  const [newIngredient, setNewIngredient] = useState({
    ingredientId: '',
    quantity: ''
  });

  useEffect(() => {
    fetchMenus();
    fetchIngredients();
  }, [page, rowsPerPage, searchTerm, startDate, endDate]);

  const fetchMenus = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { name: searchTerm }),
        ...(startDate && { startDate: dateFnsFormat(startDate, 'yyyy-MM-dd') }),
        ...(endDate && { endDate: dateFnsFormat(endDate, 'yyyy-MM-dd') })
      };

      const response = await api.get('/menus', { params });
      setMenus(response.data.data);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      setError('Gagal memuat data menu: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchIngredients = async () => {
    try {
      const response = await api.get('/ingredients?limit=1000');
      setIngredients(response.data.data);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!formData.name.trim()) {
      setError('Nama menu harus diisi');
      return;
    }
    
    if (formData.ingredients.length === 0) {
      setError('Minimal satu bahan harus ditambahkan');
      return;
    }
    
    try {
      const submitData = {
        name: formData.name,
        description: formData.description,
        price: formData.price ? parseFloat(formData.price) : 0,
        ingredients: formData.ingredients.map(ing => ({
          ingredientId: ing.ingredientId,
          quantity: parseFloat(ing.quantity)
        }))
      };
      
      if (editingMenu) {
        await api.put(`/menus/${editingMenu._id}`, submitData);
        setSuccess('Menu berhasil diupdate!');
      } else {
        await api.post('/menus', submitData);
        setSuccess('Menu berhasil ditambahkan!');
      }
      
      setOpenDialog(false);
      resetForm();
      fetchMenus();
    } catch (error) {
      setError('Gagal menyimpan menu: ' + (error.message || 'Unknown error'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      ingredients: []
    });
    setNewIngredient({
      ingredientId: '',
      quantity: ''
    });
    setEditingMenu(null);
  };

  const handleEdit = (menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      description: menu.description || '',
      price: menu.price || '',
      ingredients: menu.ingredients.map(ing => ({
        ingredientId: ing.ingredientId?._id || ing.ingredientId,
        quantity: ing.quantity.toString(),
        unit: ing.unit,
        name: ing.ingredientId?.name || ing.name
      }))
    });
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus menu ini?')) {
      try {
        await api.delete(`/menus/${id}`);
        setSuccess('Menu berhasil dihapus!');
        fetchMenus();
      } catch (error) {
        setError('Gagal menghapus menu: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    resetForm();
  };

  const addIngredient = () => {
    if (!newIngredient.ingredientId || !newIngredient.quantity || parseFloat(newIngredient.quantity) <= 0) {
      setError('Pilih bahan dan isi jumlah yang valid');
      return;
    }

    const selectedIngredient = ingredients.find(ing => ing._id === newIngredient.ingredientId);
    if (!selectedIngredient) {
      setError('Bahan tidak ditemukan');
      return;
    }

    // Check if ingredient already exists
    const existingIndex = formData.ingredients.findIndex(
      ing => ing.ingredientId === newIngredient.ingredientId
    );

    if (existingIndex > -1) {
      // Update existing ingredient
      const updatedIngredients = [...formData.ingredients];
      updatedIngredients[existingIndex].quantity = newIngredient.quantity;
      setFormData(prev => ({
        ...prev,
        ingredients: updatedIngredients
      }));
    } else {
      // Add new ingredient
      setFormData(prev => ({
        ...prev,
        ingredients: [
          ...prev.ingredients,
          {
            ingredientId: newIngredient.ingredientId,
            quantity: newIngredient.quantity,
            unit: selectedIngredient.unit,
            name: selectedIngredient.name
          }
        ]
      }));
    }

    setNewIngredient({ ingredientId: '', quantity: '' });
  };

  const removeIngredient = (index) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const getIngredientName = (ingredientId) => {
    const ingredient = ingredients.find(ing => ing._id === ingredientId);
    return ingredient ? ingredient.name : 'Unknown';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={id}>
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
            Manajemen Menu
          </Typography>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<Refresh />} 
              onClick={fetchMenus}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Add />} 
              onClick={() => setOpenDialog(true)}
            >
              Tambah Menu
            </Button>
          </Box>
        </Box>

        {/* Search and Filter */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                label="Cari berdasarkan nama menu"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="Dari Tanggal"
                value={startDate}
                onChange={(newValue) => {
                  setStartDate(newValue);
                  setPage(0);
                }}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="Sampai Tanggal"
                value={endDate}
                onChange={(newValue) => {
                  setEndDate(newValue);
                  setPage(0);
                }}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setStartDate(null);
                  setEndDate(null);
                  setPage(0);
                }}
                fullWidth
              >
                Reset Filter
              </Button>
            </Grid>
          </Grid>
        </Paper>

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
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Tanggal Input</strong></TableCell>
                    <TableCell><strong>Nama Menu</strong></TableCell>
                    <TableCell><strong>Deskripsi</strong></TableCell>
                    <TableCell><strong>Harga</strong></TableCell>
                    <TableCell><strong>Bahan-bahan</strong></TableCell>
                    <TableCell><strong>Aksi</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {menus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="textSecondary">
                          Tidak ada data menu
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    menus.map((menu) => (
                      <TableRow key={menu._id} hover className="table-row-hover">
                        <TableCell>{formatDate(menu.createdAt)}</TableCell>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {menu.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {menu.description ? (
                            <Typography variant="body2" sx={{ 
                              maxWidth: 200, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}>
                              {menu.description}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {menu.price ? (
                            <Chip 
                              label={formatCurrency(menu.price)} 
                              color="primary" 
                              size="small"
                            />
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 300 }}>
                            {menu.ingredients.slice(0, 3).map((ing, index) => (
                              <Chip 
                                key={index} 
                                label={`${ing.ingredientId?.name || ing.name} (${ing.quantity} ${ing.unit})`} 
                                size="small" 
                                variant="outlined"
                                color="secondary"
                              />
                            ))}
                            {menu.ingredients.length > 3 && (
                              <Chip 
                                label={`+${menu.ingredients.length - 3} bahan`} 
                                size="small" 
                                color="primary"
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton 
                            onClick={() => handleEdit(menu)}
                            color="primary"
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton 
                            onClick={() => handleDelete(menu._id)}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
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
            />
          </>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingMenu ? 'Edit Menu' : 'Tambah Menu Baru'}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    autoFocus
                    label="Nama Menu"
                    fullWidth
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Deskripsi"
                    fullWidth
                    multiline
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    helperText="Deskripsi optional tentang menu"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Harga (Opsional)"
                    type="number"
                    fullWidth
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    helperText="Kosongkan jika tidak ada harga"
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                
                {/* Ingredients Section */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Bahan-bahan *
                  </Typography>
                  
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={5}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Pilih Bahan</InputLabel>
                        <Select
                          value={newIngredient.ingredientId}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, ingredientId: e.target.value }))}
                          input={<OutlinedInput label="Pilih Bahan" />}
                        >
                          {ingredients.map((ingredient) => (
                            <MenuItem key={ingredient._id} value={ingredient._id}>
                              {ingredient.name} ({ingredient.unit})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        label="Jumlah"
                        type="number"
                        size="small"
                        fullWidth
                        value={newIngredient.quantity}
                        onChange={(e) => setNewIngredient(prev => ({ ...prev, quantity: e.target.value }))}
                        inputProps={{ min: 0.01, step: 0.01 }}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <Button 
                        variant="contained" 
                        onClick={addIngredient}
                        fullWidth
                      >
                        Tambah Bahan
                      </Button>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Selected Ingredients List */}
                {formData.ingredients.length > 0 && (
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Daftar Bahan:
                      </Typography>
                      {formData.ingredients.map((ingredient, index) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          mb: 1,
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1
                        }}>
                          <Typography variant="body2">
                            {getIngredientName(ingredient.ingredientId)} - {ingredient.quantity} {ingredient.unit}
                          </Typography>
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => removeIngredient(index)}
                          >
                            <Close />
                          </IconButton>
                        </Box>
                      ))}
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Batal</Button>
              <Button 
                type="submit" 
                variant="contained"
                disabled={formData.ingredients.length === 0}
              >
                {editingMenu ? 'Update' : 'Simpan'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MenuManager;