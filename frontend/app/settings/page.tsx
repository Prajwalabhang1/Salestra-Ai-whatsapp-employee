'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Settings, User, Bell, Shield, Lock, Globe,
    Save, Loader2, CheckCircle2, ChevronRight,
    Mail, LogOut, Clock, Smartphone, AlertTriangle,
    Moon, Sun, Laptop, Menu
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '../../components/Sidebar'

// ============================================================================
// TYPES & DEFAULTS
// ============================================================================

interface SettingsState {
    email: string
    timezone: string
    notifications: {
        email: boolean
        escalation: boolean
        dailyReport: boolean
        whatsapp_alerts: boolean
    }
    theme?: 'light' | 'dark' | 'system'
}

interface ActivityLog {
    id: string
    action: string
    details: any
    ip: string
    timestamp: string
}

const DEFAULT_SETTINGS: SettingsState = {
    email: '',
    timezone: 'Asia/Kolkata',
    notifications: {
        email: true,
        escalation: true,
        dailyReport: false,
        whatsapp_alerts: true
    },
    theme: 'system'
}

const TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'New Delhi (IST)' },
    { value: 'America/New_York', label: 'New York (EST)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
]

// ============================================================================
// COMPONENTS
// ============================================================================

const Toggle = ({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
    <div className="flex items-center justify-between py-4 group">
        <div className="flex-1 pr-4">
            <h4 className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">{label}</h4>
            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                ${checked ? 'bg-emerald-600 border-emerald-600' : 'bg-gray-200 border-gray-200'}
            `}
        >
            <span
                className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `}
            />
        </button>
    </div>
)

