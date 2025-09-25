import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { uploadCsvToMadangles, checkScrapingStatus, addScrapedBrandsToQueue } from '../../services/madanglesApi';
import { Upload, FileText, X, CheckCircle, AlertCircle, Eye, Plus, Clock, Users } from 'lucide-react';

const MadanglesCsvUploadForm = () => {
  const [csvState, setCsvState] = useState({
    file: null,
    uploadStatus: null,
    uploadResult: null,
    csvPreview: null,
    showPreview: false,
    showConfirmModal: false,
    showQueueButtons: false,
    scrapedBrands: [],
    pollingStatus: null,
    queueAdditionStatus: null
  });

  const fileInputRef = useRef(null);

  const { 
    file: csvFile, 
    uploadStatus: csvUploadStatus, 
    uploadResult: csvUploadResult, 
    csvPreview, 
    showPreview, 
    showConfirmModal,
    showQueueButtons,
    scrapedBrands,
    pollingStatus,
    queueAdditionStatus
  } = csvState;

  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('madangles_csvUploadResult');
      if (savedResult) {
        const parsedResult = JSON.parse(savedResult);
        if (parsedResult.timestamp && (Date.now() - new Date(parsedResult.timestamp).getTime()) < 10 * 60 * 1000) {
          setCsvState(prev => ({ ...prev, uploadResult: parsedResult }));
        } else {
          localStorage.removeItem('madangles_csvUploadResult');
        }
      }
    } catch (error) {
      console.error('Error loading madangles CSV upload result:', error);
      localStorage.removeItem('madangles_csvUploadResult');
    }
  }, []);

  const saveUploadResult = (result) => {
    if (result) {
      const resultToSave = {
        ...result,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('madangles_csvUploadResult', JSON.stringify(resultToSave));
      setCsvState(prev => ({ ...prev, uploadResult: resultToSave }));
    } else {
      localStorage.removeItem('madangles_csvUploadResult');
      setCsvState(prev => ({ ...prev, uploadResult: null }));
    }
  };

  const parseCsvPreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvText = e.target.result;
          const lines = csvText.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }

          // Parse header
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const expectedHeaders = ['Category ID', 'Brand Category', 'Ad Library URL'];


          // Condition 1: Check for correct headers (case-insensitive)
          const normalizedHeaders = headers.map(h => h.toLowerCase());
          const normalizedExpected = expectedHeaders.map(h => h.toLowerCase());
          
          if (headers.length !== expectedHeaders.length || !normalizedExpected.every(h => normalizedHeaders.includes(h))) {
            reject(new Error(`Invalid CSV format. Required headers: "${expectedHeaders.join(', ')}". Found: "${headers.join(', ')}"`));
            return;
          }

          // Parse data rows with validation
          const data = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values = line.split(',').map(v => v.trim());
            const row = {};

            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });

            // Condition 2: Validate Category ID (case-insensitive)
            const categoryId = row['Category ID'] || row['category id'];
            if (!categoryId || isNaN(Number(categoryId))) {
              reject(new Error(`Invalid 'Category ID' in row ${i + 1}. Must be a number.`));
              return;
            }

            // Condition 3: Validate Ad Library URL and extract page_id (case-insensitive)
            const adLibraryUrl = row['Ad Library URL'] || row['ad library url'] || row['Ad library Url'];
            if (!adLibraryUrl) {
              reject(new Error(`Missing 'Ad Library URL' in row ${i + 1}.`));
              return;
            }

            // Check if it's a valid Facebook Ad Library URL
            if (!adLibraryUrl.includes('facebook.com/ads/library/') || !adLibraryUrl.includes('view_all_page_id=')) {
              reject(new Error(`Invalid 'Ad Library URL' in row ${i + 1}. Must be a Facebook Ad Library URL with 'view_all_page_id' parameter.`));
              return;
            }

            const urlMatch = adLibraryUrl.match(/view_all_page_id=(\d+)/);
            if (!urlMatch || !urlMatch[1]) {
              reject(new Error(`Invalid 'Ad Library URL' in row ${i + 1}. Missing or invalid page ID.`));
              return;
            }
            
            row['page_id'] = urlMatch[1];
            // Keep the original Ad Library URL for display
            row['Ad Library URL'] = adLibraryUrl;
            data.push({ ...row, rowNumber: i + 1 });
          }

          resolve({ headers: expectedHeaders, data });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleCsvFileSelect = async (file) => {
    if (file) {
      try {
        const preview = await parseCsvPreview(file);
        setCsvState(prev => ({
          ...prev,
          file: file,
          csvPreview: preview,
          uploadStatus: null,
          uploadResult: null
        }));
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error(error.message || 'Invalid CSV file format');
        setCsvState(prev => ({
          ...prev,
          file: null,
          csvPreview: null,
          uploadStatus: null,
          uploadResult: null
        }));
      }
    } else {
      setCsvState(prev => ({
        ...prev,
        file: null,
        csvPreview: null,
        uploadStatus: null,
        uploadResult: null
      }));
    }
  };

  const handleCsvUpload = () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    // Show confirmation modal
    setCsvState(prev => ({ ...prev, showConfirmModal: true }));
  };

  const handleCancelUpload = () => {
    setCsvState(prev => ({ ...prev, showConfirmModal: false }));
  };

  const handleConfirmUpload = async () => {
    try {
      setCsvState(prev => ({ 
        ...prev, 
        showConfirmModal: false,
        uploadStatus: { type: 'uploading', message: 'Uploading CSV to madangles-scraper...' } 
      }));

      const result = await uploadCsvToMadangles(csvFile);

      if (result && result.success) {
        toast.success('CSV uploaded successfully to madangles-scraper!');
        
        const uploadResult = {
          type: 'success',
          message: result.message,
          data: result.data,
          csvPreview: csvPreview,
          fileName: csvFile.name,
          uploadedAt: new Date().toISOString()
        };

        saveUploadResult(uploadResult);

        setCsvState(prev => ({
          ...prev,
          uploadStatus: { type: 'success', message: result.message }
        }));

        // Start polling for scraping completion
        const pageIds = csvPreview.data.map(row => row.page_id);
        startDatabasePolling(pageIds);

      } else {
        throw new Error('Invalid response from server');
      }

    } catch (error) {
      console.error('Madangles CSV Upload Error:', error);
      const errorMessage = error.message || 'Failed to upload CSV to madangles-scraper';
      toast.error(errorMessage);

      setCsvState(prev => ({
        ...prev,
        uploadStatus: { type: 'error', message: errorMessage }
      }));

      saveUploadResult(null);
    }
  };

  // Database polling function
  const startDatabasePolling = async (pageIds) => {
    const maxAttempts = 30; // 1 minute total
    const interval = 2000; // 2 seconds
    
    setCsvState(prev => ({
      ...prev,
      pollingStatus: { type: 'polling', message: 'Waiting for scraping to complete...' }
    }));
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await checkScrapingStatus(pageIds);
        const { completed, scrapedBrands, totalFound, totalExpected, progress } = response.data;
        
        if (completed) {
          setCsvState(prev => ({
            ...prev,
            pollingStatus: null, // Hide polling status
            showQueueButtons: true,
            scrapedBrands: scrapedBrands
          }));
          return;
        } else {
          // Update progress
          const progressPercent = Math.min(90, progress || (i / maxAttempts) * 100);
          setCsvState(prev => ({
            ...prev,
            pollingStatus: { 
              type: 'polling', 
              message: `Scraping progress: ${totalFound}/${totalExpected} brands (${progressPercent.toFixed(0)}%)` 
            }
          }));
        }
      } catch (error) {
        console.log(`Polling attempt ${i + 1} failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    // Timeout
    setCsvState(prev => ({
      ...prev,
      pollingStatus: { 
        type: 'warning', 
        message: 'Scraping is taking longer than expected. You can check manually later.' 
      },
      showQueueButtons: true // Show buttons anyway, let user decide
    }));
    toast.warning('Scraping is taking longer than expected. You can add to queue manually.');
  };

  // Add brands to queue function
  const handleAddToQueue = async (queueType) => {
    try {
      const pageIds = scrapedBrands.map(brand => brand.page_id);
      
      setCsvState(prev => ({
        ...prev,
        queueAdditionStatus: { type: 'adding', message: `Adding brands to ${queueType} queue...` }
      }));

      const result = await addScrapedBrandsToQueue(pageIds, queueType);
      
      if (result && result.success) {
        const { successCount, failedCount, skippedCount } = result.data;
        let message = `Successfully added ${successCount} brands to ${queueType} pending queue!`;
        
        if (skippedCount > 0) {
          message += ` (${skippedCount} already in queue)`;
        }
        if (failedCount > 0) {
          message += ` (${failedCount} failed)`;
        }
        
        toast.success(message);
        
        setCsvState(prev => ({
          ...prev,
          queueAdditionStatus: { type: 'success', message: message }
        }));

        // Clear form after 3 seconds
        setTimeout(() => {
          setCsvState(prev => ({ 
            ...prev, 
            uploadStatus: null,
            file: null,
            csvPreview: null,
            showQueueButtons: false,
            scrapedBrands: [],
            pollingStatus: null,
            queueAdditionStatus: null
          }));
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 3000);

      } else {
        throw new Error('Invalid response from server');
      }

    } catch (error) {
      console.error('Error adding brands to queue:', error);
      const errorMessage = error.message || `Failed to add brands to ${queueType} queue`;
      toast.error(errorMessage);

      setCsvState(prev => ({
        ...prev,
        queueAdditionStatus: { type: 'error', message: errorMessage }
      }));
    }
  };

  const clearUpload = () => {
    setCsvState(prev => ({
      ...prev,
      file: null,
      csvPreview: null,
      uploadStatus: null,
      showQueueButtons: false,
      scrapedBrands: [],
      pollingStatus: null,
      queueAdditionStatus: null
    }));
    saveUploadResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearUploadResult = () => {
    saveUploadResult(null);
  };

  const togglePreview = () => {
    setCsvState(prev => ({ ...prev, showPreview: !prev.showPreview }));
  };



  return (
    <div className="space-y-6">

      {/* File Upload Area */}
      <div>
        {!csvFile ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
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
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 bg-gray-100 rounded-full">
                <Upload className="h-8 w-8 text-gray-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Upload CSV File</p>
                <p className="text-sm text-gray-500 mt-1">
                  Drag and drop your CSV file here, or{' '}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => document.getElementById('madangles-csv-file-input').click()}
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
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-base font-medium text-gray-900">{csvFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(csvFile.size / 1024).toFixed(1)} KB • {csvFile.type || 'text/csv'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {csvPreview && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={togglePreview}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {showPreview ? 'Hide' : 'Preview'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCsvState(prev => ({ ...prev, file: null, csvPreview: null }))}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}

        <input
          id="madangles-csv-file-input"
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

        {/* CSV Preview */}
        {csvPreview && showPreview && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900">CSV Preview ({csvPreview.data.length} rows)</h4>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {csvPreview.headers.map((header, index) => (
                      <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvPreview.data.map((row, index) => (
                    <tr key={index}>
                      {csvPreview.headers.map((header, headerIndex) => (
                        <td key={headerIndex} className="px-3 py-2 text-sm text-gray-900">
                          <div className="max-w-md break-all" title={row[header]}>
                            {row[header]}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload Status */}
        {csvUploadStatus && (
          <div className={`mt-4 p-3 rounded-lg ${csvUploadStatus.type === 'uploading'
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

        {/* Polling Status */}
        {pollingStatus && (
          <div className={`mt-4 p-3 rounded-lg ${pollingStatus.type === 'polling'
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : pollingStatus.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : pollingStatus.type === 'warning'
                ? 'bg-orange-50 border border-orange-200 text-orange-800'
                : 'bg-gray-50 border border-gray-200 text-gray-800'
            }`}>
            <div className="flex items-center space-x-2">
              {pollingStatus.type === 'polling' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
              )}
              {pollingStatus.type === 'success' && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {pollingStatus.type === 'warning' && (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              <span className="text-sm font-medium">{pollingStatus.message}</span>
            </div>
          </div>
        )}

        {/* Queue Addition Status */}
        {queueAdditionStatus && (
          <div className={`mt-4 p-3 rounded-lg ${queueAdditionStatus.type === 'adding'
            ? 'bg-blue-50 border border-blue-200 text-blue-800'
            : queueAdditionStatus.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : queueAdditionStatus.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-gray-50 border border-gray-200 text-gray-800'
            }`}>
            <div className="flex items-center space-x-2">
              {queueAdditionStatus.type === 'adding' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              {queueAdditionStatus.type === 'success' && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {queueAdditionStatus.type === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">{queueAdditionStatus.message}</span>
            </div>
          </div>
        )}

        {/* Queue Selection Interface */}
        {showQueueButtons && scrapedBrands.length > 0 && (
          <div className="mt-6 border border-gray-200 rounded-lg p-6 bg-white">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose which queue to add the brands to:</h3>
              <p className="text-sm text-gray-600">Select where you want to add the {scrapedBrands.length} scraped brands</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                onClick={() => handleAddToQueue('regular')}
                variant="outline"
                disabled={queueAdditionStatus?.type === 'adding'}
                className="h-16 flex items-center justify-center space-x-3 border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
              >
                <Users className="h-6 w-6 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Add to Regular Queue</div>
                  <div className="text-sm text-gray-500">Standard processing queue</div>
                </div>
              </Button>
              
              <Button
                onClick={() => handleAddToQueue('watchlist')}
                variant="outline"
                disabled={queueAdditionStatus?.type === 'adding'}
                className="h-16 flex items-center justify-center space-x-3 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              >
                <Clock className="h-6 w-6 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Add to Watchlist Queue</div>
                  <div className="text-sm text-gray-500">Priority watchlist processing</div>
                </div>
              </Button>
            </div>

            {/* Scraped Brands Preview */}
            <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Scraped Brands ({scrapedBrands.length}):</h5>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {scrapedBrands.map((brand, index) => (
                  <div key={index} className="flex items-center justify-between text-xs bg-white rounded border border-gray-100 p-2">
                    <div className="flex items-center space-x-2">
                      {brand.logo_url && (
                        <img 
                          src={brand.logo_url} 
                          alt={brand.name}
                          className="w-4 h-4 rounded"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <span className="font-medium text-gray-900">{brand.name}</span>
                    </div>
                    <span className="text-gray-500 font-mono text-xs">{brand.page_id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upload Button - Only show if no upload result */}
        {csvFile && !csvUploadResult && (
          <div className="mt-6 flex space-x-3">
            <Button
              onClick={handleCsvUpload}
              variant="primary"
              disabled={csvUploadStatus?.type === 'uploading'}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {csvUploadStatus?.type === 'uploading' ? 'Uploading...' : 'Upload to Madangles Scraper'}
            </Button>
            <Button
              onClick={clearUpload}
              variant="outline"
              disabled={csvUploadStatus?.type === 'uploading'}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Upload Result Confirmation */}
      {csvUploadResult && csvUploadResult.type === 'success' && (
        <div className="mt-6 border border-green-200 rounded-lg p-4 bg-green-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-medium text-green-800 mb-2">Upload Successful!</h4>
                <p className="text-sm text-green-700 mb-3">{csvUploadResult.message}</p>
                
                {/* File Details */}
                <div className="bg-white rounded border border-green-200 p-3 mb-3">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">File Details:</h5>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>File:</strong> {csvUploadResult.fileName}</p>
                    <p><strong>Uploaded:</strong> {new Date(csvUploadResult.uploadedAt).toLocaleString()}</p>
                    <p><strong>Rows:</strong> {csvUploadResult.csvPreview?.data.length || 0}</p>
                  </div>
                </div>


              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearUploadResult}
              className="text-green-600 hover:text-green-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-hidden">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[85vh] overflow-y-auto scrollbar-hide" 
                 style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Confirm Upload</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to upload this CSV file to madangles-scraper?
              </p>
              
              {csvFile && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">{csvFile.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {(csvFile.size / 1024).toFixed(1)} KB • {csvPreview?.data.length || 0} rows
                  </div>
                  
                  {/* CSV Data Preview - Cards */}
                  {csvPreview && csvPreview.data.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-gray-700">Data Preview</h5>
                      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide" 
                           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {csvPreview.data.map((row, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Left Column */}
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Category ID</label>
                                  <p className="text-sm text-gray-900 font-medium">{row['Category ID'] || 'N/A'}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Brand Category</label>
                                  <p className="text-sm text-gray-900">{row['Brand Category'] || 'N/A'}</p>
                                </div>
                              </div>
                              
                              {/* Right Column */}
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Page ID</label>
                                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">{row['page_id'] || 'N/A'}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Library URL</label>
                                  <p className="text-xs text-blue-600 break-all bg-blue-50 px-2 py-1 rounded" title={row['Ad Library URL']}>
                                    {row['Ad Library URL'] || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleCancelUpload}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmUpload}
                variant="primary"
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Confirm Upload
              </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MadanglesCsvUploadForm;
