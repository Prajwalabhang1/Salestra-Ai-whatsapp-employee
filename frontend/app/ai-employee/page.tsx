'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    Bot, Activity, MessageSquare, TrendingUp, Clock, AlertCircle, CheckCircle,
    Settings, Play, Pause, TestTube, BarChart3, Sparkles, Save, BrainCircuit,
    Sliders, Zap, Smile, UserCheck, Shield, ChevronRight, Wand2, Briefcase, Loader2,
    Send, User, Terminal, ChevronDown, ChevronUp, History, Smartphone, X, Eye, Code2
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'

// ==========================================
// TYPES
// ==========================================

interface DashboardData {
    aiStatus: {
        isEnabled: boolean
        maintenanceMode: boolean
    }
    metrics: {
        todayMessages: number
        avgConfidence: number
        escalationRate: number
        avgResponseTime: number
        activeConversations: number
    }
    recentActivity: Array<{
        action: string
        entity: string
        timestamp: string
    }>
}

interface AIConfig {
    id: string
    toneFormality: number
    toneEnthusiasm: number
    responseLength: 'short' | 'medium' | 'long'
    useEmojis: boolean
    greetingFirstTime: string
    greetingReturning?: string
    customInstructions: string
    businessDescription?: string
    isEnabled: boolean
    maintenanceMode: boolean
}

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function AIEmployeePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)

    // UI State
    const [showPreview, setShowPreview] = useState(false)
    const [activeTab, setActiveTab] = useState<'configuration' | 'activity'>('configuration')

    // Data State
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [config, setConfig] = useState<AIConfig | null>(null)
    const [unsavedChanges, setUnsavedChanges] = useState(false)

    // Action State
    const [toggling, setToggling] = useState(false)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)

    // Playground State
    const [chatHistory, setChatHistory] = useState<Message[]>([])
    const [testMessage, setTestMessage] = useState('')
    const [testing, setTesting] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Initial Load
    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }
        Promise.all([fetchDashboard(), fetchConfig()]).finally(() => setLoading(false))

        const interval = setInterval(fetchDashboard, 30000)
        return () => clearInterval(interval)
    }, [router])

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [chatHistory])

    const handleConfigChange = (newConfig: Partial<AIConfig>) => {
        if (!config) return
        setConfig({ ...config, ...newConfig })
        setUnsavedChanges(true)
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    // ==========================================
    // API CALLS
    // ==========================================

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/dashboard`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (res.ok) setDashboardData(await res.json())
        } catch (e) { console.error('Dashboard fetch error', e) }
    }

    const fetchConfig = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/config`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (res.ok) {
                const data = await res.json()
                setConfig({ ...data.aiConfig, ...data.businessConfig })
            }
        } catch (e) { console.error('Config fetch error', e) }
    }

    const toggleAI = async () => {
        if (!dashboardData) return
        setToggling(true)
        try {
            const endpoint = dashboardData.aiStatus.isEnabled ? 'disable' : 'enable'
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/control/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            if (res.ok) {
                await fetchDashboard()
                fetchConfig()
            }
        } catch (e) { console.error('Toggle error', e) }
        finally { setToggling(false) }
    }

    const saveConfig = async () => {
        if (!config) return
        setSaving(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(config)
            })
            if (res.ok) {
                const data = await res.json()
                setConfig(prev => ({ ...prev, ...data.config }))
                setUnsavedChanges(false)
            }
        } catch (e) { console.error('Save error', e) }
        finally { setSaving(false) }
    }

    const generateConfig = async () => {
        if (!config?.businessDescription) {
            alert('Please enter a business description first.')
            return
        }
        setGenerating(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/config/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    businessName: 'My Business',
                    description: config.businessDescription,
                    industry: 'General'
                })
            })
            if (res.ok) {
                const data = await res.json()
                setConfig(prev => ({ ...prev!, ...data.config }))
                setUnsavedChanges(true)
            }
        } catch (e) { console.error('Generate error', e) }
        finally { setGenerating(false) }
    }

    const sendTestMessage = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!testMessage.trim() || !config) return

        const msg = testMessage
        setChatHistory(prev => [...prev, { role: 'user', content: msg }])
        setTestMessage('')
        setTesting(true)

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/playground/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    message: msg,
                    config: config,
                    mockContext: "Playground Test Context"
                })
            })
            if (res.ok) {
                const data = await res.json()
                setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }])
            }
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'system', content: 'Connection error.' }])
        } finally {
            setTesting(false)
        }
    }

    // ==========================================
    // RENDER
    // ==========================================

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
    const isAIOnline = dashboardData?.aiStatus.isEnabled && !dashboardData?.aiStatus.maintenanceMode

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* HERO HEADER */}
                <header className="bg-white px-8 py-5 z-20 sticky top-0 border-b border-gray-200/80 backdrop-blur-sm bg-opacity-90 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">AI Studio</h1>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isAIOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{isAIOnline ? 'Active' : 'Offline'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowPreview(true)}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-all"
                        >
                            <Smartphone className="w-4 h-4 text-gray-500" />
                            Test Preview
                        </button>
                        <div className="h-8 w-px bg-gray-200 mx-1"></div>
                        <button
                            onClick={toggleAI}
                            disabled={toggling}
                            className={`px-5 py-2.5 font-bold rounded-xl flex items-center gap-2 transition-all ${isAIOnline
                                    ? 'bg-white border text-red-600 hover:bg-red-50 border-red-100'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                                }`}
                        >
                            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAIOnline ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />)}
                            {isAIOnline ? 'Pause' : 'Activate'}
                        </button>
                    </div>
                </header>

                {/* MAIN EDITOR CONTENT */}
                <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-10 scroll-smooth pb-32">
                    <div className="max-w-5xl mx-auto space-y-8">

                        {/* 1. IDENTITY & SYSTEM PROMPT (The Core) */}
                        <section className="bg-white rounded-3xl p-8 border border-gray-200/60 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                            <div className="flex items-center gap-3 mb-8 text-gray-900">
                                <BrainCircuit className="w-6 h-6 text-indigo-600" />
                                <h2 className="text-2xl font-bold">Neural Identity</h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left: Business Context */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Business Context</label>
                                        <textarea
                                            value={config?.businessDescription || ''}
                                            onChange={e => handleConfigChange({ businessDescription: e.target.value })}
                                            placeholder="Describe your business..."
                                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm resize-none transition-all"
                                            rows={6}
                                        />
                                        <button
                                            onClick={generateConfig} disabled={generating || !config?.businessDescription}
                                            className="mt-3 w-full py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Wand2 className="w-3.5 h-3.5" /> Auto-Enhance Identity
                                        </button>
                                    </div>
                                </div>

                                {/* Right: System Instructions (Main Feature) */}
                                <div className="lg:col-span-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                            <Code2 className="w-3 h-3" /> System Instructions (Prompt)
                                        </label>
                                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">PROD-V1.2</span>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={config?.customInstructions || ''}
                                            onChange={e => handleConfigChange({ customInstructions: e.target.value })}
                                            placeholder="You are a helpful AI assistant..."
                                            className="w-full p-6 bg-[#1e1e1e] text-gray-300 font-mono text-sm leading-relaxed rounded-2xl border border-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none shadow-inner"
                                            rows={14}
                                            spellCheck={false}
                                        />
                                        <div className="absolute bottom-4 right-4 text-xs text-gray-500 font-mono">
                                            {config?.customInstructions?.length || 0} chars
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        This is the core logic. Define strict rules, disallowed topics, and step-by-step reasoning here.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 2. BEHAVIOR & STYLE */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-3xl p-8 border border-gray-200/60 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Sliders className="w-5 h-5 text-gray-400" /> Voice Calibration
                                </h3>
                                <div className="space-y-8">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-gray-600">Formality</span>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">{config?.toneFormality}/10</span>
                                        </div>
                                        <input type="range" min="1" max="10" value={config?.toneFormality} onChange={e => handleConfigChange({ toneFormality: parseInt(e.target.value) })} className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-900" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-gray-600">Enthusiasm</span>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">{config?.toneEnthusiasm}/10</span>
                                        </div>
                                        <input type="range" min="1" max="10" value={config?.toneEnthusiasm} onChange={e => handleConfigChange({ toneEnthusiasm: parseInt(e.target.value) })} className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-900" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl p-8 border border-gray-200/60 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-gray-400" /> Output Style
                                    </h3>
                                    <div className="flex gap-2 mb-6">
                                        {['short', 'medium', 'long'].map(len => (
                                            <button
                                                key={len}
                                                onClick={() => handleConfigChange({ responseLength: len as any })}
                                                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all ${config?.responseLength === len
                                                        ? 'bg-gray-900 text-white border-gray-900'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {len}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer" onClick={() => handleConfigChange({ useEmojis: !config?.useEmojis })}>
                                        <span className="text-sm font-bold text-gray-700">Use Emojis</span>
                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${config?.useEmojis ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${config?.useEmojis ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Recent Activity Mini-View (Professional Log) */}
                        <div className="text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">— System Status Logs —</p>
                            <div className="inline-flex flex-col gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                {dashboardData?.recentActivity?.slice(0, 3).map((log, i) => (
                                    <div key={i} className="text-xs text-gray-500 flex items-center gap-2 justify-center">
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                                        <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className="font-medium text-gray-700">{log.action}: {log.entity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </main>

                {/* BOTTOM FLOATING SAVE BAR */}
                <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30 transition-transform duration-300 transform ${unsavedChanges ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-600">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-bold text-sm">You have unsaved changes</span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={fetchConfig} className="px-5 py-2 text-gray-600 font-bold text-sm hover:text-gray-900">Discard</button>
                            <button onClick={saveConfig} disabled={saving} className="px-6 py-2 bg-gray-900 text-white font-bold rounded-lg shadow-lg hover:bg-black transition-all flex items-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </div>

                {/* PREVIEW DRAWER (SLIDE-OVER) */}
                {showPreview && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowPreview(false)}></div>

                        {/* Drawer Panel */}
                        <div className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/80 backdrop-blur-md sticky top-0 z-10">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                        <Smartphone className="w-4 h-4" /> Live Simulator
                                    </h2>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">WhatsApp Environment • {config?.toneFormality}/10 Formality</p>
                                </div>
                                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Chat Area */}
                            <div className="flex-1 bg-[#e5ddd5] p-5 overflow-y-auto bg-opacity-80 custom-scrollbar relative">
                                <div className="space-y-4">
                                    <div className="flex justify-center my-6">
                                        <span className="bg-[#fff3cd] text-gray-600 text-[10px] px-3 py-1.5 rounded-lg shadow-sm border border-[#ffeebd] text-center max-w-[80%]">
                                            Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
                                        </span>
                                    </div>

                                    {chatHistory.length === 0 && (
                                        <div className="flex justify-center mt-20">
                                            <div className="bg-white/90 p-4 rounded-xl shadow-sm text-center max-w-[240px]">
                                                <p className="text-sm font-medium text-gray-800 mb-1">Preview Ready</p>
                                                <p className="text-xs text-gray-500">Send a message below to test your new system instructions.</p>
                                            </div>
                                        </div>
                                    )}

                                    {chatHistory.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-sm shadow-sm relative ${msg.role === 'user'
                                                    ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                                                    : 'bg-white text-gray-900 rounded-tl-none'
                                                }`}>
                                                {msg.content}
                                                <span className="text-[9px] text-gray-400 block text-right mt-1 opacity-70">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {testing && (
                                        <div className="flex justify-start">
                                            <div className="bg-white px-4 py-3 rounded-lg rounded-tl-none shadow-sm flex items-center gap-1.5 w-16">
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                            </div>

                            {/* Input Area */}
                            <div className="p-3 bg-gray-100 border-t border-gray-200">
                                <form onSubmit={sendTestMessage} className="flex gap-2">
                                    <input
                                        value={testMessage}
                                        onChange={e => setTestMessage(e.target.value)}
                                        placeholder="Type a message"
                                        className="flex-1 px-4 py-2.5 rounded-full border-none focus:ring-0 text-sm shadow-sm"
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={!testMessage.trim() || testing}
                                        className="w-10 h-10 bg-[#00a884] items-center justify-center flex rounded-full text-white hover:bg-[#008f6f] transition-colors shadow-sm"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
