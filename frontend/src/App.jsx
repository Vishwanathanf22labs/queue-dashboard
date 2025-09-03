import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import PendingQueue from './pages/PendingQueue';
import FailedQueue from './pages/FailedQueue';
import AddBrands from './pages/AddBrands';
import QueueManagement from './pages/QueueManagement';
import ScraperControlsPage from './pages/ScraperControls';
import PipelineStatusPage from './pages/PipelineStatusPage';
import Proxies from './pages/Proxies';
import WatchlistBrands from './pages/WatchlistBrands';
import WatchlistQueues from './pages/WatchlistQueues';
import useAdminStore from './stores/adminStore';

function App() {
  const { checkAdminStatus } = useAdminStore();
  const location = useLocation();

  useEffect(() => {
    // Define pages that don't require admin access (public pages)
    const publicPages = ['/', '/pending-queue', '/failed-queue', '/watchlist-queues'];
    
    // Only check admin status for admin-only pages, not for public pages
    if (!publicPages.includes(location.pathname)) {
      checkAdminStatus();
    }
  }, [location.pathname, checkAdminStatus]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pending-queue" element={<PendingQueue />} />
        <Route path="/failed-queue" element={<FailedQueue />} />
        <Route path="/watchlist-brands" element={<WatchlistBrands />} />
        <Route path="/watchlist-queues" element={<WatchlistQueues />} />
        <Route path="/add-brands" element={<AddBrands />} />
        <Route path="/queue-management" element={<QueueManagement />} />
        <Route path="/scraper-controls" element={<ScraperControlsPage />} />
        <Route path="/proxies" element={<Proxies />} />
        <Route path="/pipeline-status" element={<PipelineStatusPage />} />
      </Routes>
    </Layout>
  );
}

export default App;