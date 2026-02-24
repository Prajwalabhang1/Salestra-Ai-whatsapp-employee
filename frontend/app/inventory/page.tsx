'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Package, Search, Plus, Filter, ArrowRight,
    AlertTriangle, CheckCircle2, XCircle, MoreVertical,
    Edit, Trash2, ChevronLeft, ChevronRight, Download
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'

interface InventoryItem {
    id: string
    sku: string
    name: string
    description?: string
    category?: string
    brand?: string
    price: number
    stockQuantity: number
    status: string
    createdAt: string
}

interface PaginationState {
    total: number
    limit: number
    offset: number
}

export default function InventoryPage() {
    const router = useRouter()
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [stockFilter, setStockFilter] = useState('') // 'in_stock', 'low_stock', 'out_of_stock'
    const [categories, setCategories] = useState<{ name: string, count: number }[]>([])

    // Pagination
    const [pagination, setPagination] = useState<PaginationState>({
        total: 0,
        limit: 50,
        offset: 0
    })

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('')
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const fetchInventory = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('token')
            if (!token) {
                router.push('/login')
                return
            }

            const params = new URLSearchParams()
            params.append('limit', pagination.limit.toString())
            params.append('offset', pagination.offset.toString())
            if (debouncedSearch) params.append('search', debouncedSearch)
            if (categoryFilter) params.append('category', categoryFilter)
            if (stockFilter) params.append('stockStatus', stockFilter)

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
            const res = await fetch(`${apiUrl}/api/inventory?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            const data = await res.json()
            if (data.success) {
                setItems(data.items)
                setPagination(prev => ({ ...prev, ...data.pagination }))
            } else {
                setError(data.error || 'Failed to load inventory')
            }
        } catch (err) {
            setError('Network error occurred')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    // Fetch categories for filter
    const fetchCategories = async () => {
        const token = localStorage.getItem('token')
        if (!token) return
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
            const res = await fetch(`${apiUrl}/api/inventory/categories`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) setCategories(data.categories)
        } catch (e) {
            console.error('Failed to fetch categories')
        }
    }

    // Initial Load & Filter Changes
    useEffect(() => {
        fetchCategories()
    }, [])

    useEffect(() => {
        // Reset offset on filter change
        setPagination(p => ({ ...p, offset: 0 }))
    }, [debouncedSearch, categoryFilter, stockFilter])

    useEffect(() => {
        fetchInventory()
    }, [pagination.offset, pagination.limit, debouncedSearch, categoryFilter, stockFilter])

    const handleLogout = () => {
        localStorage.clear()
        router.push('/login')
    }

    const getStockBadge = (qty: number) => {
        if (qty === 0) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Out of stock</span>
        if (qty <= 5) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3" /> Low stock</span>
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> In stock</span>
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
                            <p className="text-sm text-gray-500 mt-1">Track and manage your products and stock levels</p>
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm">
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards - Simplified for now as we don't have a stats endpoint yet, using mock/derived data if possible or static layout */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Package className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase">Total Items</p>
                                    <p className="text-xl font-bold text-gray-900">{pagination.total}</p>
                                </div>
                            </div>
                        </div>
                        {/* Other stats would require specific backend endpoints */}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 mt-6">
                        <div className="flex-1 max-w-md relative">
                            <input
                                type="text"
                                placeholder="Search by name, SKU, or brand..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => (
                                <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                            ))}
                        </select>

                        <select
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="">All Stock Status</option>
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock (&le; 5)</option>
                            <option value="out_of_stock">Out of Stock</option>
                        </select>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-auto p-8">
                    {loading && items.length === 0 ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            {error}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
                            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">No items found</h3>
                            <p className="text-gray-500 mt-1">Try adjusting your filters or add a new item.</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Info</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                                        <Package className="w-5 h-5" />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                                        <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {item.category || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {item.price.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStockBadge(item.stockQuantity)}
                                                <div className="text-xs text-gray-400 mt-1">{item.stockQuantity} units</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${item.status === 'active' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="p-1 text-gray-400 hover:text-emerald-600 transition-colors">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination Footer */}
                            <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-medium">{items.length > 0 ? pagination.offset + 1 : 0}</span> to <span className="font-medium">{Math.min(pagination.offset + pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                                        disabled={pagination.offset === 0}
                                        className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                                        disabled={pagination.offset + items.length >= pagination.total}
                                        className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
