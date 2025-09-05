import { AlertTriangle, Clock, Home, Plus, RefreshCw, Settings, FileText, Building2, Play, Globe, Eye, List, XCircle, Activity, Upload, ExternalLink } from "lucide-react";

export const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/pending-queue", icon: Clock, label: "Pending Queue" },
  { to: "/failed-queue", icon: AlertTriangle, label: "Failed Queue" },
  { to: "/watchlist-brands", icon: Eye, label: "Watchlist Status" },
  { to: "/watchlist-queues", icon: List, label: "Watchlist Queues" },
  { to: "/add-brands", icon: Building2, label: "Add Brands" },
  { to: "/queue-management", icon: Settings, label: "Q Management" },
  { to: "/scraper-controls", icon: Play, label: "Scraper Controls" },
  { to: "/proxies", icon: Globe, label: "Proxy Controls" },
  { to: "/pipeline-status", icon: Activity, label: "Pipeline Status" }
];

export const columns = [
  {
    key: 'brand_name',
    label: 'Brand Name',
    render: (value) => (
      <div className="font-medium text-gray-900">{value}</div>
    )
  },
  {
    key: 'page_id',
    label: 'Page ID',
    render: (value) => (
      <div className="text-sm text-gray-600">{value}</div>
    )
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => (
      <div className="text-sm text-red-600 font-medium">{value}</div>
    )
  },
  {
    key: 'error_message',
    label: 'Error Message',
    render: (value) => (
      <div className="text-sm text-red-600 max-w-xs truncate">
        {value || 'Unknown error'}
      </div>
    )
  },
  {
    key: 'failed_at',
    label: 'Failed At',
    render: (value) => (
      <div className="text-sm text-gray-500">
        {new Date(value).toLocaleString()}
      </div>
    )
  }
];

export const watchlistBrandsColumns = [
  {
    key: 'brand_name',
    label: 'Brand Name',
    render: (value, brand) => (
      <div className="flex items-center space-x-2">
        <div className="font-medium text-gray-900">
          {value || 'Unknown'}
        </div>
        {brand?.page_id && (
          <button
            onClick={() => {
              const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${brand.page_id}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="View in Facebook Ad Library"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  },
  {
    key: 'page_id',
    label: 'Page ID',
    render: (value) => (
      <div className="text-sm text-gray-600">
        {value || 'N/A'}
      </div>
    )
  },
  {
    key: 'brand_id',
    label: 'Brand ID',
    headerAlign: 'center',
    className: 'text-center',
    render: (value) => (
      <div className="text-sm text-gray-600 text-center">
        {value || 'N/A'}
      </div>
    )
  },
  {
    key: 'scraper_status',
    label: 'Scraper Status',
    render: (value, brand, index, startIndex) => {
      // This will be handled in the component with proper status logic
      return value || 'Unknown';
    }
  },
  {
    key: 'actions',
    label: 'Actions',
    headerAlign: 'center',
    className: 'text-center',
    render: (value, brand) => {
      // This will be handled in the component with proper action buttons
      return null;
    }
  }
];

export const sizeClasses = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base'
};

export const tabs = [
  { id: 'single', label: 'Single Brand', icon: Plus },
  { id: 'csv', label: 'CSV Upload', icon: FileText },
  { id: 'all', label: 'Add All Brands', icon: RefreshCw },
  { id: 'madangles', label: 'Initial Scraping', icon: Upload }
];