import React from 'react';
import Card from '../ui/Card';
import {
  Activity,
  Target,
  CheckCircle,
  XCircle,
  TrendingUp,
  Server
} from 'lucide-react';

const IpStatsCard = ({ summary, loading, activeTab }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[...Array(6)].map((_, index) => (
          <Card key={index} className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const stats = [
    {
      title: "Total IPs",
      value: summary.totalIps,
      icon: Server,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Total Brands",
      value: summary.totalBrands,
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Total Ads",
      value: summary.totalAds,
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Completed",
      value: summary.totalCompleted,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Failed",
      value: summary.totalFailed,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Total Attempts",
      value: summary.totalScrapingAttempts,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default IpStatsCard;
