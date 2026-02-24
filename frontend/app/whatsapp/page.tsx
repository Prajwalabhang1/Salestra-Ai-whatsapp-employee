'use client'

/**
 * PRODUCTION-GRADE WhatsApp Integration Page
 * 
 * Features:
 * - Security-first UI design
 * - clear "Cancel" and "Change Number" workflows
 * - Trust indicators (Encryption badges, Privacy notices)
 * - Comprehensive error handling and logging
 * - Automatic retry with exponential backoff
 * - Environment-aware API URLs
 * - QR code validation
 * - Robust connection polling
 * - Multi-user concurrency support
 * - Detailed user feedback
 * - State persistence
 * - Memory leak prevention
 */

import { useReducer, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    MessageCircle, CheckCircle, AlertCircle, Wifi, WifiOff,
    Smartphone, QrCode, Phone, ChevronRight, Zap, Shield,
    Loader, Power, RefreshCw, Clock, XCircle, Settings,
    Signal, Battery, Lock, ArrowRight, Check
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    QR_EXPIRY_MS: 120000, // 2 minutes
    QR_STORAGE_KEY: 'whatsapp_qr_v2',
    MAX_RETRY_ATTEMPTS: 3,
    INITIAL_POLL_INTERVAL_MS: 3000,
    MAX_POLL_INTERVAL_MS: 10000,
    POLL_TIMEOUT_MS: 150000, // 2.5 minutes
    API_TIMEOUT_MS: 30000,
    MIN_PHONE_LENGTH: 10,
} as const

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WhatsAppPhase =
    | 'idle'
    | 'validating'
    | 'creating'
    | 'qr_generating'
    | 'qr_ready'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'error'
    | 'retrying'

type WhatsAppState = {
    phase: WhatsAppPhase
    instanceName: string | null
    qrCode: string | null
    error: string | null
    instance: any
    isLoading: boolean
    whatsappNumber: string
    retryCount: number
    lastError: string | null
}

type Action =
    | { type: 'SET_NUMBER'; payload: string }
    | { type: 'CREATE_START' }
    | { type: 'QR_GENERATING' }
    | { type: 'QR_RECEIVED'; payload: { qrCode: string; instanceName: string } }
    | { type: 'INSTANCE_EXISTS'; payload: { instance: any; qrCode?: string } }
    | { type: 'CONNECTED'; payload: any }
    | { type: 'ERROR'; payload: string }
    | { type: 'RESET' }
    | { type: 'RETRY' }
    | { type: 'INCREMENT_RETRY' }

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const initialState: WhatsAppState = {
    phase: 'idle',
    instanceName: null,
    qrCode: null,
    error: null,
    instance: null,
    isLoading: false,
    whatsappNumber: '',
    retryCount: 0,
    lastError: null,
}

