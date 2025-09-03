import React from 'react';

const Skeleton = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-gray-200 rounded ${className}`}
    {...props}
  />
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="ml-3 flex-1">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const ProcessingStatusSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-4">
    <Skeleton className="h-6 w-48 mb-4" />
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export const QuickActionsSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-4">
    <Skeleton className="h-6 w-32 mb-4" />
    <div className="flex flex-wrap gap-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-24 rounded-lg" />
      ))}
    </div>
  </div>
);

export const TableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-4">
    <div className="flex justify-between items-center mb-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-12 w-24" />
        </div>
      ))}
    </div>
  </div>
);

export default Skeleton;
