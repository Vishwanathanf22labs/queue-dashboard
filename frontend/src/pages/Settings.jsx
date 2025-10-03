import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import LoadingState from '../components/ui/LoadingState';
import CustomDropdown from '../components/ui/CustomDropdown';
import Toggle from '../components/ui/Toggle';
import useAdminStore from '../stores/adminStore';
import useEnvironmentStore from '../stores/environmentStore';
import { queueAPI } from '../services/api';
import { validateField, getFieldType, getFieldPlaceholder, getFieldStep } from '../utils/validation/settingsValidation';
import toast from 'react-hot-toast';
import { Shield, Save, RefreshCw, Edit, X, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const { currentEnvironment, changeEnvironment, isLoading: environmentLoading } = useEnvironmentStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [configData, setConfigData] = useState({});
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Local loading state for immediate feedback
  const [isTogglingEnvironment, setIsTogglingEnvironment] = useState(false);

  // Field groups for organized display
  const fieldGroups = {
    'Processing and Holding Timing': [
      'MAX_CONCURRENCY',
      'BRAND_PROCESSING_CONCURRENCY',
      'TYPESENSE_PROCESS_CONCURRENCY',
      'IP_COOLDOWN_DURATION_HOURS',
      'SCRAPER_HOLD_SCHEDULE',
      'SCRAPER_PAUSE_DURATION_MINUTES',
      'USAGE_PROXY'
    ],
    'Scroll Duration': [
      'ONE_HOUR_MS',
      'FIFTY_MINUTES_MS',
      'THIRTY_MINUTES_MS',
      'TWENTY_MINUTES_MS'
    ],
    'Scroller Details': [
      'UP_SCROLL_PROBABILITY',
      'MOUSE_MOVEMENT_PROBABILITY',
      'MOUSE_MOVE_STEPS_MIN',
      'MOUSE_MOVE_STEPS_MAX',
      'EXTRA_PAUSE_MIN_MS',
      'EXTRA_PAUSE_MAX_MS',
      'LONG_PAUSE_PROBABILITY',
      'LONG_PAUSE_MIN_MS',
      'LONG_PAUSE_MAX_MS'
    ],
    'Scroll Behavior Configs': [
      'SCROLL_STEP_MIN_MULTIPLIER',
      'SCROLL_STEP_MAX_MULTIPLIER',
      'UP_SCROLL_TIME_THRESHOLD_MS',
      'UP_SCROLL_PROBABILITY_THRESHOLD',
      'UP_SCROLL_STEP_MIN_PX',
      'UP_SCROLL_STEP_MAX_PX',
      'SCROLL_DELAY_MIN_MS',
      'SCROLL_DELAY_MAX_MS'
    ]
  };

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Reset form data when editing group changes
  useEffect(() => {
    if (editingGroup) {
      const groupFields = fieldGroups[editingGroup];
      const newFormData = {};
      groupFields.forEach(key => {
        newFormData[key] = '';
      });
      setFormData(newFormData);
      setErrors({});
    }
  }, [editingGroup]);

  // Warn user before leaving page if they're editing
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (editingGroup) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editingGroup]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load only config data (environment info not needed for settings)
      const configResponse = await queueAPI.getConfigSettings();

      setConfigData(configResponse.data.data.config);
      setErrors({});
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));

    // Validate field
    const validation = validateField(key, value);
    if (validation.valid) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    } else {
      setErrors(prev => ({
        ...prev,
        [key]: validation.error
      }));
    }
  };

  const handleSave = async (groupName) => {
    try {
      setSaving(prev => ({ ...prev, [groupName]: true }));

      const groupFields = fieldGroups[groupName];
      const updates = {};

      // Get only non-empty values from form data
      groupFields.forEach(key => {
        if (formData[key] && formData[key].trim() !== '') {
          updates[key] = formData[key];
        }
      });

      if (Object.keys(updates).length === 0) {
        toast.info('No values to save');
        return;
      }

      // Check for validation errors in this group
      const hasErrors = groupFields.some(key => errors[key]);
      if (hasErrors) {
        toast.error('Please fix validation errors before saving');
        return;
      }

      await queueAPI.updateConfigSettings(updates);

      // Reload data to get updated values
      await loadData();

      // Exit edit mode
      setEditingGroup(null);

      toast.success(`${groupName} settings saved successfully`);
    } catch (error) {
      console.error('Error saving settings:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save settings';
      toast.error(errorMessage);
    } finally {
      setSaving(prev => ({ ...prev, [groupName]: false }));
    }
  };

  const handleEdit = (groupName) => {
    setEditingGroup(groupName);
  };

  const handleCancel = () => {
    setEditingGroup(null);
    setFormData({});
    setErrors({});
  };

  const handleRefresh = async () => {
    await loadData();
    toast.success('Settings refreshed');
  };

  const handleEnvironmentToggle = async () => {
    const newEnvironment = currentEnvironment === 'production' ? 'stage' : 'production';

    // Set local loading state immediately
    setIsTogglingEnvironment(true);

    try {
      await changeEnvironment(newEnvironment);
      toast.success(`Switched to ${newEnvironment} environment`);
      // Navigate to dashboard to show full page loading
      window.location.href = '/';
    } catch (error) {
      toast.error(`Failed to switch to ${newEnvironment} environment: ${error.message}`);
      // Reset loading state on error
      setIsTogglingEnvironment(false);
    }
  };

  const renderField = (key) => {
    const value = formData[key] || '';
    const error = errors[key];
    const fieldType = getFieldType(key);
    const placeholder = getFieldPlaceholder(key);
    const step = getFieldStep(key);

    if (fieldType === 'select') {
      const options = [
        { value: 'true', label: 'true' },
        { value: 'false', label: 'false' }
      ];

      return (
        <CustomDropdown
          options={options}
          value={value}
          onChange={(newValue) => handleFieldChange(key, newValue)}
          placeholder="Select..."
          className={error ? 'border-red-500' : ''}
        />
      );
    }

    return (
      <input
        type={fieldType}
        value={value}
        onChange={(e) => handleFieldChange(key, e.target.value)}
        placeholder={placeholder}
        step={fieldType === 'number' ? step : undefined}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'
          }`}
      />
    );
  };

  const renderCurrentValue = (key) => {
    const currentValue = configData[key] || 'Not set';
    const hasValue = configData[key] && configData[key] !== '';

    return (
      <div className={`text-sm px-3 py-2 rounded-md border-l-4 ${hasValue
          ? 'text-gray-800 bg-green-50 border-green-400'
          : 'text-gray-500 bg-gray-50 border-gray-300'
        }`}>
        <span className="font-medium">{hasValue ? 'Current:' : 'Status:'}</span>
        <span className="ml-2 font-mono text-xs">{currentValue}</span>
      </div>
    );
  };

  const renderFieldGroup = (groupName, fields) => {
    const isEditing = editingGroup === groupName;
    const isSaving = saving[groupName] || false;
    const hasErrors = Object.keys(errors).length > 0;

    return (
      <Card key={groupName}>
        <div className="p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">{groupName}</h3>
            <div className="flex space-x-2">
              {!isEditing ? (
                <Button
                  onClick={() => handleEdit(groupName)}
                  disabled={!isAdmin}
                  size="sm"
                  className="flex items-center gap-2 text-xs sm:text-sm"
                  title={!isAdmin ? 'Admin access required' : 'Edit settings'}
                >
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => handleSave(groupName)}
                    disabled={!isAdmin || isSaving || hasErrors}
                    size="sm"
                    className="flex items-center gap-2 text-xs sm:text-sm"
                    title={!isAdmin ? 'Admin access required' : 'Save settings'}
                  >
                    <Save className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </>
              )}
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {fields.map(key => (
              <div key={key} className="space-y-1 sm:space-y-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                  {key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </label>
                {isEditing ? (
                  <div className="space-y-1">
                    {renderField(key)}
                    {errors[key] && (
                      <p className="text-xs sm:text-sm text-red-600">{errors[key]}</p>
                    )}
                  </div>
                ) : (
                  renderCurrentValue(key)
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

  if (adminLoading) {
    return <LoadingSpinner />;
  }


  if (loading) {
    return <LoadingSpinner />;
  }

  // Combine local and store loading states
  const isEnvironmentSwitching = isTogglingEnvironment || environmentLoading;

  // Show loading when switching environment
  if (isEnvironmentSwitching) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">Manage Redis configuration settings</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin ? (
              <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-800 rounded-lg">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm font-medium">Admin Mode</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-100 text-red-600 rounded-lg">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm font-medium">Admin Access Required</span>
              </div>
            )}

            <Button
              onClick={handleRefresh}
              disabled={loading}
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* Environment Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Environment</h3>
            <p className="text-sm text-gray-600 mt-1">
              Switch between Production and Stage environments
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700">Production</span>
            <Toggle
              isOn={currentEnvironment === 'stage'}
              onToggle={isAdmin ? handleEnvironmentToggle : undefined}
              disabled={!isAdmin}
              size="md"
            />
            <span className="text-sm font-medium text-gray-700">Stage</span>
          </div>
        </div>
      </div>

      {/* Settings Groups */}
      <div className="space-y-4 sm:space-y-6">
        {Object.entries(fieldGroups).map(([groupName, fields]) =>
          renderFieldGroup(groupName, fields)
        )}
      </div>

    </div>
  );
};

export default Settings;