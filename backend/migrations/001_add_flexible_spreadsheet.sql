-- Create flexible spreadsheet tables
-- This allows users to import ANY Excel file with custom columns

-- Sheet metadata table (stores column definitions)
CREATE TABLE IF NOT EXISTS "sheet_metadata" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Products Database',
    "columns" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sheet_metadata_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sheet_metadata_tenant_id_idx" ON "sheet_metadata"("tenant_id");

-- Spreadsheet data table (stores flexible JSONB data for each row)
CREATE TABLE IF NOT EXISTS "spreadsheet_data" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "vector_synced" BOOLEAN NOT NULL DEFAULT false,
    "vector_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    CONSTRAINT "spreadsheet_data_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spreadsheet_data_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sheet_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spreadsheet_data_tenant_id_sheet_id_row_number_key" UNIQUE ("tenant_id", "sheet_id", "row_number")
);

CREATE INDEX IF NOT EXISTS "spreadsheet_data_tenant_id_idx" ON "spreadsheet_data"("tenant_id");
CREATE INDEX IF NOT EXISTS "spreadsheet_data_sheet_id_idx" ON "spreadsheet_data"("sheet_id");
CREATE INDEX IF NOT EXISTS "spreadsheet_data_vector_synced_idx" ON "spreadsheet_data"("vector_synced");

-- Create GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS "spreadsheet_data_data_gin_idx" ON "spreadsheet_data" USING gin("data");

COMMENT ON TABLE "sheet_metadata" IS 'Stores column metadata for user-defined spreadsheets';
COMMENT ON TABLE "spreadsheet_data" IS 'Stores flexible JSONB data for each spreadsheet row - supports ANY column structure';
