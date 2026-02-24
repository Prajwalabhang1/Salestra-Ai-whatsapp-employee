'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    MessageSquare, Users, TrendingUp, Zap, BookOpen, Settings,
    Download, AlertTriangle, WifiOff, Clock
} from 'lucide-react'
import Link from 'next/link'
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// Components
import TrialBanner from '../../components/TrialBanner'
import TrialExpiredModal from '../../components/TrialExpiredModal'
import Sidebar from '../../components/Sidebar'
import MetricCard from '../../components/MetricCard'
import QuickActionsPanel from '../../components/QuickActionsPanel'
import ChartCard from '../../components/ChartCard'
import DashboardSkeleton from '../../components/DashboardSkeleton'
import AlertBanner from '../../components/AlertBanner'
import TimeRangeSelector, { TimeRange } from '../../components/TimeRangeSelector'
import EmailVerificationBanner from '../../components/EmailVerificationBanner'

interface TrialInfo {
    startDate: string
    endDate: string
    daysRemaining: number
    isActive: boolean
    isExpired: boolean
    subscriptionStatus: string
    currentTier: string
    canUpgrade: boolean
}

export default function DashboardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [dashboardData, setDashboardData] = useState<any>(null)
    const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null)
    const [timeRange, setTimeRange] = useState<TimeRange>('7d')
    const [userEmail, setUserEmail] = useState('')
    const [emailVerified, setEmailVerified] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        // Get user info from localStorage
        const userStr = localStorage.getItem('user')
        if (userStr) {
            const user = JSON.parse(userStr)
            setUserEmail(user.email || '')
            setEmailVerified(user.emailVerified !== false)
        }

        fetchDashboard(token)
        fetchTrialStatus(token)
    }, [router, timeRange])

    const fetchDashboard = async (token: string) => {
        try {
            const response = await fetch(`http://localhost:3000/api/dashboard?range=${timeRange}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!response.ok) throw new Error('Failed to fetch dashboard data')

            const data = await response.json()
            setDashboardData(data.data)
            setLoading(false)
        } catch (err: any) {
            console.error('Dashboard fetch error:', err)
            setError(err.message)
            setLoading(false)
        }
    }

    const fetchTrialStatus = async (token: string) => {
        try {
            const response = await fetch('http://localhost:3000/api/trial/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                setTrialInfo(data.trial)
            }
        } catch (err) {
            console.error('Trial status fetch error:', err)
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    const handleExport = async () => {
        if (!dashboardData) {
            alert('No data to export. Please wait for dashboard to load.')
            return
        }

        try {
            // Dynamic import to avoid SSR issues
            const { exportToPDF } = await import('../../lib/export-utils')

            const success = exportToPDF(dashboardData, timeRange)

            if (success) {
                alert('✅ PDF report downloaded successfully!')
            } else {
                alert('❌ Failed to generate PDF. Please try again.')
            }
        } catch (error) {
            console.error('Export error:', error)
            alert('❌ Export failed: ' + (error as Error).message)
        }
    }

    // Get real chart data from backend (not sample data!)
    const messageVolumeData = dashboardData?.charts?.messageVolume || []
    const peakHoursData = dashboardData?.charts?.peakHours || []

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 overflow-y-auto">
                    <DashboardSkeleton />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-200 p-8">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Unavailable</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
                            >
                                Try Again
                            </button>
                            <Link
                                href="/onboarding"
                                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 px-4 rounded-xl font-semibold transition-colors text-center"
                            >
                                Back to Onboarding
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Check for alerts and separate statuses
    const needsAttention = dashboardData?.conversationsNeedingAttention || 0
    const whatsappConnected = dashboardData?.whatsappConnected || false
    const aiEmployeeActive = dashboardData?.aiEmployeeActive || false

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Trial Expired Modal */}
                {trialInfo?.isExpired && (
                    <TrialExpiredModal daysExpired={Math.abs(trialInfo.daysRemaining)} />
                )}

                {/* Trial Banner */}
                {trialInfo && !trialInfo.isExpired && trialInfo.subscriptionStatus === 'trial' && (
                    <TrialBanner
                        daysRemaining={trialInfo.daysRemaining}
                        trialEndDate={trialInfo.endDate}
                    />
                )}

                {/* Email Verification Banner */}
                {!emailVerified && userEmail && (
                    <EmailVerificationBanner email={userEmail} />
                )}

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                        {/* Header with Time Range - Enhanced Beautiful Design */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                            <div className="flex items-center gap-4">
                                {/* Animated Accent Icon */}
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", duration: 0.8 }}
                                    className="hidden sm:flex w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl items-center justify-center shadow-lg shadow-emerald-500/30"
                                >
                                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </motion.div>

                                <div>
                                    {/* Beautiful Gradient Title */}
                                    <div className="flex items-center gap-3 mb-1">
                                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 bg-clip-text text-transparent">
                                            {dashboardData?.businessName || 'Dashboard'}
                                        </h1>

                                        {/* Live Badge */}
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-200 rounded-full"
                                        >
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                                className="w-2 h-2 bg-emerald-500 rounded-full"
                                            />
                                            <span className="text-xs font-semibold text-emerald-700">Live</span>
                                        </motion.div>
                                    </div>

                                    {/* Subtitle with Icon */}
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm sm:text-base text-gray-600">
                                            {dashboardData?.businessName
                                                ? "Your AI employee is actively working"
                                                : "Welcome back! Here's your overview"}
                                        </p>
                                        <motion.div
                                            animate={{ rotate: [0, 10, -10, 0] }}
                                            transition={{ repeat: Infinity, duration: 3, delay: 1 }}
                                        >
                                            <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                        </motion.div>
                                    </div>
                                </div>
                            </div>

                            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                        </div>

                        {/* Alerts */}
                        {!whatsappConnected && (
                            <AlertBanner
                                type="error"
                                icon={WifiOff}
                                message="WhatsApp disconnected. Reconnect to continue receiving messages."
                                action={{ label: "Reconnect", onClick: () => router.push('/whatsapp') }}
                            />
                        )}

                        {needsAttention > 0 && (
                            <AlertBanner
                                type="warning"
                                icon={AlertTriangle}
                                message={`${needsAttention} conversation${needsAttention > 1 ? 's' : ''} need${needsAttention === 1 ? 's' : ''} your attention`}
                                action={{ label: "View", onClick: () => router.push('/conversations?filter=needs-attention') }}
                            />
                        )}

                        {/* Status Cards Grid - AI Employee & WhatsApp */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* AI Employee Status Card */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className={`
                                    relative overflow-hidden rounded-2xl p-6
                                    ${aiEmployeeActive
                                        ? 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                                        : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'}
                                    shadow-md
                                `}
                            >
                                <div className={`absolute top-0 left-0 right-0 h-1 ${aiEmployeeActive ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`} />

                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <motion.div
                                            animate={{ rotate: aiEmployeeActive ? [0, 3, -3, 0] : 0 }}
                                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${aiEmployeeActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}
                                        >
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </motion.div>

                                        <div>
                                            <div className="flex items-center gap-2.5 mb-0.5">
                                                <motion.div
                                                    animate={aiEmployeeActive ? { scale: [1, 1.3, 1] } : {}}
                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                    className={`w-2.5 h-2.5 rounded-full ${aiEmployeeActive ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'}`}
                                                />
                                                <h3 className={`text-lg font-bold ${aiEmployeeActive ? 'text-blue-900' : 'text-red-900'}`}>
                                                    AI Employee
                                                </h3>
                                            </div>
                                            <p className={`text-sm ${aiEmployeeActive ? 'text-blue-700' : 'text-red-700'}`}>
                                                {aiEmployeeActive ? 'Active & ready' : 'Inactive'}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href="/ai-employee"
                                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm shadow-md hover:shadow-lg ${aiEmployeeActive ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                                    >
                                        Configure
                                    </Link>
                                </div>
                            </motion.div>

                            {/* WhatsApp Connection Status Card */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className={`
                                    relative overflow-hidden rounded-2xl p-6
                                    ${whatsappConnected
                                        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200'
                                        : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200'}
                                    shadow-md
                                `}
                            >
                                <div className={`absolute top-0 left-0 right-0 h-1 ${whatsappConnected ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gray-300'}`} />

                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${whatsappConnected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-gray-300 text-gray-600'}`}>
                                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                            </svg>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2.5 mb-0.5">
                                                <motion.div
                                                    animate={whatsappConnected ? { scale: [1, 1.3, 1] } : {}}
                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                    className={`w-2.5 h-2.5 rounded-full ${whatsappConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-gray-400'}`}
                                                />
                                                <h3 className={`text-lg font-bold ${whatsappConnected ? 'text-emerald-900' : 'text-gray-700'}`}>
                                                    WhatsApp
                                                </h3>
                                            </div>
                                            <p className={`text-sm ${whatsappConnected ? 'text-emerald-700' : 'text-gray-600'}`}>
                                                {whatsappConnected ? 'Connected' : 'Disconnected'}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href="/whatsapp"
                                        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-sm shadow-md hover:shadow-lg ${whatsappConnected ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'}`}
                                    >
                                        {whatsappConnected ? 'Manage' : 'Connect'}
                                    </Link>
                                </div>
                            </motion.div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mb-8">
                            <QuickActionsPanel
                                actions={[
                                    {
                                        icon: MessageSquare,
                                        label: "View Conversations",
                                        description: "Manage chats",
                                        onClick: () => router.push('/conversations/list'),
                                        color: 'emerald'
                                    },
                                    {
                                        icon: BookOpen,
                                        label: "Add Knowledge",
                                        description: "Upload docs",
                                        onClick: () => router.push('/knowledge'),
                                        color: 'blue'
                                    },
                                    {
                                        icon: Settings,
                                        label: "Configure AI",
                                        description: "Customize behavior",
                                        onClick: () => router.push('/ai-employee'),
                                        color: 'purple'
                                    },
                                    {
                                        icon: Download,
                                        label: "Export Data",
                                        description: "Download reports",
                                        onClick: handleExport,
                                        color: 'orange'
                                    }
                                ]}
                            />
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <MetricCard
                                title="Conversations"
                                value={dashboardData?.metrics?.conversations?.today || 0}
                                change={dashboardData?.metrics?.conversations?.change || 0}
                                icon={MessageSquare}
                                color="blue"
                                trend={dashboardData?.metrics?.conversations?.trend || []}
                                onClick={() => router.push('/conversations/list')}
                            />

                            <MetricCard
                                title="Leads Captured"
                                value={dashboardData?.metrics?.leads?.today || 0}
                                change={dashboardData?.metrics?.leads?.change || 0}
                                icon={Users}
                                color="emerald"
                                trend={dashboardData?.metrics?.leads?.trend || []}
                                onClick={() => router.push('/leads')}
                            />

                            <MetricCard
                                title="Messages Today"
                                value={dashboardData?.metrics?.productsAsked?.today || 0}
                                change={dashboardData?.metrics?.productsAsked?.change || 0}
                                icon={TrendingUp}
                                color="purple"
                                trend={dashboardData?.metrics?.productsAsked?.trend || []}
                            />

                            <MetricCard
                                title="Avg Response"
                                value={parseFloat(dashboardData?.metrics?.avgResponse?.today || '1.8')}
                                change={parseFloat(dashboardData?.metrics?.avgResponse?.change || '-0.3')}
                                changeLabel="faster"
                                icon={Zap}
                                color="orange"
                                unit="s"
                                decimals={1}
                                trend={dashboardData?.metrics?.avgResponse?.trend || []}
                            />
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <ChartCard
                                title="Message Volume"
                                subtitle="Last 7 days"
                                icon={TrendingUp}
                            >
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={messageVolumeData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="messages"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ fill: '#10b981', r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            <ChartCard
                                title="Peak Hours"
                                subtitle="When customers message most"
                                icon={Clock}
                            >
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={peakHoursData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="hour" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                            }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#3b82f6"
                                            radius={[8, 8, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        {/* Recent Conversations */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Recent Conversations</h2>
                                <Link
                                    href="/conversations/list"
                                    className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1"
                                >
                                    View all
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>

                            {dashboardData?.recentConversations?.length > 0 ? (
                                <div className="space-y-4">
                                    {dashboardData.recentConversations.map((conv: any) => (
                                        <div
                                            key={conv.id}
                                            className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/conversations/${conv.id}`)}
                                        >
                                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-emerald-700 font-semibold text-sm">
                                                    {conv.customerName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="font-semibold text-gray-900">{conv.customerName}</p>
                                                    <span className="text-xs text-gray-500">{conv.time}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 truncate mb-1">
                                                    <span className="font-medium">Customer:</span> {conv.message}
                                                </p>
                                                <p className="text-sm text-emerald-700 truncate">
                                                    <span className="font-medium">AI:</span> {conv.reply}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-600">No conversations yet</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Your AI employee will appear here when customers start messaging
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
