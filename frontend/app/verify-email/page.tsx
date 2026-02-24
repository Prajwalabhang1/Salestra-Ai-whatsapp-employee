'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [errorMessage, setErrorMessage] = useState('')
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get('token')

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setErrorMessage('No verification token provided')
            return
        }

        verifyEmail(token)
    }, [token])

    const verifyEmail = async (verificationToken: string) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/verify-email/${verificationToken}`, {
                method: 'GET',
            })

            const data = await response.json()

            if (data.success) {
                setStatus('success')

                // Update user in localStorage
                const userStr = localStorage.getItem('user')
                if (userStr) {
                    const user = JSON.parse(userStr)
                    user.emailVerified = true
                    localStorage.setItem('user', JSON.stringify(user))
                }

                // Redirect to onboarding after 2 seconds
                setTimeout(() => {
                    router.push('/onboarding')
                }, 2000)
            } else {
                setStatus('error')
                setErrorMessage(data.error || 'Verification failed')
            }
        } catch (error) {
            setStatus('error')
            setErrorMessage('Network error. Please try again.')
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                {status === 'loading' && (
                    <div className="text-center">
                        <Loader2 className="w-16 h-16 text-emerald-600 mx-auto mb-4 animate-spin" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Verifying your email...
                        </h2>
                        <p className="text-gray-600">
                            Please wait while we confirm your email address.
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Email Verified! ✅
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Your email has been successfully verified. Redirecting to onboarding...
                        </p>
                        <div className="flex justify-center">
                            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Verification Failed
                        </h2>
                        <p className="text-red-600 mb-6">
                            {errorMessage}
                        </p>
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600">
                                The verification link may have expired or is invalid.
                            </p>
                            <button
                                onClick={() => router.push('/resend-verification')}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                            >
                                Request New Link
                            </button>
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full text-gray-600 hover:text-gray-900 font-medium py-2"
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
