import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import useAdminStore from './stores/adminStore';

// Dynamic imports for better code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PendingQueue = lazy(() => import('./pages/PendingQueue'));
const FailedQueue = lazy(() => import('./pages/FailedQueue'));
const AddBrands = lazy(() => import('./pages/AddBrands'));
const QueueManagement = lazy(() => import('./pages/QueueManagement'));
const ScraperControlsPage = lazy(() => import('./pages/ScraperControls'));
const PipelineStatusPage = lazy(() => import('./pages/PipelineStatusPage'));
const Proxies = lazy(() => import('./pages/Proxies'));
const WatchlistBrands = lazy(() => import('./pages/WatchlistBrands'));
const WatchlistQueues = lazy(() => import('./pages/WatchlistQueues'));

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
        <Route path="/" element={
          <Suspense fallback={<LoadingSpinner />}>
            <Dashboard />
          </Suspense>
        } />
        <Route path="/pending-queue" element={
          <Suspense fallback={<LoadingSpinner />}>
            <PendingQueue />
          </Suspense>
        } />
        <Route path="/failed-queue" element={
          <Suspense fallback={<LoadingSpinner />}>
            <FailedQueue />
          </Suspense>
        } />
        <Route path="/watchlist-brands" element={
          <Suspense fallback={<LoadingSpinner />}>
            <WatchlistBrands />
          </Suspense>
        } />
        <Route path="/watchlist-queues" element={
          <Suspense fallback={<LoadingSpinner />}>
            <WatchlistQueues />
          </Suspense>
        } />
        <Route path="/add-brands" element={
          <Suspense fallback={<LoadingSpinner />}>
            <AddBrands />
          </Suspense>
        } />
        <Route path="/queue-management" element={
          <Suspense fallback={<LoadingSpinner />}>
            <QueueManagement />
          </Suspense>
        } />
        <Route path="/scraper-controls" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ScraperControlsPage />
          </Suspense>
        } />
        <Route path="/proxies" element={
          <Suspense fallback={<LoadingSpinner />}>
            <Proxies />
          </Suspense>
        } />
        <Route path="/pipeline-status" element={
          <Suspense fallback={<LoadingSpinner />}>
            <PipelineStatusPage />
          </Suspense>
        } />
      </Routes>
    </Layout>
  );
}

export default App;