/**
 * Modern Metric Card Component
 * Features: Animated count-up, sparkline trend, gradient accents, hover effects
 */

'use client'

import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { LucideIcon } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface MetricCardProps {
    title: string
    value: number
    change: number
    changeLabel?: string
    icon: LucideIcon
    color: 'blue' | 'emerald' | 'purple' | 'orange' | 'red'
    trend?: number[] // 7-day sparkline data
    onClick?: () => void
    unit?: string
    decimals?: number
}

const colorConfig = {
    blue: {
        bgLight: 'bg-blue-100',
        text: 'text-blue-600',
        gradient: 'from-blue-500 to-blue-600',
        border: 'hover:border-blue-300',
        shadow: 'hover:shadow-blue-500/20'
    },
    emerald: {
        bgLight: 'bg-emerald-100',
        text: 'text-emerald-600',
        gradient: 'from-emerald-500 to-emerald-600',
        border: 'hover:border-emerald-300',
        shadow: 'hover:shadow-emerald-500/20'
    },
    purple: {
        bgLight: 'bg-purple-100',
        text: 'text-purple-600',
        gradient: 'from-purple-500 to-purple-600',
        border: 'hover:border-purple-300',
        shadow: 'hover:shadow-purple-500/20'
    },
    orange: {
        bgLight: 'bg-orange-100',
        text: 'text-orange-600',
        gradient: 'from-orange-500 to-orange-600',
        border: 'hover:border-orange-300',
        shadow: 'hover:shadow-orange-500/20'
    },
    red: {
        bgLight: 'bg-red-100',
        text: 'text-red-600',
        gradient: 'from-red-500 to-red-600',
        border: 'hover:border-red-300',
        shadow: 'hover:shadow-red-500/20'
    }
}

export default function MetricCard({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    color,
    trend,
    onClick,
    unit = '',
    decimals = 0
}: MetricCardProps) {
    const colors = colorConfig[color]
    const isPositive = change >= 0
    const trendData = trend?.map((val, idx) => ({ value: val, index: idx })) || []

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.3 }}
            onClick={onClick}
            className={`
                relative bg-white rounded-xl border border-gray-200 p-6
                ${colors.border} ${colors.shadow}
                ${onClick ? 'cursor-pointer' : ''}
                transition-all duration-300 hover:shadow-lg
                overflow-hidden
            `}
        >
            {/* Background gradient (subtle) */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.gradient} opacity-5 rounded-full -mr-16 -mt-16`} />

            <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${colors.bgLight} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>

                    {/* Sparkline */}
                    {trend && trend.length > 0 && (
                        <div className="w-20 h-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke={color === 'emerald' ? '#10b981' : '#3b82f6'}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Label */}
                <p className="text-sm text-gray-600 mb-1 font-medium">{title}</p>

                {/* Value with animated count */}
                <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-3xl font-bold text-gray-900">
                        <CountUp
                            end={value}
                            duration={1.5}
                            decimals={decimals}
                            separator=","
                        />
                        {unit && <span className="text-xl text-gray-600">{unit}</span>}
                    </p>
                </div>

                {/* Change indicator */}
                <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                    <span className="font-semibold">
                        {isPositive ? '+' : ''}{change}{unit === '%' ? '' : ''}
                    </span>
                    <span className="text-gray-500">
                        {changeLabel || 'from yesterday'}
                    </span>
                </div>

                {/* Click indicator */}
                {onClick && (
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
