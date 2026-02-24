'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Save,
    Sparkles,
    MessageSquare,
    Globe,
    Clock,
    CheckCircle,
    AlertCircle,
    Bot,
    Smile,
    Briefcase,
    Wand2,
    Loader2
} from 'lucide-react'
import Sidebar from '../../../components/Sidebar'
import AIPlayground from '../../../components/AIPlayground'

export default function AIConfigurationPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [saved, setSaved] = useState(false)
    const [config, setConfig] = useState<any>(null)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }
        fetchConfig()
    }, [router])

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    const fetchConfig = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/ai-employee/config', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
            if (response.ok) {
                const data = await response.json()
                setConfig({
                    ...data.aiConfig,
                    ...data.businessConfig
                })
            }
        } catch (error) {
            console.error('Failed to fetch config:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const response = await fetch('http://localhost:3000/api/ai-employee/config', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            })
            if (response.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (error) {
            console.error('Failed to save config:', error)
        } finally {
            setSaving(false)
        }
    }

    const handleGenerateConfig = async () => {
        if (!config?.businessDescription) {
            alert('Please fill in the Business Description first!');
            return;
        }

        setGenerating(true);
        try {
            const response = await fetch('http://localhost:3000/api/ai-employee/config/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    businessName: config.businessName || 'My Business',
                    description: config.businessDescription,
                    industry: config.businessType || 'General'
                })
            });

            const data = await response.json();
            if (data.success && data.config) {
                setConfig((prev: any) => ({ ...prev, ...data.config }));
                // Notify user
                const el = document.getElementById('magic-notify');
                if (el) {
                    el.innerText = '✨ Configuration Generated!';
                    el.classList.remove('opacity-0');
                    setTimeout(() => el.classList.add('opacity-0'), 3000);
                }
            }

        } catch (e) {
            console.error('Generation failed:', e);
            alert('Could not generate configuration. Please try again.');
        } finally {
            setGenerating(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Fixed Header */}
                <div className="bg-white border-b border-gray-200 z-10 shadow-sm">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">AI Personality Studio</h1>
                                    <p className="text-xs text-gray-500 font-medium">Design your perfect employee</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center space-x-2 shadow-sm hover:shadow-md active:transform active:scale-95"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : saved ? (
                                    <>
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                        <span>Saved!</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        <span>Save Changes</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content - Split Layout */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT PANEL - Configuration (Scrollable) */}
                    <div className="flex-1 overflow-y-auto px-6 py-8 border-r border-gray-200 bg-white">
                        <div className="max-w-2xl mx-auto space-y-8 pb-10">

                            {/* Business Context Section */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-5 h-5 text-gray-700" />
                                        <h2 className="text-lg font-bold text-gray-900">Business Context</h2>
                                    </div>
                                    <button
                                        onClick={handleGenerateConfig}
                                        disabled={generating}
                                        className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                                    >
                                        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                        {generating ? 'Designing...' : 'Auto-Design Personality'}
                                    </button>
                                </div>
                                <div id="magic-notify" className="text-center text-xs text-emerald-600 font-bold mb-2 opacity-0 transition-opacity duration-500"></div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                                        <textarea
                                            value={config?.businessDescription || ''}
                                            onChange={(e) => setConfig({ ...config, businessDescription: e.target.value })}
                                            placeholder="We are a luxury spa offering massages and facials..."
                                            rows={4}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5">The 'Auto-Design' button uses this description to configure everything else!</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Custom Instructions</label>
                                        <textarea
                                            value={config?.customInstructions || ''}
                                            onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
                                            placeholder="Example: Never offer refunds without approval..."
                                            rows={3}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none text-sm"
                                        />
                                    </div>
                                </div>
                            </section>

                            <hr className="border-gray-100" />

                            {/* Personality Tuning */}
                            <section>
                                <div className="flex items-center gap-2 mb-6">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    <h2 className="text-lg font-bold text-gray-900">Personality Tuning</h2>
                                </div>

                                <div className="space-y-8 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    {/* Formality */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-semibold text-gray-700">Formality</label>
                                            <span className="text-sm font-medium text-gray-500">{config?.toneFormality || 5}/10</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={config?.toneFormality || 5}
                                            onChange={(e) => setConfig({ ...config, toneFormality: parseInt(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                        <div className="flex justify-between mt-1.5 text-xs text-gray-500 font-medium">
                                            <span>Surfer Dude 🏄‍♂️</span>
                                            <span>Supreme Court ⚖️</span>
                                        </div>
                                    </div>

                                    {/* Enthusiasm */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-semibold text-gray-700">Enthusiasm</label>
                                            <span className="text-sm font-medium text-gray-500">{config?.toneEnthusiasm || 5}/10</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={config?.toneEnthusiasm || 5}
                                            onChange={(e) => setConfig({ ...config, toneEnthusiasm: parseInt(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <div className="flex justify-between mt-1.5 text-xs text-gray-500 font-medium">
                                            <span>Robot 🤖</span>
                                            <span>Cheerleader 🎉</span>
                                        </div>
                                    </div>

                                    {/* Emojis Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Smile className="w-5 h-5 text-gray-600" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Use Emojis</p>
                                                <p className="text-xs text-gray-500">Adds warmth to messages</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setConfig({ ...config, useEmojis: !config?.useEmojis })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config?.useEmojis ? 'bg-purple-600' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config?.useEmojis ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <hr className="border-gray-100" />

                            {/* Response Settings */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <MessageSquare className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-bold text-gray-900">Response Style</h2>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    {['short', 'medium', 'long'].map((length) => (
                                        <button
                                            key={length}
                                            onClick={() => setConfig({ ...config, responseLength: length })}
                                            className={`p-3 rounded-xl border-2 transition-all ${config?.responseLength === length
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-100 hover:border-gray-200 bg-white'
                                                }`}
                                        >
                                            <span className="block text-sm font-bold text-gray-900 capitalize mb-0.5">{length}</span>
                                            <span className="block text-xs text-gray-500">
                                                {length === 'short' ? '< 100 chars' : length === 'medium' ? '100-300 chars' : '> 300 chars'}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Greeting Message (First Time)</label>
                                    <textarea
                                        value={config?.greetingFirstTime || ''}
                                        onChange={(e) => setConfig({ ...config, greetingFirstTime: e.target.value })}
                                        placeholder="Hi! Welcome to [Business Name]..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm shadow-sm"
                                    />
                                </div>
                            </section>

                        </div>
                    </div>

                    {/* RIGHT PANEL - Sticky Live Playground (45% Width) */}
                    <div className="w-[450px] xl:w-[550px] bg-slate-50 p-6 flex flex-col h-full border-l border-gray-200 shadow-[inset_4px_0_24px_-12px_rgba(0,0,0,0.05)]">
                        <div className="mb-4">
                            <h3 className="font-bold text-gray-900">Live Preview</h3>
                            <p className="text-xs text-gray-500">Test your settings instantly. No saving required.</p>
                        </div>
                        <div className="flex-1 overflow-hidden shadow-lg rounded-2xl border border-gray-200/50">
                            <AIPlayground config={config} className="h-full" />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
