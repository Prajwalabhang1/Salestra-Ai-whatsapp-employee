/**
 * Dashboard Skeleton Loader
 * Beautiful loading skeletons instead of full-screen spinner
 */

'use client'

export default function DashboardSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-8 py-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="mb-8">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>

            {/* AI Status Banner Skeleton */}
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl mb-8" />

            {/* Metrics Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                            <div className="w-20 h-8 bg-gray-200 rounded" />
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                ))}
            </div>

            {/* Charts Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {[1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6" />
                        <div className="h-64 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>

            {/* Recent Conversations Skeleton */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                            <div className="w-10 h-10 bg-gray-200 rounded-full" />
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
