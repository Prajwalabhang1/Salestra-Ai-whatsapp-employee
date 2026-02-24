'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, ArrowRight, MessageSquare, AlertCircle, Shield, CheckCircle2, Chrome } from 'lucide-react'

export default function SignupPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const [passwordStrength, setPasswordStrength] = useState(0)
    const [termsAccepted, setTermsAccepted] = useState(false)

    useEffect(() => {
        // Auto-focus email field
        document.getElementById('email')?.focus()

        // Check for OAuth errors
        const oauthError = searchParams.get('error')
        if (oauthError) {
            setError(oauthError)
        }

        // Check for token from OAuth callback
        const token = searchParams.get('token')
        if (token) {
            localStorage.setItem('token', token)
            router.push('/onboarding')
        }
    }, [searchParams, router])

    useEffect(() => {
        // Calculate password strength
        if (!password) {
            setPasswordStrength(0)
            return
        }
        let strength = 0
        if (password.length >= 8) strength++
        if (password.length >= 12) strength++
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
        if (/\d/.test(password)) strength++
        if (/[^a-zA-Z0-9]/.test(password)) strength++
        setPasswordStrength(Math.min(strength, 4))
    }, [password])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    termsAccepted,
                    privacyAccepted: termsAccepted // Assuming single checkbox for now
                })
            })

            const data = await response.json()

            if (data.success) {
                localStorage.setItem('token', data.token)
                localStorage.setItem('user', JSON.stringify(data.user))

                setTimeout(() => {
                    router.push('/onboarding')
                }, 300)
            } else {
                setError(data.error || 'Registration failed')
                setLoading(false)
            }
        } catch (err) {
            setError('Network error. Please try again.')
            setLoading(false)
        }
    }

    const handleGoogleSignup = async () => {
        setGoogleLoading(true)
        setError('')

        try {
            const response = await fetch('http://localhost:3000/api/auth/google?state=signup')
            const data = await response.json()

            if (data.authUrl) {
                // Open Google OAuth in current window
                window.location.href = data.authUrl
            } else {
                setError('Failed to initiate Google sign-up')
                setGoogleLoading(false)
            }
        } catch (err) {
            setError('Failed to connect to Google. Please try again.')
            setGoogleLoading(false)
        }
    }

    const getStrengthColor = () => {
        if (passwordStrength === 0) return 'bg-gray-200'
        if (passwordStrength <= 2) return 'bg-red-500'
        if (passwordStrength === 3) return 'bg-yellow-500'
        return 'bg-emerald-500'
    }

    const getStrengthText = () => {
        if (passwordStrength === 0) return ''
        if (passwordStrength <= 2) return 'Weak'
        if (passwordStrength === 3) return 'Good'
        return 'Strong'
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 relative overflow-hidden flex items-center justify-center p-6">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-200/10 rounded-full blur-3xl -z-10" />

            <div className="w-full max-w-md">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center hover:opacity-80 transition-opacity">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                        <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">Salestra</span>
                </Link>

                <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold mb-4 animate-bounce-subtle">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            First 100 messages free
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Get started with Salestra
                        </h1>
                        <p className="text-gray-600">
                            Start your free 7-day trial. No credit card required.
                        </p>
                    </div>

                    {/* Social Sign Up */}
                    <button
                        onClick={handleGoogleSignup}
                        disabled={googleLoading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all font-medium text-gray-700 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {googleLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                                <span>Connecting to Google...</span>
                            </>
                        ) : (
                            <>
                                <Chrome className="w-5 h-5" />
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500">or</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                Work email
                            </label>
                            <div className="relative">
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 pl-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="you@company.com"
                                    disabled={loading}
                                />
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pl-11 pr-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="Create a strong password"
                                    minLength={8}
                                    disabled={loading}
                                />
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {password && (
                                <div className="mt-2">
                                    <div className="flex gap-1 mb-1">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < passwordStrength ? getStrengthColor() : 'bg-gray-200'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    {passwordStrength > 0 && (
                                        <p className="text-xs text-gray-600">
                                            Password strength: <span className="font-semibold">{getStrengthText()}</span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !termsAccepted}
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <>
                                    <span>Create account</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <div className="flex items-start gap-3">
                            <div className="flex h-6 items-center">
                                <input
                                    id="terms"
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                                />
                            </div>
                            <div className="text-sm">
                                <label htmlFor="terms" className="font-medium text-gray-700">
                                    I agree to the <a href="#" className="underline hover:text-emerald-600">Terms</a> and <a href="#" className="underline hover:text-emerald-600">Privacy Policy</a>
                                </label>
                                <p className="text-gray-500 text-xs mt-1">
                                    You acknowledge that AI responses may vary and should be monitored.
                                </p>
                            </div>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Trust indicators */}
                <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <span>256-bit encryption</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>2,500+ customers</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