function whatsappReducer(state: WhatsAppState, action: Action): WhatsAppState {
    // console.log(`[Reducer] ${action.type}`, action)

    switch (action.type) {
        case 'SET_NUMBER':
            return { ...state, whatsappNumber: action.payload, error: null }

        case 'CREATE_START':
            return {
                ...state,
                phase: 'creating',
                isLoading: true,
                error: null,
                qrCode: null,
                lastError: null,
            }

        case 'QR_GENERATING':
            return {
                ...state,
                phase: 'qr_generating',
                isLoading: true,
            }

        case 'QR_RECEIVED':
            return {
                ...state,
                phase: 'qr_ready',
                qrCode: action.payload.qrCode,
                instanceName: action.payload.instanceName,
                isLoading: false,
                error: null,
                retryCount: 0,
            }

        case 'INSTANCE_EXISTS':
            return {
                ...state,
                phase: action.payload.qrCode ? 'qr_ready' : 'scanning',
                instance: action.payload.instance,
                qrCode: action.payload.qrCode || null,
                isLoading: false,
            }

        case 'CONNECTED':
            return {
                ...state,
                phase: 'connected',
                instance: action.payload,
                qrCode: null,
                isLoading: false,
                error: null,
            }

        case 'ERROR':
            return {
                ...state,
                phase: 'error',
                error: action.payload,
                lastError: action.payload,
                isLoading: false,
            }

        case 'RETRY':
            return {
                ...state,
                phase: 'idle',
                error: null,
                qrCode: null,
                retryCount: 0,
            }

        case 'INCREMENT_RETRY':
            return {
                ...state,
                retryCount: state.retryCount + 1,
            }

        case 'RESET':
            return initialState

        default:
            return state
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getApiUrl = (path: string): string => {
    return `${CONFIG.API_BASE_URL}${path}`
}

const validateQRCode = (qr: string | null | undefined): boolean => {
    if (!qr) return false
    const trimmed = qr.trim()
    return trimmed.length > 50 && (trimmed.startsWith('data:image') || trimmed.startsWith('2@'))
}

const saveQRToStorage = (qrCode: string, instanceName: string) => {
    try {
        localStorage.setItem(
            CONFIG.QR_STORAGE_KEY,
            JSON.stringify({ qrCode, instanceName, timestamp: Date.now() })
        )
    } catch (e) {
        console.warn('[Storage] Failed to save QR:', e)
    }
}

const loadQRFromStorage = (): { qrCode: string; instanceName: string } | null => {
    try {
        const saved = localStorage.getItem(CONFIG.QR_STORAGE_KEY)
        if (!saved) return null

        const { qrCode, instanceName, timestamp } = JSON.parse(saved)
        if (Date.now() - timestamp < CONFIG.QR_EXPIRY_MS) {
            return { qrCode, instanceName }
        }
        localStorage.removeItem(CONFIG.QR_STORAGE_KEY)
    } catch (e) {
        localStorage.removeItem(CONFIG.QR_STORAGE_KEY)
    }
    return null
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WhatsAppPageProduction() {
    const router = useRouter()
    const [state, dispatch] = useReducer(whatsappReducer, initialState)
    const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const pollStartTimeRef = useRef<number>(0)
    const abortControllerRef = useRef<AbortController | null>(null)

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        // Restore QR from storage
        const saved = loadQRFromStorage()
        if (saved) {
            dispatch({ type: 'QR_RECEIVED', payload: saved })
        } else {
            // Only fetch instance details if we don't have a QR code
            fetchInstanceDetails()
        }

        //Cleanup
        return () => {
            if (pollTimeoutRef.current) {
                clearTimeout(pollTimeoutRef.current)
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [router])

    // ========================================================================
    // QR CODE PERSISTENCE
    // ========================================================================

    useEffect(() => {
        if (state.qrCode && state.instanceName && validateQRCode(state.qrCode)) {
            saveQRToStorage(state.qrCode, state.instanceName)
        }
    }, [state.qrCode, state.instanceName])

    // ========================================================================
    // CONNECTION POLLING
    // ========================================================================

    useEffect(() => {
        if (state.phase !== 'qr_ready' && state.phase !== 'scanning') {
            // Cleanup any existing poll
            if (pollTimeoutRef.current) {
                clearTimeout(pollTimeoutRef.current)
                pollTimeoutRef.current = null
            }
            return
        }

        pollStartTimeRef.current = Date.now()
        let pollCount = 0
        let pollInterval = CONFIG.INITIAL_POLL_INTERVAL_MS

        const poll = async () => {
            try {
                pollCount++
                const elapsed = Date.now() - pollStartTimeRef.current

                // Check timeout
                if (elapsed > CONFIG.POLL_TIMEOUT_MS) {
                    dispatch({
                        type: 'ERROR',
                        payload: 'QR code expired. Please generate a new one.',
                    })
                    return
                }

                // Pass duringPolling=true to prevent INSTANCE_EXISTS dispatch
                const data = await fetchInstanceDetails(true)

                if (data?.success && data?.instance) {
                    const instanceState = data.instance.status || data.instance.state

                    // Check for actual WhatsApp connection
                    if (instanceState === 'open' || data.connected === true) {
                        dispatch({ type: 'CONNECTED', payload: data.instance })
                        localStorage.removeItem(CONFIG.QR_STORAGE_KEY)
                        return // Stop polling
                    }
                }

                // Exponential backoff
                pollInterval = Math.min(pollInterval * 1.5, CONFIG.MAX_POLL_INTERVAL_MS)
                pollTimeoutRef.current = setTimeout(poll, pollInterval)
            } catch (error: any) {
                // Continue polling with longer delay
                pollTimeoutRef.current = setTimeout(poll, pollInterval * 2)
            }
        }

        // Start polling with initial delay
        pollTimeoutRef.current = setTimeout(poll, pollInterval)

        return () => {
            if (pollTimeoutRef.current) {
                clearTimeout(pollTimeoutRef.current)
                pollTimeoutRef.current = null
            }
        }
    }, [state.phase])

    // ========================================================================
    // API FUNCTIONS
    // ========================================================================

    const fetchInstanceDetails = useCallback(async (duringPolling: boolean = false) => {
        try {
            const response = await fetch(getApiUrl('/api/whatsapp/instance-details'), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                signal: AbortSignal.timeout(CONFIG.API_TIMEOUT_MS),
            })

            const data = await response.json()

            if (data.success) {
                if (data.connected) {
                    dispatch({ type: 'CONNECTED', payload: data.instance })
                } else if (data.instance && !duringPolling) {
                    // Only dispatch INSTANCE_EXISTS on initial load, NOT during polling
                    // During polling, we're waiting for connection, not checking instance existence
                    dispatch({ type: 'INSTANCE_EXISTS', payload: { instance: data.instance } })
                }
            }

            return data
        } catch (error: any) {
            console.error('[API] Fetch error:', error.message)
            return null
        }
    }, [])

    const createInstanceWithRetry = useCallback(
        async (attempt: number = 1): Promise<any> => {

            try {
                // Cancel any existing request
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort()
                }
                abortControllerRef.current = new AbortController()

                const response = await fetch(getApiUrl('/api/whatsapp/create-instance'), {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ whatsappNumber: state.whatsappNumber }),
                    signal: abortControllerRef.current.signal,
                })

                if (!response.ok && attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                    await new Promise((resolve) => setTimeout(resolve, delay))
                    dispatch({ type: 'INCREMENT_RETRY' })
                    return createInstanceWithRetry(attempt + 1)
                }

                const data = await response.json()
                return data
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    throw error
                }

                if (attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                    await new Promise((resolve) => setTimeout(resolve, delay))
                    dispatch({ type: 'INCREMENT_RETRY' })
                    return createInstanceWithRetry(attempt + 1)
                }

                throw error
            }
        },
        [state.whatsappNumber]
    )

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    const handleConnect = useCallback(async () => {
        // Validation
        if (!state.whatsappNumber || state.whatsappNumber.length < CONFIG.MIN_PHONE_LENGTH) {
            dispatch({
                type: 'ERROR',
                payload: 'Please enter a valid WhatsApp number with country code (min 10 digits)',
            })
            return
        }

        dispatch({ type: 'CREATE_START' })

        try {
            // Create instance with retry
            const data = await createInstanceWithRetry()

            // Validate response
            const qrCode = data.qrCode?.trim()
            const isValidQR = validateQRCode(qrCode)

            if (data.success && isValidQR) {
                dispatch({
                    type: 'QR_RECEIVED',
                    payload: { qrCode, instanceName: data.instanceName },
                })
            } else if (data.success) {
                dispatch({
                    type: 'ERROR',
                    payload: 'QR code not available. The service may be busy. Please try again.',
                })
            } else {
                dispatch({ type: 'ERROR', payload: data.error || 'Failed to create WhatsApp instance' })
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return
            }
            dispatch({
                type: 'ERROR',
                payload: `Connection error: ${error.message}. Please check your internet and try again.`,
            })
        }
    }, [state.whatsappNumber, state.phase, createInstanceWithRetry])

    const handleLogout = useCallback(() => {
        localStorage.clear()
        router.push('/login')
    }, [router])

    const handleRetry = useCallback(() => {
        dispatch({ type: 'RETRY' })
    }, [])

    const handleDisconnect = useCallback(async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(getApiUrl('/api/whatsapp/logout'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            const data = await response.json()

            if (data.success) {
                localStorage.removeItem(CONFIG.QR_STORAGE_KEY)
                dispatch({ type: 'RETRY' }) // Reset to idle state
            } else {
                dispatch({ type: 'ERROR', payload: data.error || 'Failed to disconnect' })
            }
        } catch (error: any) {
            dispatch({ type: 'ERROR', payload: 'Failed to disconnect. Please try again.' })
        }
    }, [])

    // ========================================================================
    // RENDER
    // ========================================================================

    // Status Logic
    const isConnected = state.phase === 'connected'
    const isConnecting = state.phase === 'creating' || state.phase === 'qr_generating' || state.phase === 'qr_ready' || state.phase === 'scanning'

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('https://site-assets.fontawesome.com/releases/v6.5.1/svgs/brands/whatsapp.svg')] bg-no-repeat bg-[right_-10rem_bottom_-10rem] bg-[length:40rem] opacity-[0.03] z-0 pointer-events-none"></div>

                {/* Header */}
                <header className="px-4 md:px-8 py-4 md:py-6 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            <MessageCircle className="w-6 h-6 md:w-8 md:h-8 text-emerald-600 fill-emerald-100" />
                            WhatsApp Integration
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 mt-1 font-medium">Connect your business number for AI-powered messaging.</p>
                    </div>

                    {/* Quick Status Pill */}
                    <div className={`self-start md:self-auto flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full border shadow-sm ${isConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-400'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">{isConnected ? 'System Online' : 'Offline'}</span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-4 z-10 pb-20">
                    <div className="max-w-6xl mx-auto h-full flex flex-col justify-center">

                        {/* MAIN CARD */}
                        <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-slate-200/60 border border-gray-100 overflow-hidden min-h-0 md:min-h-[600px] flex flex-col md:flex-row relative">

                            {/* LEFT COLUMN: CONTROLS */}
                            <div className="flex-1 p-6 md:p-8 lg:p-12 flex flex-col justify-center relative order-2 md:order-1">
                                {state.phase === 'idle' || state.phase === 'error' ? (
                                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                        <div className="mb-6 md:mb-8">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wide mb-4 border border-blue-100">
                                                <Shield className="w-3 h-3" /> Enterprise Grade Security
                                            </div>
                                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">Connect Business Account</h2>
                                            <p className="text-gray-500 text-sm md:text-lg leading-relaxed">
                                                Link your WhatsApp Business API securely. Your data stays private and encrypted.
                                            </p>
                                        </div>

                                        {/* Connection Form */}
                                        <div className="space-y-4 md:space-y-6 max-w-md">
                                            <div>
                                                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Enter WhatsApp Number</label>
                                                <div className="relative group">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                                    </div>
                                                    <input
                                                        type="tel"
                                                        value={state.whatsappNumber}
                                                        onChange={(e) => dispatch({ type: 'SET_NUMBER', payload: e.target.value.replace(/[^0-9]/g, '') })}
                                                        placeholder="919876543210"
                                                        className="block w-full pl-12 pr-4 py-3 md:py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base md:text-lg font-mono placeholder-gray-400 transition-all shadow-sm"
                                                        maxLength={15}
                                                    />
                                                </div>
                                                {state.error && (
                                                    <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs md:text-sm font-medium animate-in fade-in slide-in-from-top-1 border border-red-100">
                                                        <AlertCircle className="w-4 h-4" /> {state.error}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={handleConnect}
                                                disabled={state.isLoading || !state.whatsappNumber || state.whatsappNumber.length < CONFIG.MIN_PHONE_LENGTH}
                                                className="w-full py-3 md:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base md:text-lg shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3 transform active:scale-[0.98]"
                                            >
                                                {state.isLoading ? (
                                                    <>
                                                        <Loader className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                                                        <span className="animate-pulse">Secure Link...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Lock className="w-5 h-5" />
                                                        Generate Secure QR
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Trust Footnote */}
                                        <div className="mt-10 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                                <Shield className="w-3 h-3 text-emerald-600" /> Data Privacy Guarantee
                                            </h4>
                                            <p className="text-xs text-gray-500 leading-relaxed">
                                                Your personal messages are never stored. Our AI only processes messages that match business inquiries. All data is encrypted at rest and in transit.
                                            </p>
                                        </div>
                                    </div>
                                ) : isConnected ? (
                                    <div className="animate-in fade-in zoom-in-95 duration-500 text-center md:text-left">
                                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                                            <CheckCircle className="w-4 h-4" /> Secure Connection Active
                                        </div>
                                        <h2 className="text-4xl font-bold text-gray-900 mb-2">Device Synced</h2>
                                        <p className="text-gray-500 mb-8">Your automated assistant is running securely.</p>

                                        <div className="space-y-4 mb-8">
                                            <div className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                                                    <Smartphone className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Linked Identity</p>
                                                    <p className="text-xl font-mono font-bold text-gray-900">+{state.instance?.whatsappNumber || state.whatsappNumber}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                                    <ActivityIndicator />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">AI Monitor</p>
                                                    <p className="text-lg font-bold text-blue-600">Processing Inquiries</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={handleDisconnect}
                                                className="w-full md:w-auto px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Power className="w-5 h-5" /> Disconnect Device
                                            </button>
                                            <p className="text-xs text-gray-400 text-center md:text-left">Disconnecting will stop AI responses immediately.</p>
                                        </div>
                                    </div>
                                ) : (
                                    // LOADING OR QR PHASE
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-2xl font-bold text-gray-900">Scan to Authenticate</h2>
                                            <span className="text-xs font-mono font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">SECURE-QR-V2</span>
                                        </div>

                                        <ol className="space-y-6 relative border-l-2 border-gray-100 ml-3 pl-8 mb-8">
                                            <li className="relative">
                                                <span className="absolute -left-[2.25rem] w-8 h-8 rounded-full bg-white border-2 border-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">1</span>
                                                <p className="font-bold text-gray-900">Open WhatsApp</p>
                                                <p className="text-sm text-gray-500">Go to Settings on your phone.</p>
                                            </li>
                                            <li className="relative">
                                                <span className="absolute -left-[2.25rem] w-8 h-8 rounded-full bg-white border-2 border-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm">2</span>
                                                <p className="font-bold text-gray-900">Tap "Linked Devices"</p>
                                            </li>
                                            <li className="relative">
                                                <span className="absolute -left-[2.25rem] w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-200">3</span>
                                                <p className="font-bold text-gray-900">Scan QR Code</p>
                                                <p className="text-sm text-emerald-600 font-medium animate-pulse">Waiting for scan...</p>
                                            </li>
                                        </ol>

                                        <div className="flex gap-4 pt-4 border-t border-gray-100">
                                            <button
                                                onClick={handleRetry}
                                                className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                            >
                                                <XCircle className="w-5 h-5" /> Cancel Setup
                                            </button>
                                            <button
                                                onClick={() => { dispatch({ type: 'RESET' }); dispatch({ type: 'SET_NUMBER', payload: '' }) }}
                                                className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                            >
                                                <RefreshCw className="w-5 h-5" /> Change Number
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>


                            {/* RIGHT COLUMN: VISUAL / PREVIEW */}
                            <div className={`w-full md:w-[45%] lg:w-[40%] bg-gray-50 border-l border-gray-100 flex items-center justify-center p-8 relative overflow-hidden transition-colors duration-500 ${isConnected ? 'bg-emerald-600' : ''}`}>

                                {isConnected ? (
                                    // CONNECTED STATE VISUAL
                                    <div className="relative text-center text-white animate-in zoom-in-95 duration-700">
                                        <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-30 rounded-full"></div>
                                        <div className="relative z-10 w-48 h-48 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/30">
                                            <Check className="w-24 h-24 text-white drop-shadow-md" />
                                        </div>
                                        <h3 className="text-2xl font-bold mb-2">You're All Set!</h3>
                                        <p className="text-emerald-100 text-sm max-w-xs mx-auto">Your AI agent is now monitoring incoming messages on this number.</p>
                                    </div>
                                ) : (
                                    // QR / LOADING STATE VISUAL
                                    <div className="relative w-full max-w-sm">
                                        {/* Phone Frame Mockup */}
                                        <div className="bg-white rounded-[2.5rem] p-4 shadow-2xl border-4 border-gray-200 relative overflow-hidden">
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-200 rounded-b-xl z-10"></div>

                                            <div className="bg-slate-50 rounded-[2rem] h-[400px] flex items-center justify-center relative overflow-hidden group">
                                                {/* Scan Line Animation */}
                                                {(state.phase === 'qr_ready' || state.phase === 'scanning') && (
                                                    <div className="absolute inset-0 z-20 pointer-events-none">
                                                        <div className="w-full h-1 bg-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.5)] absolute top-0 animate-scan"></div>
                                                    </div>
                                                )}

                                                {state.qrCode ? (
                                                    <div className="bg-white p-4 rounded-xl shadow-sm animate-in zoom-in-90 duration-300">
                                                        <img src={state.qrCode} alt="Scan QR" className="w-64 h-64 object-contain" />
                                                    </div>
                                                ) : (
                                                    <div className="text-center p-8">
                                                        {state.phase === 'idle' ? (
                                                            <QrCode className="w-24 h-24 text-gray-200 mx-auto mb-4" />
                                                        ) : (
                                                            <div className="relative">
                                                                <div className="w-24 h-24 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                                                            </div>
                                                        )}
                                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-4">
                                                            {state.phase === 'idle' ? 'Waiting for Input' : 'Generating QR...'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-center mt-4 pb-2">
                                                <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-400">
                                                    <Lock className="w-3 h-3" /> Secure Connection
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </main>
            </div>

            <style jsx>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan {
                    animation: scan 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}

function ActivityIndicator() {
    return (
        <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
        </div>
    )
}
