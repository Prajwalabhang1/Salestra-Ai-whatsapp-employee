/**
 * Alert Banner Component
 * Smart notifications for important dashboard events
 */

'use client'

import { motion } from 'framer-motion'
import { X, LucideIcon } from 'lucide-react'
import { useState } from 'react'

interface AlertBannerProps {
    type: 'info' | 'warning' | 'error' | 'success'
    icon: LucideIcon
    message: string
    action?: {
        label: string
        onClick: () => void
    }
    dismissible?: boolean
    onDismiss?: () => void
}

const typeConfig = {
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
        buttonBg: 'bg-blue-600 hover:bg-blue-700'
    },
    warning: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-900',
        iconBg: 'bg-orange-100',
        iconText: 'text-orange-600',
        buttonBg: 'bg-orange-600 hover:bg-orange-700'
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-900',
        iconBg: 'bg-red-100',
        iconText: 'text-red-600',
        buttonBg: 'bg-red-600 hover:bg-red-700'
    },
    success: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-900',
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600',
        buttonBg: 'bg-emerald-600 hover:bg-emerald-700'
    }
}

export default function AlertBanner({
    type,
    icon: Icon,
    message,
    action,
    dismissible = false,
    onDismiss
}: AlertBannerProps) {
    const [visible, setVisible] = useState(true)
    const config = typeConfig[type]

    const handleDismiss = () => {
        setVisible(false)
        onDismiss?.()
    }

    if (!visible) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`
                ${config.bg} ${config.border} border rounded-xl p-4 mb-6
            `}
        >
            <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`${config.iconBg} rounded-lg p-2 flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.iconText}`} />
                </div>

                {/* Message */}
                <p className={`flex-1 font-medium ${config.text}`}>
                    {message}
                </p>

                {/* Action Button */}
                {action && (
                    <button
                        onClick={action.onClick}
                        className={`
                            ${config.buttonBg} text-white px-4 py-2 rounded-lg
                            font-semibold text-sm transition-colors
                        `}
                    >
                        {action.label}
                    </button>
                )}

                {/* Dismiss Button */}
                {dismissible && (
                    <button
                        onClick={handleDismiss}
                        className={`${config.iconText} hover:opacity-75 transition-opacity`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
        </motion.div>
    )
}
