'use client'

import { Zap, X, Check } from 'lucide-react'
import Link from 'next/link'

interface TrialExpiredModalProps {
    daysExpired: number
    onClose?: () => void
}

export default function TrialExpiredModal({ daysExpired }: TrialExpiredModalProps) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Your Free Trial Has Ended</h2>
                        <p className="text-emerald-100 text-lg">
                            {daysExpired > 0
                                ? `Your trial ended ${daysExpired} day${daysExpired > 1 ? 's' : ''} ago`
                                : 'Your 14-day trial has concluded'
                            }
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-gray-600 text-lg mb-8">
                        Thank you for trying Salestra! To continue using your AI employee and accessing all features, choose a plan below.
                    </p>

                    {/* Pricing Tiers */}
                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                        {/* Starter */}
                        <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-emerald-500 hover:shadow-lg transition-all">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                                ₹599<span className="text-lg text-gray-600">/mo</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">Up to 1,500 messages/month</p>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>24/7 AI responses</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Basic knowledge base</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>WhatsApp integration</span>
                                </li>
                            </ul>
                            <Link
                                href="/upgrade?plan=starter"
                                className="block w-full bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-900 py-3 px-4 rounded-xl font-semibold transition-all text-center"
                            >
                                Choose Starter
                            </Link>
                        </div>

                        {/* Professional - Featured */}
                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-xl p-6 relative ring-4 ring-emerald-400 shadow-2xl transform scale-105">
                            <div className="absolute top-0 right-0 bg-white text-emerald-700 text-xs font-semibold px-3 py-1 rounded-bl-xl rounded-tr-xl shadow-md">
                                Most Popular
                            </div>
                            <h3 className="text-xl font-bold mb-2">Professional</h3>
                            <div className="text-3xl font-bold mb-1">
                                ₹999<span className="text-lg text-emerald-100">/mo</span>
                            </div>
                            <p className="text-sm text-emerald-100 mb-4">Up to 5,000 messages/month</p>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span>Everything in Starter</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span><strong>Fast AI</strong> responses</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span>Advanced analytics</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span>Priority support</span>
                                </li>
                            </ul>
                            <Link
                                href="/upgrade?plan=professional"
                                className="block w-full bg-white text-emerald-700 hover:bg-emerald-50 py-3 px-4 rounded-xl font-semibold transition-all text-center shadow-lg"
                            >
                                Choose Professional
                            </Link>
                        </div>

                        {/* Enterprise */}
                        <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-emerald-500 hover:shadow-lg transition-all">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
                            <div className="text-3xl font-bold text-gray-900 mb-1">
                                ₹1,499<span className="text-lg text-gray-600">/mo</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">Unlimited messages</p>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Everything in Professional</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>Unlimited</strong> messages</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Custom integrations</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Dedicated support</span>
                                </li>
                            </ul>
                            <Link
                                href="/upgrade?plan=enterprise"
                                className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all text-center"
                            >
                                Choose Enterprise
                            </Link>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-6">
                        <p className="text-sm text-gray-600 text-center">
                            All plans include 24/7 AI responses, analytics, and email support. <br />
                            Cancel anytime, no questions asked.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
