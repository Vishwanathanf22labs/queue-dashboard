import { useState, useEffect } from 'react';
import { Settings, Check, AlertCircle } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import toast from 'react-hot-toast';

const EnvironmentSelector = ({ onEnvironmentChange, currentEnvironment = 'production' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState(currentEnvironment);
  const [isChanging, setIsChanging] = useState(false);
  const [envStatus, setEnvStatus] = useState({
    production: 'unknown',
    stage: 'unknown'
  });

  const environments = [
    {
      key: 'production',
      label: 'Production',
      description: 'Live production environment',
      color: 'bg-red-50 border-red-200 text-red-800'
    },
    {
      key: 'stage',
      label: 'Stage',
      description: 'Development/staging environment',
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    }
  ];

  useEffect(() => {
    setSelectedEnv(currentEnvironment);
  }, [currentEnvironment]);

  const handleEnvironmentChange = async (environment) => {
    if (environment === currentEnvironment) {
      setIsOpen(false);
      return;
    }

    setIsChanging(true);
    try {
      await onEnvironmentChange(environment);
      setSelectedEnv(environment);
      setEnvStatus(prev => ({
        ...prev,
        [environment]: 'success'
      }));
      toast.success(`Switched to ${environment} environment`);
      setIsOpen(false);
    } catch (error) {
      console.error('Environment change error:', error);
      setEnvStatus(prev => ({
        ...prev,
        [environment]: 'error'
      }));
      toast.error(`Failed to switch to ${environment} environment`);
    } finally {
      setIsChanging(false);
    }
  };

  const getStatusIcon = (environment) => {
    const status = envStatus[environment];
    if (status === 'success') {
      return <Check className="w-4 h-4 text-green-600" />;
    } else if (status === 'error') {
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
    return null;
  };

  const getCurrentEnvironmentInfo = () => {
    const env = environments.find(e => e.key === currentEnvironment);
    return env || environments[0];
  };

  const currentEnvInfo = getCurrentEnvironmentInfo();

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className={`flex items-center gap-2 ${currentEnvInfo.color} hover:opacity-80 transition-opacity`}
        disabled={isChanging}
      >
        <Settings className="w-4 h-4" />
        <span className="font-medium">{currentEnvInfo.label}</span>
        {isChanging && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Environment</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Choose the environment to connect to
                </p>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </Button>
            </div>

            <div className="p-6 space-y-3">
              {environments.map((env) => (
                <div
                  key={env.key}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedEnv === env.key
                    ? `${env.color} border-current`
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                  onClick={() => setSelectedEnv(env.key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{env.label}</h4>
                        {getStatusIcon(env.key)}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{env.description}</p>
                    </div>
                    {selectedEnv === env.key && (
                      <div className="w-5 h-5 bg-current rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                disabled={isChanging}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleEnvironmentChange(selectedEnv)}
                disabled={isChanging || selectedEnv === currentEnvironment}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isChanging ? 'Switching...' : 'Switch Environment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvironmentSelector;
