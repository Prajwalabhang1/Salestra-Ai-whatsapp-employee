'use client'

import { HelpCircle } from 'lucide-react'
import { useState } from 'react'

interface HelpTooltipProps {
    content: string
}

export function HelpTooltip({ content }: HelpTooltipProps) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div className="relative inline-block ml-2">
            <button
                type="button"
                className="text-gray-400 hover:text-emerald-600 transition-colors focus:outline-none"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)}
                aria-label="More information"
            >
                <HelpCircle className="w-4 h-4" />
            </button>

            {isVisible && (
                <div className="absolute z-50 w-64 px-4 py-3 text-sm text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 mb-2">
                    {content}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    )
}
