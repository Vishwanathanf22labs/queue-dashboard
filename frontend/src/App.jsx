import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import useAdminStore from './stores/adminStore';
import useScrollToTop from './hooks/useScrollToTop';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const PendingQueue = lazy(() => import('./pages/PendingQueue'));
const FailedQueue = lazy(() => import('./pages/FailedQueue'));
const AddBrands = lazy(() => import('./pages/AddBrands'));
const QueueManagement = lazy(() => import('./pages/QueueManagement'));
const ScraperControlsPage = lazy(() => import('./pages/ScraperControls'));
const PipelineStatusPage = lazy(() => import('./pages/PipelineStatusPage'));
const Proxies = lazy(() => import('./pages/Proxies'));
const IpStats = lazy(() => import('./pages/IpStats'));
const ScrapedBrands = lazy(() => import('./pages/ScrapedBrands'));
const WatchlistBrands = lazy(() => import('./pages/WatchlistBrands'));
const WatchlistQueues = lazy(() => import('./pages/WatchlistQueues'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  const { checkAdminStatus } = useAdminStore();
  const location = useLocation();

  useEffect(() => {
    const pagesWithoutAdminUI = ['/pending-queue', '/failed-queue', '/watchlist-queues', '/pipeline-status', '/scraped-brands'];
    if (!pagesWithoutAdminUI.includes(location.pathname)) {
      checkAdminStatus();
    }
  }, [location.pathname, checkAdminStatus]);

  useScrollToTop();

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
        <Route path="/ip-stats" element={
          <Suspense fallback={<LoadingSpinner />}>
            <IpStats />
          </Suspense>
        } />
        <Route path="/scraped-brands" element={
          <Suspense fallback={<LoadingSpinner />}>
            <ScrapedBrands />
          </Suspense>
        } />
        <Route path="/pipeline-status" element={
          <Suspense fallback={<LoadingSpinner />}>
            <PipelineStatusPage />
          </Suspense>
        } />
        <Route path="/settings" element={
          <Suspense fallback={<LoadingSpinner />}>
            <Settings />
          </Suspense>
        } />
      </Routes>
    </Layout>
  );
}

export default App;