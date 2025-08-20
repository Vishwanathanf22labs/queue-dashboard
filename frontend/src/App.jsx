import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import PendingQueue from './pages/PendingQueue';
import FailedQueue from './pages/FailedQueue';
import AddBrands from './pages/AddBrands';
import QueueManagement from './pages/QueueManagement';
import ScraperControlsPage from './pages/ScraperControls';
import useAdminStore from './stores/adminStore';

function App() {
  const { checkAdminStatus } = useAdminStore();
  const location = useLocation();

  useEffect(() => {
    // Skip admin status check on read-only pages that don't need admin access
    const readOnlyPages = ['/', '/pending-queue', '/failed-queue'];
    
    if (!readOnlyPages.includes(location.pathname)) {
      checkAdminStatus();
    } else {
      console.log(`${location.pathname} page - skipping admin status check (read-only page)`);
    }
  }, [location.pathname]); // Run when location changes

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pending-queue" element={<PendingQueue />} />
        <Route path="/failed-queue" element={<FailedQueue />} />
        <Route path="/add-brands" element={<AddBrands />} />
        <Route path="/queue-management" element={<QueueManagement />} />
        <Route path="/scraper-controls" element={<ScraperControlsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
