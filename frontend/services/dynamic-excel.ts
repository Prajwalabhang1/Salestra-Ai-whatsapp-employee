import * as XLSX from 'xlsx';

export interface DynamicExcelData {
    columns: string[];
    rows: Record<string, any>[];
    sheetName: string;
    totalRows: number;
}

/**
 * Import ANY Excel file and extract whatever columns it has
 * NO column mapping - use exactly what the user provides
 */
export async function importAnyExcel(file: File): Promise<DynamicExcelData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON - this preserves original column names
                const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (rawData.length === 0) {
                    reject(new Error('Excel file is empty'));
                    return;
                }

                // Extract column names from first row
                const columns = Object.keys(rawData[0]);

                console.log(`📊 Imported ${rawData.length} rows with columns:`, columns);

                resolve({
                    columns,
                    rows: rawData,
                    sheetName,
                    totalRows: rawData.length
                });
            } catch (error: any) {
                reject(new Error(`Failed to parse Excel: ${error.message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Export spreadsheet data to Excel with dynamic columns
 */
export function exportToExcel(
    columns: string[],
    rows: Record<string, any>[],
    filename: string = 'export'
) {
    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    // Download
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Download a blank template with user-specified columns
 */
export function downloadBlankTemplate(columns: string[]) {
    // Create empty rows with the specified columns
    const emptyRows = Array.from({ length: 10 }, () => {
        const row: Record<string, any> = {};
        columns.forEach(col => {
            row[col] = '';
        });
        return row;
    });

    exportToExcel(columns, emptyRows, 'template');
}
