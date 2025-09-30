import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Alert,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Card, CardContent,
  CircularProgress, Button
} from '@mui/material';
import { Warning, Error, Info, Inventory, RestaurantMenu, ShoppingCart, Analytics, Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatDate, getCategoryLabel, getExpiryStatusColor, getExpiryStatusText } from '../utils/helpers';

const Dashboard = () => {
  const [alerts, setAlerts] = useState({
    expired: [],
    expiringSoon: [],
    lowStock: []
  });
  const [stats, setStats] = useState({
    ingredients: 0,
    menus: 0,
    orders: 0,
    categories: 0
  });
  const [categoryReports, setCategoryReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [
        alertsResponse, 
        reportsResponse,
        ingredientsResponse, 
        menusResponse, 
        ordersResponse,
        categoriesResponse
      ] = await Promise.all([
        api.get('/ingredients/alerts/expired'),
        api.get('/reports/categories'),
        api.get('/ingredients?limit=1'),
        api.get('/menus?limit=1'),
        api.get('/orders?limit=1'),
        api.get('/categories')
      ]);
      
      setAlerts(alertsResponse.data.data);
      setCategoryReports(reportsResponse.data.data);
      setStats({
        ingredients: ingredientsResponse.data.pagination?.total || 0,
        menus: menusResponse.data.pagination?.total || 0,
        orders: ordersResponse.data.pagination?.total || 0,
        categories: categoriesResponse.data.data?.length || 0
      });
    } catch (error) {
      setError('Gagal memuat data dashboard');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleViewReports = () => {
    navigate('/reports');
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Memuat dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 0 }}>
          Dashboard
        </Typography>
        <Box>
          <Button 
            startIcon={<Refresh />} 
            onClick={handleRefresh}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            onClick={handleViewReports}
          >
            Lihat Laporan
          </Button>
        </Box>
      </Box>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="dashboard-card" sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Inventory sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.ingredients}
                  </Typography>
                  <Typography variant="body2">Total Bahan</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="dashboard-card" sx={{ bgcolor: 'secondary.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <RestaurantMenu sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.menus}
                  </Typography>
                  <Typography variant="body2">Total Menu</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="dashboard-card" sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ShoppingCart sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.orders}
                  </Typography>
                  <Typography variant="body2">Total Pesanan</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="dashboard-card" sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Analytics sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.categories}
                  </Typography>
                  <Typography variant="body2">Kategori</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Expired Ingredients */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid', borderColor: 'error.main', height: '100%' }}>
            <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
              <Error color="error" sx={{ mr: 1 }} />
              <Typography variant="h6">Bahan Kedaluwarsa</Typography>
              <Chip 
                label={alerts.expired?.length || 0} 
                color="error" 
                size="small" 
                sx={{ ml: 'auto' }}
              />
            </Box>
            {alerts.expired && alerts.expired.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                Tidak ada bahan kedaluwarsa
              </Typography>
            ) : (
              alerts.expired?.slice(0, 5).map((item, index) => (
                <Alert key={index} severity="error" sx={{ mb: 1 }} className="custom-alert">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {item.name}
                    </Typography>
                    <Typography variant="caption">
                      {formatDate(item.batches?.[0]?.expiryDate)}
                    </Typography>
                  </Box>
                </Alert>
              ))
            )}
          </Paper>
        </Grid>

        {/* Expiring Soon */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid', borderColor: 'warning.main', height: '100%' }}>
            <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
              <Warning color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6">Akan Kedaluwarsa</Typography>
              <Chip 
                label={alerts.expiringSoon?.length || 0} 
                color="warning" 
                size="small" 
                sx={{ ml: 'auto' }}
              />
            </Box>
            {alerts.expiringSoon && alerts.expiringSoon.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                Tidak ada bahan akan kedaluwarsa
              </Typography>
            ) : (
              alerts.expiringSoon?.slice(0, 5).map((item, index) => (
                <Alert key={index} severity="warning" sx={{ mb: 1 }} className="custom-alert">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {item.name}
                    </Typography>
                    <Typography variant="caption">
                      {formatDate(item.batches?.[0]?.expiryDate)} - {getExpiryStatusText(item.batches?.[0]?.expiryDate)}
                    </Typography>
                  </Box>
                </Alert>
              ))
            )}
          </Paper>
        </Grid>

        {/* Low Stock */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderLeft: '4px solid', borderColor: 'info.main', height: '100%' }}>
            <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
              <Info color="info" sx={{ mr: 1 }} />
              <Typography variant="h6">Stok Menipis</Typography>
              <Chip 
                label={alerts.lowStock?.length || 0} 
                color="info" 
                size="small" 
                sx={{ ml: 'auto' }}
              />
            </Box>
            {alerts.lowStock && alerts.lowStock.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                Tidak ada stok menipis
              </Typography>
            ) : (
              alerts.lowStock?.slice(0, 5).map((item, index) => (
                <Alert key={index} severity="info" sx={{ mb: 1 }} className="custom-alert">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {item.name}
                    </Typography>
                    <Typography variant="caption">
                      Stok: {item.quantity} {item.unit}
                    </Typography>
                  </Box>
                </Alert>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Category Reports */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Ringkasan Stok per Kategori
          </Typography>
          <Button 
            variant="outlined" 
            onClick={handleViewReports}
            size="small"
          >
            Lihat Detail
          </Button>
        </Box>
        
        {Object.entries(categoryReports).length === 0 ? (
          <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 4 }}>
            Tidak ada data stok
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {Object.entries(categoryReports).map(([category, items]) => (
              <Grid item xs={12} md={6} key={category}>
                <Paper variant="outlined" sx={{ p: 2 }} className="hover-card">
                  <Typography variant="h6" sx={{ mb: 1, color: 'primary.main' }}>
                    {getCategoryLabel(category)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {items.length} item • Total: {items.reduce((sum, item) => sum + item.totalQuantity, 0)} {items[0]?.unit || ''}
                  </Typography>
                  
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {items.slice(0, 5).map((item, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          py: 0.5,
                          borderBottom: index < items.slice(0, 5).length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="body2" className="text-ellipsis">
                          {item.name}
                        </Typography>
                        <Box textAlign="right">
                          <Chip 
                            label={`${item.totalQuantity} ${item.unit}`} 
                            color="primary" 
                            size="small"
                          />
                          <Typography variant="caption" display="block" color="textSecondary">
                            {formatDate(item.expiryDate)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  
                  {items.length > 5 && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      +{items.length - 5} item lainnya
                    </Typography>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
};

export default Dashboard;