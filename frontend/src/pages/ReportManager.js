import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  Tabs, Tab, Chip, Card, CardContent, Grid,
  CircularProgress, Alert, TextField, MenuItem,
  Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TableSortLabel
} from '@mui/material';
import { Inventory, RestaurantMenu, ShoppingCart, Analytics, Refresh, Download, Warning, Upload, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import api from '../services/api';
import { TABLE_PAGINATION_OPTIONS, CATEGORIES } from '../utils/constants';
import { formatDate, getCategoryLabel, formatCurrency, getExpiryStatusColor, getExpiryStatusText, getDaysUntilExpiry } from '../utils/helpers';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ReportManager = () => {
  const [tabValue, setTabValue] = useState(0);
  const [categoryReports, setCategoryReports] = useState({});
  const [detailedCategoryReport, setDetailedCategoryReport] = useState([]);
  const [stockInHistory, setStockInHistory] = useState([]);
  const [stockOutHistory, setStockOutHistory] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalIngredients: 0,
    totalMenus: 0,
    totalOrders: 0,
    totalValue: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'expiryDate', direction: 'asc' });

  useEffect(() => {
    if (tabValue === 0) {
      fetchCategoryReports();
      fetchStats();
    } else if (tabValue === 1) {
      fetchDetailedCategoryReport();
    } else if (tabValue === 2) {
      fetchStockInHistory();
    } else if (tabValue === 3) {
      fetchStockOutHistory();
    } else if (tabValue === 4) {
      fetchExpiryAlerts();
    }
  }, [tabValue, page, rowsPerPage, categoryFilter]);

  const fetchCategoryReports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/categories');
      setCategoryReports(response.data.data);
    } catch (error) {
      setError('Gagal memuat laporan kategori: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedCategoryReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = categoryFilter !== 'all' ? { category: categoryFilter } : {};
      const response = await api.get('/reports/categories/detailed', { params });
      setDetailedCategoryReport(response.data.data);
      setTotalCount(response.data.data?.length || 0);
    } catch (error) {
      setError('Gagal memuat laporan detail kategori: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [ingredientsRes, menusRes, ordersRes] = await Promise.all([
        api.get('/ingredients?limit=1'),
        api.get('/menus?limit=1'),
        api.get('/orders?limit=1')
      ]);
      
      setStats({
        totalIngredients: ingredientsRes.data.pagination?.total || 0,
        totalMenus: menusRes.data.pagination?.total || 0,
        totalOrders: ordersRes.data.pagination?.total || 0,
        totalValue: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchStockInHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/stock-history/in', {
        params: { page: page + 1, limit: rowsPerPage }
      });
      setStockInHistory(response.data.data);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      setError('Gagal memuat riwayat stok masuk: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStockOutHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/stock-history/out', {
        params: { page: page + 1, limit: rowsPerPage }
      });
      setStockOutHistory(response.data.data);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      setError('Gagal memuat riwayat stok keluar: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchExpiryAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/expiry-alerts');
      setExpiryAlerts(response.data.data || []);
      setTotalCount(response.data.data?.length || 0);
    } catch (error) {
      setError('Gagal memuat peringatan kadaluwarsa: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
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

  // Get sorted detailed category report
  const getSortedDetailedReport = () => {
    if (!sortConfig.key) return detailedCategoryReport;

    return [...detailedCategoryReport].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'category':
          aValue = getCategoryLabel(a.category).toLowerCase();
          bValue = getCategoryLabel(b.category).toLowerCase();
          break;
        case 'ingredientName':
          aValue = a.ingredientName.toLowerCase();
          bValue = b.ingredientName.toLowerCase();
          break;
        case 'totalQuantity':
          aValue = a.totalQuantity;
          bValue = b.totalQuantity;
          break;
        case 'expiryDate':
          // Sort by days until expiry (asc = soonest first, desc = latest first)
          aValue = getDaysUntilExpiry(a.expiryDate);
          bValue = getDaysUntilExpiry(b.expiryDate);
          break;
        default:
          return 0;
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = sortConfig.direction === 'asc' ? Infinity : -Infinity;
      if (bValue === null || bValue === undefined) bValue = sortConfig.direction === 'asc' ? Infinity : -Infinity;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleRefresh = () => {
    if (tabValue === 0) {
      fetchCategoryReports();
      fetchStats();
    } else if (tabValue === 1) {
      fetchDetailedCategoryReport();
    } else if (tabValue === 2) {
      fetchStockInHistory();
    } else if (tabValue === 3) {
      fetchStockOutHistory();
    } else if (tabValue === 4) {
      fetchExpiryAlerts();
    }
  };

  const handleViewBatches = (batches) => {
    setSelectedBatches(batches);
    setOpenBatchDialog(true);
  };

  const handleCloseBatchDialog = () => {
    setOpenBatchDialog(false);
    setSelectedBatches([]);
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (tabValue === 1) {
      // Export detailed category report
      csvContent += "Kategori,Nama Bahan,Jumlah,Satuan,Tanggal Kadaluwarsa,Status\n";
      const sortedData = getSortedDetailedReport();
      sortedData.forEach(item => {
        const row = [
          getCategoryLabel(item.category),
          item.ingredientName,
          item.totalQuantity,
          item.unit,
          formatDate(item.expiryDate),
          getExpiryStatusText(item.expiryDate)
        ].join(',');
        csvContent += row + "\n";
      });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_stok_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExpiryStatusForSorting = (expiryDate) => {
    const days = getDaysUntilExpiry(expiryDate);
    if (days === null) return 9999; // Untuk item tanpa tanggal kadaluwarsa
    if (days < 0) return -1; // Sudah kadaluwarsa
    return days;
  };

  const sortedDetailedReport = getSortedDetailedReport();

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 0 }}>
          Laporan dan Analisis
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
          {tabValue === 1 && (
            <Button 
              startIcon={<Download />} 
              onClick={exportToCSV}
              variant="contained"
            >
              Export CSV
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </Box>
      )}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" icon={<Analytics />} iconPosition="start" />
          <Tab label="Laporan Stok Detail" icon={<Inventory />} iconPosition="start" />
          <Tab label="Stok Masuk" icon={<Download />} iconPosition="start" />
          <Tab label="Stok Keluar" icon={<Upload />} iconPosition="start" />
          <Tab label="Peringatan Kadaluwarsa" icon={<Warning />} iconPosition="start" />
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
            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
              {/* Statistics Cards */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card className="hover-card">
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Inventory color="primary" sx={{ fontSize: 40, mr: 2 }} />
                        <Box>
                          <Typography variant="h4" fontWeight="bold">
                            {stats.totalIngredients}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Total Bahan
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="hover-card">
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <RestaurantMenu color="secondary" sx={{ fontSize: 40, mr: 2 }} />
                        <Box>
                          <Typography variant="h4" fontWeight="bold">
                            {stats.totalMenus}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Total Menu
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="hover-card">
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <ShoppingCart color="success" sx={{ fontSize: 40, mr: 2 }} />
                        <Box>
                          <Typography variant="h4" fontWeight="bold">
                            {stats.totalOrders}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Total Pesanan
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="hover-card">
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Analytics color="warning" sx={{ fontSize: 40, mr: 2 }} />
                        <Box>
                          <Typography variant="h4" fontWeight="bold">
                            {Object.keys(categoryReports).length}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Kategori Aktif
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Category Reports */}
              <Typography variant="h5" gutterBottom>
                Ringkasan Stok per Kategori
              </Typography>
              
              {Object.entries(categoryReports).length === 0 ? (
                <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 4 }}>
                  Tidak ada data stok
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(categoryReports).map(([category, items]) => (
                    <Grid item xs={12} md={6} lg={4} key={category}>
                      <Paper variant="outlined" sx={{ p: 2, height: '100%' }} className="hover-card">
                        <Typography variant="h6" sx={{ mb: 1, color: 'primary.main' }}>
                          {getCategoryLabel(category)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          {items.length} item • Total: {items.reduce((sum, item) => sum + item.totalQuantity, 0)} {items[0]?.unit || ''}
                        </Typography>
                        
                        <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {items.slice(0, 6).map((item, index) => (
                            <Box 
                              key={index} 
                              sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                py: 1,
                                borderBottom: index < items.slice(0, 6).length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider'
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {item.name}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {formatDate(item.expiryDate)}
                                </Typography>
                              </Box>
                              <Box textAlign="right">
                                <Chip 
                                  label={`${item.totalQuantity} ${item.unit}`} 
                                  color="primary" 
                                  size="small"
                                  sx={{ mb: 0.5 }}
                                />
                                <Chip 
                                  label={getExpiryStatusText(item.expiryDate)} 
                                  color={getExpiryStatusColor(item.expiryDate)}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          ))}
                        </Box>
                        
                        {items.length > 6 && (
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                            +{items.length - 6} item lainnya
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </TabPanel>

            {/* Detailed Category Report Tab */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ mb: 3 }}>
                <TextField
                  select
                  label="Filter Kategori"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(0);
                  }}
                  size="small"
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="all">Semua Kategori</MenuItem>
                  {CATEGORIES.map(category => (
                    <MenuItem key={category} value={category}>
                      {getCategoryLabel(category)}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
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
                          active={sortConfig.key === 'ingredientName'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('ingredientName')}
                        >
                          <strong>Nama Bahan</strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.key === 'totalQuantity'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('totalQuantity')}
                        >
                          <strong>Jumlah Stok</strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell><strong>Satuan</strong></TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.key === 'expiryDate'}
                          direction={sortConfig.direction}
                          onClick={() => handleSort('expiryDate')}
                          IconComponent={sortConfig.direction === 'asc' ? ArrowUpward : ArrowDownward}
                        >
                          <strong>Tanggal Kadaluwarsa</strong>
                        </TableSortLabel>
                      </TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedDetailedReport.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="textSecondary">
                            Tidak ada data stok
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedDetailedReport.map((item, index) => (
                        <TableRow key={index} hover className="table-row-hover">
                          <TableCell>
                            <Chip 
                              label={getCategoryLabel(item.category)} 
                              variant="outlined"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle2">
                              {item.ingredientName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${item.totalQuantity} ${item.unit}`} 
                              color="primary"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              {formatDate(item.expiryDate)}
                              <Chip 
                                label={getExpiryStatusText(item.expiryDate)} 
                                color={getExpiryStatusColor(item.expiryDate)}
                                size="small"
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            {getDaysUntilExpiry(item.expiryDate) < 0 ? (
                              <Chip label="Kedaluwarsa" color="error" size="small" />
                            ) : getDaysUntilExpiry(item.expiryDate) <= 3 ? (
                              <Chip label="Kritis" color="error" size="small" />
                            ) : getDaysUntilExpiry(item.expiryDate) <= 7 ? (
                              <Chip label="Peringatan" color="warning" size="small" />
                            ) : (
                              <Chip label="Aman" color="success" size="small" />
                            )}
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
            </TabPanel>

            {/* Stock In Tab */}
            <TabPanel value={tabValue} index={2}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Tanggal</strong></TableCell>
                      <TableCell><strong>Bahan</strong></TableCell>
                      <TableCell><strong>Jumlah</strong></TableCell>
                      <TableCell><strong>Keterangan</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockInHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="textSecondary">
                            Tidak ada data stok masuk
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockInHistory.map((history) => (
                        <TableRow key={history._id} hover className="table-row-hover">
                          <TableCell>{formatDate(history.createdAt)}</TableCell>
                          <TableCell>{history.ingredientName}</TableCell>
                          <TableCell>
                            <Chip 
                              label={`+${history.quantity}`} 
                              color="success" 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{history.reason}</TableCell>
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
            </TabPanel>

            {/* Stock Out Tab */}
            <TabPanel value={tabValue} index={3}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Tanggal</strong></TableCell>
                      <TableCell><strong>Bahan</strong></TableCell>
                      <TableCell><strong>Jumlah</strong></TableCell>
                      <TableCell><strong>Keterangan</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockOutHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="textSecondary">
                            Tidak ada data stok keluar
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockOutHistory.map((history) => (
                        <TableRow key={history._id} hover className="table-row-hover">
                          <TableCell>{formatDate(history.createdAt)}</TableCell>
                          <TableCell>{history.ingredientName}</TableCell>
                          <TableCell>
                            <Chip 
                              label={`-${history.quantity}`} 
                              color="error" 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{history.reason}</TableCell>
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
            </TabPanel>

            {/* Expiry Alerts Tab */}
            <TabPanel value={tabValue} index={4}>
              <Typography variant="h6" color="warning.main" gutterBottom>
                ⚠️ Bahan yang Akan Kedaluwarsa dalam 7 Hari Mendatang
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Bahan</strong></TableCell>
                      <TableCell><strong>Kategori</strong></TableCell>
                      <TableCell><strong>Jumlah</strong></TableCell>
                      <TableCell><strong>Tanggal Kadaluwarsa</strong></TableCell>
                      <TableCell><strong>Sisa Hari</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expiryAlerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="textSecondary">
                            Tidak ada bahan yang akan kedaluwarsa dalam 7 hari mendatang
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      expiryAlerts.map((alert, index) => (
                        <TableRow key={index} hover className="table-row-hover">
                          <TableCell>
                            <Typography variant="subtitle2">
                              {alert.ingredientName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={getCategoryLabel(alert.category)} 
                              variant="outlined"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${alert.totalQuantity} ${alert.unit}`} 
                              color="warning"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{formatDate(alert.expiryDate)}</TableCell>
                          <TableCell>
                            {getDaysUntilExpiry(alert.expiryDate) > 0 
                              ? `${getDaysUntilExpiry(alert.expiryDate)} hari`
                              : 'Kedaluwarsa'
                            }
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={getExpiryStatusText(alert.expiryDate)} 
                              color={getExpiryStatusColor(alert.expiryDate)}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </>
        )}
      </Paper>

      {/* Batch Detail Dialog */}
      <Dialog open={openBatchDialog} onClose={handleCloseBatchDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Detail Batch
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Batch dengan tanggal kadaluwarsa sama digabungkan dalam sistem FIFO
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Tanggal Masuk</strong></TableCell>
                  <TableCell><strong>Stok Awal</strong></TableCell>
                  <TableCell><strong>Stok Saat Ini</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="textSecondary">
                        Tidak ada data batch
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedBatches.map((batch, index) => (
                    <TableRow key={index} hover className="table-row-hover">
                      <TableCell>{formatDate(batch.entryDate)}</TableCell>
                      <TableCell>{batch.quantity} {selectedBatches[0]?.unit}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${batch.quantity} ${selectedBatches[0]?.unit}`} 
                          color="primary"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label="Aktif" 
                          color="success"
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBatchDialog}>Tutup</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReportManager;