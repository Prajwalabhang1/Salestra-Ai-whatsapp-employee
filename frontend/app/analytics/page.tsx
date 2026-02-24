'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    BarChart3, TrendingUp, MessageSquare, Clock, Users,
    Activity, Zap, Download, Search, Filter, MoreVertical,
    CheckSquare, Square, Trash2, Mail, Phone, FileText,
    ChevronLeft, ChevronRight, RefreshCw, Layers, PieChart,
    ArrowUpRight, ArrowDownRight, Calendar
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Sidebar from '../../components/Sidebar'

// ==========================================
// TYPES
// ==========================================

interface Lead {
    id: string
    customerName: string
    customerPhone: string
    customerEmail: string
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
    intent: 'purchase' | 'pricing' | 'availability' | 'information'
    interactionCount: number
    lastContact: string
    source: string
    notes: string
    createdAt: string
}

interface AnalyticsData {
    totalConversations: number
    totalMessages: number
    avgResponseTime: number
    aiConfidence: number
    conversationTrend: number[]
    hourlyActivity: { hour: number; count: number }[]
    topProducts: { name: string; count: number }[]
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function AnalyticsPage() {
    const router = useRouter()

    // Performance State
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loadingAnalytics, setLoadingAnalytics] = useState(true)
    const [timeRange, setTimeRange] = useState('7d')
    const [analyticsError, setAnalyticsError] = useState('')

