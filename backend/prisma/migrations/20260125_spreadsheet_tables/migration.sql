-- CreateTable
CREATE TABLE "sheet_metadata" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Products Database',
    "columns" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spreadsheet_data" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vector_synced" BOOLEAN NOT NULL DEFAULT false,
    "vector_id" TEXT,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "spreadsheet_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sheet_metadata_tenant_id_idx" ON "sheet_metadata"("tenant_id");

-- CreateIndex
CREATE INDEX "spreadsheet_data_tenant_id_idx" ON "spreadsheet_data"("tenant_id");

-- CreateIndex
CREATE INDEX "spreadsheet_data_sheet_id_idx" ON "spreadsheet_data"("sheet_id");

-- CreateIndex
CREATE INDEX "spreadsheet_data_vector_synced_idx" ON "spreadsheet_data"("vector_synced");

-- CreateIndex (GIN for JSONB search)
CREATE INDEX "spreadsheet_data_data_gin_idx" ON "spreadsheet_data" USING gin("data");

-- CreateIndex (Unique constraint)
CREATE UNIQUE INDEX "spreadsheet_data_tenant_id_sheet_id_row_number_key" ON "spreadsheet_data"("tenant_id", "sheet_id", "row_number");

-- AddForeignKey
ALTER TABLE "sheet_metadata" ADD CONSTRAINT "sheet_metadata_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spreadsheet_data" ADD CONSTRAINT "spreadsheet_data_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spreadsheet_data" ADD CONSTRAINT "spreadsheet_data_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sheet_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
