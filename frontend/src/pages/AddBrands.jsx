import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import AdminLoginModal from '../components/ui/AdminLoginModal';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import SingleBrandForm from '../components/addBrands/SingleBrandForm';
import CsvUploadForm from '../components/addBrands/CsvUploadForm';
import AddAllBrandsForm from '../components/addBrands/AddAllBrandsForm';
import MadanglesCsvUploadForm from '../components/addBrands/MadanglesCsvUploadForm';
import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import { Shield, LogOut } from 'lucide-react';
import { tabs } from '../constants/data';

const AddBrands = () => {
  const { loading } = useQueueStore();
  const { isAdmin, isLoading: adminLoading, logout } = useAdminStore();

  const getInitialLoginModalState = () => {
    try {
      // Check if this is a page refresh by looking for a specific flag
      const isPageRefresh = sessionStorage.getItem('addBrandsPageRefreshed') === 'true';
      if (isPageRefresh) {
        // Clear the flag and check for saved login modal state
        sessionStorage.removeItem('addBrandsPageRefreshed');
        const saved = localStorage.getItem('addBrands_showLoginModal');
        return saved ? JSON.parse(saved) : false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const [state, setState] = useState({
    formState: {
      activeTab: 'single',
      isSubmitting: false
    },
    showLoginModal: getInitialLoginModalState()
  });

  const { activeTab, isSubmitting } = state.formState;

  const updateFormState = (updates) => {
    setState(prev => ({
      ...prev,
      formState: { ...prev.formState, ...updates }
    }));
  };

  useEffect(() => {
    const savedTab = localStorage.getItem('addBrands_activeTab');
    if (savedTab && ['single', 'csv', 'all', 'madangles'].includes(savedTab)) {
      updateFormState({ activeTab: savedTab });
    }
  }, []);

  // Effect to detect page refresh and restore admin login modal state
  useEffect(() => {
    // Detect if this is a page refresh (not initial load)
    const isInitialLoad = !sessionStorage.getItem('addBrandsPageVisited');
    if (!isInitialLoad) {
      // This is a page refresh, set the flag
      sessionStorage.setItem('addBrandsPageRefreshed', 'true');
    } else {
      // This is initial load, mark page as visited
      sessionStorage.setItem('addBrandsPageVisited', 'true');
    }

    const savedLoginModalState = getInitialLoginModalState();
    if (savedLoginModalState) {
      setState(prev => ({ ...prev, showLoginModal: savedLoginModalState }));
    }
  }, []);

  // Cleanup effect to clear persistence when component unmounts (page navigation)
  useEffect(() => {
    return () => {
      // Only clear if this is not a page refresh (i.e., user is navigating away)
      const isPageRefresh = sessionStorage.getItem('addBrandsPageRefreshed') === 'true';
      if (!isPageRefresh) {
        localStorage.removeItem('addBrands_showLoginModal');
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('addBrands_activeTab', activeTab);
  }, [activeTab]);

  const openLoginModal = () => {
    setState(prev => ({ ...prev, showLoginModal: true }));
    localStorage.setItem('addBrands_showLoginModal', 'true');
  };

  const closeLoginModal = () => {
    setState(prev => ({ ...prev, showLoginModal: false }));
    localStorage.removeItem('addBrands_showLoginModal');
  };

  useEffect(() => {
    if (isAdmin && state.showLoginModal) {
      closeLoginModal();
    }
  }, [isAdmin, state.showLoginModal]);

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
                <SingleBrandForm 
                  loading={loading}
                  isSubmitting={isSubmitting}
                  onSubmittingChange={(value) => updateFormState({ isSubmitting: value })}
                />
              )}

              {activeTab === 'csv' && (
                <CsvUploadForm 
                  loading={loading}
                  isSubmitting={isSubmitting}
                  onSubmittingChange={(value) => updateFormState({ isSubmitting: value })}
                />
              )}

              {activeTab === 'all' && (
                <AddAllBrandsForm 
                  loading={loading}
                  isSubmitting={isSubmitting}
                  onSubmittingChange={(value) => updateFormState({ isSubmitting: value })}
                />
              )}

              {activeTab === 'madangles' && (
                <MadanglesCsvUploadForm />
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