'use client';

import { useState, useCallback } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { parseExcelToInventoryItems, downloadExcelTemplate } from '../../services/excel-parser';
import { InventoryItem } from '../../types/inventory';

interface ExcelImportModalProps {
    onClose: () => void;
    onImport: (items: Partial<InventoryItem>[]) => Promise<{ success: boolean; message: string }>;
}

export default function ExcelImportModal({ onClose, onImport }: ExcelImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<Partial<InventoryItem>[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleFile = useCallback(async (selectedFile: File) => {
        if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
            setErrors(['Please upload an Excel file (.xlsx or .xls)']);
            return;
        }

        setLoading(true);
        setErrors([]);
        setFile(selectedFile);

        try {
            const { items, errors: parseErrors } = await parseExcelToInventoryItems(selectedFile);
            setPreview(items);
            setErrors(parseErrors);
        } catch (error: any) {
            setErrors([error.message]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const handleImport = useCallback(async () => {
        if (preview.length === 0) return;

        setImporting(true);
        try {
            const result = await onImport(preview);
            setResult(result);

            if (result.success) {
                setTimeout(() => {
                    onClose();
                }, 2000);
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message });
        } finally {
            setImporting(false);
        }
    }, [preview, onImport, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Import from Excel</h2>
                        <p className="text-sm text-gray-600 mt-1">Upload your inventory Excel file</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Download Template */}
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <Download className="text-blue-600" size={20} />
                            <div>
                                <p className="text-sm font-medium text-blue-900">Need a template?</p>
                                <p className="text-xs text-blue-700">Download our Excel template with sample data</p>
                            </div>
                        </div>
                        <button
                            onClick={downloadExcelTemplate}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Download Template
                        </button>
                    </div>

                    {/* File Upload */}
                    {!file && (
                        <div
                            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">
                                Drag and drop your Excel file here
                            </p>
                            <p className="text-sm text-gray-600 mb-4">or</p>
                            <label className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer inline-block">
                                Browse Files
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx,.xls"
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />
                            </label>
                            <p className="text-xs text-gray-500 mt-4">Supports .xlsx and .xls files</p>
                        </div>
                    )}

                    {/* File Info */}
                    {file && (
                        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle className="text-green-600" size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                    <p className="text-xs text-gray-600">
                                        {(file.size / 1024).toFixed(2)} KB • {preview.length} rows
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setFile(null);
                                    setPreview([]);
                                    setErrors([]);
                                }}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    )}

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-red-600 mt-0.5" size={20} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-900 mb-2">
                                        Found {errors.length} error(s):
                                    </p>
                                    <ul className="text-sm text-red-700 space-y-1">
                                        {errors.slice(0, 10).map((error, i) => (
                                            <li key={i}>• {error}</li>
                                        ))}
                                        {errors.length > 10 && (
                                            <li className="text-red-600 font-medium">
                                                ... and {errors.length - 10} more errors
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {preview.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-3">
                                Preview ({preview.length} items)
                            </h3>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-64">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {preview.slice(0, 5).map((item, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-mono text-xs">{item.sku}</td>
                                                    <td className="px-4 py-2">{item.name}</td>
                                                    <td className="px-4 py-2">{item.currency} {item.price}</td>
                                                    <td className="px-4 py-2">{item.stockQuantity}</td>
                                                    <td className="px-4 py-2">{item.category || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {preview.length > 5 && (
                                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-600 border-t border-gray-200">
                                        Showing first 5 of {preview.length} items
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}>
                            <p className={`text-sm font-medium ${result.success ? 'text-green-900' : 'text-red-900'
                                }`}>
                                {result.message}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                        disabled={importing}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={preview.length === 0 || importing || loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {importing ? 'Importing...' : `Import ${preview.length} Items`}
                    </button>
                </div>
            </div>
        </div>
    );
}
