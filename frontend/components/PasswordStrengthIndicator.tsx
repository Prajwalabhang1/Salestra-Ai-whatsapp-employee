'use client'

import { useState, useEffect } from 'react'

interface PasswordStrengthIndicatorProps {
    password: string
    showRequirements?: boolean
}

export function PasswordStrengthIndicator({ password, showRequirements = true }: PasswordStrengthIndicatorProps) {
    const [strength, setStrength] = useState<{
        score: number
        label: string
        color: string
        width: string
    }>({ score: 0, label: 'Weak', color: 'red', width: '0%' })

    const [requirements, setRequirements] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    })

    useEffect(() => {
        if (!password) {
            setStrength({ score: 0, label: 'Weak', color: 'red', width: '0%' })
            setRequirements({
                length: false,
                uppercase: false,
                lowercase: false,
                number: false,
                special: false
            })
            return
        }

        // Calculate strength score
        let score = 0

        // Length scoring
        if (password.length >= 16) score += 40
        else if (password.length >= 12) score += 30
        else if (password.length >= 8) score += 20
        else score += 10

        // Character variety
        const hasLower = /[a-z]/.test(password)
        const hasUpper = /[A-Z]/.test(password)
        const hasNumber = /[0-9]/.test(password)
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)

        if (hasLower) score += 10
        if (hasUpper) score += 10
        if (hasNumber) score += 10
        if (hasSpecial) score += 10

        // Bonus points
        const specialCount = (password.match(/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/g) || []).length
        if (specialCount >= 2) score += 10
        if (password.length >= 20) score += 10

        // Update requirements
        setRequirements({
            length: password.length >= 12,
            uppercase: hasUpper,
            lowercase: hasLower,
            number: hasNumber,
            special: hasSpecial
        })

        // Determine strength
        let label = 'Weak'
        let color = 'red'
        let width = '33%'

        if (score >= 70) {
            label = 'Strong'
            color = 'green'
            width = '100%'
        } else if (score >= 50) {
            label = 'Medium'
            color = 'yellow'
            width = '66%'
        }

        setStrength({ score, label, color, width })
    }, [password])

    if (!password) return null

    return (
        <div className="mt-2">
            {/* Strength Bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-300 ${strength.color === 'green' ? 'bg-green-500' :
                            strength.color === 'yellow' ? 'bg-yellow-500' :
                                'bg-red-500'
                        }`}
                    style={{ width: strength.width }}
                />
            </div>

            {/* Strength Label */}
            <p className="text-xs mt-1 flex items-center gap-2">
                <span className="text-gray-600">Password strength:</span>
                <span className={`font-medium ${strength.color === 'green' ? 'text-green-600' :
                        strength.color === 'yellow' ? 'text-yellow-600' :
                            'text-red-600'
                    }`}>
                    {strength.label} ({strength.score}%)
                </span>
            </p>

            {/* Requirements Checklist */}
            {showRequirements && (
                <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-gray-700 mb-1">Requirements:</p>
                    <RequirementItem met={requirements.length} text="At least 12 characters" />
                    <RequirementItem met={requirements.uppercase} text="One uppercase letter (A-Z)" />
                    <RequirementItem met={requirements.lowercase} text="One lowercase letter (a-z)" />
                    <RequirementItem met={requirements.number} text="One number (0-9)" />
                    <RequirementItem met={requirements.special} text="One special character (!@#$...)" />
                </div>
            )}
        </div>
    )
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
    return (
        <div className="flex items-center gap-2 text-xs">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${met ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                {met ? (
                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                )}
            </div>
            <span className={met ? 'text-green-700' : 'text-gray-600'}>{text}</span>
        </div>
    )
}
