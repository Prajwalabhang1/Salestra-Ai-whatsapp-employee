'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, MessageSquare, BarChart3, Users,
    BookOpen, Bot, Settings, CreditCard, LogOut,
    ChevronLeft, ChevronRight, MessageCircle, Package
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface SidebarProps {
    onLogout?: () => void
}

export default function Sidebar({ onLogout }: SidebarProps) {
    const pathname = usePathname()
    // Default to false for SSR, then read from localStorage on client
    const [collapsed, setCollapsed] = useState(false)

    // Load collapsed state from localStorage on client-side only
    useEffect(() => {
        const saved = localStorage.getItem('sidebarCollapsed')
        if (saved === 'true') {
            setCollapsed(true)
        }
    }, [])

    const toggleCollapse = () => {
        const newState = !collapsed
        setCollapsed(newState)
        localStorage.setItem('sidebarCollapsed', String(newState))
    }

    const navItems = [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/conversations/list', icon: MessageSquare, label: 'Conversations' },
        { href: '/analytics', icon: BarChart3, label: 'Analytics & CRM' },
        { href: '/inventory', icon: Package, label: 'Inventory' },
        { href: '/ai-employee', icon: Bot, label: 'AI Employee' },
        { href: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
        { href: '/settings', icon: Settings, label: 'Settings' },
        { href: '/billing', icon: CreditCard, label: 'Billing' },
    ]

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard' || pathname === '/'
        }
        return pathname?.startsWith(href)
    }

    return (
        <div
            className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    {!collapsed && (
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-semibold text-gray-900">Salestra</span>
                        </div>
                    )}
                    <button
                        onClick={toggleCollapse}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {collapsed ? (
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        ) : (
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active
                                ? 'bg-emerald-50 text-emerald-700 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                                } ${collapsed ? 'justify-center' : ''}`}
                            title={collapsed ? item.label : ''}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-emerald-600' : 'text-gray-500'}`} />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    )
                })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={onLogout}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 transition-all w-full ${collapsed ? 'justify-center' : ''
                        }`}
                    title={collapsed ? 'Logout' : ''}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>Logout</span>}
                </button>
            </div>
        </div>
    )
}
