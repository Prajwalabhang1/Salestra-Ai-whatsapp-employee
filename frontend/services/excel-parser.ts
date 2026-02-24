import * as XLSX from 'xlsx';
import { InventoryItem } from '../types/inventory';

export interface ParsedExcelData {
    items: Partial<InventoryItem>[];
    errors: string[];
    totalRows: number;
}

/**
 * Parse Excel file to inventory items
 * Supports various column name variations
 */
export async function parseExcelToInventoryItems(file: File): Promise<ParsedExcelData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON
                const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

                // Debug: Log first row to help user
                if (rawData.length > 0) {
                    console.log('📊 Excel columns detected:', Object.keys(rawData[0]));
                    console.log('📋 First row sample:', rawData[0]);
                }

                const items: Partial<InventoryItem>[] = [];
                const errors: string[] = [];

                rawData.forEach((row, index) => {
                    try {
                        const item = mapExcelRowToInventoryItem(row);
                        items.push(item);
                    } catch (error: any) {
                        errors.push(`Row ${index + 2}: ${error.message}`);
                    }
                });

                resolve({
                    items,
                    errors,
                    totalRows: rawData.length
                });
            } catch (error: any) {
                reject(new Error(`Failed to parse Excel file: ${error.message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Map Excel row to InventoryItem (auto-detect column names with fuzzy matching)
 */
function mapExcelRowToInventoryItem(row: any): Partial<InventoryItem> {
    // Helper to find value from multiple possible column names (fuzzy matching)
    const findValue = (possibleNames: string[]): any => {
        for (const name of possibleNames) {
            const key = Object.keys(row).find(k => {
                const normalizedKey = k.toLowerCase().trim().replace(/\s+/g, '').replace(/_/g, '');
                const normalizedName = name.toLowerCase().trim().replace(/\s+/g, '').replace(/_/g, '');

                // Exact match after normalization
                if (normalizedKey === normalizedName) return true;

                // Contains match (handles extra words)
                if (normalizedKey.includes(normalizedName) || normalizedName.includes(normalizedKey)) return true;

                return false;
            });
            if (key && row[key] !== undefined && row[key] !== '' && row[key] !== null) {
                return row[key];
            }
        }
        return null;
    };

    // Extract values with MANY column name variations
    const sku = findValue([
        'SKU', 'sku', 'Product Code', 'ProductCode', 'Code', 'Item Code', 'ItemCode',
        'Article No', 'ArticleNo', 'Product ID', 'ProductID', 'ID'
    ]);

    const name = findValue([
        'Name', 'Product Name', 'ProductName', 'Product', 'Item Name', 'ItemName',
        'Title', 'Item', 'product name', 'product_name', 'PRODUCT NAME',
        'Description', 'Item Description', 'Desc' // Some sheets use description as name
    ]);

    const description = findValue([
        'Description', 'Desc', 'Details', 'Product Description', 'ProductDescription',
        'Long Description', 'Notes', 'Remarks', 'Comments'
    ]);

    const category = findValue([
        'Category', 'Cat', 'Type', 'Product Category', 'ProductCategory',
        'Group', 'Classification', 'Segment'
    ]);

    const brand = findValue([
        'Brand', 'Manufacturer', 'Make', 'Vendor', 'Supplier', 'Company'
    ]);

    const priceRaw = findValue([
        'Price', 'Unit Price', 'UnitPrice', 'Rate', 'Cost', 'MRP',
        'Selling Price', 'SellingPrice', 'Amount', 'Value'
    ]);

    const currency = findValue(['Currency', 'Curr', 'CCY']) || 'INR';

    const stockRaw = findValue([
        'Stock', 'Stock Quantity', 'StockQuantity', 'Quantity', 'Qty', 'QTY',
        'Available', 'Inventory', 'Current Stock', 'CurrentStock', 'On Hand', 'OnHand'
    ]);

    const location = findValue([
        'Location', 'Warehouse', 'Storage', 'Bin', 'Shelf', 'Store', 'Site'
    ]);

    // If name still not found, provide helpful error
    if (!name) {
        const availableColumns = Object.keys(row).join(', ');
        throw new Error(`Cannot find Product Name column. Your columns: [${availableColumns}]. Please ensure you have "Product Name" or "Name" column`);
    }

    // Validate SKU
    if (!sku) {
        const availableColumns = Object.keys(row).join(', ');
        throw new Error(`Cannot find SKU column. Your columns: [${availableColumns}]. Please ensure you have "SKU" or "Product Code" column`);
    }

    // Validate Price
    if (priceRaw === null || priceRaw === undefined || priceRaw === '') {
        throw new Error(`Price is required for product: ${name} (SKU:${sku})`);
    }

    // Parse numbers with cleaning (remove currency symbols, commas, etc.)
    const priceStr = String(priceRaw).replace(/[^0-9.-]/g, ''); // Remove non-numeric except decimal and minus
    const price = parseFloat(priceStr);

    const stockStr = stockRaw !== null && stockRaw !== undefined && stockRaw !== ''
        ? String(stockRaw).replace(/[^0-9-]/g, '')
        : '0';
    const stockQuantity = parseInt(stockStr) || 0;

    // Validation
    if (isNaN(price)) throw new Error(`Invalid price "${priceRaw}" for ${name}`);
    if (price < 0) throw new Error(`Price cannot be negative for ${name}`);
    if (isNaN(stockQuantity)) throw new Error(`Invalid stock "${stockRaw}" for ${name}`);
    if (stockQuantity < 0) throw new Error(`Stock cannot be negative for ${name}`);

    return {
        sku: String(sku).trim(),
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        category: category ? String(category).trim() : null,
        brand: brand ? String(brand).trim() : null,
        price,
        currency: String(currency).trim().toUpperCase(),
        stockQuantity,
        location: location ? String(location).trim() : null,
    };
}

/**
 * Export inventory items to Excel file
 */
export function exportInventoryToExcel(items: InventoryItem[], filename: string = 'inventory') {
    // Format data for Excel
    const exportData = items.map(item => ({
        'SKU': item.sku,
        'Product Name': item.name,
        'Description': item.description || '',
        'Category': item.category || '',
        'Brand': item.brand || '',
        'Price': item.price,
        'Currency': item.currency,
        'Stock': item.stockQuantity,
        'Location': item.location || '',
        'Created': new Date(item.createdAt).toLocaleDateString(),
        'Updated': new Date(item.updatedAt).toLocaleDateString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const columnWidths = [
        { wch: 15 }, // SKU
        { wch: 25 }, // Product Name
        { wch: 35 }, // Description
        { wch: 15 }, // Category
        { wch: 15 }, // Brand
        { wch: 10 }, // Price
        { wch: 10 }, // Currency
        { wch: 10 }, // Stock
        { wch: 15 }, // Location
        { wch: 12 }, // Created
        { wch: 12 }, // Updated
    ];
    worksheet['!cols'] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

    // Save file
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Download Excel template
 */
export function downloadExcelTemplate() {
    const templateData = [
        {
            'SKU': 'FAN001',
            'Product Name': 'Havells Ceiling Fan',
            'Description': '1200mm, Energy efficient, 2 year warranty',
            'Category': 'Fans',
            'Brand': 'Havells',
            'Price': 2500,
            'Currency': 'INR',
            'Stock': 10,
            'Location': 'Warehouse A',
        },
        {
            'SKU': 'LIGHT001',
            'Product Name': 'Philips LED Bulb',
            'Description': '9W, Cool White',
            'Category': 'Lights',
            'Brand': 'Philips',
            'Price': 150,
            'Currency': 'INR',
            'Stock': 50,
            'Location': 'Warehouse A',
        },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    XLSX.writeFile(workbook, 'inventory_template.xlsx');
}
