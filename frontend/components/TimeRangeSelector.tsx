/**
 * Time Range Selector Component
 * Allows users to select different time periods for dashboard data
 */

'use client'

import { Calendar } from 'lucide-react'

export type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom'

interface TimeRangeSelectorProps {
    value: TimeRange
    onChange: (value: TimeRange) => void
}

const options: { label: string; value: TimeRange }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'This month', value: 'month' }
]

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
    return (
        <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as TimeRange)}
                className="
                    bg-white border border-gray-200 rounded-lg px-4 py-2
                    font-medium text-gray-900 text-sm
                    focus:outline-none focus:ring-2 focus:ring-emerald-500
                    hover:border-gray-300 transition-colors
                    cursor-pointer
                "
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    )
}
