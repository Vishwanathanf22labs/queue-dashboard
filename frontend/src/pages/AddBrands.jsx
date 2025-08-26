import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import BrandSearch from '../components/ui/BrandSearch';
import AdminLoginModal from '../components/ui/AdminLoginModal';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import CustomDropdown from '../components/ui/CustomDropdown';
import SortedSetInput from '../components/ui/SortedSetInput';
import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import { validateSingleBrand } from '../utils/validation';
import { queueAPI } from '../services/api';
import { Plus, RefreshCw, Check, Shield, LogOut, FileText, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { tabs } from '../constants/data';

const AddBrands = () => {
  const { loading } = useQueueStore();
  const { isAdmin, isLoading: adminLoading, logout } = useAdminStore();

  const getInitialLoginModalState = () => {
    try {
      const saved = localStorage.getItem('addBrands_showLoginModal');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  };

  const getInitialSingleBrand = () => {
    try {
      const saved = localStorage.getItem('addBrands_singleBrand');
      return saved ? JSON.parse(saved) : { id: '', page_id: '', name: '', score: 0 };
    } catch {
      return { id: '', page_id: '', name: '', score: 0 };
    }
  };

  const [state, setState] = useState({
    formState: {
      activeTab: 'single',
      isSubmitting: false
    },
    statusFilter: 'all',
    brandCounts: null,
    csvState: {
      file: null,
      uploadStatus: null,
      uploadResult: null
    },
    showLoginModal: getInitialLoginModalState(),
    singleBrandForm: getInitialSingleBrand()
  });

  const { activeTab, isSubmitting } = state.formState;
  const { file: csvFile, uploadStatus: csvUploadStatus, uploadResult: csvUploadResult } = state.csvState;

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateFormState = (updates) => {
    setState(prev => ({
      ...prev,
      formState: { ...prev.formState, ...updates }
    }));
  };

  const updateCsvState = (updates) => {
    setState(prev => ({
      ...prev,
      csvState: { ...prev.csvState, ...updates }
    }));
  };

  const fileInputRef = useRef(null);


  useEffect(() => {
    const savedTab = localStorage.getItem('addBrands_activeTab');
    if (savedTab && ['single', 'csv', 'all'].includes(savedTab)) {
      updateFormState({ activeTab: savedTab });
    }
  }, []);


  useEffect(() => {
    localStorage.setItem('addBrands_activeTab', activeTab);
  }, [activeTab]);


  useEffect(() => {
    if (isAdmin) {
      fetchBrandCounts();
    }
  }, [isAdmin]);

  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('addBrands_csvUploadResult');
      if (savedResult) {
        const parsedResult = JSON.parse(savedResult);

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

  const fetchBrandCounts = async () => {
    try {
      const response = await queueAPI.getBrandCounts();
      if (response.data.success) {
        updateState({ brandCounts: response.data.data });
      }
    } catch (error) {
      console.error('Failed to fetch brand counts:', error);
    }
  };

  const openLoginModal = () => {
    updateState({ showLoginModal: true });
    localStorage.setItem('addBrands_showLoginModal', 'true');
  };

  const closeLoginModal = () => {
    updateState({ showLoginModal: false });
    localStorage.removeItem('addBrands_showLoginModal');
  };

  useEffect(() => {
    if (isAdmin && state.showLoginModal) {
      closeLoginModal();
    }
  }, [isAdmin, state.showLoginModal]);

  useEffect(() => {
    localStorage.setItem('addBrands_singleBrand', JSON.stringify(state.singleBrandForm));
  }, [state.singleBrandForm]);


  const handleSingleBrandSelect = (brand) => {
    if (brand) {
      const newForm = {
        id: brand.brand_id.toString(),
        page_id: brand.page_id,
        name: brand.brand_name
      };
      updateState({ singleBrandForm: newForm });
      toast.success(`Selected: ${brand.brand_name}`);
    } else {
      updateState({ singleBrandForm: { id: '', page_id: '', name: '' } });
    }
  };

  const isSearchDisabled = (formData) => {
    return Boolean(formData.id && formData.page_id && formData.name);
  };

  const handleSearchAttempt = () => {
    if (isSearchDisabled(state.singleBrandForm)) {
      toast.error('Only one brand allowed. Please remove the current brand first.');
      return;
    }
  };

  const clearSearchInputs = () => {

    updateState({ singleBrandForm: getInitialSingleBrand() });

    localStorage.removeItem('addBrands_singleBrand');
  };

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

      if (result && result.data) {
        const summary = result.data.summary || result.data;
        const results = result.data.results || result.data;

        let successMessage = result.message || 'CSV uploaded successfully!';
        let totalAdded = summary.totalAdded || 0;
        let totalErrors = summary.totalErrors || 0;
        let csvErrors = summary.csvErrors || 0;
        let duplicates = summary.duplicates || 0;


        if (totalAdded > 0) {

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

    if (!state.singleBrandForm.id || !state.singleBrandForm.page_id) {
      toast.error('Please search and select a brand first.');
      return;
    }

    const validation = validateSingleBrand({
      id: parseInt(state.singleBrandForm.id),
      page_id: state.singleBrandForm.page_id,
      score: state.singleBrandForm.score || 0
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
      
      // Auto-remove the selected brand after 3 seconds
      setTimeout(() => {
        updateState({ singleBrandForm: { id: '', page_id: '', name: '', score: 0 } });
      }, 3000);
      
    } catch (error) {
      toast.error(error.message || 'Failed to add brand');
    } finally {
      updateFormState({ isSubmitting: false });
    }
  };

  const handleAddAllBrands = async () => {
    try {
      updateFormState({ isSubmitting: true });


      const statusParam = state.statusFilter === 'all' ? null : state.statusFilter;
      const result = await queueAPI.addAllBrands(statusParam);

      toast.success(result.message || 'Brands added successfully');

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
          <AdminAccessRequired
            title="Admin Access Required"
            description="This page requires administrator privileges. Please log in with your admin credentials to add brands to the queue."
            showLoginButton={true}
            onLoginClick={openLoginModal}
          />
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
                          selectedBrand={state.singleBrandForm.id ? state.singleBrandForm : null}
                          disabled={Boolean(isSubmitting || loading || isSearchDisabled(state.singleBrandForm))}
                          onSearchAttempt={handleSearchAttempt}
                        />
                        <p className="mt-1.5 sm:mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
                          Only one brand can be selected at a time
                        </p>
                      </div>


                      {state.singleBrandForm.id && state.singleBrandForm.page_id && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <Check className="h-5 w-5 text-green-600" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-green-800">{state.singleBrandForm.name}</p>
                                <p className="text-sm text-green-700">
                                  Brand ID: {state.singleBrandForm.id} | Page ID: {state.singleBrandForm.page_id}
                                </p>
                                <p className="text-sm text-green-600">
                                  Queue Score: {state.singleBrandForm.score} 
                                  {state.singleBrandForm.score === 1 && ' (Priority)'}
                                  {state.singleBrandForm.score === 0 && ' (Normal)'}
                                  {state.singleBrandForm.score > 1 && ' (High Priority)'}
                                  {state.singleBrandForm.score < 0 && ' (Low Priority)'}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="remove"
                              size="sm"
                              onClick={() => {
                                updateState({ singleBrandForm: { id: '', page_id: '', name: '', score: 0 } });
                              }}
                              className="ml-3"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}

                      <SortedSetInput
                        score={state.singleBrandForm.score}
                        onScoreChange={(score) => {
                          updateState({
                            singleBrandForm: {
                              ...state.singleBrandForm,
                              score: score !== null ? score : 0
                            }
                          });
                        }}
                        disabled={!state.singleBrandForm.id || isSubmitting || loading}
                        className="mt-4"
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="primary" disabled={loading || isSubmitting || !state.singleBrandForm.id} className="w-full sm:w-auto">
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
                      <div className={`p-3 rounded-lg ${csvUploadStatus.type === 'uploading'
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

                    {state.brandCounts && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-gray-900">{state.brandCounts.total}</div>
                          <div className="text-xs text-gray-600">Total Brands</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-green-600">{state.brandCounts.active}</div>
                          <div className="text-xs text-green-600">Active Brands</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-red-600">{state.brandCounts.inactive}</div>
                          <div className="text-xs text-gray-600">Inactive Brands</div>
                        </div>
                      </div>
                    )}

                    <CustomDropdown
                      options={[
                        {
                          value: 'all',
                          label: `All Brands ${state.brandCounts ? `(${state.brandCounts.total})` : ''}`
                        },
                        {
                          value: 'Active',
                          label: `Active Brands Only ${state.brandCounts ? `(${state.brandCounts.active})` : ''}`
                        },
                        {
                          value: 'Inactive',
                          label: `Inactive Brands Only ${state.brandCounts ? `(${state.brandCounts.inactive})` : ''}`
                        }
                      ]}
                      value={state.statusFilter}
                      onChange={(value) => updateState({ statusFilter: value })}
                      className="w-full max-w-xs mb-4"
                    />

                    <Button
                      onClick={handleAddAllBrands}
                      variant="primary"
                      disabled={loading || isSubmitting}
                      className="w-full"
                    >
                      <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      {isSubmitting
                        ? 'Adding Brands...'
                        : state.statusFilter === 'all'
                          ? 'Add All Brands to Queue'
                          : `Add ${state.statusFilter} Brands to Queue`
                      }
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}


        <AdminLoginModal
          isOpen={state.showLoginModal}
          onClose={closeLoginModal}
        />
      </div>
    </div>
  );
};

export default AddBrands;