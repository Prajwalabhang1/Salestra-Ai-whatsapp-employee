'use client'

/**
 * PRODUCTION-GRADE WhatsApp Integration Page
 * 
 * Features:
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
    Loader, Power, RefreshCw, Clock, XCircle
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
    console.log(`[Reducer] ${action.type}`, action)

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
        console.group('🚀 WhatsApp Page Initialized')

        const token = localStorage.getItem('token')
        if (!token) {
            console.warn('No auth token, redirecting to login')
            console.groupEnd()
            router.push('/login')
            return
        }

        // Restore QR from storage
        const saved = loadQRFromStorage()
        if (saved) {
            console.log('✅ Restored QR from storage')
            dispatch({ type: 'QR_RECEIVED', payload: saved })
        }

        // Fetch existing instance details
        fetchInstanceDetails()

        console.groupEnd()

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

        console.log('🔄 Starting connection polling...')
        pollStartTimeRef.current = Date.now()
        let pollCount = 0
        let pollInterval = CONFIG.INITIAL_POLL_INTERVAL_MS

        const poll = async () => {
            try {
                pollCount++
                const elapsed = Date.now() - pollStartTimeRef.current

                console.log(`[Poll #${pollCount}] Checking connection (elapsed: ${Math.round(elapsed / 1000)}s)`)

                // Check timeout
                if (elapsed > CONFIG.POLL_TIMEOUT_MS) {
                    console.warn('⏱️  Polling timeout - QR likely expired')
                    dispatch({
                        type: 'ERROR',
                        payload: 'QR code expired. Please generate a new one.',
                    })
                    return
                }

                const data = await fetchInstanceDetails()

                if (data?.success && data?.instance) {
                    const instanceState = data.instance.status || data.instance.state
                    console.log(`[Poll #${pollCount}] Instance state: "${instanceState}"`)

                    // Check for actual WhatsApp connection
                    if (instanceState === 'open' || data.connected === true) {
                        console.log('✅ WhatsApp connected!')
                        dispatch({ type: 'CONNECTED', payload: data.instance })
                        localStorage.removeItem(CONFIG.QR_STORAGE_KEY)
                        return // Stop polling
                    }
                }

                // Exponential backoff
                pollInterval = Math.min(pollInterval * 1.5, CONFIG.MAX_POLL_INTERVAL_MS)
                console.log(`[Poll] Next check in ${Math.round(pollInterval / 1000)}s`)

                pollTimeoutRef.current = setTimeout(poll, pollInterval)
            } catch (error: any) {
                console.error('[Poll] Error:', error.message)
                // Continue polling with longer delay
                pollTimeoutRef.current = setTimeout(poll, pollInterval * 2)
            }
        }

        // Start polling with initial delay
        pollTimeoutRef.current = setTimeout(poll, pollInterval)

        return () => {
            console.log('[Poll] Cleanup - stopping polling')
            if (pollTimeoutRef.current) {
                clearTimeout(pollTimeoutRef.current)
                pollTimeoutRef.current = null
            }
        }
    }, [state.phase])

    // ========================================================================
    // API FUNCTIONS
    // ========================================================================

    const fetchInstanceDetails = useCallback(async () => {
        try {
            const response = await fetch(getApiUrl('/api/whatsapp/instance-details'), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                signal: AbortSignal.timeout(CONFIG.API_TIMEOUT_MS),
            })

            const data = await response.json()
            console.log('[API] Instance details:', data)

            if (data.success) {
                if (data.connected) {
                    dispatch({ type: 'CONNECTED', payload: data.instance })
                } else if (data.instance) {
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
            console.log(`📡 Create instance attempt ${attempt}/${CONFIG.MAX_RETRY_ATTEMPTS}`)

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

                console.log(`[API] Response status: ${response.status}`)

                if (!response.ok && attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                    console.log(`⏳ Retrying in ${delay}ms...`)
                    await new Promise((resolve) => setTimeout(resolve, delay))
                    dispatch({ type: 'INCREMENT_RETRY' })
                    return createInstanceWithRetry(attempt + 1)
                }

                const data = await response.json()
                console.log('[API] Response data:', data)
                return data
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.log('[API] Request aborted')
                    throw error
                }

                console.error(`[API] Error on attempt ${attempt}:`, error.message)

                if (attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                    console.log(`⏳ Retrying in ${delay}ms...`)
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
        console.group('🔵 WhatsApp Connection Flow Started')
        console.log('Phone number:', state.whatsappNumber)
        console.log('Current phase:', state.phase)

        // Validation
        if (!state.whatsappNumber || state.whatsappNumber.length < CONFIG.MIN_PHONE_LENGTH) {
            console.error('❌ Invalid phone number')
            console.groupEnd()
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

            console.log('QR Code Validation:')
            console.log('  Exists:', !!qrCode)
            console.log('  Length:', qrCode?.length || 0)
            console.log('  Valid:', isValidQR)

            if (data.success && isValidQR) {
                console.log('✅ QR Code received successfully!')
                console.log('  Instance:', data.instanceName)
                dispatch({
                    type: 'QR_RECEIVED',
                    payload: { qrCode, instanceName: data.instanceName },
                })
                console.groupEnd()
            } else if (data.success) {
                console.warn('⚠️  API success but QR code invalid')
                console.groupEnd()
                dispatch({
                    type: 'ERROR',
                    payload: 'QR code not available. The service may be busy. Please try again.',
                })
            } else {
                console.error('❌ API error:', data.error)
                console.groupEnd()
                dispatch({ type: 'ERROR', payload: data.error || 'Failed to create WhatsApp instance' })
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('User cancelled')
                console.groupEnd()
                return
            }

            console.error('❌ Fatal error:', error.message)
            console.groupEnd()
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

    // ========================================================================
    // RENDER
    // ========================================================================

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
                            <p className="text-emerald-100 mt-1">
                                Connect your business WhatsApp for AI-powered customer service
                            </p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${state.phase === 'connected'
                                ? 'bg-white/20 border border-white/30'
                                : 'bg-amber-500/20 border border-amber-300/30'
                            }`}
                    >
                        {state.phase === 'connected' ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="font-medium">Connected & Active</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 rounded-full bg-amber-300" />
                                <span className="font-medium">
                                    {state.phase === 'creating' || state.phase === 'qr_generating'
                                        ? 'Connecting...'
                                        : state.phase === 'qr_ready' || state.phase === 'scanning'
                                            ? 'Waiting for Scan'
                                            : 'Not Connected'}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto px-8 py-8">
                    <div className="max-w-4xl mx-auto">
                        {/* Phase-based rendering */}
                        {(state.phase === 'idle' || state.phase === 'error') && (
                            <SetupView
                                whatsappNumber={state.whatsappNumber}
                                setWhatsappNumber={(val) => dispatch({ type: 'SET_NUMBER', payload: val })}
                                onConnect={handleConnect}
                                loading={state.isLoading}
                                error={state.error}
                                onRetry={handleRetry}
                            />
                        )}

                        {(state.phase === 'creating' || state.phase === 'qr_generating') && (
                            <CreatingView retryCount={state.retryCount} />
                        )}

                        {state.qrCode && (state.phase === 'qr_ready' || state.phase === 'scanning') && (
                            <QRCodeView qrCode={state.qrCode} instanceName={state.instanceName} />
                        )}

                        {state.phase === 'scanning' && !state.qrCode && state.instance && (
                            <ScanningView instance={state.instance} onReconnect={handleRetry} />
                        )}

                        {state.phase === 'connected' && state.instance && (
                            <ConnectedView instance={state.instance} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

function SetupView({ whatsappNumber, setWhatsappNumber, onConnect, loading, error, onRetry }: any) {
    return (
        <div className="space-y-6">
            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 mb-1">Connection Error</h3>
                            <p className="text-red-700 text-sm mb-3">{error}</p>
                            <button
                                onClick={onRetry}
                                className="text-sm font-medium text-red-600 hover:text-red-800 inline-flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Setup Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Phone className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your WhatsApp</h2>
                    <p className="text-gray-600">
                        Enter your business WhatsApp number to enable AI customer service
                    </p>
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
                            disabled={loading}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Include country code (e.g., <span className="font-mono font-medium">91</span> for
                            India)
                        </p>
                    </div>

                    <button
                        onClick={onConnect}
                        disabled={loading || !whatsappNumber || whatsappNumber.length < CONFIG.MIN_PHONE_LENGTH}
                        className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                    >
                        {loading ? (
                            <>
                                <Loader className="w-6 h-6 animate-spin" />
                                <span>Connecting...</span>
                            </>
                        ) : (
                            <>
                                <QrCode className="w-6 h-6" />
                                <span>Generate QR Code</span>
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-blue-900 text-sm mb-1">
                                    Secure Connection
                                </h4>
                                <p className="text-xs text-blue-800">
                                    Your WhatsApp connection is encrypted and secure. You maintain full control and
                                    can disconnect anytime.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CreatingView({ retryCount }: { retryCount: number }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <Loader className="w-16 h-16 text-emerald-600 animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Setting Up Your WhatsApp</h3>
            <p className="text-gray-600 mb-6">
                {retryCount > 0
                    ? `Retry attempt ${retryCount}... This may take up to 30 seconds`
                    : 'This usually takes 10-30 seconds'}
            </p>

            <div className="max-w-md mx-auto space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-left">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm text-gray-700">Creating WhatsApp instance...</span>
                    </div>
                </div>
                <div className="bg-gray-100 rounded-lg p-3 text-left">
                    <div className="flex items-center gap-3">
                        <Loader className="w-5 h-5 text-emerald-600 animate-spin" />
                        <span className="text-sm text-gray-700">Generating QR code...</span>
                    </div>
                </div>
                <div className="bg-gray-100 rounded-lg p-3 text-left opacity-50">
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Ready to scan</span>
                    </div>
                </div>
            </div>

            {retryCount > 0 && (
                <div className="mt-6 text-xs text-gray-500">
                    The service may be busy with other requests. Please wait...
                </div>
            )}
        </div>
    )
}

function QRCodeView({ qrCode, instanceName }: { qrCode: string; instanceName: string | null }) {
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

                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-lg py-3 mb-4">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Waiting for scan...</span>
                </div>

                {instanceName && (
                    <div className="text-center">
                        <p className="text-xs text-gray-500">
                            Instance: <span className="font-mono text-emerald-600">{instanceName}</span>
                        </p>
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="font-semibold text-blue-900 mb-4 text-sm">How to connect:</h3>
                    <ol className="space-y-2 text-xs text-blue-800">
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                1
                            </span>
                            <span>
                                Open <strong>WhatsApp</strong> on your phone
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                2
                            </span>
                            <span>
                                Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong>
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                3
                            </span>
                            <span>
                                Tap <strong>Linked Devices</strong>
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                4
                            </span>
                            <span>
                                Tap <strong>Link a Device</strong>
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                5
                            </span>
                            <span>Point your phone at the QR code above</span>
                        </li>
                    </ol>
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
            </div>
        </div>
    )
}

function ConnectedView({ instance }: { instance: any }) {
    return (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg text-white p-8">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="w-8 h-8" />
                        <h2 className="text-2xl font-bold">WhatsApp Connected!</h2>
                    </div>
                    <p className="text-emerald-100 mb-6">
                        Your AI employee is active and ready to assist customers
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Phone className="w-5 h-5" />
                            <span className="font-mono font-semibold text-lg">
                                {instance.whatsappNumber || 'Connected'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-100">
                            <MessageCircle className="w-4 h-4" />
                            <span className="text-sm">{instance.businessName || 'Business Account'}</span>
                        </div>
                    </div>
                </div>
                <Wifi className="w-16 h-16 opacity-20" />
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h3 className="font-semibold mb-2">Next Steps:</h3>
                <ul className="text-sm space-y-1 text-emerald-50">
                    <li>✓ Monitor conversations from the dashboard</li>
                    <li>✓ View analytics and customer insights</li>
                    <li>✓ Customize AI responses as needed</li>
                </ul>
            </div>
        </div>
    )
}
