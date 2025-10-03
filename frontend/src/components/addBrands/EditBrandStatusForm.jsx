import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import BrandSearch from '../ui/BrandSearch';
import CustomDropdown from '../ui/CustomDropdown';
import useQueueStore from '../../stores/queueStore';
import Papa from 'papaparse';

const EditBrandStatusForm = ({ disabled = false }) => {
  const { fetchBrandStatus, setBrandStatus, bulkPreviewBrands, bulkApplyStatusUpdates } = useQueueStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedBrand, setSelectedBrand] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // CSV bulk edit states
  const [csvData, setCsvData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkSection, setShowBulkSection] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, confirmText: '' });
  const fileInputRef = useRef(null);

  // Load persisted data on mount
  useEffect(() => {
    try {
      const savedCsvData = localStorage.getItem('bulkEdit_csvData');
      const savedPreviewData = localStorage.getItem('bulkEdit_previewData');
      const savedShowBulkSection = localStorage.getItem('bulkEdit_showBulkSection');
      const savedConfirmDialog = localStorage.getItem('bulkEdit_confirmDialog');
      
      if (savedCsvData) {
        setCsvData(JSON.parse(savedCsvData));
      }
      if (savedPreviewData) {
        setPreviewData(JSON.parse(savedPreviewData));
      }
      if (savedShowBulkSection === 'true') {
        setShowBulkSection(true);
      }
      if (savedConfirmDialog) {
        setConfirmDialog(JSON.parse(savedConfirmDialog));
      }
    } catch (error) {
      console.error('Error loading persisted bulk edit data:', error);
    }
  }, []);

  const handleBrandSelect = async (brand) => {
    try {
      setSelectedBrand(brand);
      setCurrentStatus(null);
      if (!brand) return;
      const data = await fetchBrandStatus({ brand_id: brand.brand_id });
      setCurrentStatus(data.status || 'Unknown');
    } catch (error) {
      toast.error(error.message || 'Failed to load brand status');
    }
  };

  const nextStatus = () => {
    if (currentStatus === 'Active') return 'Inactive';
    if (currentStatus === 'Inactive') return 'Active';
    return null;
  };

  const canToggle = currentStatus === 'Active' || currentStatus === 'Inactive';

  const handleClear = () => {
    setSelectedBrand(null);
    setCurrentStatus(null);
    // Clear URL search params
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    setSearchParams(newParams);
  };

  // CSV handling functions
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error('Error parsing CSV: ' + results.errors[0].message);
          return;
        }
        
        setCsvData(results.data);
        localStorage.setItem('bulkEdit_csvData', JSON.stringify(results.data));
        toast.success(`CSV loaded: ${results.data.length} rows`);
      },
      error: (error) => {
        toast.error('Error reading file: ' + error.message);
      }
    });
  };

  const extractPageIdFromUrl = (url) => {
    if (!url) return null;
    const match = url.match(/page_id=(\d+)/);
    return match ? match[1] : null;
  };

  const getBestBrandName = (brand, csvRow) => {
    // Priority: CSV name > DB actual_name > DB name (if not generic)
    const csvName = csvRow?.name;
    const dbActualName = brand?.actual_name;
    const dbName = brand?.name;
    
    // Check if a name is generic (just "Brand" or just numbers)
    const isGeneric = (name) => {
      if (!name) return true;
      const trimmed = name.trim();
      return trimmed === 'Brand' || /^\d+$/.test(trimmed) || trimmed.length <= 2;
    };
    
    
    // ALWAYS use CSV name if available, even if it seems generic
    if (csvName && csvName.trim()) {
      return csvName.trim();
    }
    
    // Use actual_name if available and not generic
    if (dbActualName && !isGeneric(dbActualName)) {
      return dbActualName;
    }
    
    // Use DB name if not generic
    if (dbName && !isGeneric(dbName)) {
      return dbName;
    }
    
    // Fallback to any available name
    return csvName || dbActualName || dbName || 'Unknown Brand';
  };

  const handlePreview = async () => {
    if (!csvData || csvData.length === 0) {
      toast.error('Please upload a CSV file first');
      return;
    }

    try {
      setBulkLoading(true);
      
      // Extract IDs and page IDs from CSV
      const ids = [];
      const pageIds = [];
      
      csvData.forEach(row => {
        // Try to get ID from 'id' column
        if (row.id && !isNaN(row.id)) {
          ids.push(parseInt(row.id));
        }
        
        // Try to extract page_id from ads_library_url
        if (row.ads_library_url) {
          const pageId = extractPageIdFromUrl(row.ads_library_url);
          if (pageId) {
            pageIds.push(pageId);
          }
        }
      });

      if (ids.length === 0 && pageIds.length === 0) {
        toast.error('No valid IDs or page_ids found in CSV');
        return;
      }

      const result = await bulkPreviewBrands(ids, pageIds);
      
      // Enhance the result with CSV data for better brand names
      const enhancedData = {
        ...result.data,
        items: result.data.items.map(brand => {
          // Find corresponding CSV row - try both ID and page_id matching
          let csvRow = csvData.find(row => {
            // Match by ID
            if (row.id && parseInt(row.id) === brand.id) return true;
            // Match by page_id from ads_library_url
            if (row.ads_library_url) {
              const pageId = extractPageIdFromUrl(row.ads_library_url);
              if (pageId === brand.page_id) return true;
            }
            return false;
          });
          
          // If no match found, try to find by any available identifier
          if (!csvRow) {
            csvRow = csvData.find(row => {
              // Try matching by any available field
              return (row.id && parseInt(row.id) === brand.id) ||
                     (row.page_id && row.page_id === brand.page_id) ||
                     (row.ads_library_url && extractPageIdFromUrl(row.ads_library_url) === brand.page_id);
            });
          }
          
          return {
            ...brand,
            displayName: getBestBrandName(brand, csvRow),
            csvRow: csvRow
          };
        })
      };
      
      setPreviewData(enhancedData);
      localStorage.setItem('bulkEdit_previewData', JSON.stringify(enhancedData));
      
      // Show detailed breakdown
      const { items, notFound, duplicates } = result.data;
      const totalProcessed = ids.length + pageIds.length;
      const duplicatesCount = (duplicates.ids || 0) + (duplicates.pageIds || 0);
      const notFoundCount = notFound.length;
      
      
      toast.success(`Preview loaded: ${items.length} brands found (${duplicatesCount} duplicates, ${notFoundCount} not found)`);
      
    } catch (error) {
      toast.error(error.message || 'Failed to preview brands');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatusChange = (index, newStatus) => {
    if (!previewData) return;
    
    const updatedItems = [...previewData.items];
    updatedItems[index] = { ...updatedItems[index], newStatus };
    const updatedPreviewData = { ...previewData, items: updatedItems };
    setPreviewData(updatedPreviewData);
    localStorage.setItem('bulkEdit_previewData', JSON.stringify(updatedPreviewData));
  };

  const handleBulkSetAll = (status) => {
    if (!previewData) return;
    
    const updatedItems = previewData.items.map(item => ({
      ...item,
      newStatus: status
    }));
    const updatedPreviewData = { ...previewData, items: updatedItems };
    setPreviewData(updatedPreviewData);
    localStorage.setItem('bulkEdit_previewData', JSON.stringify(updatedPreviewData));
  };


  const handleBulkApply = () => {
    if (!previewData || previewData.items.length === 0) {
      toast.error('No brands to update');
      return;
    }

    const newDialogState = { show: true, confirmText: '' };
    setConfirmDialog(newDialogState);
    localStorage.setItem('bulkEdit_confirmDialog', JSON.stringify(newDialogState));
  };

  const handleConfirmApply = async () => {
    if (confirmDialog.confirmText !== 'confirm') {
      toast.error('Please type "confirm" to proceed');
      return;
    }

    try {
      setBulkLoading(true);
      
      const updates = previewData.items
        .filter(item => item.newStatus && item.newStatus !== item.currentStatus)
        .map(item => ({
          id: item.id,
          status: item.newStatus
        }));

      if (updates.length === 0) {
        toast.error('No changes to apply');
        return;
      }

      const result = await bulkApplyStatusUpdates(updates);
      
      toast.success(`Bulk update completed: ${result.data.totals.updated} updated, ${result.data.totals.skipped} skipped, ${result.data.totals.errors} errors`);
      
      // Clear the bulk section
      setPreviewData(null);
      setCsvData(null);
      setConfirmDialog({ show: false, confirmText: '' });
      localStorage.removeItem('bulkEdit_csvData');
      localStorage.removeItem('bulkEdit_previewData');
      localStorage.removeItem('bulkEdit_confirmDialog');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      toast.error(error.message || 'Failed to apply bulk updates');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleClearBulk = () => {
    setCsvData(null);
    setPreviewData(null);
    setConfirmDialog({ show: false, confirmText: '' });
    localStorage.removeItem('bulkEdit_csvData');
    localStorage.removeItem('bulkEdit_previewData');
    localStorage.removeItem('bulkEdit_confirmDialog');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggle = async () => {
    if (!selectedBrand || !canToggle) return;
    try {
      setLoading(true);
      const targetStatus = nextStatus();
      const res = await setBrandStatus(
        { brand_id: selectedBrand.brand_id },
        targetStatus
      );
      setCurrentStatus(res.data.status);
      toast.success(res.message || 'Status updated');
      
      // Clear search and URL after successful update
      setTimeout(() => {
        setSelectedBrand(null);
        setCurrentStatus(null);
        // Clear URL search params
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('search');
        setSearchParams(newParams);
      }, 2000); // Clear after 2 seconds to show the success
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Edit Brand Status</h3>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
              Search Brand <span className="text-red-500">*</span>
            </label>
            <BrandSearch onBrandSelect={handleBrandSelect} selectedBrand={selectedBrand} disabled={disabled} />
            <p className="mt-1.5 sm:mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
              Search by brand name, page ID, or brand ID. Select a brand to view status.
            </p>
          </div>

          {selectedBrand && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{selectedBrand.brand_name}</p>
                  <p className="text-sm text-gray-700">
                    Brand ID: {selectedBrand.brand_id} | Page ID: {selectedBrand.page_id}
                  </p>
                </div>
                <div className="ml-4 flex items-center space-x-3">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    currentStatus === 'Active' ? 'bg-green-100 text-green-700' :
                    currentStatus === 'Inactive' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {currentStatus || '—'}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleToggle}
                      disabled={disabled || !canToggle || loading}
                      variant={canToggle ? 'primary' : 'secondary'}
                      size="sm"
                      className="px-3 py-1.5 font-medium rounded-md"
                    >
                      {canToggle ? `Set ${nextStatus()}` : 'Toggle Disabled'}
                    </Button>
                    <Button
                      onClick={handleClear}
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      className="px-3 py-1.5 font-medium rounded-md"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
              {!canToggle && (
                <p className="text-xs text-gray-500 mt-2">Status changes are only allowed for Active/Inactive brands.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Edit from CSV Section */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Bulk Edit from CSV</h3>
          <Button
            onClick={() => {
              const newShowBulkSection = !showBulkSection;
              setShowBulkSection(newShowBulkSection);
              localStorage.setItem('bulkEdit_showBulkSection', newShowBulkSection.toString());
            }}
            variant="secondary"
            size="sm"
            disabled={disabled}
          >
            {showBulkSection ? 'Hide' : 'Show'} CSV Upload
          </Button>
        </div>

        {showBulkSection && (
          <div className="space-y-4">
            {/* CSV Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={disabled}
              />
            </div>

            {/* CSV Data Info */}
            {csvData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  CSV loaded: {csvData.length} rows
                </p>
                <Button
                  onClick={handlePreview}
                  disabled={disabled || bulkLoading}
                  variant="primary"
                  size="sm"
                  className="mt-2"
                >
                  {bulkLoading ? 'Loading...' : 'Preview Brands'}
                </Button>
              </div>
            )}

            {/* Preview Table */}
            {previewData && (
              <div className="space-y-4 relative">
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Preview ({previewData.items.length} brands)
                  </h4>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleBulkSetAll('Active')}
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      Set All Active
                    </Button>
                    <Button
                      onClick={() => handleBulkSetAll('Inactive')}
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                    >
                      Set All Inactive
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-visible max-h-96 scrollbar-hide">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Page ID
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Brand Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Current Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          New Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.items.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.id}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.page_id}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.displayName || item.name}</td>
                          <td className="px-3 py-2 text-sm">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                              item.currentStatus === 'Active' ? 'bg-green-100 text-green-700' :
                              item.currentStatus === 'Inactive' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {item.currentStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {item.currentStatus === 'Incomplete' ? (
                              <span className="text-gray-500 text-xs">Cannot change</span>
                            ) : (
                              <div className="relative z-10">
                                <CustomDropdown
                                  options={[
                                    { value: '', label: 'Select...' },
                                    { value: 'Active', label: 'Active' },
                                    { value: 'Inactive', label: 'Inactive' }
                                  ]}
                                  value={item.newStatus || ''}
                                  onChange={(value) => handleBulkStatusChange(index, value)}
                                  placeholder="Select..."
                                  className="w-full"
                                />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Apply Button */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-blue-900">
                        {previewData.items.filter(item => item.newStatus && item.newStatus !== item.currentStatus).length} changes to apply
                      </div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        onClick={handleBulkApply}
                        disabled={disabled || bulkLoading}
                        variant="primary"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        {bulkLoading ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Applying...
                          </div>
                        ) : (
                          'Apply Changes'
                        )}
                      </Button>
                      <Button
                        onClick={handleClearBulk}
                        variant="secondary"
                        size="sm"
                        disabled={disabled}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Summary */}
            {previewData && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Processing Summary
                </h5>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700">CSV Rows:</span>
                      <span className="text-sm font-semibold text-blue-900">{csvData?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Found Brands:</span>
                      <span className="text-sm font-semibold text-green-900">{previewData.items.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-700">Not Found:</span>
                      <span className="text-sm font-semibold text-orange-900">{previewData.notFound?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-700">Duplicates:</span>
                      <span className="text-sm font-semibold text-purple-900">{(previewData.duplicates?.ids || 0) + (previewData.duplicates?.pageIds || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Not Found Items */}
            {previewData && previewData.notFound && previewData.notFound.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 shadow-sm">
                <h5 className="text-sm font-semibold text-amber-900 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Not Found ({previewData.notFound.length} items)
                </h5>
                <div className="text-sm text-amber-800 max-h-32 overflow-y-auto space-y-1">
                  {previewData.notFound.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-amber-100 rounded px-2 py-1">
                      <span className="font-medium">{item.type}:</span>
                      <span className="font-mono text-xs">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            {/* Close button */}
            <button
              onClick={() => {
                setConfirmDialog({ show: false, confirmText: '' });
                localStorage.removeItem('bulkEdit_confirmDialog');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h3 className="text-lg font-medium text-gray-900 mb-4 pr-8">
              Confirm Bulk Update
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will update multiple brand statuses. Type "confirm" to proceed.
            </p>
            <input
              type="text"
              value={confirmDialog.confirmText}
              onChange={(e) => {
                const newDialogState = { ...confirmDialog, confirmText: e.target.value };
                setConfirmDialog(newDialogState);
                localStorage.setItem('bulkEdit_confirmDialog', JSON.stringify(newDialogState));
              }}
              placeholder="Type 'confirm'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                onClick={() => {
                  setConfirmDialog({ show: false, confirmText: '' });
                  localStorage.removeItem('bulkEdit_confirmDialog');
                }}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmApply}
                disabled={disabled || bulkLoading}
                variant="primary"
                size="sm"
              >
                {bulkLoading ? 'Applying...' : 'Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditBrandStatusForm;


