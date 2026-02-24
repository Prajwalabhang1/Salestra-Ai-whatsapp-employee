'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Bot, User, Loader, Sparkles, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import Sidebar from '../../../components/Sidebar'

interface Message {
    role: 'user' | 'assistant'
    content: string
    metadata?: {
        confidence?: number
        executionTime?: number
        tools?: string[]
    }
}

export default function PlaygroundPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }
    }, [router])

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    const handleSendMessage = async () => {
        if (!input.trim() || loading) return

        const userMessage: Message = {
            role: 'user',
            content: input
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setLoading(true)

        try {
            // For now, we'll create a mock response since the test endpoint doesn't exist yet
            // TODO: Replace with actual API call to /api/ai-employee/test-message

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000))

            const aiMessage: Message = {
                role: 'assistant',
                content: `This is a simulated response to: "${input}". The actual AI testing playground will be connected to the backend test endpoint soon!`,
                metadata: {
                    confidence: 0.92,
                    executionTime: 1250,
                    tools: ['search_knowledge']
                }
            }

            setMessages(prev => [...prev, aiMessage])

        } catch (error) {
            console.error('Failed to send message:', error)
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Sorry, there was an error processing your message. Please try again.'
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-5xl mx-auto px-6 py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">AI Testing Playground</h1>
                                    <p className="text-sm text-gray-600">Test your AI assistant in real-time</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setMessages([])}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Clear Chat
                            </button>
                        </div>
                    </div>
                </div>

                {/* Chat Container */}
                <div className="flex-1 overflow-hidden">
                    <div className="max-w-5xl mx-auto h-full flex">
                        {/* Messages Area */}
                        <div className="flex-1 flex flex-col bg-white border-x border-gray-200">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-center">
                                            <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500 text-sm">Start a conversation to test your AI</p>
                                            <p className="text-gray-400 text-xs mt-2">Try asking about your business, products, or services</p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-2xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                                                <div className="flex items-start space-x-3">
                                                    {message.role === 'assistant' && (
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                                            <Bot className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <div className={`rounded-2xl px-4 py-3 ${message.role === 'user'
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-gray-100 text-gray-900'
                                                            }`}>
                                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                        </div>
                                                        {message.metadata && (
                                                            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                                                                {message.metadata.confidence !== undefined && (
                                                                    <div className="flex items-center space-x-1">
                                                                        <TrendingUp className="w-3 h-3" />
                                                                        <span>{Math.round(message.metadata.confidence * 100)}% confidence</span>
                                                                    </div>
                                                                )}
                                                                {message.metadata.executionTime !== undefined && (
                                                                    <div className="flex items-center space-x-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        <span>{message.metadata.executionTime}ms</span>
                                                                    </div>
                                                                )}
                                                                {message.metadata.tools && message.metadata.tools.length > 0 && (
                                                                    <div className="flex items-center space-x-1">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        <span>{message.metadata.tools.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {message.role === 'user' && (
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0">
                                                            <User className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                                <div className="flex items-center space-x-2">
                                                    <Loader className="w-4 h-4 animate-spin text-gray-400" />
                                                    <span className="text-sm text-gray-500">Thinking...</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type your test message..."
                                        disabled={loading}
                                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!input.trim() || loading}
                                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                    >
                                        <Send className="w-4 h-4" />
                                        <span>Send</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Info Panel */}
                        <div className="w-80 bg-gray-50 p-6 border-r border-gray-200 overflow-y-auto">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">About Playground</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-900 font-medium mb-2">💡 Tip</p>
                                    <p className="text-xs text-blue-700">
                                        The playground uses your current AI configuration. Any changes you make to settings will be reflected here.
                                    </p>
                                </div>

                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-xs text-green-900 font-medium mb-2">✨ Features</p>
                                    <ul className="text-xs text-green-700 space-y-1">
                                        <li>• Real-time AI responses</li>
                                        <li>• Confidence scoring</li>
                                        <li>• Execution time tracking</li>
                                        <li>• Tool usage visibility</li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-xs text-orange-900 font-medium mb-2">⚠️ Note</p>
                                    <p className="text-xs text-orange-700">
                                        This is a testing environment. These conversations are not saved and won't count toward your usage limits.
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-gray-200">
                                    <h4 className="text-xs font-semibold text-gray-900 mb-3">Quick Test Scenarios</h4>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setInput('What are your business hours?')}
                                            className="w-full text-left p-2 text-xs text-gray-700 hover:bg-white rounded-lg transition-colors"
                                        >
                                            "What are your business hours?"
                                        </button>
                                        <button
                                            onClick={() => setInput('Do you have any products in stock?')}
                                            className="w-full text-left p-2 text-xs text-gray-700 hover:bg-white rounded-lg transition-colors"
                                        >
                                            "Do you have any products in stock?"
                                        </button>
                                        <button
                                            onClick={() => setInput('How can I contact customer support?')}
                                            className="w-full text-left p-2 text-xs text-gray-700 hover:bg-white rounded-lg transition-colors"
                                        >
                                            "How can I contact support?"
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
