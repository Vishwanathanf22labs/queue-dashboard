import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import BrandSearch from '../components/ui/BrandSearch';
import AdminLoginModal from '../components/ui/AdminLoginModal';
import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import { validateSingleBrand } from '../utils/validation';
import { queueAPI } from '../services/api';
import { Plus, Users, RefreshCw, Check, Shield, LogOut, FileText, Upload, X, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { tabs } from '../constants/data';

const AddBrands = () => {
  const { loading } = useQueueStore();
  const { isAdmin, isLoading: adminLoading, logout } = useAdminStore();

  // State declarations
  const [formState, setFormState] = useState({
    activeTab: 'single',
    isSubmitting: false
  });
  
  // Add All Brands filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  // Brand counts state
  const [brandCounts, setBrandCounts] = useState(null);
  
  // CSV Upload State
  const [csvState, setCsvState] = useState({
    file: null,
    uploadStatus: null,
    uploadResult: null
  });
  
  // Ref for file input element
  const fileInputRef = useRef(null);

  // Destructure for easier access
  const { activeTab, isSubmitting } = formState;
  const { file: csvFile, uploadStatus: csvUploadStatus, uploadResult: csvUploadResult } = csvState;

  // Helper functions to update grouped state
  const updateFormState = (updates) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  const updateCsvState = (updates) => {
    setCsvState(prev => ({ ...prev, ...updates }));
  };

  // Initialize active tab from localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('addBrands_activeTab');
    if (savedTab && ['single', 'csv', 'all'].includes(savedTab)) {
      updateFormState({ activeTab: savedTab });
    }
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('addBrands_activeTab', activeTab);
  }, [activeTab]);

  // Fetch brand counts when component mounts
  useEffect(() => {
    if (isAdmin) {
      fetchBrandCounts();
    }
  }, [isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStatusDropdown && !event.target.closest('.status-filter-dropdown')) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown]);

  // Initialize CSV upload result from localStorage
  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('addBrands_csvUploadResult');
      if (savedResult) {
        const parsedResult = JSON.parse(savedResult);
        // Only restore if it's recent (within last 10 minutes)
        if (parsedResult.timestamp && (Date.now() - new Date(parsedResult.timestamp).getTime()) < 10 * 60 * 1000) {
          updateCsvState({ uploadResult: parsedResult });
        } else {
          localStorage.removeItem('addBrands_csvUploadResult');
        }
      }
    } catch (error) {
      console.error('Error loading CSV upload result:', error);
      localStorage.removeItem('addBrands_csvUploadResult');
    }
  }, []);

  // Save CSV upload result to localStorage
  const saveCsvUploadResult = (result) => {
    if (result) {
      const resultToSave = {
        ...result,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('addBrands_csvUploadResult', JSON.stringify(resultToSave));
      updateCsvState({ uploadResult: resultToSave });
    } else {
      localStorage.removeItem('addBrands_csvUploadResult');
      updateCsvState({ uploadResult: null });
    }
  };
  
  // Fetch brand counts
  const fetchBrandCounts = async () => {
    try {
      const response = await queueAPI.getBrandCounts();
      if (response.data.success) {
        setBrandCounts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch brand counts:', error);
    }
  };
  
  // Initialize showLoginModal from localStorage to persist across refreshes
  const getInitialLoginModalState = () => {
    try {
      const saved = localStorage.getItem('addBrands_showLoginModal');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  };
  
  const [showLoginModal, setShowLoginModal] = useState(getInitialLoginModalState);
  
  // Functions to handle modal state with localStorage persistence
  const openLoginModal = () => {
    setShowLoginModal(true);
    localStorage.setItem('addBrands_showLoginModal', 'true');
  };
  
  const closeLoginModal = () => {
    setShowLoginModal(false);
    localStorage.removeItem('addBrands_showLoginModal');
  };
  
  // Clear login modal state when user successfully logs in as admin
  useEffect(() => {
    if (isAdmin && showLoginModal) {
      closeLoginModal();
    }
  }, [isAdmin, showLoginModal]);
  
  // Initialize state with localStorage data if available
  const getInitialSingleBrand = () => {
    try {
      const saved = localStorage.getItem('addBrands_singleBrand');
      return saved ? JSON.parse(saved) : { id: '', page_id: '', name: '' };
    } catch {
      return { id: '', page_id: '', name: '' };
    }
  };

  const [singleBrandForm, setSingleBrandForm] = useState(getInitialSingleBrand);

  // Save to localStorage whenever forms change
  useEffect(() => {
    localStorage.setItem('addBrands_singleBrand', JSON.stringify(singleBrandForm));
  }, [singleBrandForm]);

  // Handle brand selection from search
  const handleSingleBrandSelect = (brand) => {
    if (brand) {
      const newForm = {
        id: brand.brand_id.toString(),
        page_id: brand.page_id,
        name: brand.brand_name
      };
      setSingleBrandForm(newForm);
      toast.success(`Selected: ${brand.brand_name}`);
    } else {
      setSingleBrandForm({ id: '', page_id: '', name: '' });
    }
  };

  // Check if search should be disabled (when brand is already selected)
  const isSearchDisabled = (formData) => {
    return Boolean(formData.id && formData.page_id && formData.name);
  };

  // Handle search attempt when brand is already selected
  const handleSearchAttempt = () => {
    if (isSearchDisabled(singleBrandForm)) {
      toast.error('Only one brand allowed. Please remove the current brand first.');
      return;
    }
  };

  // Clear search input after successful brand addition
  const clearSearchInputs = () => {
    // Clear single brand form
    setSingleBrandForm(getInitialSingleBrand);
    // Clear localStorage
    localStorage.removeItem('addBrands_singleBrand');
  };

  // CSV Upload handlers
  const handleCsvFileSelect = (file) => {
    if (file) {
      updateCsvState({ 
        file: file, 
        uploadStatus: null, 
        uploadResult: null 
      });
    } else {
      updateCsvState({ 
        file: null, 
        uploadStatus: null, 
        uploadResult: null 
      });
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    if (isSubmitting || loading) {
      toast.error('Please wait, brands are already being processed.');
      return;
    }

    try {
      updateFormState({ isSubmitting: true });
      updateCsvState({ uploadStatus: { type: 'uploading', message: 'Uploading CSV file...' } });
      
      const result = await queueAPI.addBulkBrandsFromCSV(csvFile);
      
      // Handle successful upload
      if (result && result.data) {
        const summary = result.data.summary || result.data;
        const results = result.data.results || result.data;
        
        let successMessage = result.message || 'CSV uploaded successfully!';
        let totalAdded = summary.totalAdded || 0;
        let totalErrors = summary.totalErrors || 0;
        let csvErrors = summary.csvErrors || 0;
        let duplicates = summary.duplicates || 0;
        
        // Show appropriate toast based on results
        if (totalAdded > 0) {
          // Some brands were added successfully
          toast.success(successMessage);
        } else if (duplicates > 0) {
          toast.error(successMessage);
        } else if (totalErrors > 0) {
          toast.error(successMessage);
        } else {
          toast(successMessage);
        }
        

        const uploadResult = {
          type: 'success',
          message: successMessage,
          summary: {
            totalAdded: totalAdded,
            totalErrors: totalErrors,
            csvErrors: csvErrors,
            duplicates: duplicates,
            fileName: csvFile.name,
            uploadedAt: new Date().toISOString()
          }
        };
        
        saveCsvUploadResult(uploadResult);
       
        updateCsvState({ 
          uploadStatus: { type: 'success', message: successMessage }
        });
        
        
        setTimeout(() => {
          updateCsvState({ uploadStatus: null });

          updateCsvState({ file: null });

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 3000); 
        
      
        setTimeout(() => {
          saveCsvUploadResult(null);
        }, 5000); 
        
      } else {
        throw new Error('Invalid response structure from server');
      }
      
    } catch (error) {
      console.error('CSV Upload Error:', error);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload CSV file';
      toast.error(errorMessage);
      
      updateCsvState({ 
        uploadStatus: { type: 'error', message: errorMessage }
      });
      
 
      saveCsvUploadResult(null);
    } finally {
      updateFormState({ isSubmitting: false });
    }
  };


  const clearCsvUpload = () => {
    updateCsvState({ 
      file: null, 
      uploadStatus: null 
    });
    saveCsvUploadResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const clearCsvUploadResult = () => {
    saveCsvUploadResult(null); 
  };

  const handleSingleBrandSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting || loading) {
      toast.error('Please wait, a brand is already being processed.');
      return;
    }
    
    if (!singleBrandForm.id || !singleBrandForm.page_id) {
      toast.error('Please search and select a brand first.');
      return;
    }
    
    const validation = validateSingleBrand({
      id: parseInt(singleBrandForm.id),
      page_id: singleBrandForm.page_id
    });

    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    try {
      updateFormState({ isSubmitting: true });
      const result = await queueAPI.addSingleBrand(validation.data);
      toast.success(result.message || 'Brand added successfully');
      clearSearchInputs();
    } catch (error) {
      toast.error(error.message || 'Failed to add brand');
    } finally {
      updateFormState({ isSubmitting: false });
    }
  };

  const handleAddAllBrands = async () => {
    try {
      updateFormState({ isSubmitting: true });
      
      // Only pass status if it's not 'all'
      const statusParam = statusFilter === 'all' ? null : statusFilter;
      const result = await queueAPI.addAllBrands(statusParam);
      
      toast.success(result.message || 'Brands added successfully');
      
      // Refresh brand counts after adding brands
      await fetchBrandCounts();
    } catch (error) {
      toast.error(error.message || 'Failed to add brands');
    } finally {
      updateFormState({ isSubmitting: false });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Add Brands</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">Add brands to the processing queue</p>
            </div>
  
            {adminLoading ? (
              <div className="flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-500">
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-gray-400 mr-2"></div>
                Checking admin status...
              </div>
            ) : isAdmin ? (
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-green-600 bg-green-100 rounded-lg">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Admin Mode
                </div>
                <Button
                  onClick={logout}
                  size="sm"
                  variant="danger"
                  className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                onClick={openLoginModal}
                size="sm"
                variant="primary"
                className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
              >
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Admin Login
              </Button>
            )}
          </div>
        </div>

        {!adminLoading && !isAdmin && (
          <Card>
            <div className="p-4 sm:p-6 lg:p-8 text-center">
              <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-pink-100 border border-pink-200 rounded-full flex items-center justify-center">
                  <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Admin Access Required</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    This page requires administrator privileges. Please log in with<br className="hidden sm:block" />
                    your admin credentials to add brands to the queue.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={openLoginModal}
                  className="flex items-center space-x-2 mt-3 sm:mt-4"
                >
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  <span>Login as Admin</span>
                </Button>
              </div>
            </div>
          </Card>
        )}


        {isAdmin && (
          <>
            <Card className="mb-4 sm:mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap space-x-2 sm:space-x-8">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    
                    return (
                                              <Button
                          key={tab.id}
                          variant={activeTab === tab.id ? 'tab-active' : 'tab'}
                          size="sm"
                          onClick={() => updateFormState({ activeTab: tab.id })}
                          className="py-2 px-2 sm:px-1 text-xs sm:text-sm flex items-center space-x-1 sm:space-y-0 sm:space-x-2 whitespace-nowrap relative"
                        >
                        <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>{tab.label}</span>
                      </Button>
                    );
                  })}
                </nav>
              </div>
            </Card>

            <Card>
              {activeTab === 'single' && (
                <form onSubmit={handleSingleBrandSubmit} className="space-y-4 sm:space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Add Single Brand</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                          Search Brand <span className="text-red-500">*</span>
                        </label>
                        <BrandSearch 
                          onBrandSelect={handleSingleBrandSelect}
                          placeholder="Type brand name to search (e.g., 'nike', 'adidas')..."
                          selectedBrand={singleBrandForm.id ? singleBrandForm : null}
                          disabled={Boolean(isSubmitting || loading || isSearchDisabled(singleBrandForm))}
                          onSearchAttempt={handleSearchAttempt}
                        />
                        <p className="mt-1.5 sm:mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
                          Only one brand can be selected at a time
                        </p>
                      </div>
                      
        
                      {singleBrandForm.id && singleBrandForm.page_id && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <Check className="h-5 w-5 text-green-600" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-green-800">{singleBrandForm.name}</p>
                                <p className="text-sm text-green-700">
                                  Brand ID: {singleBrandForm.id} | Page ID: {singleBrandForm.page_id}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="remove"
                              size="sm"
                              onClick={() => {
                                setSingleBrandForm({ id: '', page_id: '', name: '' });
                              }}
                              className="ml-3"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button type="submit" variant="primary" disabled={loading || isSubmitting || !singleBrandForm.id} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Adding Brand...' : 'Add Brand'}
                  </Button>
                </form>
              )}

              {activeTab === 'csv' && (
                <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-3 lg:mb-4">Upload CSV File</h3>

                    {!csvFile ? (
                      <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 lg:p-8 text-center hover:border-gray-400 transition-colors"
                        onDrop={(e) => {
                          e.preventDefault();
                          const files = e.dataTransfer.files;
                          if (files.length > 0) {
                            const file = files[0];
                            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                              handleCsvFileSelect(file);
                            } else {
                              toast.error('Please select a CSV file');
                            }
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={(e) => e.preventDefault()}
                      >
                        <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                          <div className="p-2 sm:p-3 bg-gray-100 rounded-full">
                            <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                          </div>
                          
                          <div>
                            <p className="text-base sm:text-lg font-medium text-gray-900">Upload CSV File</p>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                              Drag and drop your CSV file here, or{' '}
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => document.getElementById('csv-file-input').click()}
                                className="text-blue-600 hover:text-blue-700 font-medium p-0 h-auto"
                              >
                                browse files
                              </Button>
                            </p>
                          </div>
                          
                          <div className="text-xs text-gray-400">
                            <p>Supported formats: .csv</p>
                            <p>Max size: 5MB</p>
                          </div>
                        </div>
                      </div>
                    ) : (

                      <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-full">
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm sm:text-base font-medium text-gray-900">{csvFile.name}</p>
                              <p className="text-xs sm:text-sm text-gray-500">
                                {(csvFile.size / 1024).toFixed(1)} KB • {csvFile.type || 'text/csv'}
                              </p>
                            </div>
                          </div>
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => updateCsvState({ file: null })}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-3 w-3 sm:h-4 sm:w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}

       
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleCsvFileSelect(file);
                        }
                   
                        e.target.value = '';
                      }}
                      className="hidden"
                      ref={fileInputRef}
                    />

                    {csvUploadStatus && (
                      <div className={`p-3 rounded-lg ${
                        csvUploadStatus.type === 'uploading' 
                          ? 'bg-blue-50 border border-blue-200 text-blue-800'
                          : csvUploadStatus.type === 'error'
                          ? 'bg-red-50 border border-red-200 text-red-800'
                          : csvUploadStatus.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-800'
                          : 'bg-gray-50 border border-gray-200 text-gray-800'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {csvUploadStatus.type === 'uploading' && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          )}
                          {csvUploadStatus.type === 'success' && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          {csvUploadStatus.type === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">{csvUploadStatus.message}</span>
                        </div>
                      </div>
                    )}

                    {csvFile && (
                      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                        <Button
                          onClick={handleCsvUpload}
                          variant="primary"
                          disabled={loading || isSubmitting}
                          className="flex-1 sm:flex-none"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {isSubmitting ? 'Uploading...' : 'Upload CSV'}
                        </Button>
                        
                        <Button
                          onClick={clearCsvUpload}
                          variant="outline"
                          disabled={loading || isSubmitting}
                          className="flex-1 sm:flex-none"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                      </div>
                    )}

                    {csvUploadResult && csvUploadResult.type === 'success' && (
                      <div className="mt-3 sm:mt-4 border border-green-200 rounded-lg p-3 sm:p-4 bg-green-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="p-1.5 sm:p-2 bg-green-100 rounded-full">
                              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm sm:text-base font-medium text-green-800">Upload Summary</p>
                              <p className="text-xs sm:text-sm text-green-700">
                                {csvUploadResult.summary?.totalAdded || 0} brands added to pending queue
                                {csvUploadResult.summary?.totalErrors > 0 && (
                                  <span className="ml-2 text-yellow-600">
                                    ({csvUploadResult.summary.totalErrors} processing errors)
                                  </span>
                                )}
                                {csvUploadResult.summary?.csvErrors > 0 && (
                                  <span className="ml-2 text-orange-600">
                                    ({csvUploadResult.summary.csvErrors} CSV parsing errors)
                                  </span>
                                )}
                                {csvUploadResult.summary?.duplicates > 0 && (
                                  <span className="ml-2 text-purple-600">
                                    ({csvUploadResult.summary.duplicates} already in queue)
                                  </span>
                                )}
                              </p>
                              {csvUploadResult.summary?.fileName && (
                                <p className="text-xs text-green-600 mt-1">
                                  File: {csvUploadResult.summary.fileName}
                                </p>
                              )}
                              {csvUploadResult.summary?.uploadedAt && (
                                <p className="text-xs text-green-600">
                                  Uploaded: {new Date(csvUploadResult.summary.uploadedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={clearCsvUploadResult}
                            className="text-green-600 hover:text-green-700 self-start sm:self-auto"
                          >
                            <X className="h-3 w-3 sm:h-4 sm:w-4" />
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'all' && (
                <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-3 lg:mb-4">Add All Brands</h3>
                    
                    {/* Brand Counts Display */}
                    {brandCounts && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-gray-900">{brandCounts.total}</div>
                          <div className="text-xs text-gray-600">Total Brands</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-green-600">{brandCounts.active}</div>
                          <div className="text-xs text-green-600">Active Brands</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-red-600">{brandCounts.inactive}</div>
                          <div className="text-xs text-red-600">Inactive Brands</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Status Filter Dropdown */}
                    <div className="relative status-filter-dropdown w-full max-w-xs mb-4">
                      <button
                        type="button"
                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      >
                        <span>
                          {statusFilter === 'all' 
                            ? 'All Brands' 
                            : statusFilter === 'Active' 
                              ? 'Active Brands Only' 
                              : 'Inactive Brands Only'
                          }
                        </span>
                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                          showStatusDropdown ? 'rotate-180' : ''
                        }`} />
                      </button>
                      
                      {showStatusDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setStatusFilter('all');
                              setShowStatusDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                              statusFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            All Brands {brandCounts ? `(${brandCounts.total})` : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusFilter('Active');
                              setShowStatusDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                              statusFilter === 'Active' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            Active Brands Only {brandCounts ? `(${brandCounts.active})` : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusFilter('Inactive');
                              setShowStatusDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                              statusFilter === 'Inactive' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            Inactive Brands Only {brandCounts ? `(${brandCounts.inactive})` : ''}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Button */}
                    <Button
                      onClick={handleAddAllBrands}
                      variant="primary"
                      disabled={loading || isSubmitting}
                      className="w-full"
                    >
                      <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      {isSubmitting 
                        ? 'Adding Brands...' 
                        : statusFilter === 'all' 
                          ? 'Add All Brands to Queue' 
                          : `Add ${statusFilter} Brands to Queue`
                      }
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}


        <AdminLoginModal 
          isOpen={showLoginModal} 
          onClose={closeLoginModal} 
        />
      </div>
    </div>
  );
};

export default AddBrands;