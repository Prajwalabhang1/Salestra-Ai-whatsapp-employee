'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    toasts: Toast[]
    addToast: (type: ToastType, message: string, duration?: number) => void
    removeToast: (id: string) => void
    toast: {
        success: (message: string, duration?: number) => void
        error: (message: string, duration?: number) => void
        info: (message: string, duration?: number) => void
        warning: (message: string, duration?: number) => void
    }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const id = Math.random().toString(36).substring(2, 9)
        setToasts(prev => [...prev, { id, type, message, duration }])

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }
    }, [removeToast])

    const toast = {
        success: (msg: string, dur?: number) => addToast('success', msg, dur),
        error: (msg: string, dur?: number) => addToast('error', msg, dur),
        info: (msg: string, dur?: number) => addToast('info', msg, dur),
        warning: (msg: string, dur?: number) => addToast('warning', msg, dur)
    }

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    )
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) {
    return (
        <div className="fixed top-4 right-4 z-[100000] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`
                        pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border flex items-start gap-3 transition-all animate-in slide-in-from-right-full
                        ${toast.type === 'success' ? 'bg-white border-emerald-200 text-gray-800' : ''}
                        ${toast.type === 'error' ? 'bg-white border-red-200 text-gray-800' : ''}
                        ${toast.type === 'info' ? 'bg-white border-blue-200 text-gray-800' : ''}
                        ${toast.type === 'warning' ? 'bg-white border-yellow-200 text-gray-800' : ''}
                    `}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                        {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                    </div>
                    <div className="flex-1 text-sm font-medium">{toast.message}</div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context.toast
}
