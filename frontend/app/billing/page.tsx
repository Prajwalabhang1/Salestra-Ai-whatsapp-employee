'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Check, Zap, TrendingUp, Users, Star } from 'lucide-react'
import Sidebar from '../../components/Sidebar'

export default function BillingPage() {
    const router = useRouter()
    const [subscription, setSubscription] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }
        fetchBilling()
    }, [router])

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    const fetchBilling = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/billing', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
            if (response.ok) {
                const data = await response.json()
                setSubscription(data.subscription)
            }
        } catch (error) {
            console.error('Failed to fetch billing:', error)
        } finally {
            setLoading(false)
        }
    }

    const pricingPlans = [
        {
            name: 'Starter',
            price: '₹599',
            period: '/mo',
            description: 'Perfect for small businesses',
            messageLimit: '1,500',
            features: [
                'Answer customer questions 24/7',
                'Share prices & availability',
                'Basic knowledge base'
            ],
            color: 'from-gray-600 to-gray-700',
            popular: false
        },
        {
            name: 'Professional',
            price: '₹999',
            period: '/mo',
            description: 'For growing businesses',
            messageLimit: '5,000',
            features: [
                'Everything in Starter, plus:',
                'Fast AI response (priority processing)',
                'Advanced analytics dashboard',
                'Lead capture & tagging'
            ],
            color: 'from-emerald-500 to-emerald-600',
            popular: true
        },
        {
            name: 'Enterprise',
            price: '₹1,499',
            period: '/mo',
            description: 'For large businesses',
            messageLimit: 'Unlimited',
            features: [
                'Everything in Professional, plus:',
                'Fastest AI response (highest priority)',
                'Priority support (1-hour response)',
                'Custom AI training'
            ],
            color: 'from-blue-600 to-purple-600',
            popular: false
        }
    ]

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-gray-200">
                    <div className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                                <p className="text-sm text-gray-600">Manage your plan and billing</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {/* Current Subscription Status */}
                        {subscription && (
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-sm text-gray-600">Plan</p>
                                        <p className="text-xl font-bold text-gray-900 capitalize">{subscription.plan}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Messages Used</p>
                                        <p className="text-xl font-bold text-gray-900">
                                            {subscription.messagesUsed.toLocaleString()} / {subscription.messageLimit === 999999999 ? '∞' : subscription.messageLimit.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Status</p>
                                        <div className="flex items-center space-x-2">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${subscription.isTrial ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                {subscription.isTrial ? `Trial - ${subscription.daysRemaining} days left` : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pricing Section */}
                        <div>
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Simple, affordable pricing</h2>
                                <p className="text-gray-600">Unlimited messages on all plans. Choose the plan that fits your business size.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {pricingPlans.map((plan, index) => (
                                    <div
                                        key={index}
                                        className={`relative rounded-2xl border-2 p-8 ${plan.popular
                                                ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-white shadow-xl scale-105'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                            } transition-all`}
                                    >
                                        {plan.popular && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                                <span className="bg-emerald-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                                                    Most Popular
                                                </span>
                                            </div>
                                        )}

                                        <div className="text-center mb-6">
                                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                            <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                                            <div className="flex items-baseline justify-center">
                                                <span className="text-5xl font-bold text-emerald-600">{plan.price}</span>
                                                <span className="text-gray-600 ml-1">{plan.period}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-2">
                                                Up to {plan.messageLimit} messages/month
                                            </p>
                                        </div>

                                        <ul className="space-y-3 mb-6">
                                            {plan.features.map((feature, i) => (
                                                <li key={i} className="flex items-start">
                                                    <Check className={`w-5 h-5 ${plan.popular ? 'text-emerald-600' : 'text-gray-500'} mr-3 flex-shrink-0 mt-0.5`} />
                                                    <span className="text-sm text-gray-700">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <button
                                            className={`w-full py-3 rounded-lg font-semibold transition-all ${plan.popular
                                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-lg'
                                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                }`}
                                        >
                                            {plan.popular ? 'Start Free Trial' : subscription?.plan === plan.name.toLowerCase() ? 'Current Plan' : 'Start Free Trial'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                    <Star className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">All plans include</h3>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                        <li className="flex items-center">
                                            <Check className="w-4 h-4 text-emerald-600 mr-2" />
                                            WhatsApp integration
                                        </li>
                                        <li className="flex items-center">
                                            <Check className="w-4 h-4 text-emerald-600 mr-2" />
                                            AI-powered responses
                                        </li>
                                        <li className="flex items-center">
                                            <Check className="w-4 h-4 text-emerald-600 mr-2" />
                                            Multi-language support
                                        </li>
                                        <li className="flex items-center">
                                            <Check className="w-4 h-4 text-emerald-600 mr-2" />
                                            Custom knowledge base
                                        </li>
                                        <li className="flex items-center">
                                            <Check className="w-4 h-4 text-emerald-600 mr-2" />
                                            Real-time analytics
                                        </li>
                                        <li className="flex items-center">
                                            <Check className="w-4 h-4 text-emerald-600 mr-2" />
                                            24/7 availability
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
