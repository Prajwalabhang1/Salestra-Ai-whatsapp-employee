'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, ArrowRight, Zap } from 'lucide-react'

interface TrialBannerProps {
    daysRemaining: number
    trialEndDate: string
    onUpgradeClick?: () => void
}

export default function TrialBanner({ daysRemaining, trialEndDate, onUpgradeClick }: TrialBannerProps) {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    // Determine banner color based on days remaining
    const getBannerStyle = () => {
        if (daysRemaining <= 0) {
            return {
                bgColor: 'bg-red-600',
                textColor: 'text-white',
                accentColor: 'text-red-100',
                buttonBg: 'bg-white',
                buttonText: 'text-red-600',
                buttonHover: 'hover:bg-red-50'
            }
        } else if (daysRemaining <= 3) {
            return {
                bgColor: 'bg-orange-600',
                textColor: 'text-white',
                accentColor: 'text-orange-100',
                buttonBg: 'bg-white',
                buttonText: 'text-orange-600',
                buttonHover: 'hover:bg-orange-50'
            }
        } else if (daysRemaining <= 7) {
            return {
                bgColor: 'bg-yellow-500',
                textColor: 'text-gray-900',
                accentColor: 'text-yellow-900',
                buttonBg: 'bg-gray-900',
                buttonText: 'text-white',
                buttonHover: 'hover:bg-gray-800'
            }
        } else {
            return {
                bgColor: 'bg-emerald-600',
                textColor: 'text-white',
                accentColor: 'text-emerald-100',
                buttonBg: 'bg-white',
                buttonText: 'text-emerald-600',
                buttonHover: 'hover:bg-emerald-50'
            }
        }
    }

    const style = getBannerStyle()

    const getMessage = () => {
        if (daysRemaining <= 0) {
            return 'Your free trial has ended'
        } else if (daysRemaining === 1) {
            return 'Last day of your free trial!'
        } else if (daysRemaining <= 3) {
            return `Only ${daysRemaining} days left in your trial`
        } else if (daysRemaining <= 7) {
            return `${daysRemaining} days remaining in your free trial`
        } else {
            return `${daysRemaining} days left in your free trial`
        }
    }

    return (
        <div className={`${style.bgColor} ${style.textColor} px-6 py-4 shadow-md relative overflow-hidden`}>
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <div>
                            <p className="font-semibold text-sm md:text-base">
                                {getMessage()}
                            </p>
                            <p className={`text-xs md:text-sm ${style.accentColor} mt-0.5`}>
                                Trial ends on {new Date(trialEndDate).toLocaleDateString('en-IN', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {daysRemaining <= 7 && (
                        <Link
                            href="/upgrade"
                            onClick={onUpgradeClick}
                            className={`${style.buttonBg} ${style.buttonText} ${style.buttonHover} px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg hover:-translate-y-0.5`}
                        >
                            <Zap className="w-4 h-4" />
                            <span>Upgrade Now</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}

                    {daysRemaining > 7 && (
                        <button
                            onClick={() => setIsVisible(false)}
                            className={`${style.accentColor} hover:${style.textColor} text-sm font-medium transition-colors`}
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
