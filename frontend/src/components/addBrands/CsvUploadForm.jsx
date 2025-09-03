import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { queueAPI } from '../../services/api';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

const CsvUploadForm = ({ loading, isSubmitting, onSubmittingChange }) => {
  const [csvState, setCsvState] = useState({
    file: null,
    uploadStatus: null,
    uploadResult: null
  });

  const fileInputRef = useRef(null);

  const { file: csvFile, uploadStatus: csvUploadStatus, uploadResult: csvUploadResult } = csvState;

  useEffect(() => {
    try {
      const savedResult = localStorage.getItem('addBrands_csvUploadResult');
      if (savedResult) {
        const parsedResult = JSON.parse(savedResult);

        if (parsedResult.timestamp && (Date.now() - new Date(parsedResult.timestamp).getTime()) < 10 * 60 * 1000) {
          setCsvState(prev => ({ ...prev, uploadResult: parsedResult }));
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
      setCsvState(prev => ({ ...prev, uploadResult: resultToSave }));
    } else {
      localStorage.removeItem('addBrands_csvUploadResult');
      setCsvState(prev => ({ ...prev, uploadResult: null }));
    }
  };

  const handleCsvFileSelect = (file) => {
    if (file) {
      setCsvState(prev => ({
        ...prev,
        file: file,
        uploadStatus: null,
        uploadResult: null
      }));
    } else {
      setCsvState(prev => ({
        ...prev,
        file: null,
        uploadStatus: null,
        uploadResult: null
      }));
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
      onSubmittingChange(true);
      setCsvState(prev => ({ ...prev, uploadStatus: { type: 'uploading', message: 'Uploading CSV file...' } }));

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

        setCsvState(prev => ({
          ...prev,
          uploadStatus: { type: 'success', message: successMessage }
        }));

        setTimeout(() => {
          setCsvState(prev => ({ ...prev, uploadStatus: null }));
          setCsvState(prev => ({ ...prev, file: null }));

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

      setCsvState(prev => ({
        ...prev,
        uploadStatus: { type: 'error', message: errorMessage }
      }));

      saveCsvUploadResult(null);
    } finally {
      onSubmittingChange(false);
    }
  };

  const clearCsvUpload = () => {
    setCsvState(prev => ({
      ...prev,
      file: null,
      uploadStatus: null
    }));
    saveCsvUploadResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearCsvUploadResult = () => {
    saveCsvUploadResult(null);
  };

  return (
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
                onClick={() => setCsvState(prev => ({ ...prev, file: null }))}
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
  );
};

export default CsvUploadForm;