    // CRM State
    const [leads, setLeads] = useState<Lead[]>([])
    const [loadingLeads, setLoadingLeads] = useState(true)
    const [leadSearch, setLeadSearch] = useState('')
    const [leadStatusFilter, setLeadStatusFilter] = useState('all')
    const [selectedLeads, setSelectedLeads] = useState<string[]>([])
    const [bulkActionLoading, setBulkActionLoading] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }
        // Load all data
        Promise.all([fetchAnalytics(), fetchLeads()])
    }, [router, timeRange])

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    // ==========================================
    // API CALLS
    // ==========================================

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/analytics?range=${timeRange}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (res.ok) setAnalytics(await res.json())
            else throw new Error('Failed to load analytics')
        } catch (e: any) {
            setAnalyticsError(e.message)
        } finally {
            setLoadingAnalytics(false)
        }
    }

    const fetchLeads = async () => {
        setLoadingLeads(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/leads`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (res.ok) {
                const data = await res.json()
                setLeads(data.leads || [])
            }
        } catch (e) { console.error(e) }
        finally { setLoadingLeads(false) }
    }

    const exportLeads = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/leads/export/csv`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
            }
        } catch (e) {
            alert('Export failed')
        }
    }

    const updateLeadStatus = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/leads/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) fetchLeads() // Refresh to update UI
        } catch (e) { console.error(e) }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedLeads.length} leads?`)) return
        setBulkActionLoading(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/leads/bulk-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ leadIds: selectedLeads, action: 'delete' })
            })
            if (res.ok) {
                setSelectedLeads([])
                fetchLeads()
            }
        } catch (e) { alert('Bulk action failed') }
        finally { setBulkActionLoading(false) }
    }

    // ==========================================
    // HELPERS
    // ==========================================

    const filteredLeads = leads.filter(l => {
        const matchesSearch = !leadSearch ||
            l.customerName?.toLowerCase().includes(leadSearch.toLowerCase()) ||
            l.customerPhone?.includes(leadSearch)
        const matchesStatus = leadStatusFilter === 'all' || l.status === leadStatusFilter
        return matchesSearch && matchesStatus
    })

    const toggleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) setSelectedLeads([])
        else setSelectedLeads(filteredLeads.map(l => l.id))
    }

    const toggleSelect = (id: string) => {
        if (selectedLeads.includes(id)) setSelectedLeads(selectedLeads.filter(l => l !== id))
        else setSelectedLeads([...selectedLeads, id])
    }

    // Chart Data Preparation
    const trendData = analytics?.conversationTrend?.map((val, i) => ({ day: `Day ${i + 1}`, val })) || []
    const hourlyData = analytics?.hourlyActivity?.map(h => ({ hour: `${h.hour}:00`, val: h.count })) || []

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* HEADER */}
                <div className="bg-white border-b border-gray-200 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
                            <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Business Intelligence</h1>
                            <p className="text-sm text-gray-500 font-medium">Real-time Performance & pipeline tracking</p>
                        </div>
                    </div>

                    <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm self-start md:self-auto">
                        {['24h', '7d', '30d'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeRange === range ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                {range.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* SCROLLABLE MAIN CONTENT */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth">

                    {/* SECTION 1: KEY METRICS */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            title="Total Conversations"
                            value={analytics?.totalConversations || 0}
                            icon={MessageSquare}
                            color="blue"
                            loading={loadingAnalytics}
                        />
                        <MetricCard
                            title="Total Messages"
                            value={analytics?.totalMessages || 0}
                            icon={Activity}
                            color="purple"
                            loading={loadingAnalytics}
                        />
                        <MetricCard
                            title="Avg Response Time"
                            value={`${(analytics?.avgResponseTime || 0).toFixed(1)}m`}
                            icon={Clock}
                            color="emerald"
                            loading={loadingAnalytics}
                        />
                        <MetricCard
                            title="AI Confidence"
                            value={`${Math.round((analytics?.aiConfidence || 0) * 100)}%`}
                            icon={Zap}
                            color="amber"
                            loading={loadingAnalytics}
                        />
                    </section>

                    {/* SECTION 2: CHARTS & PIPELINE */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT: Interaction Trend (2/3 width) */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" /> Interaction Volume Trend
                            </h3>
                            <div className="h-72">
                                {loadingAnalytics ? (
                                    <div className="h-full flex items-center justify-center text-gray-400">Loading chart...</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="day" fontSize={11} stroke="#94a3b8" />
                                            <YAxis fontSize={11} stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                            <Line type="monotone" dataKey="val" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Pipeline Funnel (1/3 width) */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-emerald-500" /> Lead Pipeline
                            </h3>
                            <div className="flex-1 space-y-5">
                                <PipelineStage label="Total Leads" count={leads.length} color="blue" percent={100} />
                                <PipelineStage label="Contacted" count={leads.filter(l => l.status === 'contacted').length} color="indigo" percent={leads.length ? (leads.filter(l => l.status === 'contacted').length / leads.length) * 100 : 0} />
                                <PipelineStage label="Qualified" count={leads.filter(l => l.status === 'qualified').length} color="purple" percent={leads.length ? (leads.filter(l => l.status === 'qualified').length / leads.length) * 100 : 0} />
                                <PipelineStage label="Converted" count={leads.filter(l => l.status === 'converted').length} color="emerald" percent={leads.length ? (leads.filter(l => l.status === 'converted').length / leads.length) * 100 : 0} />
                            </div>
                        </div>
                    </section>

                    {/* SECTION 3: LEAD MANAGEMENT */}
                    <section className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Users className="w-6 h-6 text-gray-400" /> Lead Management
                            </h2>

                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        value={leadSearch}
                                        onChange={e => setLeadSearch(e.target.value)}
                                        placeholder="Search leads..."
                                        className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    />
                                </div>
                                <select
                                    value={leadStatusFilter}
                                    onChange={e => setLeadStatusFilter(e.target.value)}
                                    className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                >
                                    <option value="all">All Status</option>
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="converted">Converted</option>
                                    <option value="lost">Lost</option>
                                </select>
                                {selectedLeads.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={bulkActionLoading}
                                        className="px-3 py-2 bg-red-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete ({selectedLeads.length})
                                    </button>
                                )}
                                <button
                                    onClick={exportLeads}
                                    className="px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4" /> Export
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 w-12 text-center">
                                                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                                                    {selectedLeads.length === filteredLeads.length && filteredLeads.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                                                </button>
                                            </th>
                                            <th className="px-6 py-4">Customer</th>
                                            <th className="px-6 py-4">Status & Pipeline</th>
                                            <th className="px-6 py-4">Engagement</th>
                                            <th className="px-6 py-4">Created</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loadingLeads ? (
                                            <tr><td colSpan={6} className="p-12 text-center text-gray-400">Loading leads data...</td></tr>
                                        ) : filteredLeads.length === 0 ? (
                                            <tr><td colSpan={6} className="p-12 text-center text-gray-400">No leads found matching your filters.</td></tr>
                                        ) : (
                                            filteredLeads.map(lead => (
                                                <tr key={lead.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                    <td className="px-6 py-4 text-center">
                                                        <button onClick={() => toggleSelect(lead.id)} className="text-gray-400 hover:text-gray-600">
                                                            {selectedLeads.includes(lead.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-700 border border-indigo-200">
                                                                {lead.customerName?.slice(0, 2).toUpperCase() || '??'}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-gray-900">{lead.customerName || 'Unknown'}</div>
                                                                <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.customerPhone}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={lead.status}
                                                                onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                                                                className={`text-xs px-2.5 py-1 rounded-full font-bold border-0 ring-1 ring-inset cursor-pointer outline-none transition-all uppercase tracking-wide ${lead.status === 'new' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                                        lead.status === 'contacted' ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' :
                                                                            lead.status === 'converted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                                                                                lead.status === 'qualified' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                                                                                    'bg-gray-50 text-gray-700 ring-gray-600/20'
                                                                    }`}
                                                            >
                                                                <option value="new">NEW</option>
                                                                <option value="contacted">CONTACTED</option>
                                                                <option value="qualified">QUALIFIED</option>
                                                                <option value="converted">WON</option>
                                                                <option value="lost">LOST</option>
                                                            </select>
                                                            {lead.intent && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 uppercase">
                                                                    {lead.intent}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4 text-gray-600">
                                                            <span className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 px-2 py-1 rounded-md border border-gray-200">
                                                                <MessageSquare className="w-3.5 h-3.5 text-gray-400" /> {lead.interactionCount}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-xs font-mono">
                                                        {new Date(lead.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => router.push(`/conversations?phone=${lead.customerPhone}`)}
                                                            className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-lg transition-all text-xs font-medium shadow-sm"
                                                        >
                                                            Open Chat
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                                <span className="text-xs text-gray-500">Showing {filteredLeads.length} leads</span>
                                <div className="flex gap-2">
                                    <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-50" disabled><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                                    <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-50" disabled><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    )
}

// ==========================================
// HELPERS
// ==========================================

function MetricCard({ title, value, icon: Icon, color, loading }: any) {
    const bgMap: any = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600'
    }
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden">
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
                {loading ? <div className="h-8 w-24 bg-gray-100 animate-pulse rounded" /> : <p className="text-3xl font-bold text-gray-900">{value}</p>}
            </div>
            <div className={`p-3 rounded-xl ${bgMap[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    )
}

function PipelineStage({ label, count, color, percent }: any) {
    const colorClass: any = {
        blue: 'bg-blue-500',
        indigo: 'bg-indigo-500',
        purple: 'bg-purple-500',
        emerald: 'bg-emerald-500'
    }
    return (
        <div>
            <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-medium text-gray-600">{label}</span>
                <span className="text-sm font-bold text-gray-900">{count}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${colorClass[color]}`}
                    style={{ width: `${Math.max(percent, 2)}%` }}
                />
            </div>
        </div>
    )
}
