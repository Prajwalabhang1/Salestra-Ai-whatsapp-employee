'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    Bot, Save, Sparkles, MessageSquare, Sliders,
    Zap, AlertTriangle, Play, RefreshCw, CheckCircle2,
    Settings, BrainCircuit, UserCheck, Shield
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'

interface AIConfig {
    id: string
    toneFormality: number
    toneEnthusiasm: number
    responseLength: 'short' | 'medium' | 'long'
    useEmojis: boolean
    greetingFirstTime: string
    greetingReturning?: string
    customInstructions: string
    isEnabled: boolean
    maintenanceMode: boolean
}

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
}

export default function KnowledgeBasePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState<AIConfig | null>(null)
    const [testMessage, setTestMessage] = useState('')
    const [chatHistory, setChatHistory] = useState<Message[]>([])
    const [testing, setTesting] = useState(false)
    const [showPlayground, setShowPlayground] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchConfig()
    }, [])

    useEffect(() => {
        if (showPlayground && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [chatHistory, showPlayground])

    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token')
            if (!token) {
                router.push('/login')
                return
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/config`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                setConfig(data.aiConfig)
            }
        } catch (error) {
            console.error('Failed to fetch config:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!config) return
        setSaving(true)
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            })

            if (response.ok) {
                // Show success toast or feedback (optional)
                const data = await response.json()
                setConfig(data.config)
            }
        } catch (error) {
            console.error('Failed to save:', error)
        } finally {
            setSaving(false)
        }
    }

    const handleTestChat = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!testMessage.trim() || !config) return

        const userMsg = testMessage
        setChatHistory(prev => [...prev, { role: 'user', content: userMsg }])
        setTestMessage('')
        setTesting(true)

        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ai-employee/playground/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userMsg,
                    config: config, // Send current specific config state to test draft changes
                    mockContext: "No specific RAG context for this test."
                })
            })

            if (response.ok) {
                const data = await response.json()
                setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }])
            }
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'system', content: 'Error: Failed to get AI response.' }])
        } finally {
            setTesting(false)
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    const updateConfig = (field: keyof AIConfig, value: any) => {
        if (!config) return
        setConfig({ ...config, [field]: value })
    }

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Loading AI Brain...</p>
                </div>
            </div>
        )
    }

    if (!config) return null

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-8 py-6 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                                <BrainCircuit className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">AI Persona & Behavior</h1>
                                <p className="text-sm text-gray-500 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    Configure how your AI thinks, speaks, and interacts
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowPlayground(!showPlayground)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showPlayground
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <MessageSquare className="w-4 h-4" />
                                {showPlayground ? 'Hide Playground' : 'Test AI Agent'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex overflow-hidden">
                    {/* Editor Panel */}
                    <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
                        <div className="max-w-4xl mx-auto space-y-8 pb-20">

                            {/* System Prompt Section */}
                            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <Bot className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900">System Prompt</h2>
                                            <p className="text-sm text-gray-500">The core instructions that define your AI's role and knowledge.</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">Markdown Supported</span>
                                </div>
                                <div className="p-1">
                                    <textarea
                                        value={config.customInstructions || ''}
                                        onChange={(e) => updateConfig('customInstructions', e.target.value)}
                                        placeholder="You are a helpful assistant for... You should always..."
                                        className="w-full h-[400px] p-6 text-gray-700 font-mono text-sm focus:outline-none resize-none leading-relaxed"
                                    />
                                </div>
                                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                                    <span>{config.customInstructions?.length || 0} characters</span>
                                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Auto-sanitized</span>
                                </div>
                            </section>

                            {/* Personality Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-emerald-50 rounded-lg">
                                            <Sliders className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900">Tone & Style</h2>
                                            <p className="text-sm text-gray-500">Adjust how the AI communicates</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">Formality</label>
                                                <span className="text-sm text-emerald-600 font-medium">
                                                    {config.toneFormality <= 3 ? 'Casual' : config.toneFormality <= 7 ? 'Balanced' : 'Formal'} ({config.toneFormality}/10)
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                value={config.toneFormality}
                                                onChange={(e) => updateConfig('toneFormality', parseInt(e.target.value))}
                                                className="w-full accent-emerald-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <div className="flex justify-between mt-1 text-xs text-gray-400">
                                                <span>Slang</span>
                                                <span>Professional</span>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">Enthusiasm</label>
                                                <span className="text-sm text-emerald-600 font-medium">
                                                    {config.toneEnthusiasm <= 3 ? 'Calm' : config.toneEnthusiasm <= 7 ? 'Friendly' : 'Excited'} ({config.toneEnthusiasm}/10)
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                value={config.toneEnthusiasm}
                                                onChange={(e) => updateConfig('toneEnthusiasm', parseInt(e.target.value))}
                                                className="w-full accent-emerald-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <div className="flex justify-between mt-1 text-xs text-gray-400">
                                                <span>Reserved</span>
                                                <span>Energetic</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Settings className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900">Output Settings</h2>
                                            <p className="text-sm text-gray-500">Fine-tune response constraints</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 block mb-3">Response Length</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['short', 'medium', 'long'].map((len) => (
                                                    <button
                                                        key={len}
                                                        onClick={() => updateConfig('responseLength', len)}
                                                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${config.responseLength === len
                                                                ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {len.charAt(0).toUpperCase() + len.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div>
                                                <span className="text-sm font-medium text-gray-900 block">Use Emojis</span>
                                                <span className="text-xs text-gray-500">Allow AI to use emojis in responses</span>
                                            </div>
                                            <button
                                                onClick={() => updateConfig('useEmojis', !config.useEmojis)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${config.useEmojis ? 'bg-blue-600' : 'bg-gray-200'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.useEmojis ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Greeting Message */}
                            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                    <div className="p-2 bg-amber-50 rounded-lg">
                                        <UserCheck className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">First Impression</h2>
                                        <p className="text-sm text-gray-500">Configure how the AI introduces itself</p>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Greeting Message</label>
                                    <textarea
                                        value={config.greetingFirstTime || ''}
                                        onChange={(e) => updateConfig('greetingFirstTime', e.target.value)}
                                        className="w-full h-24 p-4 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                                        placeholder="Hi! I'm your AI assistant. How can I help you today?"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Tip: Keep it short, friendly, and aligned with your brand voice.
                                    </p>
                                </div>
                            </section>

                        </div>
                    </div>

                    {/* Playground Drawer (Right Side) */}
                    <div
                        className={`border-l border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out ${showPlayground ? 'w-[400px]' : 'w-0 opacity-0 overflow-hidden'
                            }`}
                    >
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                Test Playground
                            </h3>
                            <button onClick={() => setChatHistory([])} className="text-xs text-gray-500 hover:text-gray-900 underline">
                                Clear Chat
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                            {chatHistory.length === 0 && (
                                <div className="text-center py-10 text-gray-400">
                                    <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Start typing to test your new configuration.</p>
                                </div>
                            )}

                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : msg.role === 'system'
                                                ? 'bg-red-50 text-red-600 border border-red-100'
                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {testing && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm">
                                        <div className="flex gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100" />
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-white">
                            <form onSubmit={handleTestChat} className="flex gap-2">
                                <input
                                    type="text"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    type="submit"
                                    disabled={testing || !testMessage.trim()}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
