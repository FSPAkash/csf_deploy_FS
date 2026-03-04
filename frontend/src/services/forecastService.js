import api from './api';

export const forecastService = {
  async getProducts() {
    const response = await api.get('/forecast/products');
    return response.data;
  },

  async getProductData(product, apsClass = null) {
    const params = apsClass ? { aps_class: apsClass } : {};
    const response = await api.get(`/forecast/data/${product}`, { params });
    return response.data;
  },

  async simulate(params) {
    const response = await api.post('/forecast/simulate', params);
    return response.data;
  },

  async exportSimulation(params) {
    const response = await api.post('/forecast/export', params);
    return response.data;
  },

  async getAvailableYears(product, apsClass = null) {
    const params = apsClass ? { aps_class: apsClass } : {};
    const response = await api.get(`/data/years/${product}`, { params });
    return response.data;
  },

  async getDataMetadata() {
    const response = await api.get('/data/metadata');
    return response.data;
  },

  async getProductMetadata(product) {
    const response = await api.get(`/data/metadata/${product}`);
    return response.data;
  },
};

export const adminService = {
  async uploadData(formData) {
    const response = await api.post('/admin/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async uploadBulkProductData(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/admin/upload-bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async downloadTemplate(product, includeAps = false) {
    const response = await api.get('/admin/template', {
      params: { product, include_aps: includeAps },
      responseType: 'blob',
    });
    return response.data;
  },

  async getProductsList() {
    const response = await api.get('/admin/products');
    return response.data;
  },

  async deleteProduct(product, apsClass = null) {
    const params = apsClass ? { aps_class: apsClass } : {};
    const response = await api.delete(`/admin/delete/${product}`, { params });
    return response.data;
  },

  async previewUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/admin/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getDataMetadata() {
    const response = await api.get('/admin/data-metadata');
    return response.data;
  },

  async saveAnalysisMonth(month, year) {
    const response = await api.post('/admin/analysis-month', { month, year });
    return response.data;
  },
};