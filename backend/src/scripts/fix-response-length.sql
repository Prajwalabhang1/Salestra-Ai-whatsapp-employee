-- Fix responseMaxLength for tenant 918208484585
-- Current: 500 characters (too restrictive)
-- New: 2000 characters (allows longer, more helpful responses)

UPDATE "AIConfiguration" 
SET "response_max_length" = 2000 
WHERE "tenantId" = '74c7b84f-9e08-4f22-8ef1-7b7195836ec1';

-- Verify the update
SELECT "tenantId", "response_max_length", "isEnabled", "maintenanceMode" 
FROM "AIConfiguration" 
WHERE "tenantId" = '74c7b84f-9e08-4f22-8ef1-7b7195836ec1';
