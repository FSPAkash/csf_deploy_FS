import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Eye,
  Database,
  Calendar,
  Target
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminService } from '../services/forecastService';
import {
  GlassCard,
  Button,
  Select,
  Alert,
  Spinner,
  Badge,
  Modal
} from '../components/common';
import { PRODUCT_APS_MAPPING, EXCEL_SHEETS, MONTHS } from '../utils/constants';
import { formatFileSize } from '../utils/formatters';
import clsx from 'clsx';

// Helper to calculate analysis month from data date (upload month + 4)
function calculateAnalysisMonth(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const uploadMonth = date.getMonth(); // 0-11
    const uploadYear = date.getFullYear();

    // Add 4 months
    let analysisMonth = uploadMonth + 4;
    let analysisYear = uploadYear;

    if (analysisMonth > 11) {
      analysisMonth = analysisMonth - 12;
      analysisYear = analysisYear + 1;
    }

    return { month: analysisMonth, year: analysisYear };
  } catch {
    return null;
  }
}

function DevMode() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // State
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Upload state
  const [uploadMode, setUploadMode] = useState('product'); // 'product', 'aps', 'update'
  const [productCode, setProductCode] = useState('');
  const [selectedAps, setSelectedAps] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Bulk upload state
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  // Analysis month state (upload month + 4, editable)
  const [analysisMonth, setAnalysisMonth] = useState(null); // 0-11
  const [analysisYear, setAnalysisYear] = useState(null);

  // Load products and saved analysis month on mount
  useEffect(() => {
    loadProducts();
    loadSavedAnalysisMonth();
  }, []);

  // Load saved analysis month from backend
  const loadSavedAnalysisMonth = async () => {
    try {
      const response = await adminService.getDataMetadata();
      if (response.success && response.metadata) {
        if (response.metadata.analysis_month !== undefined) {
          setAnalysisMonth(response.metadata.analysis_month);
        }
        if (response.metadata.analysis_year !== undefined) {
          setAnalysisYear(response.metadata.analysis_year);
        }
      }
    } catch (err) {
      console.log('Failed to load saved analysis month:', err);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getProductsList();
      setProducts(response.products || []);
    } catch (err) {
      setError('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Auto-preview
    try {
      const response = await adminService.previewUpload(file);
      setPreviewData(response);
    } catch (err) {
      console.error('Preview failed:', err);
    }
  }, []);

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile || !productCode) {
      setError('Please select a file and enter a product code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('product_code', productCode.toUpperCase());
      formData.append('upload_type', uploadMode);
      
      if (uploadMode === 'aps' && selectedAps) {
        formData.append('aps_class', selectedAps);
      }

      const response = await adminService.uploadData(formData);

      if (response.success) {
        setSuccess(`Successfully uploaded data for ${productCode}`);
        setSelectedFile(null);
        setPreviewData(null);
        loadProducts();
      } else {
        setError(response.errors?.join(', ') || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle template download
  const handleDownloadTemplate = async () => {
    if (!productCode) {
      setError('Please enter a product code first');
      return;
    }

    setIsLoading(true);
    try {
      const blob = await adminService.downloadTemplate(productCode.toUpperCase(), true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${productCode.toUpperCase()}_template.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (product, apsClass = null) => {
    if (!confirm(`Are you sure you want to delete ${apsClass || product}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await adminService.deleteProduct(product, apsClass);
      setSuccess(`Deleted ${apsClass || product}`);
      loadProducts();
    } catch (err) {
      setError('Failed to delete');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle bulk file selection
  const handleBulkFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    setBulkFile(file);
    setBulkUploadResult(null);
    setError(null);
  }, []);

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setError('Please select a file first');
      return;
    }

    setIsBulkUploading(true);
    setError(null);
    setSuccess(null);
    setBulkUploadResult(null);

    try {
      const response = await adminService.uploadBulkProductData(bulkFile);

      if (response.success) {
        setBulkUploadResult(response);
        setSuccess(`Successfully updated baseline data for ${response.products_updated.length} products`);
        setBulkFile(null);
        loadProducts();

        // Calculate and set analysis month (upload month + 4)
        if (response.data_date) {
          const analysisDate = calculateAnalysisMonth(response.data_date);
          if (analysisDate) {
            setAnalysisMonth(analysisDate.month);
            setAnalysisYear(analysisDate.year);
          }
        }
      } else {
        setError(response.errors?.join(', ') || 'Bulk upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setIsBulkUploading(false);
    }
  };

  // Parse date from bulk filename for display
  const parseBulkFilenameDate = (filename) => {
    if (!filename) return null;
    const match = filename.match(/^(\d{2})_(\d{2})_(\d{2})_/);
    if (match) {
      const [, month, day, year] = match;
      try {
        const date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } catch {
        return null;
      }
    }
    return null;
  };

  const bulkFileDate = bulkFile ? parseBulkFilenameDate(bulkFile.name) : null;

  // Handle saving analysis month to backend
  const handleSaveAnalysisMonth = async () => {
    if (analysisMonth === null || analysisYear === null) return;

    try {
      await adminService.saveAnalysisMonth(analysisMonth, analysisYear);
      setSuccess(`Analysis month set to ${MONTHS[analysisMonth]} ${analysisYear}`);
    } catch (err) {
      setError('Failed to save analysis month');
    }
  };

  // Check if product exists
  const productExists = products.some(p => p.code === productCode.toUpperCase());

  // Get APS options for selected product
  const apsOptions = productCode && PRODUCT_APS_MAPPING[productCode.toUpperCase()]
    ? PRODUCT_APS_MAPPING[productCode.toUpperCase()]
    : [];

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="sticky top-0 z-[var(--z-sticky)] glass-subtle border-b border-surface-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Exit Dev Mode
            </Button>
            <h1 className="text-lg font-semibold text-daikin-dark">
              Development Mode
            </h1>
            <div className="w-24" /> {/* Spacer for alignment */}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Bulk Upload Section - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-daikin-blue/10">
                <Database className="h-5 w-5 text-daikin-blue" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-daikin-dark">
                  Bulk Baseline Data Upload
                </h2>
                <p className="text-sm text-surface-500">
                  Upload all product baselines from a single Excel file
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: File upload */}
              <div className="space-y-4">
                {/* File format info */}
                <div className="p-4 bg-daikin-blue/5 border border-daikin-blue/20 rounded-lg">
                  <p className="text-sm font-medium text-daikin-dark mb-2">
                    Expected File Format:
                  </p>
                  <ul className="text-xs text-surface-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-daikin-blue" />
                      Filename: <code className="px-1 py-0.5 bg-surface-100 rounded">MM_DD_YY_Product_Data.xlsx</code>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-daikin-blue" />
                      Rows: Product codes (CL, CN, FN, HP, AH, etc.)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-daikin-blue" />
                      Columns: Dates in <code className="px-1 py-0.5 bg-surface-100 rounded">YY-Mon</code> format (e.g., 19-Apr = April 2019)
                    </li>
                  </ul>
                </div>

                {/* File dropzone */}
                <div
                  className={clsx(
                    'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
                    'hover:border-daikin-blue/50 hover:bg-daikin-blue/5',
                    bulkFile
                      ? 'border-green-300 bg-green-50'
                      : 'border-surface-300'
                  )}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {bulkFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-green-500" />
                        <div className="text-left">
                          <p className="font-medium text-daikin-dark">
                            {bulkFile.name}
                          </p>
                          <p className="text-xs text-surface-500">
                            {formatFileSize(bulkFile.size)}
                          </p>
                        </div>
                      </div>
                      {bulkFileDate && (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-daikin-blue">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Data date: {bulkFileDate}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-surface-400 mx-auto mb-2" />
                      <p className="text-sm text-surface-600">
                        Click or drag to upload bulk data file
                      </p>
                      <p className="text-xs text-surface-400 mt-1">
                        .xlsx or .xls files only
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload button */}
                <Button
                  variant="primary"
                  onClick={handleBulkUpload}
                  disabled={!bulkFile || isBulkUploading}
                  isLoading={isBulkUploading}
                  leftIcon={<Upload className="h-4 w-4" />}
                  className="w-full"
                >
                  Upload Bulk Baseline Data
                </Button>
              </div>

              {/* Right: Results */}
              <div>
                {bulkUploadResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Upload Successful</span>
                    </div>

                    {bulkUploadResult.data_date && (
                      <div className="flex items-center gap-2 p-3 bg-daikin-blue/10 rounded-lg">
                        <Calendar className="h-4 w-4 text-daikin-blue" />
                        <span className="text-sm text-daikin-dark">
                          Data date: <strong>{new Date(bulkUploadResult.data_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</strong>
                        </span>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-daikin-dark mb-2">
                        Products Updated:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bulkUploadResult.products_updated?.map((product) => (
                          <Badge key={product} variant="success" size="sm">
                            {product}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {bulkUploadResult.warnings?.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-medium text-amber-800 mb-1">Warnings:</p>
                        <ul className="text-xs text-amber-700 space-y-1">
                          {bulkUploadResult.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center p-8">
                    <div className="text-surface-400">
                      <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        Upload a bulk data file to see results
                      </p>
                      <p className="text-xs mt-1">
                        This will update baseline data for all products in the file
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Focus Analysis Month Setting - Always Visible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-daikin-blue/10">
                <Target className="h-5 w-5 text-daikin-blue" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-daikin-dark">
                  Focus Analysis Month
                </h2>
                <p className="text-sm text-surface-500">
                  Set the month to highlight on charts for all users
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-surface-600">Month:</label>
                <select
                  value={analysisMonth ?? ''}
                  onChange={(e) => setAnalysisMonth(e.target.value === '' ? null : parseInt(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm text-daikin-dark focus:outline-none focus:ring-2 focus:ring-daikin-blue/30"
                >
                  <option value="">Not Set</option>
                  {MONTHS.map((month, idx) => (
                    <option key={month} value={idx}>{month}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-surface-600">Year:</label>
                <input
                  type="number"
                  value={analysisYear ?? new Date().getFullYear()}
                  onChange={(e) => setAnalysisYear(parseInt(e.target.value))}
                  min={2020}
                  max={2035}
                  className="w-24 h-9 px-3 rounded-lg border border-surface-300 bg-white text-sm text-daikin-dark focus:outline-none focus:ring-2 focus:ring-daikin-blue/30"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAnalysisMonth}
                disabled={analysisMonth === null}
              >
                Save Focus Month
              </Button>
              {analysisMonth !== null && analysisYear !== null && (
                <span className="text-sm text-daikin-blue font-medium">
                  Currently set: {MONTHS[analysisMonth]} {analysisYear}
                </span>
              )}
            </div>
          </GlassCard>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Individual Upload Section */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <GlassCard padding="lg">
                <h2 className="text-xl font-semibold text-daikin-dark mb-2">
                  Upload Individual Product Data
                </h2>
                <p className="text-sm text-surface-500 mb-6">
                  Upload weights, market share, or APS-specific data
                </p>

                {/* Alerts */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4"
                    >
                      <Alert type="error" onClose={() => setError(null)}>
                        {error}
                      </Alert>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4"
                    >
                      <Alert type="success" onClose={() => setSuccess(null)}>
                        {success}
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-6">
                  {/* Product Code */}
                  <div>
                    <label className="block text-sm font-medium text-daikin-dark mb-1.5">
                      Product Code
                    </label>
                    <input
                      type="text"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value.toUpperCase())}
                      maxLength={3}
                      placeholder="e.g., CN, HP, FN"
                      className="w-full h-10 px-3 rounded-lg glass-input text-sm uppercase"
                    />
                    {productCode && (
                      <p className="mt-1 text-xs text-surface-500">
                        {productExists ? (
                          <span className="text-green-600">Product exists in system</span>
                        ) : (
                          <span className="text-amber-600">New product - will be created</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Upload Mode */}
                  {productExists && (
                    <Select
                      label="Upload Type"
                      value={uploadMode}
                      onChange={setUploadMode}
                      options={[
                        { value: 'product', label: 'Product Total Data' },
                        { value: 'aps', label: 'APS Class Data' },
                        { value: 'update', label: 'Update Weights/Market Share' },
                      ]}
                    />
                  )}

                  {/* APS Selector */}
                  {uploadMode === 'aps' && apsOptions.length > 0 && (
                    <Select
                      label="APS Class"
                      value={selectedAps}
                      onChange={setSelectedAps}
                      options={apsOptions.map(aps => ({ value: aps, label: aps }))}
                      placeholder="Select APS Class"
                    />
                  )}

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-daikin-dark mb-1.5">
                      Excel File
                    </label>
                    <div 
                      className={clsx(
                        'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
                        'hover:border-daikin-blue/50 hover:bg-daikin-blue/5',
                        selectedFile 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-surface-300'
                      )}
                    >
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileSpreadsheet className="h-8 w-8 text-green-500" />
                          <div className="text-left">
                            <p className="font-medium text-daikin-dark">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-surface-500">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-8 w-8 text-surface-400 mx-auto mb-2" />
                          <p className="text-sm text-surface-600">
                            Click or drag to upload Excel file
                          </p>
                          <p className="text-xs text-surface-400 mt-1">
                            .xlsx or .xls files only
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview Button */}
                  {previewData && (
                    <Button
                      variant="secondary"
                      onClick={() => setShowPreview(true)}
                      leftIcon={<Eye className="h-4 w-4" />}
                      className="w-full"
                    >
                      Preview File Contents
                    </Button>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={handleDownloadTemplate}
                      disabled={!productCode || isLoading}
                      leftIcon={<Download className="h-4 w-4" />}
                      className="flex-1"
                    >
                      Download Template
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleUpload}
                      disabled={!selectedFile || !productCode || isLoading}
                      isLoading={isLoading}
                      leftIcon={<Upload className="h-4 w-4" />}
                      className="flex-1"
                    >
                      Upload
                    </Button>
                  </div>

                  {/* Expected Sheets Info */}
                  <div className="p-4 bg-surface-50 rounded-lg">
                    <p className="text-sm font-medium text-daikin-dark mb-2">
                      Expected Excel Sheets:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(EXCEL_SHEETS).map(([key, name]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-daikin-blue" />
                          <span className="text-surface-600">{name}</span>
                          {key === 'baseline' && (
                            <Badge variant="primary" size="sm">Required</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Existing Products Section */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <GlassCard padding="lg">
                <h2 className="text-xl font-semibold text-daikin-dark mb-6">
                  Existing Products
                </h2>

                {isLoading && products.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 text-surface-500">
                    No products found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {products.map((product) => (
                      <div
                        key={product.code}
                        className="p-4 rounded-lg border border-surface-200 hover:border-daikin-blue/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-daikin-dark">
                              {product.code}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {product.has_baseline && (
                                <Badge variant="success" size="sm">Baseline</Badge>
                              )}
                              {product.has_weights && (
                                <Badge variant="info" size="sm">Weights</Badge>
                              )}
                              {product.has_market_share && (
                                <Badge variant="primary" size="sm">Market Share</Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(product.code)}
                            className="text-surface-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* APS Classes */}
                        {product.aps_classes?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-surface-100">
                            <p className="text-xs text-surface-500 mb-2">APS Classes:</p>
                            <div className="flex flex-wrap gap-2">
                              {product.aps_classes.map((aps) => (
                                <div
                                  key={aps}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-surface-100 text-xs"
                                >
                                  <span>{aps}</span>
                                  <button
                                    onClick={() => handleDelete(product.code, aps)}
                                    className="text-surface-400 hover:text-red-500 ml-1"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Available APS (not yet uploaded) */}
                        {product.available_aps?.filter(aps => 
                          !product.aps_classes?.includes(aps)
                        ).length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-surface-400">
                              Available: {product.available_aps.filter(aps => 
                                !product.aps_classes?.includes(aps)
                              ).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="File Preview"
        size="xl"
      >
        {previewData && (
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {Object.entries(previewData.sheets || {}).map(([sheetName, sheetData]) => (
              <div key={sheetName} className="border border-surface-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-surface-50 border-b border-surface-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-daikin-dark">{sheetName}</span>
                    <Badge variant="info" size="sm">
                      {sheetData.row_count} rows
                    </Badge>
                  </div>
                </div>
                <div className="p-4 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-200">
                        {sheetData.columns?.map((col, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium text-surface-600">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetData.preview?.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-surface-100">
                          {sheetData.columns?.map((col, j) => (
                            <td key={j} className="px-2 py-1 text-surface-600">
                              {row[col] ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DevMode;