import React from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  Tag,
  Hash,
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

const IpBrandsList = ({ ip, brands, pagination, loading, onPageChange }) => {

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'complete':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'complete':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="flex justify-center py-8">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  if (!brands || brands.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="text-center py-8">
          <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Brands Found</h3>
          <p className="text-gray-500">No brands found for IP {ip}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-1" />
                Brand Name
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center">
                <Hash className="h-4 w-4 mr-1" />
                Page ID
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                Ads Count
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {brands.map((brand, index) => (
            <tr key={`${brand.brandId}-${index}`} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {brand.brandName}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                {brand.pageId}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {brand.adsCount.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center">
                  {getStatusIcon(brand.status)}
                  <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(brand.status)}`}>
                    {brand.status}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default IpBrandsList;
