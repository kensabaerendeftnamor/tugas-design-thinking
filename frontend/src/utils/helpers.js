export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return '-';
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '-';
  }
};

export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getCategoryLabel = (category) => {
  const labels = {
    vegetable: 'Sayuran',
    meat: 'Daging',
    sauce: 'Saus',
    fruit: 'Buah',
    grain: 'Biji-bijian',
    dairy: 'Produk Susu',
    spice: 'Bumbu',
    other: 'Lainnya'
  };
  return labels[category] || category;
};

export const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getExpiryStatus = (expiryDate) => {
  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
  if (daysUntilExpiry === null) return 'unknown';
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 3) return 'critical';
  if (daysUntilExpiry <= 7) return 'warning';
  return 'good';
};

export const getExpiryStatusColor = (expiryDate) => {
  const status = getExpiryStatus(expiryDate);
  switch (status) {
    case 'expired': return 'error';
    case 'critical': return 'error';
    case 'warning': return 'warning';
    case 'good': return 'success';
    default: return 'default';
  }
};

export const getExpiryStatusText = (expiryDate) => {
  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
  if (daysUntilExpiry === null) return 'Tidak diketahui';
  if (daysUntilExpiry < 0) return 'Kedaluwarsa';
  if (daysUntilExpiry === 0) return 'Kedaluwarsa hari ini';
  if (daysUntilExpiry === 1) return '1 hari lagi';
  return `${daysUntilExpiry} hari lagi`;
};