'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, User, Clock, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import Sidebar from '../../../components/Sidebar'

interface Message {
    id: string
    sender: 'customer' | 'ai' | 'human'
    messageText: string
    timestamp: string
    relativeTime: string
    aiConfidence: number | null
}

interface ConversationData {
    id: string
    customerName: string
    customerPhone: string
    status: string
    assignedTo: string
    sentiment: string | null
    language: string | null
    tags: string[]
    messageCount: number
    unreadCount: number
}

interface Metadata {
    totalDuration: string
    avgConfidence: number
    escalationCount: number
    responseRate: string
}

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
    const conversationId = params.id
    const router = useRouter()

    const [conversation, setConversation] = useState<ConversationData | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [metadata, setMetadata] = useState<Metadata | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        fetchConversationDetail()
    }, [conversationId])

    const fetchConversationDetail = async () => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        try {
            setLoading(true)
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
            const response = await fetch(`${apiUrl}/api/conversations/${conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.ok) {
                const data = await response.json()
                setConversation(data.conversation)
                setMessages(data.messages)
                setMetadata(data.metadata)
            } else if (response.status === 404) {
                router.push('/conversations/list')
            }
        } catch (error) {
            console.error('Error fetching conversation:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (action: 'takeover' | 'return-to-ai' | 'resolve') => {
        const token = localStorage.getItem('token')
        if (!token) return

        setActionLoading(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
            let endpoint = ''

            if (action === 'takeover') {
                endpoint = `/api/conversations/${conversationId}/takeover`
            } else if (action === 'return-to-ai') {
                endpoint = `/api/conversations/${conversationId}/return-to-ai`
            }

            const response = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.ok) {
                // Refresh conversation data
                await fetchConversationDetail()
            }
        } catch (error) {
            console.error(`Error performing ${action}:`, error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (!conversation) {
        return null
    }

    const getSentimentColor = (sentiment: string | null) => {
        switch (sentiment) {
            case 'positive': return 'text-green-600 bg-green-50'
            case 'negative': return 'text-red-600 bg-red-50'
            default: return 'text-gray-600 bg-gray-50'
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <Link
                            href="/conversations/list"
                            className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Conversations
                        </Link>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            {conversation.assignedTo === 'ai' ? (
                                <button
                                    onClick={() => handleAction('takeover')}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? 'Processing...' : 'Take Over'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAction('return-to-ai')}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? 'Processing...' : 'Return to AI'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-start gap-6">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-2xl">
                                {conversation.customerName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">{conversation.customerName}</h1>
                            <p className="text-gray-600 mt-1">{conversation.customerPhone}</p>
                            <div className="flex items-center gap-3 mt-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${conversation.status === 'resolved' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                    {conversation.status}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${conversation.assignedTo === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                    }`}>
                                    {conversation.assignedTo === 'ai' ? 'AI Agent' : 'Human Agent'}
                                </span>
                                {conversation.sentiment && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSentimentColor(conversation.sentiment)}`}>
                                        {conversation.sentiment}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto p-8">
                        {/* Metadata Cards */}
                        {metadata && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-sm font-medium">Duration</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{metadata.totalDuration}</p>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <MessageSquare className="w-4 h-4" />
                                        <span className="text-sm font-medium">Messages</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{conversation.messageCount}</p>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <TrendingUp className="w-4 h-4" />
                                        <span className="text-sm font-medium">AI Confidence</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{metadata.avgConfidence}%</p>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm font-medium">Response Time</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">{metadata.responseRate}</p>
                                </div>
                            </div>
                        )}

                        {/* Messages Thread */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-6">Conversation Thread</h2>

                            <div className="space-y-6">
                                {messages.map((message, index) => (
                                    <div key={message.id} className="flex gap-4">
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.sender === 'customer'
                                            ? 'bg-gray-100'
                                            : message.sender === 'ai'
                                                ? 'bg-emerald-100'
                                                : 'bg-blue-100'
                                            }`}>
                                            {message.sender === 'customer' ? (
                                                <User className="w-5 h-5 text-gray-600" />
                                            ) : (
                                                <MessageSquare className={`w-5 h-5 ${message.sender === 'ai' ? 'text-emerald-600' : 'text-blue-600'}`} />
                                            )}
                                        </div>

                                        {/* Message Content */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-900">
                                                    {message.sender === 'customer' ? conversation.customerName : message.sender === 'ai' ? 'AI Assistant' : 'Human Agent'}
                                                </span>
                                                <span className="text-xs text-gray-500">{message.relativeTime}</span>
                                                {message.aiConfidence !== null && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${message.aiConfidence >= 0.8 ? 'bg-green-100 text-green-700' :
                                                        message.aiConfidence >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                        {Math.round(message.aiConfidence * 100)}% confidence
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-700 whitespace-pre-wrap">{message.messageText}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
