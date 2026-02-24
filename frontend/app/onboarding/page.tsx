'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, ArrowLeft, Check, MessageSquare, Upload, Bot, Zap, CheckCircle2, AlertCircle, Shield, Rocket, TrendingUp, Users, Settings, Smile } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { analytics } from '@/lib/analytics'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { useToast } from '@/lib/toast-context'
import { Confetti } from '@/components/ui/Confetti'
import { useWhatsAppQRCode, formatTimeRemaining } from '@/lib/whatsapp-qr'

export default function OnboardingPage() {
    const router = useRouter()
    const toast = useToast()
    const [currentStep, setCurrentStep] = useState(0)
    const [formData, setFormData] = useState({
        // Business Context
        businessName: '',
        businessDescription: '',
        industry: 'retail',
        whatsappNumber: '',

        // AI Configuration
        tone: 'professional',
        language: 'en',
        workingHours: null,
        customInstructions: '',

        // System
        tenantId: '',
        instanceId: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const steps = [
        { id: 'welcome', title: 'Welcome', icon: Zap },
        { id: 'context', title: 'Business Context', icon: MessageSquare },
        { id: 'knowledge', title: 'Knowledge Base', icon: Upload },
        { id: 'personality', title: 'AI Personality', icon: Bot },
        { id: 'test-ai', title: 'Test Your AI', icon: CheckCircle2 },
        { id: 'whatsapp', title: 'WhatsApp', icon: MessageSquare },
        { id: 'launch', title: 'Launch', icon: Rocket },
    ]

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            analytics.trackStepComplete(steps[currentStep].id, currentStep)
            saveProgress(currentStep + 1) // Phase 4.2
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const updateFormData = (data: any) => {
        setFormData({ ...formData, ...data })
    }

    // Get user from localStorage
    useEffect(() => {
        const userStr = localStorage.getItem('user')
        if (userStr) {
            const user = JSON.parse(userStr)
        }

        // Load saved progress (Phase 4.2)
        loadProgress()
    }, [])

    const loadProgress = async () => {
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const response = await fetch('http://localhost:3000/api/onboarding/progress', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await response.json()

            if (data.success && data.data) {
                // Restore step if not completed
                if (data.data.step > 0 && !data.data.completed) {
                    setCurrentStep(data.data.step)
                    toast.success('Resumed from where you left off!')
                }
                // Restore form data
                if (data.data.data) {
                    setFormData(prev => ({ ...prev, ...data.data.data }))
                }
            }
        } catch (err) {
            console.error('Failed to load progress', err)
        }
    }

    const saveProgress = async (step: number) => {
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            await fetch('http://localhost:3000/api/onboarding/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    step,
                    data: formData,
                    completed: step === steps.length - 1
                })
            })
        } catch (err) {
            console.error('Failed to save progress', err)
        }
    }

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return <WelcomeStep nextStep={nextStep} />
            case 1:
                return <BusinessContextStep
                    formData={formData}
                    updateFormData={updateFormData}
                    nextStep={nextStep}
                    prevStep={prevStep}
                    setLoading={setLoading}
                    setError={setError}
                    loading={loading}
                />
            case 2:
                return <KnowledgeStep
                    formData={formData}
                    nextStep={nextStep}
                    prevStep={prevStep}
                />
            case 3:
                return <PersonalityStep
                    formData={formData}
                    updateFormData={updateFormData}
                    nextStep={nextStep}
                    prevStep={prevStep}
                />
            case 4:
                return <TestAIStep
                    formData={formData}
                    nextStep={nextStep}
                    prevStep={prevStep}
                />
            case 5:
                return <WhatsAppStep
                    formData={formData}
                    updateFormData={updateFormData}
                    nextStep={nextStep}
                    prevStep={prevStep}
                />
            case 6:
                return <LaunchStep
                    formData={formData}
                    router={router}
                    prevStep={prevStep}
                />
            default:
                return <WelcomeStep nextStep={nextStep} />
        }
    }

    return (
        <div className="min-h-screen bg-mesh-gradient text-slate-800">
            {/* Header */}
            <header className="border-b border-white/20 glass sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-semibold text-gray-900">Salestra</span>
                    </div>
                    <div className="text-sm text-gray-500">
                        Step {currentStep + 1} of {steps.length}
                    </div>
                </div>
            </header>

            {/* Progress bar */}
            <div className="border-b border-white/20 bg-white/40 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-6">
                    <div className="flex items-center">
                        {steps.map((step, index) => {
                            const StepIcon = step.icon
                            const isActive = index === currentStep
                            const isComplete = index < currentStep

                            return (
                                <div key={step.id} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center w-full">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isComplete ? 'bg-emerald-500 text-white' :
                                            isActive ? 'bg-emerald-600 text-white' :
                                                'bg-gray-200 text-gray-500'
                                            }`}>
                                            {isComplete ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                                        </div>
                                        <span className="text-xs mt-2 text-center text-gray-600 hidden sm:block">
                                            {step.title}
                                        </span>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={`h-1 flex-1 mx-2 transition-all ${isComplete ? 'bg-emerald-500' : 'bg-gray-200'
                                            }`} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <main className="max-w-4xl mx-auto px-4 py-8 md:px-6 md:py-12">
                <div className="glass-card rounded-2xl p-6 md:p-12 shadow-xl animate-fade-in">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div key={currentStep} className="animate-in slide-in-from-right-8 fade-in duration-500">
                        {renderStep()}
                    </div>
                </div>
            </main>
        </div>
    )
}

// Step 1: Welcome
function WelcomeStep({ nextStep }: { nextStep: () => void }) {
    return (
        <div className="text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Bot className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Let's Create Your AI Employee
            </h1>

            <p className="text-xl text-gray-600 mb-8">
                In the next 3-5 minutes, we'll set up an AI assistant that handles customer conversations on WhatsApp 24/7.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-4">Here's what we'll do:</h3>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-gray-900">Learn about your business</p>
                            <p className="text-sm text-gray-600">So the AI knows what you offer</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-gray-900">Upload your business knowledge</p>
                            <p className="text-sm text-gray-600">FAQs, products, policies (optional)</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-gray-900">Configure AI personality</p>
                            <p className="text-sm text-gray-600">Set tone, language, and behavior</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-gray-900">Connect your WhatsApp</p>
                            <p className="text-sm text-gray-600">We'll handle this in the background</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-gray-900">Test before going live</p>
                            <p className="text-sm text-gray-600">Chat with your AI to make sure it works perfectly</p>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={nextStep}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-8 rounded-lg transition-colors inline-flex items-center gap-2 group"
            >
                <span>Let's start</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
        </div>
    )
}

// Step 2: Business Context
function BusinessContextStep({ formData, updateFormData, nextStep, prevStep, setLoading, setError, loading }: any) {
    const toast = useToast()
    const [localData, setLocalData] = useState({
        businessName: formData.businessName,
        businessDescription: formData.businessDescription,
        industry: formData.industry,
        whatsappNumber: formData.whatsappNumber,
    })
    const [customIndustry, setCustomIndustry] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const token = localStorage.getItem('token')

            // Step 1: Save business context
            const payload = {
                ...localData,
                industry: localData.industry === 'other' ? customIndustry : localData.industry
            }

            const response = await fetch('http://localhost:3000/api/onboarding-new/business-context', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            const data = await response.json()

            if (data.success || response.ok) {
                toast.success('Business context saved!')
                // Step 2: Generate AI configuration based on business description
                try {
                    const generateResponse = await fetch('http://localhost:3000/api/ai-employee/config/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            body: JSON.stringify({
                                businessName: localData.businessName,
                                description: localData.businessDescription,
                                industry: localData.industry === 'other' ? customIndustry : localData.industry
                            })
                        })
                    })

                    const generateData = await generateResponse.json()

                    if (generateData.success && generateData.config) {
                        toast.success('AI Personality generated!')
                        // Save generated config to form data for next step
                        updateFormData({
                            ...localData,
                            generatedAIConfig: generateData.config
                        })
                    } else {
                        console.warn('AI generation failed, will use defaults:', generateData.error)
                        updateFormData(localData)
                    }
                } catch (genError) {
                    console.error('AI generation error:', genError)
                    // Continue even if generation fails
                    updateFormData(localData)
                }

                nextStep()
            } else {
                const errMsg = data.error || 'Failed to save business context'
                setError(errMsg)
                toast.error(errMsg)
                analytics.trackError(errMsg, 'business_context_save')
            }
        } catch (err) {
            const errMsg = 'Network error. Please try again.'
            setError(errMsg)
            toast.error(errMsg)
            analytics.trackError(errMsg, 'business_context_submit')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Tell us about your business
                </h2>
                <p className="text-gray-600">
                    This helps the AI understand what you offer and how to answer customer questions.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Business Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Business Name
                        <HelpTooltip content="The name your AI will use when introducing itself to customers." />
                    </label>
                    <input
                        type="text"
                        value={localData.businessName}
                        onChange={(e) => setLocalData({ ...localData, businessName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="Acme Coffee Co."
                        required
                        disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">What should customers call your business?</p>
                </div>

                {/* Business Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        What does your business do?
                        <HelpTooltip content="Provide details about your products, services, and key selling points. The AI uses this to answer customer questions accurately." />
                    </label>
                    <textarea
                        value={localData.businessDescription}
                        onChange={(e) => setLocalData({ ...localData, businessDescription: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent h-32"
                        placeholder="We sell premium organic coffee beans sourced from sustainable farms around the world. We also offer brewing equipment and barista training."
                        required
                        disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Describe your products/services in 2-3 sentences. The AI uses this to answer customer questions.
                    </p>
                </div>

                {/* Industry */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Industry
                        <HelpTooltip content="Helps us tailor the AI's default knowledge and behavior patterns." />
                    </label>
                    <select
                        value={localData.industry}
                        onChange={(e) => setLocalData({ ...localData, industry: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        disabled={loading}
                    >
                        <option value="mobile-laptop-shops">Mobile & Laptop Shops</option>
                        <option value="retail">Retail Stores</option>
                        <option value="services">Service Providers</option>
                        <option value="healthcare">Healthcare Clinics</option>
                        <option value="education">Educational Institutes</option>
                        <option value="real-estate">Real Estate Agencies</option>
                        <option value="restaurant">Restaurants & Cafes</option>
                        <option value="ecommerce">E-commerce Businesses</option>
                        <option value="finance">Finance & Insurance</option>
                        <option value="legal">Legal Services</option>
                        <option value="logistics">Logistics & Transport</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="consulting">Consulting</option>
                        <option value="technology">Technology & SaaS</option>
                        <option value="tourism">Tourism & Hospitality</option>
                        <option value="entertainment">Entertainment & Media</option>
                        <option value="other">Other (Specify)</option>
                    </select>
                    {localData.industry === 'other' && (
                        <input
                            type="text"
                            value={customIndustry}
                            onChange={(e) => setCustomIndustry(e.target.value)}
                            className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent animate-fade-in"
                            placeholder="Please specify your industry"
                            required
                        />
                    )}
                </div>

                {/* WhatsApp Number */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        WhatsApp Business Number
                        <HelpTooltip content="The number you want to connect to the AI. Must be a valid WhatsApp account." />
                    </label>
                    <input
                        type="tel"
                        value={localData.whatsappNumber}
                        onChange={(e) => setLocalData({ ...localData, whatsappNumber: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="918010099999"
                        required
                        disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Enter your WhatsApp Business number with country code (e.g., 918010099999 for India). We'll connect this in step 5.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-6">
                    <button
                        type="button"
                        onClick={prevStep}
                        className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2 group disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <span>Continue</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div >
    )
}

// Step 3: Knowledge Base
function KnowledgeStep({ nextStep, prevStep }: any) {
    const toast = useToast()
    const [files, setFiles] = useState<File[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [textKnowledge, setTextKnowledge] = useState('')
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
    const [currentFile, setCurrentFile] = useState<string>('')
    const [uploadedDocs, setUploadedDocs] = useState<any[]>([])
    const fileInputRef = useState<HTMLInputElement | null>(null)

    const handleFileSelect = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return

        const newFiles = Array.from(selectedFiles).filter(file => {
            const validTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
            const maxSize = 10 * 1024 * 1024 // 10MB

            return validTypes.includes(file.type) && file.size <= maxSize
        })

        setFiles([...files, ...newFiles])
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFileSelect(e.dataTransfer.files)
    }

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index))
    }

    const handleUpload = async () => {
        setUploading(true)
        const token = localStorage.getItem('token')

        try {
            // Upload files
            for (const file of files) {
                setCurrentFile(file.name)
                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

                // Simulate progress since fetch doesn't support it easily
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        const current = prev[file.name] || 0
                        if (current >= 90) return prev
                        return { ...prev, [file.name]: current + 10 }
                    })
                }, 500)

                const formData = new FormData()
                formData.append('file', file)
                formData.append('source', 'onboarding')

                try {
                    await fetch('http://localhost:3000/api/knowledge/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    })

                    clearInterval(progressInterval)
                    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
                } catch (err) {
                    clearInterval(progressInterval)
                    console.error(`Failed to upload ${file.name}`, err)
                }
            }

            // Upload text knowledge if provided
            if (textKnowledge.trim()) {
                await fetch('http://localhost:3000/api/knowledge/text', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: 'Business Information',
                        content: textKnowledge
                    })
                })
                analytics.track('knowledge_text_added', { length: textKnowledge.length })
            }

            analytics.track('knowledge_upload_complete', {
                fileCount: files.length,
                hasText: !!textKnowledge.trim()
            })

            toast.success('Knowledge base updated!')
            nextStep()
        } catch (error: any) {
            console.error('Upload error:', error)
            toast.error(error.message || 'Upload failed')
            analytics.trackError(error.message || 'Upload failed', 'knowledge_upload')
        } finally {
            setUploading(false)
            setCurrentFile('')
        }
    }

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Add Your Knowledge Base
                </h2>
                <p className="text-gray-600">
                    Upload documents or add information that helps your AI understand your products, services, and policies.
                </p>
            </div>

            {/* File Upload Area */}
            <div className="space-y-6">
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-300 hover:border-emerald-400'
                        }`}
                >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Drop files here or click to upload
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Supported: PDF, TXT, DOCX (Max 10MB each)
                    </p>
                    <input
                        type="file"
                        multiple
                        accept=".pdf,.txt,.docx"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-colors"
                    >
                        Choose Files
                    </label>
                </div>

                {/* Selected Files List */}
                {files.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Selected Files ({files.length})</h4>
                        <div className="space-y-2">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                            <Upload className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{file.name}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                                {uploadProgress[file.name] !== undefined && (
                                                    <span className="text-xs text-emerald-600 font-medium">
                                                        {uploadProgress[file.name] === 100 ? 'Completed' : `${uploadProgress[file.name]}%`}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Progress Bar */}
                                            {uploadProgress[file.name] !== undefined && (
                                                <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                                                        style={{ width: `${uploadProgress[file.name]}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFile(index)}
                                        disabled={uploading}
                                        className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Text Knowledge Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Or paste information directly
                    </label>
                    <textarea
                        value={textKnowledge}
                        onChange={(e) => setTextKnowledge(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent h-40 resize-none"
                        placeholder="Example: Our store hours are 9 AM to 9 PM Monday-Saturday. We accept all major credit cards and cash. We offer free home delivery for orders above ₹500..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Include FAQs, product details, pricing, policies - anything customers might ask about.
                    </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex gap-3">
                        <div className="flex-shrink-0">
                            <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900 mb-1">How this helps your AI</h4>
                            <p className="text-sm text-blue-800">
                                The AI uses this information to answer customer questions accurately. You can always add more documents later from the dashboard.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6">
                    <button
                        onClick={prevStep}
                        className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-2 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        <span>Back</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={nextStep}
                            className="text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Skip for now
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={uploading || (files.length === 0 && !textKnowledge.trim())}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Step 4: AI Designer (Replaces old Personality Step)
function PersonalityStep({ formData, updateFormData, nextStep, prevStep }: any) {
    const toast = useToast()
    const [localConfig, setLocalConfig] = useState<any>(null)
    const [saving, setSaving] = useState(false)
    const [customizing, setCustomizing] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Load generated config from Step 2 or fetch from backend
        if (formData.generatedAIConfig) {
            setLocalConfig(formData.generatedAIConfig)
            setLoading(false)
        } else {
            // Fallback: Generate now if not done in Step 2
            generateConfigNow()
        }
    }, [])

    const generateConfigNow = async () => {
        const token = localStorage.getItem('token')
        try {
            const response = await fetch('http://localhost:3000/api/ai-employee/config/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    businessName: formData.businessName,
                    description: formData.businessDescription,
                    industry: formData.industry
                })
            })
            const data = await response.json()
            if (data.success && data.config) {
                setLocalConfig(data.config)
            } else {
                // Use sensible defaults
                setLocalConfig({
                    toneFormality: 5,
                    toneEnthusiasm: 5,
                    responseLength: 'medium',
                    useEmojis: true,
                    greetingFirstTime: `Welcome to ${formData.businessName}! How can I help you today?`,
                    customInstructions: ''
                })
            }
        } catch (error) {
            console.error('Generation error:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatPersonalityLabel = (formality: number, enthusiasm: number) => {
        let label = ''
        if (formality <= 3) label = 'Casual'
        else if (formality <= 7) label = 'Professional'
        else label = 'Formal'

        label += ' & '

        if (enthusiasm <= 3) label += 'Reserved'
        else if (enthusiasm <= 7) label += 'Warm'
        else label += 'Energetic'

        return label
    }

    const handleSave = async () => {
        setSaving(true)
        const token = localStorage.getItem('token')

        try {
            // Save to new unified AIConfiguration endpoint
            const response = await fetch('http://localhost:3000/api/ai-employee/config', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(localConfig)
            })

            const data = await response.json()

            if (response.ok) {
                toast.success('Personality settings saved!')
                updateFormData({ ...formData, aiConfig: localConfig })
                nextStep()
            } else {
                console.error('API error:', data)
                toast.error(data.error || 'Failed to save AI configuration')
                setSaving(false)
            }
        } catch (error) {
            console.error('Save error:', error)
            toast.error('Network error. Please try again.')
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600">✨ Analyzing your business and designing the perfect AI personality...</p>
            </div>
        )
    }

    if (!localConfig) {
        return <div>Error loading configuration</div>
    }

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    ✨ Meet Your AI Employee
                </h2>
                <p className="text-gray-600">
                    Based on your business description, we've designed the perfect personality. You can customize it below.
                </p>
            </div>

            {/* AI-Generated Preview Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-300 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-emerald-900 mb-2">
                            {formatPersonalityLabel(localConfig.toneFormality || 5, localConfig.toneEnthusiasm || 5)}
                        </h3>

                        <div className="space-y-3 mb-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">Formality</span>
                                    <span className="text-sm text-gray-600">{localConfig.toneFormality || 5}/10</span>
                                </div>
                                <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-600 rounded-full transition-all"
                                        style={{ width: `${(localConfig.toneFormality || 5) * 10}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">Enthusiasm</span>
                                    <span className="text-sm text-gray-600">{localConfig.toneEnthusiasm || 5}/10</span>
                                </div>
                                <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 rounded-full transition-all"
                                        style={{ width: `${(localConfig.toneEnthusiasm || 5) * 10}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/80 rounded-lg p-4 mb-3">
                            <p className="text-sm font-semibold text-gray-700 mb-1">First Message:</p>
                            <p className="text-gray-800 italic">"{localConfig.greetingFirstTime || 'Hello! How can I help you?'}"</p>
                        </div>

                        {localConfig.customInstructions && (
                            <div className="bg-white/80 rounded-lg p-4">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Key Behaviors:</p>
                                <p className="text-sm text-gray-700">{localConfig.customInstructions}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex gap-3">
                    <button
                        onClick={() => setCustomizing(!customizing)}
                        className="text-sm font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                        <Settings className="w-4 h-4" />
                        {customizing ? 'Hide Customization' : 'Customize Personality'}
                    </button>
                </div>
            </div>

            {/* Customization Panel (Expandable) */}
            {customizing && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-6">
                    <h4 className="font-semibold text-gray-900">Fine-Tune Your AI</h4>

                    {/* Formality Slider */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            Formality Level
                            <HelpTooltip content="Adjust how professional or casual your AI sounds. Lower = Casual/Friendly, Higher = Professional/Formal." />
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={localConfig.toneFormality || 5}
                            onChange={(e) => setLocalConfig({ ...localConfig, toneFormality: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>Casual 😎</span>
                            <span>Professional ⚖️</span>
                        </div>
                    </div>

                    {/* Enthusiasm Slider */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            Enthusiasm Level
                            <HelpTooltip content="Control the energy level. Lower = Calm/Direct, Higher = Energetic/Excited." />
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={localConfig.toneEnthusiasm || 5}
                            onChange={(e) => setLocalConfig({ ...localConfig, toneEnthusiasm: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>Calm 🧘</span>
                            <span>Energetic 🎉</span>
                        </div>
                    </div>

                    {/* Greeting Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            Welcome Message
                            <HelpTooltip content="The very first message your AI will send to new customers." />
                        </label>
                        <textarea
                            value={localConfig.greetingFirstTime || ''}
                            onChange={(e) => setLocalConfig({ ...localConfig, greetingFirstTime: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Custom Instructions */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            Custom Instructions
                            <HelpTooltip content="Specific rules for your AI, e.g., 'Never mention competitor prices' or 'Always ask for email address'." />
                        </label>
                        <textarea
                            value={localConfig.customInstructions || ''}
                            onChange={(e) => setLocalConfig({ ...localConfig, customInstructions: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none"
                            rows={4}
                            placeholder="Example: Always mention our 30-day return policy. Never discuss competitor prices."
                        />
                    </div>

                    {/* Emojis Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Smile className="w-5 h-5 text-gray-600" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">Use Emojis</p>
                                <p className="text-xs text-gray-500">Add warmth to messages</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setLocalConfig({ ...localConfig, useEmojis: !localConfig.useEmojis })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localConfig.useEmojis ? 'bg-emerald-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localConfig.useEmojis ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6">
                <button
                    onClick={prevStep}
                    className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-2 group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Back</span>
                </button>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2 group disabled:opacity-50"
                >
                    {saving ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <span>Looks Perfect!</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}


// Step 5: Test AI (NEW - Live Test Chamber)
function TestAIStep({ formData, nextStep, prevStep }: any) {
    const toast = useToast()
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
    const [testMessage, setTestMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [hasTested, setHasTested] = useState(false)

    // Auto-send first AI greeting
    useEffect(() => {
        if (messages.length === 0 && formData.aiConfig?.greetingFirstTime) {
            setMessages([{
                role: 'assistant',
                content: formData.aiConfig.greetingFirstTime
            }])
        }
    }, [])

    const sendTestMessage = async () => {
        if (!testMessage.trim()) return

        const userMessage = testMessage
        setTestMessage('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setSending(true)
        setHasTested(true)

        try {
            const token = localStorage.getItem('token')
            const response = await fetch('http://localhost:3000/api/ai-employee/playground/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userMessage,
                    config: formData.aiConfig || formData.generatedAIConfig
                })
            })

            const data = await response.json()

            if (response.ok && data.response) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response
                }])
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.'
                }])
                toast.error('AI unavailable')
            }
        } catch (error) {
            console.error('Test message error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Connection error. Please make sure the backend is running.'
            }])
            toast.error('Connection failed')
        } finally {
            setSending(false)
        }
    }

    const suggestedQuestions = [
        "What are your business hours?",
        `Tell me about ${formData.businessName || 'your services'}`,
        "How can I make a purchase?",
        "Do you offer delivery?"
    ]

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    🧪 Test Your AI Employee
                </h2>
                <p className="text-gray-600">
                    Chat with your AI to see how it responds. Make sure it answers questions correctly before going live!
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Suggested Questions Sidebar */}
                <div className="md:col-span-1">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sticky top-4">
                        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Try asking:
                        </h3>
                        <div className="space-y-2">
                            {suggestedQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => setTestMessage(q)}
                                    className="w-full text-left text-sm p-3 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg transition-colors text-gray-700"
                                >
                                    "{q}"
                                </button>
                            ))}
                        </div>

                        {!hasTested && (
                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                                <p className="text-xs text-yellow-800">
                                    ⚠️ You must test at least once before proceeding
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="md:col-span-2">
                    <div className="bg-white border-2 border-gray-200 rounded-2xl h-[500px] flex flex-col">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {sending && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="border-t border-gray-200 p-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && !sending && sendTestMessage()}
                                    placeholder="Type a message to test your AI..."
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    disabled={sending}
                                />
                                <button
                                    onClick={sendTestMessage}
                                    disabled={sending || !testMessage.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sending ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setMessages([])}
                        className="mt-3 text-sm text-gray-600 hover:text-gray-900"
                    >
                        🔄 Reset conversation
                    </button>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-8">
                <button
                    onClick={prevStep}
                    className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-2 group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Back to Edit AI</span>
                </button>

                <button
                    onClick={nextStep}
                    disabled={!hasTested}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span>AI Works Great!</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
        </div>
    )
}



// Step 6: WhatsApp Connection (PRODUCTION-GRADE)
function WhatsAppStep({ formData, updateFormData, nextStep, prevStep }: any) {
    const toast = useToast()
    const [creatingInstance, setCreatingInstance] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const [instanceError, setInstanceError] = useState<string | null>(null)
    const { qrCode, connected, loading, error, expiresIn, refreshQRCode } = useWhatsAppQRCode(formData.instanceId)

    useEffect(() => {
        // Production-grade instance creation with retry logic
        const createInstance = async (attempt: number = 1) => {
            if (formData.instanceId || creatingInstance) return

            setCreatingInstance(true)
            setInstanceError(null)

            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}')
                const tenantId = user.id || formData.tenantId

                if (!tenantId) {
                    throw new Error('User not authenticated. Please refresh the page.')
                }

                console.log(`[WhatsApp Setup] Creating instance (attempt ${attempt}/3)...`)

                const response = await fetch('http://localhost:3000/api/onboarding/create-instance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId }),
                    signal: AbortSignal.timeout(30000) // 30s timeout
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    throw new Error(errorData.error || `Server error: ${response.status}`)
                }

                const data = await response.json()

                // ✅ FIX: Correctly access the nested response structure
                if (data.success && data.data?.instanceId) {
                    const instanceId = data.data.instanceId
                    const instanceName = data.data.instanceName || instanceId

                    console.log(`[WhatsApp Setup] ✅ Instance created: ${instanceId}`)

                    updateFormData({
                        instanceId,
                        whatsappInstanceId: instanceName
                    })

                    toast.success('WhatsApp instance ready! Scan the QR code to connect.')
                    setRetryCount(0)
                } else {
                    // API returned success but no instance data
                    console.error('[WhatsApp Setup] Invalid response:', data)
                    throw new Error('Instance created but ID not returned. Please try again.')
                }
            } catch (err: any) {
                console.error(`[WhatsApp Setup] Attempt ${attempt} failed:`, err)

                const errorMessage = err.name === 'AbortError'
                    ? 'Connection timeout. Please check your internet and try again.'
                    : err.message || 'Failed to initialize WhatsApp'

                setInstanceError(errorMessage)

                // Retry logic with exponential backoff
                if (attempt < 3) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                    console.log(`[WhatsApp Setup] Retrying in ${delay}ms...`)

                    toast.info(`Retrying... (${attempt + 1}/3)`)
                    setRetryCount(attempt)

                    await new Promise(resolve => setTimeout(resolve, delay))
                    return createInstance(attempt + 1)
                } else {
                    // All retries exhausted
                    toast.error(errorMessage)
                }
            } finally {
                setCreatingInstance(false)
            }
        }

        createInstance()
    }, [formData.instanceId])

    // Auto-advance when connected
    useEffect(() => {
        if (connected) {
            const timer = setTimeout(() => {
                nextStep()
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [connected])

    // Manual retry function for user-triggered attempts
    const handleManualRetry = async () => {
        setInstanceError(null)
        updateFormData({ instanceId: null, whatsappInstanceId: null })
        // This will trigger the useEffect to create instance again
    }

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    📱 Connect Your WhatsApp
                </h2>
                <p className="text-gray-600">
                    {creatingInstance
                        ? 'Setting up your secure connection...'
                        : 'Scan the QR code with your WhatsApp app to link your number.'
                    }
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* QR Code Section - PRODUCTION GRADE */}
                <div className="bg-white/50 backdrop-blur-sm rounded-2xl border-2 border-white/60 p-8 flex flex-col items-center justify-center min-h-[400px]">

                    {/* State 1: Creating Instance (with retry indicator) */}
                    {creatingInstance && (
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-700 font-medium mb-2">
                                {retryCount > 0 ? `Retrying connection... (${retryCount + 1}/3)` : 'Initializing WhatsApp...'}
                            </p>
                            <p className="text-sm text-gray-500">This usually takes 5-10 seconds</p>
                        </div>
                    )}

                    {/* State 2: Instance Creation Failed */}
                    {!creatingInstance && instanceError && !formData.instanceId && (
                        <div className="text-center max-w-sm">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Failed</h3>
                            <p className="text-sm text-red-600 mb-6">{instanceError}</p>

                            <button
                                onClick={handleManualRetry}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                            >
                                🔄 Try Again
                            </button>

                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-800">
                                    <strong>Troubleshooting:</strong><br />
                                    • Check your internet connection<br />
                                    • Ensure backend service is running<br />
                                    • Try refreshing this page
                                </p>
                            </div>
                        </div>
                    )}

                    {/* State 3: Loading QR Code */}
                    {!creatingInstance && formData.instanceId && loading && !error && (
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-700 font-medium mb-1">Generating secure QR code...</p>
                            <p className="text-sm text-gray-500">Almost ready to scan!</p>
                        </div>
                    )}

                    {/* State 4: QR Code Load Error */}
                    {!creatingInstance && !loading && error && !connected && (
                        <div className="text-center text-red-600 max-w-sm">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code Unavailable</h3>
                            <p className="text-sm mb-6">{error}</p>
                            <button
                                onClick={refreshQRCode}
                                className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-800 font-medium rounded-lg transition-colors"
                            >
                                🔄 Refresh QR Code
                            </button>
                        </div>
                    )}

                    {/* State 5: QR Code Ready to Scan */}
                    {!creatingInstance && !loading && !error && qrCode && !connected && (
                        <div className="flex flex-col items-center animate-fade-in transition-all">
                            <div className="relative group">
                                <img
                                    src={qrCode}
                                    alt="WhatsApp QR Code"
                                    className="w-64 h-64 border-4 border-emerald-500 rounded-2xl shadow-lg transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-x-0 bottom-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                                        ⏱ Expires in {formatTimeRemaining(expiresIn)}
                                    </span>
                                </div>

                                {/* Scan indicator overlay */}
                                <div className="absolute inset-0 border-4 border-emerald-400 rounded-2xl animate-pulse opacity-20 pointer-events-none" />
                            </div>

                            <div className="mt-6 flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Auto-refreshes in {formatTimeRemaining(expiresIn)}
                                </div>

                                <p className="text-sm text-gray-600 font-medium">👆 Scan this code with WhatsApp</p>
                            </div>
                        </div>
                    )}

                    {/* State 6: Successfully Connected */}
                    {connected && (
                        <div className="text-center animate-win">
                            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow">
                                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-900 mb-2">✅ Connected Successfully!</h3>
                            <p className="text-emerald-700 mb-4">Your WhatsApp is now linked</p>
                            <p className="text-sm text-gray-600">Redirecting to launch in 2 seconds...</p>
                        </div>
                    )}
                </div>

                {/* Instructions - ENHANCED */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2 text-lg">
                            <Shield className="w-5 h-5" />
                            How to Connect (3 easy steps)
                        </h4>
                        <ol className="space-y-4 text-blue-800/90 text-sm">
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                <div>
                                    <p className="font-medium">Open WhatsApp on your phone</p>
                                    <p className="text-xs text-blue-700 mt-1">Make sure you have the latest version</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                <div>
                                    <p className="font-medium">Go to <strong>Settings</strong> → <strong>Linked Devices</strong></p>
                                    <p className="text-xs text-blue-700 mt-1">Then tap "Link a Device"</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                <div>
                                    <p className="font-medium">Point your camera at the QR code</p>
                                    <p className="text-xs text-blue-700 mt-1">Connection is instant!</p>
                                </div>
                            </li>
                        </ol>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border border-yellow-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Important Notes
                        </h4>
                        <ul className="space-y-2 text-sm text-yellow-800/90">
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 mt-0.5">📱</span>
                                <span>Keep your phone connected to internet</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 mt-0.5">💼</span>
                                <span>We recommend using a dedicated business number</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-600 mt-0.5">🔄</span>
                                <span>QR code refreshes automatically every 50 seconds</span>
                            </li>
                        </ul>
                    </div>

                    {/* Helpful Tips */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                            💡 Pro Tips
                        </h4>
                        <ul className="space-y-2 text-sm text-emerald-800/90">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-600">✓</span>
                                <span>Use good lighting when scanning QR code</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-600">✓</span>
                                <span>Ensure your phone's WhatsApp is up to date</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-600">✓</span>
                                <span>Connection takes less than 5 seconds</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-8">
                <button
                    onClick={prevStep}
                    className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-2 group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Back</span>
                </button>

                <button
                    onClick={nextStep}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                >
                    Skip for now
                </button>
            </div>
        </div>
    )
}

// Step 7: Launch Celebration
function LaunchStep({ router, prevStep }: any) {
    const toast = useToast()
    const [launching, setLaunching] = useState(false)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        // Get user data from localStorage
        const userData = localStorage.getItem('user')
        if (userData) {
            setUser(JSON.parse(userData))
        }
    }, [])

    const handleLaunch = async () => {
        setLaunching(true)

        // Redirect to dashboard (tenant status already updated during onboarding)
        setTimeout(() => {
            router.push('/dashboard')
        }, 1500)
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Confetti />
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6">
                    <Rocket className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-3">
                    You're All Set! 🎉
                </h2>
                <p className="text-lg text-gray-600">
                    Your AI employee is configured and ready to handle customer conversations
                </p>
            </div>

            {/* Setup Summary */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Setup Summary</h3>

                <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Business Configured</h4>
                            <p className="text-sm text-gray-600">
                                {user?.businessName || 'Your business'} is ready with AI personality settings
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">Knowledge Base</h4>
                            <p className="text-sm text-gray-600">
                                Your AI has been trained with your business information
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">WhatsApp Connected</h4>
                            <p className="text-sm text-gray-600">
                                AI employee is monitoring WhatsApp messages 24/7
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Next Steps */}
            <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl border border-blue-200 p-8 mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">What Happens Next?</h3>

                <div className="space-y-4">
                    <div className="flex gap-3">
                        <MessageSquare className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-gray-800 font-medium">Monitor Conversations</p>
                            <p className="text-sm text-gray-600">Track all AI-customer interactions from your dashboard</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <TrendingUp className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-gray-800 font-medium">View Analytics</p>
                            <p className="text-sm text-gray-600">See response times, customer satisfaction, and conversation insights</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Users className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-gray-800 font-medium">Manage Leads</p>
                            <p className="text-sm text-gray-600">Your AI automatically captures and qualifies leads</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Settings className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-gray-800 font-medium">Customize Anytime</p>
                            <p className="text-sm text-gray-600">Update AI personality, knowledge base, and settings as needed</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
                <button
                    onClick={prevStep}
                    className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-2 group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Back</span>
                </button>

                <button
                    onClick={handleLaunch}
                    disabled={launching}
                    className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                >
                    {launching ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Launching...</span>
                        </>
                    ) : (
                        <>
                            <Rocket className="w-5 h-5" />
                            <span>Launch Dashboard</span>
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
