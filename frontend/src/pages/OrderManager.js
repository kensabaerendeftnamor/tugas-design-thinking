import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  TextField, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, IconButton, Chip, Alert,
  CircularProgress, Grid
} from '@mui/material';
import { Add, Delete, Refresh } from '@mui/icons-material';
import api from '../services/api';
import { TABLE_PAGINATION_OPTIONS } from '../utils/constants';
import { formatDateTime } from '../utils/helpers';


const OrderManager = () => {
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    menuId: '',
    quantity: 1
  });

  useEffect(() => {
    fetchOrders();
    fetchMenus();
    fetchIngredients();
  }, [page, rowsPerPage, searchTerm, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { menuName: searchTerm }),
        ...(startDate && { startDate: startDate }),
        ...(endDate && { endDate: endDate })
      };

      const response = await api.get('/orders', { params });
      setOrders(response.data.data);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      setError('Gagal memuat data pesanan: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await api.get('/menus?limit=1000');
      setMenus(response.data.data);
    } catch (error) {
      console.error('Error fetching menus:', error);
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
   
    try {
      await api.post('/orders', formData);
      setSuccess('Pesanan berhasil dibuat! Stok bahan telah dikurangi otomatis.');
      setOpenDialog(false);
      setFormData({ menuId: '', quantity: 1 });
      fetchOrders();
    } catch (error) {
      setError('Gagal membuat pesanan: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pesanan ini? Stok bahan akan dikembalikan.')) {
      try {
        await api.delete(`/orders/${id}`);
        setSuccess('Pesanan berhasil dihapus! Stok bahan telah dikembalikan.');
        fetchOrders();
      } catch (error) {
        setError('Gagal menghapus pesanan: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Selesai';
      case 'pending': return 'Menunggu';
      case 'cancelled': return 'Dibatalkan';
      default: return status;
    }
  };

  // FUNGSI YANG DIPERBAIKI: Mencari nama bahan dari daftar ingredients
  const getIngredientDisplayInfo = (ingredient) => {
    // Coba semua kemungkinan sumber untuk nama bahan
    let ingredientName = '';
    let unit = '';

    // 1. Cek apakah ada ingredientName langsung
    if (ingredient.ingredientName) {
      ingredientName = ingredient.ingredientName;
      unit = ingredient.unit || '';
    } 
    // 2. Cek apakah ingredientId adalah object yang terpopulate
    else if (ingredient.ingredientId && typeof ingredient.ingredientId === 'object') {
      ingredientName = ingredient.ingredientId.name || '';
      unit = ingredient.ingredientId.unit || '';
    }
    // 3. Cari dari daftar ingredients berdasarkan ingredientId
    else if (ingredient.ingredientId) {
      const foundIngredient = ingredients.find(ing => ing._id === ingredient.ingredientId);
      if (foundIngredient) {
        ingredientName = foundIngredient.name;
        unit = foundIngredient.unit;
      }
    }

    // 4. Jika masih tidak ditemukan, gunakan fallback
    if (!ingredientName) {
      ingredientName = 'Bahan tidak diketahui';
    }
    if (!unit) {
      unit = 'unit';
    }

    return { ingredientName, unit };
  };

  // FUNGSI UNTUK MIGRASI DATA PESANAN LAMA (opsional)
  const migrateOldOrders = async () => {
    if (window.confirm('Migrasi data pesanan lama? Ini akan memperbaiki tampilan bahan yang digunakan.')) {
      try {
        setLoading(true);
        
        // Ambil semua pesanan
        const allOrdersResponse = await api.get('/orders?limit=1000');
        const allOrders = allOrdersResponse.data.data;
        
        let migratedCount = 0;
        
        for (const order of allOrders) {
          const needsMigration = order.ingredientsUsed.some(ing => 
            !ing.ingredientName || !ing.unit
          );
          
          if (needsMigration) {
            const updatedIngredientsUsed = await Promise.all(
              order.ingredientsUsed.map(async (ing) => {
                if (ing.ingredientName && ing.unit) {
                  return ing; // Sudah benar, tidak perlu diubah
                }
                
                // Cari informasi bahan
                let ingredientName = 'Bahan tidak diketahui';
                let unit = 'unit';
                
                if (ing.ingredientId) {
                  try {
                    const ingredientResponse = await api.get(`/ingredients/${ing.ingredientId}`);
                    if (ingredientResponse.data.success) {
                      ingredientName = ingredientResponse.data.data.name;
                      unit = ingredientResponse.data.data.unit;
                    }
                  } catch (error) {
                    console.warn(`Tidak dapat menemukan ingredient dengan ID: ${ing.ingredientId}`);
                  }
                }
                
                return {
                  ...ing,
                  ingredientName,
                  unit
                };
              })
            );
            
            // Update pesanan dengan data yang sudah dimigrasi
            await api.put(`/orders/${order._id}`, {
              ingredientsUsed: updatedIngredientsUsed
            });
            
            migratedCount++;
          }
        }
        
        setSuccess(`Berhasil memigrasi ${migratedCount} pesanan lama`);
        fetchOrders();
        
      } catch (error) {
        setError('Gagal memigrasi data pesanan: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

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
          Manajemen Pesanan
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchOrders}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          {/* Tombol migrasi untuk memperbaiki data lama */}
          {orders.some(order => 
            order.ingredientsUsed.some(ing => !ing.ingredientName)
          ) && (
            <Button
              variant="outlined"
              color="warning"
              onClick={migrateOldOrders}
              sx={{ mr: 1 }}
              disabled={loading}
            >
              {loading ? 'Memigrasi...' : 'Perbaiki Data Lama'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenDialog(true)}
          >
            Buat Pesanan
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
            <TextField
              label="Dari Tanggal"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Sampai Tanggal"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              onClick={() => {
                setStartDate('');
                setEndDate('');
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
                  <TableCell><strong>Menu</strong></TableCell>
                  <TableCell><strong>Kuantitas</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Bahan Digunakan</strong></TableCell>
                  <TableCell><strong>Aksi</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="textSecondary">
                        Tidak ada data pesanan
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order._id} hover className="table-row-hover">
                      <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {order.menuName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={order.quantity} color="primary" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(order.status)}
                          color={getStatusColor(order.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 300 }}>
                          {order.ingredientsUsed.slice(0, 3).map((ing, index) => {
                            const { ingredientName, unit } = getIngredientDisplayInfo(ing);
                            return (
                              <Chip
                                key={index}
                                label={`${ingredientName} -${ing.quantityUsed} ${unit}`}
                                size="small"
                                variant="outlined"
                                color="error"
                              />
                            );
                          })}
                          {order.ingredientsUsed.length > 3 && (
                            <Chip
                              label={`+${order.ingredientsUsed.length - 3} bahan`}
                              size="small"
                              color="primary"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleDelete(order._id)}
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

      {/* Create Order Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Buat Pesanan Baru</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Pilih Menu"
                  fullWidth
                  required
                  value={formData.menuId}
                  onChange={(e) => setFormData(prev => ({ ...prev, menuId: e.target.value }))}
                >
                  {menus.map(menu => (
                    <MenuItem key={menu._id} value={menu._id}>
                      {menu.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Kuantitas"
                  type="number"
                  fullWidth
                  required
                  inputProps={{ min: 1 }}
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Batal</Button>
            <Button type="submit" variant="contained">
              Buat Pesanan
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default OrderManager;