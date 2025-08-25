import { AlertTriangle, Clock, Home, Plus, RefreshCw, Settings, FileText, Building2, Play, Globe} from "lucide-react";

export const navItems = [
    { to: "/", icon: Home, label: "Dashboard" },
    { to: "/pending-queue", icon: Clock, label: "Pending Queue" },
    { to: "/failed-queue", icon: AlertTriangle, label: "Failed Queue" },
    { to: "/add-brands", icon: Building2, label: "Add Brands" },
    { to: "/queue-management", icon: Settings, label: "Q Management" },
    { to: "/scraper-controls", icon: Play, label: "Scraper Controls" },
    { to: "/proxies", icon: Globe, label: "Proxy Controls" }
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

export const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

export const tabs = [
    { id: 'single', label: 'Single Brand', icon: Plus },
    { id: 'csv', label: 'CSV Upload', icon: FileText },
    { id: 'all', label: 'Add All Brands', icon: RefreshCw }
  ];