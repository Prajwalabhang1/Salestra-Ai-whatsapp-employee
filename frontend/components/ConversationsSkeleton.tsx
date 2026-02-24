'use client'

export default function ConversationsSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 w-full">
                            {/* Avatar Skeleton */}
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />

                            <div className="flex-1">
                                {/* Name and Phone Skeleton */}
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2 w-1/3">
                                        <div className="h-5 bg-gray-200 rounded w-full" />
                                        <div className="h-4 bg-gray-200 rounded w-2/3" />
                                    </div>
                                    {/* Status Badge Skeleton */}
                                    <div className="w-20 h-6 bg-gray-200 rounded-full" />
                                </div>

                                {/* Timestamp Skeleton */}
                                <div className="flex items-center gap-3 mt-3">
                                    <div className="h-3 bg-gray-200 rounded w-16" />
                                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <div className="h-3 bg-gray-200 rounded w-20" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Message Preview Skeleton */}
                    <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-4 bg-gray-200 rounded" />
                            <div className="h-4 bg-gray-200 rounded flex-1" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-gray-200 rounded" />
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
