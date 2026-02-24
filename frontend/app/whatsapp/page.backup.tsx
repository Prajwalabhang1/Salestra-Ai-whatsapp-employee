'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    MessageCircle, Check, RefreshCw, Power, TestTube,
    AlertCircle, Wifi, WifiOff, Smartphone, QrCode,
    Phone, ChevronRight, Zap, Shield, CheckCircle, Loader
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'

type ConnectionState = 'loading' | 'no_instance' | 'generating_qr' | 'waiting_scan' | 'connected'

export default function WhatsAppPage() {
    const router = useRouter()
    const [state, setState] = useState<ConnectionState>('loading')
    const [instance, setInstance] = useState<any>(null)
    const [whatsappNumber, setWhatsappNumber] = useState('')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }
        fetchInstanceDetails()
    }, [router])

    // Poll for connection when waiting for scan
    useEffect(() => {
        if (state === 'waiting_scan') {
            const interval = setInterval(fetchInstanceDetails, 3000) // Poll every 3 seconds
            return () => clearInterval(interval)
        }
    }, [state])

    const fetchInstanceDetails = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/whatsapp/instance-details', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const data = await response.json()

            console.log('[Frontend] Instance details:', data) // Debug polling

            if (data.success) {
                if (data.connected) {
                    console.log('[Frontend] WhatsApp is CONNECTED!')
                    setState('connected')
                    setInstance(data.instance)
                    setQrCode(null) // Clear QR code
                    setMessage({ type: 'success', text: '✅ WhatsApp Connected Successfully!' })
                } else if (data.instance) {
                    // Instance exists but not connected yet
                    console.log('[Frontend] Instance exists, not connected yet')
                    setInstance(data.instance)
                    if (state === 'loading') {
                        setState(qrCode ? 'waiting_scan' : 'no_instance')
                    }
                    // Keep current state if waiting_scan
                } else {
                    // No instance
                    console.log('[Frontend] No instance found')
                    if (state === 'loading') {
                        setState('no_instance')
                    }
                    setInstance(null)
                }
            }
        } catch (error) {
            console.error('[Frontend] Failed to fetch instance details:', error)
        } finally {
            if (state === 'loading') setState('no_instance')
        }
    }

    const handleConnect = async () => {
        if (!whatsappNumber || whatsappNumber.length < 10) {
            setMessage({ type: 'error', text: 'Please enter a valid WhatsApp number with country code' })
            return
        }

        setActionLoading(true)
        setState('generating_qr')
        setMessage(null)

        try {
            const response = await fetch('http://localhost:3000/api/whatsapp/create-instance', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ whatsappNumber })
            })
            const data = await response.json()

            console.log('[Frontend] Create instance response:', data) // Debug log

            if (data.success && data.qrCode) {
                // QR code received immediately
                console.log('[Frontend] QR code received, length:', data.qrCode.length)
                setQrCode(data.qrCode)
                setState('waiting_scan')
                setMessage({ type: 'success', text: 'QR code generated! Scan to connect' })
                fetchInstanceDetails()
            } else if (data.success) {
                // Instance created but QR not ready - fetch separately
                console.log('[Frontend] Instance created, fetching QR separately')
                setMessage({ type: 'success', text: 'Instance created! Fetching QR code...' })

                setTimeout(async () => {
                    try {
                        const qrResponse = await fetch('http://localhost:3000/api/whatsapp/qr-code', {
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        })
                        const qrData = await qrResponse.json()

                        console.log('[Frontend] QR fetch response:', qrData)

                        if (qrData.success && qrData.qrCode) {
                            setQrCode(qrData.qrCode)
                            setState('waiting_scan')
                            setMessage({ type: 'success', text: 'QR code ready! Scan to connect' })
                        } else {
                            console.error('[Frontend] No QR code in response:', qrData)
                            setMessage({ type: 'error', text: 'QR code not available yet. Try reconnecting.' })
                            setState('no_instance')
                        }
                    } catch (e) {
                        console.error('[Frontend] QR fetch error:', e)
                        setMessage({ type: 'error', text: 'Failed to fetch QR code' })
                        setState('no_instance')
                    }
                }, 2000)
            } else {
                console.error('[Frontend] Create instance failed:', data)
                setMessage({ type: 'error', text: data.error || 'Failed to create instance' })
                setState('no_instance')
            }
        } catch (error) {
            console.error('[Frontend] Network error:', error)
            setMessage({ type: 'error', text: 'Network error. Please try again.' })
            setState('no_instance')
        } finally {
            setActionLoading(false)
        }
    }

    const handleDisconnect = async () => {
        if (!confirm('Disconnect WhatsApp? Your AI will stop responding to customers.')) return

        setActionLoading(true)
        try {
            const response = await fetch('http://localhost:3000/api/whatsapp/disconnect', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const data = await response.json()

            if (data.success) {
                setMessage({ type: 'success', text: 'WhatsApp disconnected' })
                setState('no_instance')
                setInstance(null)
                setQrCode(null)
            } else {
                setMessage({ type: 'error', text: 'Failed to disconnect' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network error' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <MessageCircle className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">WhatsApp Integration</h1>
                            <p className="text-emerald-100 mt-1">Connect your business WhatsApp for AI-powered customer service</p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${state === 'connected'
                        ? 'bg-white/20 border border-white/30'
                        : 'bg-amber-500/20 border border-amber-300/30'
                        }`}>
                        {state === 'connected' ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="font-medium">Connected & Active</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 rounded-full bg-amber-300" />
                                <span className="font-medium">Not Connected</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto px-8 py-8">
                    <div className="max-w-4xl mx-auto">
                        {/* Message Alert */}
                        {message && (
                            <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'
                                }`}>
                                {message.type === 'success' ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                )}
                                <p className={`font-medium ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
                                    {message.text}
                                </p>
                            </div>
                        )}

                        {/* State Views */}
                        {state === 'loading' && <LoadingView />}
                        {state === 'generating_qr' && <GeneratingView />}
                        {state === 'waiting_scan' && qrCode && <QRCodeView qrCode={qrCode} />}
                        {state === 'waiting_scan' && !qrCode && (
                            <div className="text-center py-8">
                                <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                                <p className="text-gray-600">Fetching QR code...</p>
                            </div>
                        )}
                        {state === 'no_instance' && (
                            <SetupView
                                whatsappNumber={whatsappNumber}
                                setWhatsappNumber={setWhatsappNumber}
                                onConnect={handleConnect}
                                loading={actionLoading}
                            />
                        )}
                        {state === 'connected' && instance && (
                            <ConnectedView
                                instance={instance}
                                onDisconnect={handleDisconnect}
                                loading={actionLoading}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Component Views
function LoadingView() {
    return (
        <div className="flex items-center justify-center py-20">
            <Loader className="w-12 h-12 text-emerald-600 animate-spin" />
        </div>
    )
}

function SetupView({ whatsappNumber, setWhatsappNumber, onConnect, loading }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your WhatsApp</h2>
                <p className="text-gray-600">Enter your business WhatsApp number to enable AI customer service</p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        WhatsApp Business Number
                    </label>
                    <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="918012345678"
                        className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:outline-none text-center text-lg font-mono"
                        maxLength={15}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Include country code (e.g., <span className="font-mono font-medium">91</span> for India)
                    </p>
                </div>

                <button
                    onClick={onConnect}
                    disabled={loading || !whatsappNumber}
                    className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                >
                    {loading ? (
                        <>
                            <Loader className="w-6 h-6 animate-spin" />
                            <span>Generating QR Code...</span>
                        </>
                    ) : (
                        <>
                            <QrCode className="w-6 h-6" />
                            <span>Generate QR Code</span>
                            <ChevronRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>

            {/* Features */}
            <div className="mt-12 pt-8 border-t">
                <div className="grid md:grid-cols-3 gap-4">
                    <Feature icon={<Zap />} title="Instant Responses" desc="AI replies in seconds" />
                    <Feature icon={<Shield />} title="24/7 Availability" desc="Never miss a message" />
                    <Feature icon={<MessageCircle />} title="Smart AI" desc="Context-aware conversations" />
                </div>
            </div>
        </div>
    )
}

function GeneratingView() {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <Loader className="w-16 h-16 text-emerald-600 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating QR Code...</h3>
            <p className="text-gray-600">Please wait while we set up your WhatsApp connection</p>
        </div>
    )
}

function QRCodeView({ qrCode }: { qrCode: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan QR Code</h2>
                <p className="text-gray-600">Open WhatsApp on your phone and scan this code</p>
            </div>

            <div className="max-w-md mx-auto">
                <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-8 rounded-2xl mb-6">
                    <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="w-80 h-80 mx-auto rounded-2xl shadow-2xl bg-white p-4"
                    />
                </div>

                <div className="space-y-3 mb-6">
                    <Step num={1} text="Open WhatsApp on your phone" />
                    <Step num={2} text="Go to Settings → Linked Devices" />
                    <Step num={3} text="Tap 'Link a Device' and scan this code" />
                </div>

                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-lg py-3">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Waiting for scan...</span>
                </div>
            </div>
        </div>
    )
}

function ConnectedView({ instance, onDisconnect, loading }: any) {
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg text-white p-8">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <CheckCircle className="w-8 h-8" />
                            <h2 className="text-2xl font-bold">WhatsApp Connected!</h2>
                        </div>
                        <p className="text-emerald-100 mb-6">Your AI employee is active and ready to assist customers</p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Phone className="w-5 h-5" />
                                <span className="font-mono font-semibold text-lg">{instance.whatsappNumber || 'Connected'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-100">
                                <MessageCircle className="w-4 h-4" />
                                <span className="text-sm">{instance.businessName || 'Business Account'}</span>
                            </div>
                        </div>
                    </div>
                    <Wifi className="w-16 h-16 opacity-20" />
                </div>
            </div>

            <button
                onClick={onDisconnect}
                disabled={loading}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Disconnecting...</span>
                    </>
                ) : (
                    <>
                        <Power className="w-5 h-5" />
                        <span>Disconnect WhatsApp</span>
                    </>
                )}
            </button>
        </div>
    )
}

function Feature({ icon, title, desc }: any) {
    return (
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                {icon}
            </div>
            <div>
                <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
                <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
            </div>
        </div>
    )
}

function Step({ num, text }: any) {
    return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                {num}
            </div>
            <p className="text-gray-700 font-medium">{text}</p>
        </div>
    )
}
