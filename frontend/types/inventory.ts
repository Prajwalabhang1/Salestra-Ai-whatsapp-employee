// TypeScript interfaces for inventory management

export interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    category: string | null;
    brand: string | null;
    price: number;
    currency: string;
    stockQuantity: number;
    location: string | null;
    status: string;
    vectorSynced?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BulkInsertResponse {
    success: boolean;
    inserted: number;
    failed: number;
    errors?: Array<{
        row: number;
        error: string;
    }>;
}

export interface BulkUpdateRequest {
    updates: Array<{
        id: string;
        field: string;
        value: any;
    }>;
}

export interface ColumnConfig {
    field: string;
    headerName: string;
    visible: boolean;
    width?: number;
    order: number;
}
