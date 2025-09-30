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

  // Helper function untuk mendapatkan informasi bahan yang digunakan
  const getIngredientDisplayInfo = (ingredientUsed) => {
    // Prioritaskan data dari ingredientId yang terpopulate
    if (ingredientUsed.ingredientId && typeof ingredientUsed.ingredientId === 'object') {
      return {
        name: ingredientUsed.ingredientId.name || 'Bahan tidak ditemukan',
        unit: ingredientUsed.ingredientId.unit || '',
        quantity: ingredientUsed.quantityUsed || 0
      };
    }
    
    // Fallback ke data denormalized
    return {
      name: ingredientUsed.ingredientName || 'Bahan tidak ditemukan',
      unit: ingredientUsed.unit || '',
      quantity: ingredientUsed.quantityUsed || 0
    };
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
                            const ingredientInfo = getIngredientDisplayInfo(ing);
                            const displayText = `${ingredientInfo.name} -${ingredientInfo.quantity} ${ingredientInfo.unit}`;
                            
                            return (
                              <Chip
                                key={index}
                                label={displayText}
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