const SectionHeader = ({ title, description, icon: Icon }: any) => (
    <div className="mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>
        <p className="text-sm text-gray-500 ml-11">{description}</p>
    </div>
)

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SettingsPage() {
    const router = useRouter()

    // State
    const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [activeSection, setActiveSection] = useState('account')
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Feature States
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '' })

    // Theme Handler
    useEffect(() => {
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else if (settings.theme === 'light') {
            document.documentElement.classList.remove('dark')
        } else {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark')
            } else {
                document.documentElement.classList.remove('dark')
            }
        }
    }, [settings.theme])

    // Fetch Activity Logs
    useEffect(() => {
        if (activeSection === 'security') {
            const token = localStorage.getItem('token')
            if (token) {
                fetch('http://localhost:3000/api/settings/activity', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) setActivityLogs(data.logs)
                    })
                    .catch(err => console.error("Activity fetch error", err))
            }
        }
    }, [activeSection])

    // Initial Fetch
    useEffect(() => {
        const fetchSettings = async () => {
            const token = localStorage.getItem('token')
            if (!token) {
                router.push('/login')
                return
            }

            try {
                const response = await fetch('http://localhost:3000/api/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                if (response.ok) {
                    const data = await response.json()
                    // Merge with defaults to ensure all fields exist
                    setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
                }
            } catch (error) {
                console.error("Failed to load settings:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [router])

    // Change Handler
    const handleSettingChange = (key: keyof SettingsState | string, value: any) => {
        setHasUnsavedChanges(true)
        if (key.includes('.')) {
            const [parent, child] = key.split('.')
            setSettings(prev => ({
                ...prev,
                [parent]: {
                    ...(prev as any)[parent],
                    [child]: value
                }
            }))
        } else {
            setSettings(prev => ({ ...prev, [key]: value }))
        }
    }

    const updateNotification = (key: string, value: boolean) => handleSettingChange(`notifications.${key}`, value)

    const handleSave = async () => {
        setSaving(true)
        setToast(null)
        try {
            await fetch('http://localhost:3000/api/settings', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            })
            setToast({ message: 'Settings saved successfully', type: 'success' })
            setHasUnsavedChanges(false)
            setTimeout(() => setToast(null), 3000)
        } catch (error) {
            setToast({ message: 'Failed to save settings', type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (!passwordForm.current || !passwordForm.new) {
            setToast({ message: 'Please fill both fields', type: 'error' })
            return
        }

        try {
            const res = await fetch('http://localhost:3000/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new })
            })
            const data = await res.json()
            if (data.success) {
                setToast({ message: 'Password changed successfully', type: 'success' })
                setShowPasswordModal(false)
                setPasswordForm({ current: '', new: '' })
            } else {
                setToast({ message: data.error || 'Failed to change password', type: 'error' })
            }
        } catch (e) {
            setToast({ message: 'Network error', type: 'error' })
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="flex h-screen bg-slate-50">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-sm font-medium text-emerald-700 animate-pulse">Loading preferences...</span>
                    </div>
                </div>
            </div>
        )
    }

    const navigation = [
        { id: 'account', label: 'Account & Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security & Access', icon: Shield },
        { id: 'preferences', label: 'App Preferences', icon: Settings },
    ]

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-gray-900">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {/* Header */}
                <header className="px-8 py-5 bg-white border-b border-gray-200 z-10 flex items-center justify-between shrink-0 shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            <Settings className="w-7 h-7 text-emerald-600 fill-emerald-50" />
                            Control Center
                        </h1>
                    </div>

                    <AnimatePresence>
                        {hasUnsavedChanges && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="flex items-center gap-4"
                            >
                                <span className="text-sm text-gray-500 hidden md:block">You have unsaved changes</span>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-semibold shadow-lg hover:bg-black hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:transform-none flex items-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </header>

                {/* Main Layout */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

                    {/* Settings Sidebar */}
                    <nav className="w-full md:w-64 lg:w-72 bg-white/50 border-r border-gray-200 p-4 space-y-1 overflow-y-auto md:block hidden backdrop-blur-sm">
                        <div className="mb-4 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Settings Menu
                        </div>
                        {navigation.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                    ${activeSection === item.id
                                        ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                                        : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900'}
                                `}
                            >
                                <item.icon className={`w-4 h-4 ${activeSection === item.id ? 'text-emerald-600' : 'text-gray-400'}`} />
                                {item.label}
                                {activeSection === item.id && (
                                    <ChevronRight className="w-4 h-4 ml-auto text-emerald-400" />
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Mobile Navigation (Horizontal) */}
                    <nav className="md:hidden flex overflow-x-auto border-b border-gray-200 bg-white p-2 gap-2 hide-scrollbar shrink-0">
                        {navigation.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                                    ${activeSection === item.id
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-600'}
                                `}
                            >
                                <item.icon className="w-3 h-3" />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* Content Area */}
                    <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative">
                        <div className="max-w-3xl mx-auto space-y-8 pb-20">

                            {/* Toast Notification */}
                            <AnimatePresence>
                                {toast && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        className={`absolute bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 text-sm font-medium z-50 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                            }`}
                                    >
                                        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                        {toast.message}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* SECTIONS */}

                            {/* Account Section */}
                            {activeSection === 'account' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <SectionHeader
                                        title="Account & Profile"
                                        description="Manage your personal information and login details."
                                        icon={User}
                                    />

                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="col-span-2">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="email"
                                                        value={settings.email}
                                                        onChange={(e) => handleSettingChange('email', e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                                                        placeholder="name@company.com"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Used for login and important alerts.</p>
                                            </div>

                                            <div className="col-span-2">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Timezone</label>
                                                <div className="relative">
                                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <select
                                                        value={settings.timezone}
                                                        onChange={(e) => handleSettingChange('timezone', e.target.value)}
                                                        className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none transition-all outline-none"
                                                    >
                                                        {TIMEZONES.map(tz => (
                                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">All times in analytics will be displayed in this timezone.</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Notifications Section */}
                            {activeSection === 'notifications' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <SectionHeader
                                        title="Notification Preferences"
                                        description="Choose how and when you want to be alerted."
                                        icon={Bell}
                                    />

                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 divide-y divide-gray-100">
                                        <Toggle
                                            label="Email Alerts"
                                            description="Receive daily summaries and critical system alerts via email."
                                            checked={settings.notifications.email}
                                            onChange={(v) => updateNotification('email', v)}
                                        />
                                        <Toggle
                                            label="Escalation Alerts"
                                            description="Get instant notifications when AI cannot handle a query."
                                            checked={settings.notifications.escalation}
                                            onChange={(v) => updateNotification('escalation', v)}
                                        />
                                        <Toggle
                                            label="Daily Analysis Report"
                                            description="Receive a PDF report of yesterday's performance every morning."
                                            checked={settings.notifications.dailyReport}
                                            onChange={(v) => updateNotification('dailyReport', v)}
                                        />
                                        <Toggle
                                            label="WhatsApp System Alerts"
                                            description="Receive system health alerts directly on your connected WhatsApp."
                                            checked={settings.notifications.whatsapp_alerts}
                                            onChange={(v) => updateNotification('whatsapp_alerts', v)}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {/* Security Section (Updated) */}
                            {activeSection === 'security' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <SectionHeader
                                        title="Security & Access"
                                        description="Protect your account and view activity."
                                        icon={Shield}
                                    />

                                    <div className="space-y-6">
                                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                                                <Lock className="w-4 h-4 text-emerald-600" /> Password & Authentication
                                            </h3>
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 mb-4">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">Password</p>
                                                    <p className="text-xs text-gray-500">Last changed recently</p>
                                                </div>
                                                <button
                                                    onClick={() => setShowPasswordModal(true)}
                                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                                >
                                                    Change Password
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                                                    <p className="text-xs text-gray-500">Secure your account with 2FA</p>
                                                </div>
                                                <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors text-emerald-600">
                                                    Enable 2FA
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-emerald-600" /> Recent Activity
                                            </h3>
                                            <div className="space-y-3">
                                                {activityLogs.length > 0 ? activityLogs.map((log) => (
                                                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                                                                <Laptop className="w-3 h-3" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{log.action}</p>
                                                                <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-mono text-gray-400">{log.ip}</span>
                                                    </div>
                                                )) : (
                                                    <p className="text-sm text-gray-500 text-center py-4">No recent activity recorded.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Preferences Section */}
                            {activeSection === 'preferences' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <SectionHeader
                                        title="App Preferences"
                                        description="Customize your workspace appearance."
                                        icon={Settings}
                                    />

                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { id: 'light', label: 'Light', icon: Sun },
                                                { id: 'dark', label: 'Dark', icon: Moon },
                                                { id: 'system', label: 'System', icon: Laptop },
                                            ].map((theme) => (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => handleSettingChange('theme', theme.id)}
                                                    className={`
                                                        flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all
                                                        ${settings.theme === theme.id
                                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                            : 'border-gray-100 hover:border-emerald-200 hover:bg-gray-50'}
                                                    `}
                                                >
                                                    <theme.icon className={`w-6 h-6 ${settings.theme === theme.id ? 'text-emerald-600' : 'text-gray-400'}`} />
                                                    <span className="text-sm font-bold">{theme.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                        </div>
                    </main>
                </div>

                {/* Password Modal */}
                <AnimatePresence>
                    {showPasswordModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
                            >
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Change Password</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={passwordForm.current}
                                            onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={passwordForm.new}
                                            onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setShowPasswordModal(false)}
                                            className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleChangePassword}
                                            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                                        >
                                            Update Password
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <style jsx>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    )
}
