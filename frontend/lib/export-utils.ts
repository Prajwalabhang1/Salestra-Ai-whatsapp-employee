/**
 * Export Utilities - CSV and PDF Generation
 * Professional dashboard export with multiple formats
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface DashboardData {
    businessName?: string
    metrics?: {
        conversations?: { today: number; change: number }
        leads?: { today: number; change: number }
        productsAsked?: { today: number; change: number }
        avgResponse?: { today: string; change: string }
    }
    recentConversations?: Array<{
        customerName: string
        message: string
        reply: string
        time: string
        status: string
    }>
    charts?: {
        messageVolume?: Array<{ day: string; messages: number }>
        peakHours?: Array<{ hour: string; count: number }>
    }
}

export function exportToCSV(dashboardData: DashboardData, timeRange: string) {
    try {
        const csvLines = []

        // Header
        csvLines.push('Salestra Dashboard Export')
        csvLines.push(`Business: ${dashboardData.businessName || 'N/A'}`)
        csvLines.push(`Date: ${new Date().toLocaleString()}`)
        csvLines.push(`Time Range: ${timeRange}`)
        csvLines.push('')

        // Metrics
        csvLines.push('METRICS')
        csvLines.push('Metric,Today,Change')
        csvLines.push(`Conversations,${dashboardData.metrics?.conversations?.today || 0},${dashboardData.metrics?.conversations?.change || 0}`)
        csvLines.push(`Leads Captured,${dashboardData.metrics?.leads?.today || 0},${dashboardData.metrics?.leads?.change || 0}`)
        csvLines.push(`Messages,${dashboardData.metrics?.productsAsked?.today || 0},${dashboardData.metrics?.productsAsked?.change || 0}`)
        csvLines.push(`Avg Response Time,${dashboardData.metrics?.avgResponse?.today || 0}s,${dashboardData.metrics?.avgResponse?.change || 0}s`)
        csvLines.push('')

        // Recent conversations
        csvLines.push('RECENT CONVERSATIONS')
        csvLines.push('Customer,Message,AI Reply,Time,Status')
        dashboardData.recentConversations?.forEach((conv) => {
            const message = conv.message?.replace(/,/g, ';') || ''
            const reply = conv.reply?.replace(/,/g, ';') || ''
            csvLines.push(`${conv.customerName},${message},${reply},${conv.time},${conv.status}`)
        })
        csvLines.push('')

        // Chart data
        if (dashboardData.charts?.messageVolume) {
            csvLines.push('MESSAGE VOLUME (7 DAYS)')
            csvLines.push('Day,Messages')
            dashboardData.charts.messageVolume.forEach((item) => {
                csvLines.push(`${item.day},${item.messages}`)
            })
            csvLines.push('')
        }

        if (dashboardData.charts?.peakHours) {
            csvLines.push('PEAK HOURS')
            csvLines.push('Hour,Count')
            dashboardData.charts.peakHours.forEach((item) => {
                csvLines.push(`${item.hour},${item.count}`)
            })
        }

        // Create and download
        const csvContent = csvLines.join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        downloadFile(blob, `salestra-dashboard-${new Date().toISOString().split('T')[0]}.csv`)

        return true
    } catch (error) {
        console.error('CSV export error:', error)
        return false
    }
}

export function exportToPDF(dashboardData: DashboardData, timeRange: string) {
    try {
        const doc = new jsPDF()

        // Title and Header
        doc.setFontSize(20)
        doc.setTextColor(16, 185, 129) // Emerald color
        doc.text('Salestra Dashboard Report', 20, 20)

        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        doc.text(`Business: ${dashboardData.businessName || 'N/A'}`, 20, 30)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 36)
        doc.text(`Time Range: ${timeRange}`, 20, 42)

        // Metrics Section
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        doc.text('Key Metrics', 20, 55)

        const metricsData = [
            ['Metric', 'Today', 'Change'],
            ['Conversations',
                String(dashboardData.metrics?.conversations?.today || 0),
                String(dashboardData.metrics?.conversations?.change || 0)
            ],
            ['Leads Captured',
                String(dashboardData.metrics?.leads?.today || 0),
                String(dashboardData.metrics?.leads?.change || 0)
            ],
            ['Messages',
                String(dashboardData.metrics?.productsAsked?.today || 0),
                String(dashboardData.metrics?.productsAsked?.change || 0)
            ],
            ['Avg Response Time',
                `${dashboardData.metrics?.avgResponse?.today || '0'}s`,
                `${dashboardData.metrics?.avgResponse?.change || '0'}s`
            ]
        ]

        autoTable(doc, {
            head: [metricsData[0]],
            body: metricsData.slice(1),
            startY: 60,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
            styles: { fontSize: 10 }
        })

        // Message Volume Chart Data
        if (dashboardData.charts?.messageVolume && dashboardData.charts.messageVolume.length > 0) {
            const finalY = (doc as any).lastAutoTable.finalY || 100

            doc.setFontSize(14)
            doc.text('7-Day Message Volume', 20, finalY + 15)

            const volumeData = [
                ['Day', 'Messages'],
                ...dashboardData.charts.messageVolume.map(item => [
                    item.day,
                    String(item.messages)
                ])
            ]

            autoTable(doc, {
                head: [volumeData[0]],
                body: volumeData.slice(1),
                startY: finalY + 20,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] },
                styles: { fontSize: 10 }
            })
        }

        // Peak Hours
        if (dashboardData.charts?.peakHours && dashboardData.charts.peakHours.length > 0) {
            const finalY = (doc as any).lastAutoTable.finalY || 150

            doc.setFontSize(14)
            doc.text('Peak Hours Distribution', 20, finalY + 15)

            const peakData = [
                ['Hour', 'Message Count'],
                ...dashboardData.charts.peakHours.map(item => [
                    item.hour,
                    String(item.count)
                ])
            ]

            autoTable(doc, {
                head: [peakData[0]],
                body: peakData.slice(1),
                startY: finalY + 20,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] },
                styles: { fontSize: 10 }
            })
        }

        // Recent Conversations (new page if needed)
        if (dashboardData.recentConversations && dashboardData.recentConversations.length > 0) {
            doc.addPage()

            doc.setFontSize(14)
            doc.text('Recent Conversations', 20, 20)

            const conversationsData = [
                ['Customer', 'Message', 'AI Reply', 'Time'],
                ...dashboardData.recentConversations.slice(0, 10).map(conv => [
                    conv.customerName,
                    conv.message.substring(0, 50) + (conv.message.length > 50 ? '...' : ''),
                    conv.reply.substring(0, 50) + (conv.reply.length > 50 ? '...' : ''),
                    conv.time
                ])
            ]

            autoTable(doc, {
                head: [conversationsData[0]],
                body: conversationsData.slice(1),
                startY: 25,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129] },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 60 },
                    3: { cellWidth: 30 }
                }
            })
        }

        // Footer on all pages
        const pageCount = doc.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i)
            doc.setFontSize(8)
            doc.setTextColor(150, 150, 150)
            doc.text(
                `Page ${i} of ${pageCount} • Powered by Salestra`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            )
        }

        // Save PDF
        doc.save(`salestra-dashboard-${new Date().toISOString().split('T')[0]}.pdf`)

        return true
    } catch (error) {
        console.error('PDF export error:', error)
        return false
    }
}

function downloadFile(blob: Blob, filename: string) {
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
