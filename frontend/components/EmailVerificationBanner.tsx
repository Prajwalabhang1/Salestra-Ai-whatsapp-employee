'use client'

import { useState } from 'react'
import { AlertCircle, Mail, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface EmailVerificationBannerProps {
    email: string
}

export default function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
    const [dismissed, setDismissed] = useState(false)
    const [resending, setResending] = useState(false)
    const [message, setMessage] = useState('')

    const handleResend = async () => {
        setResending(true)
        setMessage('')

        try {
            const response = await fetch('http://localhost:3000/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })

            const data = await response.json()

            if (response.ok) {
                setMessage('✅ Verification email sent! Check your inbox.')
            } else {
                setMessage('❌ Failed to send email. Try again later.')
            }
        } catch (error) {
            setMessage('❌ Network error. Please try again.')
        } finally {
            setResending(false)
            // Clear message after 5 seconds
            setTimeout(() => setMessage(''), 5000)
        }
    }

    if (dismissed) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-amber-50 border-b border-amber-200"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <AlertCircle className="w-6 h-6 text-amber-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-900 mb-1">
                                Email verification required
                            </p>
                            <p className="text-sm text-amber-800">
                                Please verify your email address (<strong>{email}</strong>) to unlock all features.
                                Check your inbox for the verification link.
                            </p>

                            {message && (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-sm mt-2 font-medium text-amber-900"
                                >
                                    {message}
                                </motion.p>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleResend}
                                disabled={resending}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" />
                                        <span>Resend</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setDismissed(true)}
                                className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors"
                                aria-label="Dismiss"
                            >
                                <X className="w-5 h-5 text-amber-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
