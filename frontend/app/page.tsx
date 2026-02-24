'use client'

import { ArrowRight, CheckCircle2, MessageSquare, Zap, Clock, Shield, TrendingUp, Users, Star } from 'lucide-react'
import Link from 'next/link'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-semibold text-gray-900">Salestra</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
                            Sign in
                        </Link>
                        <Link
                            href="/signup"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                        >
                            Get Started Free
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-20 pb-24 px-6 relative overflow-hidden">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50 -z-10" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-3xl -z-10" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-200/20 rounded-full blur-3xl -z-10" />

                <div className="max-w-6xl mx-auto text-center relative">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-emerald-200 text-emerald-700 rounded-full text-sm font-medium mb-6 shadow-sm hover:shadow-md transition-shadow">
                        <Zap className="w-4 h-4" />
                        <span>Live in 10 minutes — No technical knowledge required</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                        Your AI employee on<br />
                        <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">WhatsApp</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                        Salestra answers customer questions, shares prices, checks availability, and captures leads automatically using your business data.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <Link
                            href="/signup"
                            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 inline-flex items-center gap-2 group w-full sm:w-auto justify-center shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                        >
                            <span>Get Started Free</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a
                            href="#how-it-works"
                            className="border-2 border-gray-300 hover:border-emerald-500 text-gray-700 hover:text-emerald-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 w-full sm:w-auto text-center hover:shadow-md"
                        >
                            See How It Works
                        </a>
                    </div>

                    {/* WhatsApp Chat Preview - Enhanced */}
                    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden hover:shadow-3xl transition-shadow duration-500">
                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                                <MessageSquare className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="font-semibold text-white">Your Business</div>
                                <div className="text-xs text-emerald-100 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                    <span>AI Employee • Online</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
                            <div className="flex justify-start animate-fade-in">
                                <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm max-w-[80%] border border-gray-100">
                                    <p className="text-sm text-gray-700">Hi! Do you have iPhone 15 Pro in stock?</p>
                                </div>
                            </div>
                            <div className="flex justify-end animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 rounded-2xl rounded-tr-sm text-white max-w-[80%] shadow-md">
                                    <p className="text-sm">Yes! We have the iPhone 15 Pro available in all colors. Prices start at ₹85,999. Would you like to reserve one?</p>
                                </div>
                            </div>
                            <div className="flex justify-start animate-fade-in" style={{ animationDelay: '0.4s' }}>
                                <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm max-w-[80%] border border-gray-100">
                                    <p className="text-sm text-gray-700">What about delivery?</p>
                                </div>
                            </div>
                            <div className="flex justify-end animate-fade-in" style={{ animationDelay: '0.6s' }}>
                                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 rounded-2xl rounded-tr-sm text-white max-w-[80%] shadow-md">
                                    <p className="text-sm">We offer same-day delivery within the city for ₹500, or free pickup from our store!</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof Stats */}
            <section className="py-12 px-6 bg-white border-y border-gray-100">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div className="group cursor-default">
                            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform duration-300">2,500+</div>
                            <p className="text-sm text-gray-600">Active Businesses</p>
                        </div>
                        <div className="group cursor-default">
                            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform duration-300">50K+</div>
                            <p className="text-sm text-gray-600">Messages Handled Daily</p>
                        </div>
                        <div className="group cursor-default">
                            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform duration-300">24/7</div>
                            <p className="text-sm text-gray-600">Always Online</p>
                        </div>
                        <div className="group cursor-default">
                            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform duration-300">98%</div>
                            <p className="text-sm text-gray-600">Customer Satisfaction</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem Section */}
            <section className="py-16 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        Stop losing customers on WhatsApp
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
                        Every missed message is a lost sale. Here's what happens without Salestra:
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200">
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                                <Clock className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Missed messages at night & weekends</h3>
                            <p className="text-gray-600 text-sm">Customers message you when it's convenient for them, not during your business hours.</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200">
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                                <MessageSquare className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Same questions asked repeatedly</h3>
                            <p className="text-gray-600 text-sm">"What are your prices?" "Do you deliver?" — answering the same questions wastes your time.</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200">
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                                <TrendingUp className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Lost leads while you're busy</h3>
                            <p className="text-gray-600 text-sm">Customers don't wait. If you're slow to respond, they move to your competitors.</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200">
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Can't scale customer support</h3>
                            <p className="text-gray-600 text-sm">Hiring more staff is expensive. Managing multiple conversations manually is overwhelming.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        Setup in 3 simple steps
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-16 max-w-2xl mx-auto">
                        No technical knowledge required. Your AI employee starts working in minutes.
                    </p>

                    <div className="space-y-12">
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="flex-shrink-0 w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <span className="text-2xl font-bold text-emerald-600">1</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Connect your WhatsApp number</h3>
                                <p className="text-gray-600">Scan a QR code with your WhatsApp Business account. Takes 30 seconds.</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="flex-shrink-0 w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <span className="text-2xl font-bold text-emerald-600">2</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Add your business info</h3>
                                <p className="text-gray-600">Tell us what you sell, your prices, policies. Upload product catalogs, FAQs — or skip and add later.</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="flex-shrink-0 w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <span className="text-2xl font-bold text-emerald-600">3</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">AI handles conversations automatically</h3>
                                <p className="text-gray-600">Your AI employee starts replying to customers 24/7. You can monitor and jump in anytime.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* What Salestra Can Do */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        What your AI employee can do
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-16 max-w-2xl mx-auto">
                        Salestra handles the conversations you don't have time for, using only the information you provide.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">Answer questions instantly</h3>
                            <p className="text-gray-600">Product details, pricing, availability, business hours — all answered in seconds.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <TrendingUp className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">Share prices & stock info</h3>
                            <p className="text-gray-600">Customers get real-time information from your inventory and price lists.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Star className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">Recommend alternatives</h3>
                            <p className="text-gray-600">If something's out of stock, your AI suggests similar products you have available.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">Capture interested leads</h3>
                            <p className="text-gray-600">Collects customer info and flags hot leads for you to follow up personally.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">Escalate when needed</h3>
                            <p className="text-gray-600">For complex questions, your AI notifies you to take over the conversation.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">Work 24/7</h3>
                            <p className="text-gray-600">Never miss a message again. Your AI is always online, even when you're sleeping.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className="py-16 px-6">
                <div className="max-w-3xl mx-auto bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                    <Shield className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">No guessing. No hallucinations.</h3>
                    <p className="text-lg text-gray-700 leading-relaxed">
                        Salestra <strong>only replies using the data you provide</strong>. If it doesn't know something, it tells the customer and escalates to you. Your AI never makes things up.
                    </p>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        Trusted by businesses across India
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-16 max-w-2xl mx-auto">
                        See what business owners are saying about their AI employees.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="flex gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                ))}
                            </div>
                            <p className="text-gray-700 mb-4 italic">
                                "Salestra handles 80% of our customer queries now. We're saving ₹15,000/month on customer support and never miss a lead!"
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <span className="text-emerald-700 font-semibold">RM</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Rajesh Mehta</p>
                                    <p className="text-sm text-gray-600">Mobile Store, Mumbai</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="flex gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                ))}
                            </div>
                            <p className="text-gray-700 mb-4 italic">
                                "My customers get instant replies even at midnight. Sales increased by 35% since using Salestra. Best investment ever!"
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <span className="text-emerald-700 font-semibold">PS</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Priya Sharma</p>
                                    <p className="text-sm text-gray-600">Fashion Boutique, Delhi</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="flex gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                ))}
                            </div>
                            <p className="text-gray-700 mb-4 italic">
                                "Setup took only 8 minutes. Now I focus on closing deals while my AI handles all the initial questions. Game changer!"
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <span className="text-emerald-700 font-semibold">AK</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Amit Kumar</p>
                                    <p className="text-sm text-gray-600">Real Estate Agency, Bangalore</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ROI Comparison */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        Stop wasting money on manual replies
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
                        See how much you save by switching to Salestra.
                    </p>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white border-2 border-red-200 rounded-xl p-8">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Users className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Manual Handling</h3>
                            </div>
                            <ul className="space-y-4 mb-6">
                                <li className="flex items-start gap-3">
                                    <span className="text-red-600 mt-1">✗</span>
                                    <div>
                                        <p className="font-semibold text-gray-900">Staff Cost: ₹15,000/month</p>
                                        <p className="text-sm text-gray-600">Hiring customer support person</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-600 mt-1">✗</span>
                                    <div>
                                        <p className="font-semibold text-gray-900">Only 9 AM - 6 PM</p>
                                        <p className="text-sm text-gray-600">Miss 60% of inquiries outside hours</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-600 mt-1">✗</span>
                                    <div>
                                        <p className="font-semibold text-gray-900">Slow responses</p>
                                        <p className="text-sm text-gray-600">Lost leads to competitors</p>
                                    </div>
                                </li>
                            </ul>
                            <div className="text-center pt-4 border-t border-gray-200">
                                <div className="text-3xl font-bold text-red-600">₹15,000/mo</div>
                                <p className="text-sm text-gray-600">+ Lost sales</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-xl p-8 relative">
                            <div className="absolute top-4 right-4 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                Save 93%
                            </div>
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Zap className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Salestra AI</h3>
                            </div>
                            <ul className="space-y-4 mb-6">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-900">Only ₹999/month</p>
                                        <p className="text-sm text-gray-700">5,000 messages included</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-900">24/7 Availability</p>
                                        <p className="text-sm text-gray-700">Never miss a customer again</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-900">Instant replies</p>
                                        <p className="text-sm text-gray-700">Capture more leads</p>
                                    </div>
                                </li>
                            </ul>
                            <div className="text-center pt-4 border-t border-emerald-300">
                                <div className="text-3xl font-bold text-emerald-700">₹999/mo</div>
                                <p className="text-sm text-emerald-800 font-semibold">Save ₹14,000/month!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Who It's For */}
            <section className="py-20 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        Perfect for businesses that use WhatsApp
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
                        Join businesses already using Salestra to automate their customer conversations.
                    </p>

                    <div className="grid md:grid-cols-4 gap-6">
                        {[
                            'Mobile & Laptop Shops',
                            'Retail Stores',
                            'Service Providers',
                            'Healthcare Clinics',
                            'Educational Institutes',
                            'Real Estate Agencies',
                            'Restaurants & Cafes',
                            'E-commerce Businesses'
                        ].map((business, i) => (
                            <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                                <p className="font-medium text-gray-900">{business}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Teaser */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Simple, affordable pricing
                    </h2>
                    <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
                        Unlimited messages on all plans. Choose the plan that fits your business size.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                            <p className="text-gray-600 mb-4">Perfect for small businesses</p>
                            <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-1">₹599<span className="text-lg text-gray-600">/mo</span></div>
                            <p className="text-sm text-gray-500 mb-6">Up to 1,500 messages/month</p>
                            <ul className="space-y-3 mb-6">
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Answer customer questions 24/7</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Share prices & availability</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Basic knowledge base</span>
                                </li>
                            </ul>
                            <Link href="/signup" className="block w-full bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-900 py-3 px-4 rounded-xl font-semibold transition-all duration-300 text-center">
                                Start Free Trial
                            </Link>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-2xl p-8 relative hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 hover:-translate-y-2 ring-2 ring-emerald-400">
                            <div className="absolute top-0 right-0 bg-white text-emerald-700 text-xs font-semibold px-3 py-1 rounded-bl-xl rounded-tr-2xl shadow-md">
                                Most Popular
                            </div>
                            <h3 className="text-xl font-bold mb-2">Professional</h3>
                            <p className="text-emerald-100 mb-4">For growing businesses</p>
                            <div className="text-4xl font-bold mb-1">₹999<span className="text-lg text-emerald-100">/mo</span></div>
                            <p className="text-sm text-emerald-100 mb-6">Up to 5,000 messages/month</p>
                            <ul className="space-y-3 mb-6">
                                <li className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span>Everything in Starter, plus:</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span><strong>Fast AI response</strong> (priority processing)</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span>Advanced analytics dashboard</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                                    <span>Lead capture & tagging</span>
                                </li>
                            </ul>
                            <Link href="/signup" className="block w-full bg-white hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 py-3 px-4 rounded-xl font-semibold transition-all duration-300 text-center shadow-md hover:shadow-lg">
                                Start Free Trial
                            </Link>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
                            <p className="text-gray-600 mb-4">For large businesses</p>
                            <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-1">₹1,499<span className="text-lg text-gray-600">/mo</span></div>
                            <p className="text-sm text-gray-500 mb-6">Unlimited messages</p>
                            <ul className="space-y-3 mb-6">
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Everything in Professional, plus:</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>Fastest AI response</strong> (highest priority)</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Priority support (1-hour response)</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Custom AI training</span>
                                </li>
                            </ul>
                            <a href="mailto:sales@salestra.com" className="block w-full bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-900 py-3 px-4 rounded-xl font-semibold transition-all duration-300 text-center">
                                Contact Sales
                            </a>
                        </div>
                    </div>

                    <p className="text-gray-600">
                        <strong>7-day free trial</strong> on all plans. No credit card required. Cancel anytime.
                    </p>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 px-6 bg-white">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                        Frequently asked questions
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-12">
                        Everything you need to know about Salestra.
                    </p>

                    <div className="space-y-6">
                        <details className="bg-gray-50 rounded-lg p-6 group">
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900">
                                <span>How long does setup actually take?</span>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                            </summary>
                            <p className="mt-4 text-gray-600">
                                Most businesses complete setup in 8-10 minutes. You'll connect your WhatsApp (30 seconds), add business info (3-5 minutes), and test your AI (2-3 minutes). That's it!
                            </p>
                        </details>

                        <details className="bg-gray-50 rounded-lg p-6 group">
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900">
                                <span>What if my business is unique? Will the AI understand?</span>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                            </summary>
                            <p className="mt-4 text-gray-600">
                                Absolutely! You teach the AI about YOUR specific business — products, prices, policies, services. It learns from the documents and information you provide, so it answers exactly how you would.
                            </p>
                        </details>

                        <details className="bg-gray-50 rounded-lg p-6 group">
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900">
                                <span>Is the 7-day trial really free?</span>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                            </summary>
                            <p className="mt-4 text-gray-600">
                                Yes, completely free. No credit card required to start. Try all features for 14 days. If you're not satisfied, just cancel — no hassle, no charges.
                            </p>
                        </details>

                        <details className="bg-gray-50 rounded-lg p-6 group">
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900">
                                <span>What happens when AI doesn't know the answer?</span>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                            </summary>
                            <p className="mt-4 text-gray-600">
                                Your AI will NEVER make up answers. If it doesn't know something, it politely tells the customer and tags the conversation for you to handle personally. You stay in control.
                            </p>
                        </details>

                        <details className="bg-gray-50 rounded-lg p-6 group">
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900">
                                <span>Can I upgrade or downgrade my plan anytime?</span>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                            </summary>
                            <p className="mt-4 text-gray-600">
                                Yes! Change plans anytime with a single click. Upgrade when you need more messages, downgrade if you need less. No contracts, no commitments.
                            </p>
                        </details>

                        <details className="bg-gray-50 rounded-lg p-6 group">
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-gray-900">
                                <span>Is my customer data safe and private?</span>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                            </summary>
                            <p className="mt-4 text-gray-600">
                                Absolutely. All conversations are encrypted, and your business data is stored securely. We never share your data with anyone. Your privacy is our priority.
                            </p>
                        </details>
                    </div>
                </div>
            </section>

            {/* Trust & Guarantee Section */}
            <section className="py-16 px-6 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div>
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Bank-Level Security</h3>
                            <p className="text-sm text-gray-600">256-bit encryption protects all your data</p>
                        </div>
                        <div>
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">7-Day Money Back</h3>
                            <p className="text-sm text-gray-600">Not satisfied? Get a full refund</p>
                        </div>
                        <div>
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Cancel Anytime</h3>
                            <p className="text-sm text-gray-600">No long-term contracts required</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-6 bg-emerald-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Start serving customers 24/7
                    </h2>
                    <p className="text-xl text-emerald-100 mb-8">
                        Your AI employee is ready to start working in the next 10 minutes.
                    </p>
                    <Link
                        href="/signup"
                        className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-emerald-600 px-8 py-4 rounded-lg font-semibold text-lg transition-colors group"
                    >
                        <span>Get Started Free</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-50 border-t border-gray-200 py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-semibold text-gray-900">Salestra</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                            <a href="#" className="hover:text-gray-900">Privacy Policy</a>
                            <a href="#" className="hover:text-gray-900">Terms of Service</a>
                            <a href="#" className="hover:text-gray-900">Contact</a>
                        </div>
                    </div>
                    <div className="mt-8 text-center text-sm text-gray-500">
                        © 2026 Salestra. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    )
}
