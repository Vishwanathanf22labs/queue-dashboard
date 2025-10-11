import { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import AdminLoginModal from '../ui/AdminLoginModal';
import useAdminStore from '../../stores/adminStore';
import AdminLoginContext from '../../contexts/AdminLoginContext';

const Layout = ({ children }) => {
  const { isAdmin, isLoading } = useAdminStore();

  const getInitialLoginModalState = () => {
    try {
      const isPageRefresh = sessionStorage.getItem('layoutPageRefreshed') === 'true';
      if (isPageRefresh) {
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

  useEffect(() => {
    const isInitialLoad = !sessionStorage.getItem('layoutPageVisited');
    if (!isInitialLoad) {
      sessionStorage.setItem('layoutPageRefreshed', 'true');
    } else {
      sessionStorage.setItem('layoutPageVisited', 'true');
    }

    const savedLoginModalState = getInitialLoginModalState();
    if (savedLoginModalState) {
      setShowLoginModal(savedLoginModalState);
    }
  }, []);

  useEffect(() => {
    return () => {
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
