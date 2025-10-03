import { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import AdminLoginModal from '../ui/AdminLoginModal';
import useAdminStore from '../../stores/adminStore';
import AdminLoginContext from '../../contexts/AdminLoginContext';

const Layout = ({ children }) => {
  const { isAdmin, isLoading } = useAdminStore();

  const getInitialLoginModalState = () => {
    try {
      // Check if this is a page refresh by looking for a specific flag
      const isPageRefresh = sessionStorage.getItem('layoutPageRefreshed') === 'true';
      if (isPageRefresh) {
        // Clear the flag and check for saved login modal state
        sessionStorage.removeItem('layoutPageRefreshed');
        const saved = localStorage.getItem('layout_showLoginModal');
        return saved ? JSON.parse(saved) : false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(getInitialLoginModalState());

  // Effect to detect page refresh and restore admin login modal state
  useEffect(() => {
    // Detect if this is a page refresh (not initial load)
    const isInitialLoad = !sessionStorage.getItem('layoutPageVisited');
    if (!isInitialLoad) {
      // This is a page refresh, set the flag
      sessionStorage.setItem('layoutPageRefreshed', 'true');
    } else {
      // This is initial load, mark page as visited
      sessionStorage.setItem('layoutPageVisited', 'true');
    }

    const savedLoginModalState = getInitialLoginModalState();
    if (savedLoginModalState) {
      setShowLoginModal(savedLoginModalState);
    }
  }, []);

  // Cleanup effect to clear persistence when component unmounts (page navigation)
  useEffect(() => {
    return () => {
      // Only clear if this is not a page refresh (i.e., user is navigating away)
      const isPageRefresh = sessionStorage.getItem('layoutPageRefreshed') === 'true';
      if (!isPageRefresh) {
        localStorage.removeItem('layout_showLoginModal');
      }
    };
  }, []);

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    localStorage.removeItem('layout_showLoginModal');
  };

  const handleAdminLogin = () => {
    setShowLoginModal(true);
    localStorage.setItem('layout_showLoginModal', 'true');
  };

  return (
    <AdminLoginContext.Provider value={{ onAdminLogin: handleAdminLogin }}>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="flex">
          <Sidebar onAdminLogin={handleAdminLogin} />
          <main className="flex-1 p-4 sm:p-4 md:p-6 ml-0 sm:ml-64 transition-all duration-300 overflow-x-hidden">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>

        {/* Global Admin Login Modal */}
        <AdminLoginModal
          isOpen={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            localStorage.removeItem('layout_showLoginModal');
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </AdminLoginContext.Provider>
  );
};

export default Layout;
