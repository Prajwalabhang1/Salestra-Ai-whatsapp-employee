'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, ArrowRight, Loader2, ChevronDown } from 'lucide-react'
import Sidebar from '../../../components/Sidebar'
import ConversationsSkeleton from '../../../components/ConversationsSkeleton'

const PAGINATION_LIMIT = 50

export default function ConversationsListPage() {
    const router = useRouter()
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [filter, setFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Pagination state
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [totalCount, setTotalCount] = useState(0)

    // Production-ready state management
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected')
    const [retryCount, setRetryCount] = useState(0)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const currentIntervalRef = useRef(3000) // Dynamic interval
    const isPollingRef = useRef(false) // Prevent duplicate polling

    // Filter changes reset pagination
    useEffect(() => {
        setOffset(0)
        setHasMore(true)
        // We trigger a refresh when filter/search changes
        const token = localStorage.getItem('token')
        if (token) {
            fetchConversations(token, false, false)
        }
    }, [filter, searchQuery])

    // Production-ready smart polling with tab visibility detection
    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        // Initial fetch handled by filter effect or here if needed
        // But to avoid double fetch on mount (due to filter effect), we can check if empty
        if (conversations.length === 0 && !loading) {
            fetchConversations(token)
        }

        // Start polling
        const startPolling = (interval: number) => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }

            intervalRef.current = setInterval(() => {
                const t = localStorage.getItem('token')
                // Only poll if we are at the top of the list (offset 0) and not searching
                // Polling deep pagination pages is complex and usually not needed
                if (t && !isPollingRef.current && offset === 0 && searchQuery === '') {
                    fetchConversations(t, true)
                }
            }, interval)
        }

        // Tab visibility optimization
        const handleVisibilityChange = () => {
            if (document.hidden) {
                currentIntervalRef.current = 30000
                startPolling(30000)
                console.log('📱 Tab hidden - reduced polling to 30s')
            } else {
                currentIntervalRef.current = 3000
                startPolling(3000)
                console.log('👁️ Tab visible - resumed 3s polling')
            }
        }

        startPolling(3000)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (abortControllerRef.current) abortControllerRef.current.abort()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [router, offset, searchQuery]) // Add dependencies to control polling logic

    const fetchConversations = async (token: string, silent = false, isLoadMore = false) => {
        // Prevent concurrent requests if not loading more
        if (isPollingRef.current && !isLoadMore) {
            return
        }

        isPollingRef.current = true

        // For load more, we don't abort previous requests usually, but here we keep it simple
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        const abortController = new AbortController()
        abortControllerRef.current = abortController

        const startTime = Date.now()

        try {
            if (isLoadMore) {
                setLoadingMore(true)
            } else if (!silent) {
                setLoading(true)
            } else {
                setIsRefreshing(true)
            }

            const currentOffset = isLoadMore ? offset + PAGINATION_LIMIT : 0
            if (!isLoadMore) {
                // If not loading more (refetching top), reset offset in logic, 
                // but state update happens via useEffect for filters usually. 
                // Here we ensure consistency.
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
            const queryParams = new URLSearchParams({
                limit: PAGINATION_LIMIT.toString(),
                offset: currentOffset.toString(),
                status: filter,
                search: searchQuery
            })

            const response = await fetch(`${apiUrl}/api/conversations?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: abortController.signal
            })

            const duration = Date.now() - startTime

            if (response.ok) {
                const data = await response.json()
                const newConversations = data.conversations || []
                const pagination = data.pagination

                // Update pagination state
                setTotalCount(pagination?.total || 0)
                setHasMore(pagination?.hasMore || false)

                if (isLoadMore) {
                    setConversations(prev => [...prev, ...newConversations])
                    setOffset(currentOffset)
                } else {
                    setConversations(newConversations)
                    if (!silent) setOffset(0) // Reset offset if full refresh
                }

                // Success success
                if (!silent) {
                    console.log(`✅ Fetch success (${duration}ms) - ${newConversations.length} items`)
                }

                if (retryCount > 0) {
                    setRetryCount(0)
                    currentIntervalRef.current = 3000
                    setConnectionStatus('connected')
                }
            } else {
                console.error(`❌ API Error ${response.status}: ${response.statusText}`)
                handleFetchError()
                if (!silent && !isLoadMore) setConversations([])
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('🚫 Request aborted')
            } else {
                console.error('❌ Network error:', error.message)
                handleFetchError()
                if (!silent && !isLoadMore) setConversations([])
            }
        } finally {
            setLoading(false)
            setLoadingMore(false)
            setIsRefreshing(false)
            isPollingRef.current = false
        }
    }

    const handleLoadMore = () => {
        const token = localStorage.getItem('token')
        if (token && hasMore && !loadingMore) {
            fetchConversations(token, false, true)
        }
    }

    const handleFetchError = () => {
        const newRetryCount = retryCount + 1
        setRetryCount(newRetryCount)
        setConnectionStatus('reconnecting')
        const newInterval = Math.min(3000 * Math.pow(2, newRetryCount), 60000)
        currentIntervalRef.current = newInterval
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    return (
        <div className="flex h-screen bg-gray-50" suppressHydrationWarning>
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-8 py-6 z-10 relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-gray-900">All Conversations</h1>
                                {connectionStatus === 'connected' && (
                                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse"></span>
                                        Live
                                    </span>
                                )}
                                {connectionStatus === 'reconnecting' && (
                                    <span className="flex items-center gap-1.5 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                                        Reconnecting...
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Manage and monitor all customer interactions {totalCount > 0 && `(${totalCount})`}
                            </p>
                        </div>
                        <Link
                            href="/dashboard"
                            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm inline-flex items-center gap-1"
                        >
                            Back to Dashboard
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 mt-6">
                        <div className="flex-1 max-w-md relative">
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none pl-10"
                            />
                            <MessageSquare className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                        <div className="flex gap-2">
                            {['all', 'unread', 'resolved'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-colors ${filter === f
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
                    {loading && conversations.length === 0 ? (
                        <div className="w-full">
                            <ConversationsSkeleton />
                        </div>
                    ) : conversations.length > 0 ? (
                        <div className="w-full space-y-4 pb-8">
                            {conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className="bg-white rounded-xl border border-gray-200 p-6 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                                    onClick={() => router.push(`/conversations/${conv.id}`)}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                                                <span className="text-emerald-700 font-semibold text-lg">
                                                    {conv.customerName ? conv.customerName.charAt(0).toUpperCase() : '?'}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 text-lg">{conv.customerName}</h3>
                                                <p className="text-sm text-gray-500">{conv.customerPhone}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-xs text-gray-500">{conv.timestamp}</span>
                                                    <span className="text-xs text-gray-300">•</span>
                                                    <span className="text-xs text-gray-500">{conv.messageCount} messages</span>
                                                    {conv.unreadCount > 0 && (
                                                        <>
                                                            <span className="text-xs text-gray-300">•</span>
                                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium animate-pulse">
                                                                {conv.unreadCount} new
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${conv.status === 'resolved'
                                            ? 'bg-gray-100 text-gray-600'
                                            : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                            {conv.status}
                                        </span>
                                    </div>

                                    <div className="space-y-2 pl-16">
                                        <div className="flex items-start gap-2">
                                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-0.5">Cust</span>
                                            <p className="text-sm text-gray-600 line-clamp-1">{conv.lastMessage}</p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide mt-0.5">AI</span>
                                            <p className="text-sm text-gray-900 line-clamp-1 font-medium">{conv.aiResponse}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Load More Button */}
                            {hasMore && (
                                <div className="pt-4 text-center">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading past conversations...
                                            </>
                                        ) : (
                                            <>
                                                Load older conversations
                                                <ChevronDown className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-24 bg-white rounded-xl border border-gray-200 border-dashed">
                            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">No conversations found</h3>
                            <p className="text-gray-500 mt-1 max-w-sm mx-auto">
                                No conversations match your current filters. Try adjusting your search or filter settings.
                            </p>
                            {filter !== 'all' || searchQuery !== '' ? (
                                <button
                                    onClick={() => { setFilter('all'); setSearchQuery('') }}
                                    className="mt-4 text-emerald-600 font-medium hover:text-emerald-700 hover:underline"
                                >
                                    Clear all filters
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
