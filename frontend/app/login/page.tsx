'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, ArrowRight, MessageSquare, AlertCircle, Shield, CheckCircle2, Chrome } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)

    useEffect(() => {
        // Auto-focus email field
        document.getElementById('email')?.focus()

        // Check for remembered email
        const savedEmail = localStorage.getItem('remembered_email')
        if (savedEmail) {
            setFormData(prev => ({ ...prev, email: savedEmail }))
            setRememberMe(true)
        }

        // Check for OAuth errors
        const oauthError = searchParams.get('error')
        if (oauthError) {
            setError(oauthError)
        }

        // Check for token from OAuth callback
        const token = searchParams.get('token')
        if (token) {
            localStorage.setItem('token', token)
            router.push('/dashboard')
        }
    }, [searchParams, router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, password: formData.password })
            })

            let data
            const contentType = response.headers.get('content-type')

            // Check if response is JSON
            if (contentType && contentType.includes('application/json')) {
                data = await response.json()
            } else {
                // If not JSON, try to get text
                const text = await response.text()
                throw new Error(text || 'Server error. Please try again.')
            }

            if (!response.ok) {
                throw new Error(data.error || 'Login failed')
            }

            if (!data.token) {
                throw new Error('No authentication token received')
            }

            // Store token and user data
            localStorage.setItem('token', data.token)
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user))
            }

            // Remember email if checkbox is checked
            if (rememberMe) {
                localStorage.setItem('remembered_email', formData.email)
            } else {
                localStorage.removeItem('remembered_email')
            }

            // Redirect based on onboarding status
            setTimeout(() => {
                if (data.needsOnboarding) {
                    router.push('/onboarding')
                } else {
                    router.push('/dashboard')
                }
            }, 300)
        } catch (err: any) {
            console.error('Login error:', err)
            setError(err.message || 'Invalid email or password')
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setGoogleLoading(true)
        setError('')

        try {
            const response = await fetch('http://localhost:3000/api/auth/google?state=login')
            const data = await response.json()

            if (data.authUrl) {
                // Open Google OAuth in current window
                window.location.href = data.authUrl
            } else {
                setError('Failed to initiate Google sign-in')
                setGoogleLoading(false)
            }
        } catch (err) {
            setError('Failed to connect to Google. Please try again.')
            setGoogleLoading(false)
        }
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
                            Welcome back
                        </h1>
                        <p className="text-gray-600">
                            Sign in to manage your AI employee
                        </p>
                    </div>

                    {/* Social Login */}
                    <button
                        onClick={handleGoogleLogin}
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

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                Email address
                            </label>
                            <div className="relative">
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 pl-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="you@company.com"
                                    disabled={loading}
                                    autoComplete="email"
                                />
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                                    Password
                                </label>
                                <Link href="/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-3 pl-11 pr-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="••••••••"
                                    disabled={loading}
                                    autoComplete="current-password"
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
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor="remember" className="ml-2 text-sm text-gray-600 cursor-pointer">
                                Remember me for 30 days
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign in</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                                Sign up for free
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
