'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

interface DynamicGridProps {
    columns: string[];
    rows: Record<string, any>[];
    onCellEdit: (rowId: string, columnName: string, value: any) => Promise<void>;
    onDeleteRows: (ids: string[]) => Promise<void>;
    onAddRow: (rowData: Record<string, any>) => Promise<any>;
    onAddColumn?: (columnName: string) => Promise<void>;
}

export default function InventoryGrid({
    columns,
    rows,
    onCellEdit,
    onDeleteRows,
    onAddRow,
    onAddColumn
}: DynamicGridProps) {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [newColumnName, setNewColumnName] = useState('');
    const [blankRows, setBlankRows] = useState<Record<string, any>[]>(
        Array.from({ length: 10 }, (_, i) => ({ _id: `blank-${i}`, _isBlank: true }))
    );
    const [savingRows, setSavingRows] = useState<Set<string>>(new Set());

    // Handle cell change
    const handleCellChange = useCallback(async (rowId: string, columnName: string, value: string) => {
        // Find if it's a blank row
        const blankRow = blankRows.find(r => r._id === rowId);

        if (blankRow) {
            // Update blank row locally
            setBlankRows(prev => prev.map(r =>
                r._id === rowId ? { ...r, [columnName]: value } : r
            ));
        } else {
            // Update existing row via API
            try {
                await onCellEdit(rowId, columnName, value);
            } catch (error: any) {
                alert(`Failed to update: ${error.message}`);
            }
        }
    }, [blankRows, onCellEdit]);

    // Save a blank row
    const handleSaveBlankRow = useCallback(async (row: Record<string, any>) => {
        const rowData: Record<string, any> = {};
        columns.forEach(col => {
            if (row[col]) rowData[col] = row[col];
        });

        if (Object.keys(rowData).length === 0) {
            alert('Please fill in at least one field');
            return;
        }

        setSavingRows(prev => new Set(prev).add(row._id));

        try {
            await onAddRow(rowData);
            // Remove from blank rows
            setBlankRows(prev => prev.filter(r => r._id !== row._id));
            console.log('✅ Row saved');
        } catch (error: any) {
            alert(`Failed to save: ${error.message}`);
        } finally {
            setSavingRows(prev => {
                const next = new Set(prev);
                next.delete(row._id);
                return next;
            });
        }
    }, [columns, onAddRow]);

    // Toggle row selection
    const toggleRowSelection = useCallback((rowId: string) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.add(rowId);
            }
            return next;
        });
    }, []);

    // Delete selected
    const handleDeleteSelected = useCallback(async () => {
        if (selectedRows.size === 0) return;
        if (!confirm(`Delete ${selectedRows.size} row(s)?`)) return;

        try {
            await onDeleteRows(Array.from(selectedRows));
            setSelectedRows(new Set());
        } catch (error: any) {
            alert(`Failed to delete: ${error.message}`);
        }
    }, [selectedRows, onDeleteRows]);

    // Add column
    const handleAddColumn = useCallback(async () => {
        if (!newColumnName || !onAddColumn) return;

        try {
            await onAddColumn(newColumnName);
            setNewColumnName('');
        } catch (error: any) {
            alert(`Failed to add column: ${error.message}`);
        }
    }, [newColumnName, onAddColumn]);

    // Add more blank rows
    const addBlankRows = useCallback(() => {
        const newBlanks = Array.from({ length: 10 }, (_, i) => ({
            _id: `blank-${Date.now()}-${i}`,
            _isBlank: true
        }));
        setBlankRows(prev => [...prev, ...newBlanks]);
    }, []);

    const allRows = [...rows, ...blankRows];

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                <div className="flex items-center gap-3">
                    {selectedRows.size > 0 ? (
                        <>
                            <span className="text-sm font-medium text-blue-700">
                                {selectedRows.size} selected
                            </span>
                            <button
                                onClick={handleDeleteSelected}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                            >
                                <Trash2 size={14} />
                                Delete
                            </button>
                        </>
                    ) : (
                        <span className="text-sm text-gray-600">
                            {rows.length} row(s) | Edit cells directly | Add columns as needed
                        </span>
                    )}
                </div>

                <button
                    onClick={addBlankRows}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                    <Plus size={16} />
                    Add 10 Rows
                </button>
            </div>

            {/* Spreadsheet Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-100">
                        <tr>
                            <th className="w-10 px-2 py-2 border border-gray-300">
                                <input type="checkbox" className="rounded" disabled />
                            </th>
                            {columns.map(col => (
                                <th
                                    key={col}
                                    className="px-3 py-2 text-left font-medium text-gray-700 border border-gray-300 min-w-[150px]"
                                >
                                    {col}
                                </th>
                            ))}
                            {onAddColumn && (
                                <th className="px-2 py-2 border border-gray-300 bg-gray-50">
                                    <input
                                        type="text"
                                        placeholder="+ Add Column"
                                        value={newColumnName}
                                        onChange={e => setNewColumnName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                                        className="w-full px-2 py-1 text-sm border rounded"
                                    />
                                </th>
                            )}
                            <th className="w-24 px-2 py-2 border border-gray-300 bg-gray-50">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allRows.map((row) => {
                            const isBlank = row._isBlank;
                            const rowId = isBlank ? row._id : row.id;

                            return (
                                <tr
                                    key={rowId}
                                    className={`${isBlank ? 'bg-gray-50' : ''} ${selectedRows.has(rowId) ? 'bg-blue-50' : ''} hover:bg-gray-100`}
                                >
                                    <td className="px-2 py-1 border border-gray-200 text-center">
                                        {!isBlank && (
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.has(rowId)}
                                                onChange={() => toggleRowSelection(rowId)}
                                                className="rounded"
                                            />
                                        )}
                                    </td>
                                    {columns.map(col => (
                                        <td key={col} className="px-1 py-1 border border-gray-200">
                                            <input
                                                type="text"
                                                value={row[col] || ''}
                                                onChange={e => handleCellChange(rowId, col, e.target.value)}
                                                placeholder={isBlank ? `${col}...` : ''}
                                                className="w-full px-2 py-1 bg-transparent border-0 focus:ring-2 focus:ring-blue-500 rounded"
                                            />
                                        </td>
                                    ))}
                                    {onAddColumn && <td className="border border-gray-200"></td>}
                                    <td className="px-2 py-1 border border-gray-200 text-center">
                                        {isBlank && (
                                            <button
                                                onClick={() => handleSaveBlankRow(row)}
                                                disabled={savingRows.has(rowId)}
                                                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 mx-auto"
                                            >
                                                {savingRows.has(rowId) ? '...' : <><Save size={12} /> Save</>}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600">
                💡 Fill in any columns, click <span className="bg-green-100 px-1">Save</span> to create rows
                | All data is searchable by AI
            </div>
        </div>
    );
}
