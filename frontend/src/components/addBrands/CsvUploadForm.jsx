import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { queueAPI } from '../../services/api';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

const CsvUploadForm = ({ loading, isSubmitting, onSubmittingChange, disabled = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [csvState, setCsvState] = useState({
    file: null,
    uploadStatus: null,
    uploadResult: null
  });

  const fileInputRef = useRef(null);

  const { file: csvFile, uploadStatus: csvUploadStatus, uploadResult: csvUploadResult } = csvState;
  
  // Get queueType from URL params or default to 'regular'
  const queueType = searchParams.get('queueType') || 'regular';

  // Function to update URL params when queueType changes
  const updateQueueType = (newQueueType) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (newQueueType === 'regular') {
      newSearchParams.delete('queueType');
    } else {
      newSearchParams.set('queueType', newQueueType);
    }
    setSearchParams(newSearchParams);
  };

  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('addBrands_csvUploadResult');
      if (savedResult) {
        const parsedResult = JSON.parse(savedResult);
        if (parsedResult.timestamp && (Date.now() - new Date(parsedResult.timestamp).getTime()) < 3 * 60 * 1000) {
          setCsvState(prev => ({ ...prev, uploadResult: parsedResult }));
        } else {
          localStorage.removeItem('addBrands_csvUploadResult');
        }
      }
    } catch (error) {
      console.error('Error loading CSV upload result from localStorage:', error);
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
      setCsvState(prev => ({ ...prev, uploadResult: resultToSave }));
    } else {
      localStorage.removeItem('addBrands_csvUploadResult');
      setCsvState(prev => ({ ...prev, uploadResult: null }));
    }
  };

  const clearCsvUpload = () => {
    setCsvState({
      file: null,
      uploadStatus: null,
      uploadResult: null
    });
    localStorage.removeItem('addBrands_csvUploadResult');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCsvFileSelect = (file) => {
    if (file) {
      clearCsvUpload();
      setCsvState(prev => ({
        ...prev,
        file: file
      }));
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    if (isSubmitting || loading) {
      toast.error('Please wait, an upload is already in progress.');
      return;
    }

    onSubmittingChange(true);
    setCsvState(prev => ({
      ...prev,
      uploadStatus: { type: 'uploading', message: 'Uploading CSV file...' },
      uploadResult: null
    }));

    try {
      const result = await queueAPI.addBulkBrandsFromCSV(csvFile, queueType);

      if (result && result.data && result.data.data) {
        const summaryData = result.data.data.summary;

        const totalAdded = parseInt(summaryData.totalAdded || 0, 10);
        const totalErrors = parseInt(summaryData.totalErrors || 0, 10);
        const csvErrors = parseInt(summaryData.csvErrors || 0, 10);
        const duplicates = parseInt(summaryData.duplicates || 0, 10);
        const allErrors = totalErrors + csvErrors;

        let toastMessage = '';
        let toastType = 'default';

        if (totalAdded > 0) {
          toastType = 'success';
          toastMessage = `${totalAdded} brand(s) successfully added to the queue.`;
          if (duplicates > 0) toastMessage += ` ${duplicates} were duplicates.`;
          if (allErrors > 0) toastMessage += ` ${allErrors} had errors.`;
        } else if (duplicates > 0 && allErrors === 0) {
          toastType = 'default';
          toastMessage = `No new brands added. ${duplicates} brand(s) were already in the queue.`;
        } else if (allErrors > 0) {
          toastType = 'error';
          toastMessage = `Upload failed with ${allErrors} error(s). No brands were added.`;
        } else {
          toastMessage = 'Processing complete, but no new brands were added.';
        }

        if (toastType === 'success') toast.success(toastMessage);
        else if (toastType === 'error') toast.error(toastMessage);
        else toast(toastMessage);

        const newUploadResult = {
          type: toastType,
          message: toastMessage,
          summary: { totalAdded, totalErrors, csvErrors, duplicates, fileName: csvFile.name, uploadedAt: new Date().toISOString() },
          timestamp: new Date().toISOString()
        };

        setCsvState(prev => ({
          ...prev,
          file: null,
          uploadStatus: { type: toastType, message: toastMessage },
          uploadResult: newUploadResult
        }));

        localStorage.setItem('addBrands_csvUploadResult', JSON.stringify(newUploadResult));

        setTimeout(() => {
          setCsvState(prev => ({
            ...prev,
            uploadStatus: null,
            uploadResult: null
          }));
          localStorage.removeItem('addBrands_csvUploadResult');
        }, 4000);

      } else {
        throw new Error('Invalid or empty response structure from the server.');
      }

    } catch (error) {
      console.error('CSV Upload Error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload CSV file';
      toast.error(errorMessage);
      setCsvState(prev => ({
        ...prev,
        uploadStatus: { type: 'error', message: errorMessage },
        uploadResult: null
      }));
      localStorage.removeItem('addBrands_csvUploadResult');
    } finally {
      onSubmittingChange(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearCsvUploadResult = () => {
    setCsvState(prev => ({ ...prev, uploadResult: null }));
    localStorage.removeItem('addBrands_csvUploadResult');
  };

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Upload CSV File</h3>
        <p className="text-sm text-gray-600 mb-3 sm:mb-4">
          Upload a CSV file to add multiple brands to the regular pending queue or watchlist pending queue for scraping
        </p>

        <div className="mb-4">
          <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
            Queue Type <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-4 mb-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="csvQueueType"
                value="regular"
                checked={queueType === 'regular'}
                onChange={(e) => updateQueueType(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                disabled={disabled || isSubmitting || loading}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Regular Queue</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="csvQueueType"
                value="watchlist"
                checked={queueType === 'watchlist'}
                onChange={(e) => updateQueueType(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                disabled={disabled || isSubmitting || loading}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Watchlist Queue</span>
            </label>
          </div>
        </div>

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
                    disabled={disabled}
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
                onClick={clearCsvUpload}
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
          disabled={disabled}
        />

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
              {csvUploadStatus.type === 'uploading' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
              {csvUploadStatus.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {csvUploadStatus.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              <span className="text-sm font-medium">{csvUploadStatus.message}</span>
            </div>
          </div>
        )}

        {csvFile && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <Button onClick={handleCsvUpload} variant="primary" disabled={loading || isSubmitting} className="flex-1 sm:flex-none">
              <Upload className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Uploading...' : 'Upload CSV'}
            </Button>
            <Button onClick={clearCsvUpload} variant="outline" disabled={loading || isSubmitting} className="flex-1 sm:flex-none">
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        )}

        {csvUploadResult && (
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
                    {csvUploadResult.summary?.duplicates > 0 && (
                      <span className="ml-2 text-purple-600">({csvUploadResult.summary.duplicates} already in queue)</span>
                    )}
                    {(csvUploadResult.summary?.totalErrors > 0 || csvUploadResult.summary?.csvErrors > 0) && (
                      <span className="ml-2 text-yellow-600">({(csvUploadResult.summary.totalErrors || 0) + (csvUploadResult.summary.csvErrors || 0)} errors)</span>
                    )}
                  </p>
                  {csvUploadResult.summary?.fileName && (
                    <p className="text-xs text-green-600 mt-1">File: {csvUploadResult.summary.fileName}</p>
                  )}
                  {csvUploadResult.summary?.uploadedAt && (
                    <p className="text-xs text-green-600">Uploaded: {new Date(csvUploadResult.summary.uploadedAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={clearCsvUploadResult} className="text-green-600 hover:text-green-700 self-start sm:self-auto">
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvUploadForm;
