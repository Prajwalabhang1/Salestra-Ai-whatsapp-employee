import type { Metadata } from 'next'
import { Inter } from "next/font/google";
import './globals.css'
import { ToastProvider } from "@/lib/toast-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: 'Salestra - AI Employee for WhatsApp',
    description: 'Your AI-powered sales and support agent on WhatsApp',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className={inter.className}>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </body>
        </html>
    )
}
