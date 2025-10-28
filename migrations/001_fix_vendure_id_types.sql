-- ============================================
-- Migration: Fix Vendure ID Types
-- Date: 2025-10-28
-- Purpose: Change Vendure ID columns from VARCHAR to INTEGER
-- ============================================

-- Step 1: Check current state
DO $$ 
BEGIN
    RAISE NOTICE 'Checking current tenants table structure...';
END $$;

-- Step 2: Add new INTEGER columns
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS vendure_seller_id_new INTEGER,
ADD COLUMN IF NOT EXISTS vendure_channel_id_new INTEGER,
ADD COLUMN IF NOT EXISTS vendure_administrator_id INTEGER;

-- Step 3: Migrate existing data (only if columns contain valid integers)
-- This handles cases where VARCHAR columns already exist with integer values
DO $$
BEGIN
    -- Check if old VARCHAR columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' 
        AND column_name = 'vendure_seller_id'
        AND data_type = 'character varying'
    ) THEN
        -- Migrate data if it's a valid integer
        UPDATE tenants 
        SET vendure_seller_id_new = CAST(vendure_seller_id AS INTEGER)
        WHERE vendure_seller_id IS NOT NULL 
          AND vendure_seller_id ~ '^[0-9]+$';
        
        RAISE NOTICE 'Migrated vendure_seller_id data';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' 
        AND column_name = 'vendure_channel_id'
        AND data_type = 'character varying'
    ) THEN
        -- Migrate data if it's a valid integer
        UPDATE tenants 
        SET vendure_channel_id_new = CAST(vendure_channel_id AS INTEGER)
        WHERE vendure_channel_id IS NOT NULL 
          AND vendure_channel_id ~ '^[0-9]+$';
        
        RAISE NOTICE 'Migrated vendure_channel_id data';
    END IF;
END $$;

-- Step 4: Drop old VARCHAR columns if they exist
ALTER TABLE tenants 
DROP COLUMN IF EXISTS vendure_seller_id CASCADE,
DROP COLUMN IF EXISTS vendure_channel_id CASCADE;

-- Step 5: Rename new columns to correct names
ALTER TABLE tenants 
RENAME COLUMN vendure_seller_id_new TO vendure_seller_id;

ALTER TABLE tenants 
RENAME COLUMN vendure_channel_id_new TO vendure_channel_id;

-- Step 6: Update index on vendure_seller_id (drop old, create new)
DROP INDEX IF EXISTS idx_tenants_vendure_seller_id;
CREATE INDEX idx_tenants_vendure_seller_id ON tenants(vendure_seller_id);

-- Step 7: Add new indexes
CREATE INDEX IF NOT EXISTS idx_tenants_vendure_channel_id ON tenants(vendure_channel_id);
CREATE INDEX IF NOT EXISTS idx_tenants_vendure_administrator_id ON tenants(vendure_administrator_id);

-- Step 8: Verify the changes
DO $$ 
DECLARE
    seller_id_type TEXT;
    channel_id_type TEXT;
    admin_id_type TEXT;
BEGIN
    SELECT data_type INTO seller_id_type
    FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'vendure_seller_id';
    
    SELECT data_type INTO channel_id_type
    FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'vendure_channel_id';
    
    SELECT data_type INTO admin_id_type
    FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'vendure_administrator_id';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'vendure_seller_id type: %', seller_id_type;
    RAISE NOTICE 'vendure_channel_id type: %', channel_id_type;
    RAISE NOTICE 'vendure_administrator_id type: %', admin_id_type;
    RAISE NOTICE '============================================';
    
    -- Validate all are integers
    IF seller_id_type = 'integer' AND channel_id_type = 'integer' AND admin_id_type = 'integer' THEN
        RAISE NOTICE '✅ All Vendure ID columns are now INTEGER type!';
    ELSE
        RAISE WARNING '⚠️ Some columns are not INTEGER. Please check manually.';
    END IF;
END $$;

-- Step 9: Display sample data
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Sample tenants data:';
    RAISE NOTICE '============================================';
    
    FOR rec IN 
        SELECT 
            id,
            business_name,
            vendure_seller_id,
            vendure_channel_id,
            vendure_administrator_id
        FROM tenants 
        LIMIT 5
    LOOP
        RAISE NOTICE 'Tenant: % | Seller ID: % | Channel ID: % | Admin ID: %', 
            rec.business_name, 
            rec.vendure_seller_id, 
            rec.vendure_channel_id,
            rec.vendure_administrator_id;
    END LOOP;
END $$;

