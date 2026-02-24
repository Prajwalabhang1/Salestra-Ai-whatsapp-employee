'use client'

import { useReducer, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    MessageCircle, CheckCircle, AlertCircle, Wifi, WifiOff,
    Smartphone, QrCode, Phone, ChevronRight, Zap, Shield,
    Loader, Power, RefreshCw
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'

// PRODUCTION-GRADE STATE MANAGEMENT
type WhatsAppPhase = 'idle' | 'creating' | 'qr_ready' | 'scanning' | 'connected' | 'error'

type WhatsAppState = {
    phase: WhatsAppPhase
    instanceName: string | null
    qrCode: string | null
    error: string | null
    instance: any
    isLoading: boolean
    whatsappNumber: string
}

type Action =
    | { type: 'SET_NUMBER'; payload: string }
    | { type: 'CREATE_START' }
    | { type: 'QR_RECEIVED'; payload: { qrCode: string; instanceName: string } }
    | { type: 'INSTANCE_EXISTS'; payload: { instance: any; qrCode?: string } }
    | { type: 'CONNECTED'; payload: any }
    | { type: 'ERROR'; payload: string }
    | { type: 'RESET' }
    | { type: 'RETRY' }

const initialState: WhatsAppState = {
    phase: 'idle',
    instanceName: null,
    qrCode: null,
    error: null,
    instance: null,
    isLoading: false,
    whatsappNumber: ''
}

// ATOMIC STATE TRANSITIONS - Prevents race conditions
function whatsappReducer(state: WhatsAppState, action: Action): WhatsAppState {
    console.log('[Reducer]', action.type, action)

    switch (action.type) {
        case 'SET_NUMBER':
            return { ...state, whatsappNumber: action.payload, error: null }

        case 'CREATE_START':
            return {
                ...state,
                phase: 'creating',
                isLoading: true,
                error: null,
                qrCode: null
            }

        case 'QR_RECEIVED':
            return {
                ...state,
                phase: 'qr_ready',
                qrCode: action.payload.qrCode,
                instanceName: action.payload.instanceName,
                isLoading: false,
                error: null
            }

        case 'INSTANCE_EXISTS':
            return {
                ...state,
                phase: action.payload.qrCode ? 'qr_ready' : 'scanning',
                instance: action.payload.instance,
                qrCode: action.payload.qrCode || null,
                isLoading: false
            }

        case 'CONNECTED':
            return {
                ...state,
                phase: 'connected',
                instance: action.payload,
                qrCode: null,
                isLoading: false,
                error: null
            }

        case 'ERROR':
            return {
                ...state,
                phase: 'error',
                error: action.payload,
                isLoading: false
            }

        case 'RETRY':
            return {
                ...state,
                phase: 'idle',
                error: null,
                qrCode: null
            }

        case 'RESET':
            return initialState

        default:
            return state
    }
}

export default function WhatsAppPage() {
    const router = useRouter()
    const [state, dispatch] = useReducer(whatsappReducer, initialState)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        // Restore QR from localStorage if exists (< 2 minutes old)
        const saved = localStorage.getItem('whatsapp_qr')
        if (saved) {
            try {
                const { qrCode, instanceName, timestamp } = JSON.parse(saved)
                if (Date.now() - timestamp < 120000) { // 2 minutes
                    console.log('[Frontend] Restored QR from localStorage')
                    dispatch({ type: 'QR_RECEIVED', payload: { qrCode, instanceName } })
                } else {
                    localStorage.removeItem('whatsapp_qr')
                }
            } catch (e) {
                localStorage.removeItem('whatsapp_qr')
            }
        }

        // Fetch instance details
        fetchInstanceDetails()
    }, [router])

    // Persist QR to localStorage
    useEffect(() => {
        if (state.qrCode && state.instanceName) {
            localStorage.setItem('whatsapp_qr', JSON.stringify({
                qrCode: state.qrCode,
                instanceName: state.instanceName,
                timestamp: Date.now()
            }))
        }
    }, [state.qrCode, state.instanceName])

    // Auto-polling when in qr_ready phase
    useEffect(() => {
        if (state.phase !== 'qr_ready' && state.phase !== 'scanning') return

        let pollInterval = 2000
        let pollCount = 0

        const poll = async () => {
            try {
                const data = await fetchInstanceDetails()

                if (data?.connected) {
                    dispatch({ type: 'CONNECTED', payload: data.instance })
                    localStorage.removeItem('whatsapp_qr')
                    return
                }

                // Exponential backoff: 2s → 3s → 5s → 8s → max 10s
                pollCount++
                pollInterval = Math.min(pollInterval * 1.5, 10000)
                setTimeout(poll, pollInterval)

            } catch (error) {
                console.error('[Poll] Error:', error)
                setTimeout(poll, pollInterval * 2)
            }
        }

        const timer = setTimeout(poll, pollInterval)
        return () => clearTimeout(timer)

    }, [state.phase])

    const fetchInstanceDetails = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/whatsapp/instance-details', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const data = await response.json()

            console.log('[Frontend] Instance details:', data)

            if (data.success) {
                if (data.connected) {
                    dispatch({ type: 'CONNECTED', payload: data.instance })
                } else if (data.instance) {
                    dispatch({ type: 'INSTANCE_EXISTS', payload: { instance: data.instance } })
                }
            }
            return data
        } catch (error) {
            console.error('[Frontend] Fetch error:', error)
        }
    }

    const handleConnect = async () => {
        if (!state.whatsappNumber || state.whatsappNumber.length < 10) {
            dispatch({ type: 'ERROR', payload: 'Please enter a valid WhatsApp number with country code' })
            return
        }

        dispatch({ type: 'CREATE_START' })

        try {
            const response = await fetch('http://localhost:3000/api/whatsapp/create-instance', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ whatsappNumber: state.whatsappNumber })
            })
            const data = await response.json()

            console.log('[Frontend] Create response:', data)

            if (data.success && data.qrCode) {
                dispatch({
                    type: 'QR_RECEIVED',
                    payload: { qrCode: data.qrCode, instanceName: data.instanceName }
                })
            } else if (data.success) {
                dispatch({ type: 'ERROR', payload: 'QR code not available. Please try again.' })
            } else {
                dispatch({ type: 'ERROR', payload: data.error || 'Failed to create instance' })
            }
        } catch (error) {
            dispatch({ type: 'ERROR', payload: 'Network error. Please try again.' })
        }
    }

    const handleDisconnect = async () => {
        // Implementation
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
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${state.phase === 'connected'
                        ? 'bg-white/20 border border-white/30'
                        : 'bg-amber-500/20 border border-amber-300/30'
                        }`}>
                        {state.phase === 'connected' ? (
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
                        {/* Error Message */}
                        {state.phase === 'error' && (
                            <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-50 border-2 border-red-200">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-medium text-red-800">{state.error}</p>
                                    <button
                                        onClick={() => dispatch({ type: 'RETRY' })}
                                        className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                                    >
                                        Try again →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Phase-based rendering */}
                        {(state.phase === 'idle' || state.phase === 'error') && (
                            <SetupView
                                whatsappNumber={state.whatsappNumber}
                                setWhatsappNumber={(val) => dispatch({ type: 'SET_NUMBER', payload: val })}
                                onConnect={handleConnect}
                                loading={state.isLoading}
                            />
                        )}

                        {state.phase === 'creating' && <CreatingView />}

                        {/* Show QR if available, regardless of phase */}
                        {state.qrCode && (state.phase === 'qr_ready' || state.phase === 'scanning') && (
                            <QRCodeView qrCode={state.qrCode} />
                        )}

                        {/* If scanning phase but no QR, show reconnect option */}
                        {state.phase === 'scanning' && !state.qrCode && state.instance && (
                            <ScanningView
                                instance={state.instance}
                                onReconnect={() => dispatch({ type: 'RETRY' })}
                            />
                        )}

                        {state.phase === 'connected' && state.instance && (
                            <ConnectedView instance={state.instance} onDisconnect={handleDisconnect} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Components remain the same...
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
        </div>
    )
}

function CreatingView() {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <Loader className="w-16 h-16 text-emerald-600 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Creating Instance...</h3>
            <p className="text-gray-600">This may take up to 30 seconds</p>
            <div className="mt-4 w-64 mx-auto bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
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

                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-lg py-3">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Waiting for scan...</span>
                </div>
            </div>
        </div>
    )
}

function ScanningView({ instance, onReconnect }: { instance: any; onReconnect: () => void }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-10 h-10 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Instance Found</h2>
                <p className="text-gray-600">A WhatsApp instance exists but is not connected</p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Instance ID:</span>
                        <span className="text-sm font-mono text-gray-900">{instance.instanceId}</span>
                    </div>
                    {instance.whatsappNumber && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Number:</span>
                            <span className="text-sm font-mono text-gray-900">{instance.whatsappNumber}</span>
                        </div>
                    )}
                    {instance.businessName && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Business:</span>
                            <span className="text-sm text-gray-900">{instance.businessName}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                            {instance.status || 'Not Connected'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={onReconnect}
                    className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                    <RefreshCw className="w-6 h-6" />
                    <span>Generate New QR Code</span>
                </button>

                <p className="text-xs text-gray-500 text-center">
                    Click above to generate a new QR code and reconnect this instance
                </p>
            </div>
        </div>
    )
}

function ConnectedView({ instance, onDisconnect }: any) {
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
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
                <Power className="w-5 h-5" />
                <span>Disconnect WhatsApp</span>
            </button>
        </div>
    )
}
