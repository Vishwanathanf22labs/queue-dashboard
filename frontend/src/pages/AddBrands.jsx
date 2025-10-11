import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SingleBrandForm from '../components/addBrands/SingleBrandForm';
import CsvUploadForm from '../components/addBrands/CsvUploadForm';
import AddAllBrandsForm from '../components/addBrands/AddAllBrandsForm';
import MadanglesCsvUploadForm from '../components/addBrands/MadanglesCsvUploadForm';
import EditBrandStatusForm from '../components/addBrands/EditBrandStatusForm';
import { useAdminLogin } from '../contexts/AdminLoginContext';
import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import { Shield } from 'lucide-react';
import { tabs } from '../constants/data';
import toast from 'react-hot-toast';

const AddBrands = () => {
  const { loading } = useQueueStore();
  const { onAdminLogin } = useAdminLogin();
  const { isAdmin, isLoading: adminLoading } = useAdminStore();

  const [state, setState] = useState({
    activeTab: 'single',
    isSubmitting: false
  });

  const { activeTab, isSubmitting } = state;

  const updateFormState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    const savedTab = localStorage.getItem('addBrands_activeTab');
    if (savedTab && ['single', 'csv', 'all', 'madangles', 'edit'].includes(savedTab)) {
      updateFormState({ activeTab: savedTab });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('addBrands_activeTab', activeTab);
  }, [activeTab]);

  if (adminLoading) {
    return <LoadingSpinner />;
  }

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
              <div className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-green-600 bg-green-100 rounded-lg">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Admin Mode
              </div>
            ) : (
              <button
                onClick={onAdminLogin}
                className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
              >
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Admin Access Required
              </button>
            )}
          </div>
        </div>


        <Card className="mb-4 sm:mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap gap-2 sm:gap-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'tab-active' : 'tab'}
                    size="sm"
                    onClick={() => updateFormState({ activeTab: tab.id })}
                    className="py-2 px-3 text-xs sm:text-sm flex items-center space-x-1.5 whitespace-nowrap relative flex-1 sm:flex-none justify-center"
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
            <SingleBrandForm
              loading={loading}
              isSubmitting={isSubmitting}
              onSubmittingChange={(value) => updateFormState({ isSubmitting: value })}
              disabled={!isAdmin}
            />
          )}

          {activeTab === 'csv' && (
            <CsvUploadForm
              loading={loading}
              isSubmitting={isSubmitting}
              onSubmittingChange={(value) => updateFormState({ isSubmitting: value })}
              disabled={!isAdmin}
            />
          )}

          {activeTab === 'all' && (
            <AddAllBrandsForm
              loading={loading}
              isSubmitting={isSubmitting}
              onSubmittingChange={(value) => updateFormState({ isSubmitting: value })}
              disabled={!isAdmin}
            />
          )}

          {activeTab === 'madangles' && (
            <MadanglesCsvUploadForm disabled={!isAdmin} />
          )}

          {activeTab === 'edit' && (
            <EditBrandStatusForm disabled={!isAdmin} />
          )}
        </Card>
      </div>

    </div>
  );
};

export default AddBrands;