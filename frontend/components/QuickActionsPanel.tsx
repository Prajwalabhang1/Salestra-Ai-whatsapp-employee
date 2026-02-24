/**
 * Quick Actions Panel Component
 * Prominent action buttons for common tasks
 */

'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface QuickAction {
    icon: LucideIcon
    label: string
    description?: string
    onClick: () => void
    color?: 'emerald' | 'blue' | 'purple' | 'orange'
}

interface QuickActionsPanelProps {
    actions: QuickAction[]
}

const colorConfig = {
    emerald: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200'
}

export default function QuickActionsPanel({ actions }: QuickActionsPanelProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {actions.map((action, index) => (
                    <motion.button
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={action.onClick}
                        className={`
                            flex flex-col items-center gap-3 p-4 rounded-lg
                            transition-all duration-200
                            ${colorConfig[action.color || 'emerald']}
                        `}
                    >
                        <action.icon className="w-6 h-6" />
                        <div className="text-center">
                            <p className="font-semibold text-sm">{action.label}</p>
                            {action.description && (
                                <p className="text-xs opacity-75 mt-1">{action.description}</p>
                            )}
                        </div>
                    </motion.button>
                ))}
            </div>
        </div>
    )
}
