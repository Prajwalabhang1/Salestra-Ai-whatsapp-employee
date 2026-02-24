/**
 * Chart Card Component
 * Wrapper for charts with consistent styling
 */

'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface ChartCardProps {
    title: string
    subtitle?: string
    icon?: LucideIcon
    children: React.ReactNode
    action?: {
        label: string
        onClick: () => void
    }
}

export default function ChartCard({
    title,
    subtitle,
    icon: Icon,
    children,
    action
}: ChartCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-emerald-600" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        {subtitle && (
                            <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                </div>

                {action && (
                    <button
                        onClick={action.onClick}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                        {action.label}
                    </button>
                )}
            </div>

            {/* Chart Content */}
            <div className="w-full">
                {children}
            </div>
        </motion.div>
    )
}
