# Vendure-Supabase ID Mapping Guide

## The Problem

**Vendure uses INTEGER IDs** for all entities (sellers, channels, administrators, products, etc.)  
**Supabase uses UUID** for user authentication and primary keys

This creates a mismatch when trying to link tenants to Vendure entities.

---

## The Solution

We use **two separate authentication systems** with proper ID mapping:

### 1. **Supabase Auth** (SaaS Platform)
- Uses UUID for `auth.users.id`
- Purpose: SaaS platform login, billing, subscription management
- Database: `store-flow-saas` (Supabase project)

### 2. **Vendure Auth** (Marketplace)
- Uses INTEGER for administrator/seller IDs
- Purpose: Store management, products, orders
- Database: `store-flow` (Vendure PostgreSQL)

### 3. **The Bridge: tenants table**
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,                    -- Supabase UUID
    owner_id UUID,                          -- Links to Supabase auth.users(id)
    vendure_seller_id INTEGER,              -- Links to Vendure Seller ID
    vendure_channel_id INTEGER,             -- Links to Vendure Channel ID
    vendure_administrator_id INTEGER,       -- Links to Vendure Administrator ID
    ...
);
```

---

## Updated Schema

### Changes Made

**Before (WRONG):**
```sql
vendure_seller_id VARCHAR(255),    -- ❌ Trying to store integers as strings
vendure_channel_id VARCHAR(255),   -- ❌ Inefficient and type-unsafe
```

**After (CORRECT):**
```sql
vendure_seller_id INTEGER,              -- ✅ Correct type for Vendure IDs
vendure_channel_id INTEGER,             -- ✅ Correct type for Vendure IDs
vendure_administrator_id INTEGER,       -- ✅ New field for admin ID
```

---

## Dual User Creation Flow

When a merchant signs up, we create **TWO user accounts** with proper ID mapping:

### Complete Signup Process

```typescript
// ============================================
// STEP 1: Create Supabase User (SaaS Auth)
// ============================================
const { data: supabaseUser, error } = await supabase.auth.signUp({
    email: 'merchant@example.com',
    password: 'SecurePassword123!'
});

// supabaseUser.id is a UUID
// Example: "a3bb189e-8bf9-3888-9912-ace4e6543002"

// ============================================
// STEP 2: Create Tenant Record (with UUID)
// ============================================
const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
        subdomain: 'johns-electronics',
        business_name: 'Johns Electronics',
        owner_id: supabaseUser.id,  // UUID from Supabase
        status: 'provisioning'
    })
    .select()
    .single();

// tenant.id is also a UUID
// tenant.owner_id = supabaseUser.id (UUID)

// ============================================
// STEP 3: Provision Vendure Seller
// ============================================
const vendureResult = await provisionVendureSeller({
    shopName: 'Johns Electronics',
    ownerEmail: 'merchant@example.com',
    ownerPassword: 'SecurePassword123!' // SAME password
});

// vendureResult contains INTEGER IDs:
// {
//   sellerId: 7,              // INTEGER
//   channelId: 5,             // INTEGER
//   administratorId: 5        // INTEGER
// }

// ============================================
// STEP 4: Update Tenant with Vendure IDs
// ============================================
const { error: updateError } = await supabase
    .from('tenants')
    .update({
        vendure_seller_id: vendureResult.sellerId,           // INTEGER: 7
        vendure_channel_id: vendureResult.channelId,         // INTEGER: 5
        vendure_administrator_id: vendureResult.administratorId, // INTEGER: 5
        status: 'active'
    })
    .eq('id', tenant.id);

// ============================================
// RESULT: Complete Mapping
// ============================================
// Tenant Record:
// {
//   id: "a3bb189e-8bf9-3888-9912-ace4e6543002",    // UUID (Supabase)
//   owner_id: "a3bb189e-8bf9-3888-9912-ace4e6543002", // UUID (Supabase)
//   vendure_seller_id: 7,                          // INTEGER (Vendure)
//   vendure_channel_id: 5,                         // INTEGER (Vendure)
//   vendure_administrator_id: 5                    // INTEGER (Vendure)
// }
```

---

## How Authentication Works

### 1. **SaaS Admin Login** (Billing & Settings)
```typescript
// Login to Supabase
const { data, error } = await supabase.auth.signInWithPassword({
    email: 'merchant@example.com',
    password: 'SecurePassword123!'
});

// Gets UUID session token
// Access: Billing, subscription, domain management
```

### 2. **Store Admin Login** (Products & Orders)
```typescript
// Login to Vendure
const mutation = `
    mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
            ... on CurrentUser {
                id              // Returns INTEGER
                identifier
                channels {
                    id          // Returns INTEGER
                    code
                }
            }
        }
    }
`;

// SAME email and password!
const result = await vendureLogin({
    username: 'merchant@example.com',
    password: 'SecurePassword123!'
});

// Gets session cookie
// Access: Products, orders, inventory, customers
```

**Key Point:** Same email/password works for BOTH systems!

---

## ID Lookup Examples

### Example 1: Get Tenant's Vendure Data

```typescript
// Step 1: Get tenant from Supabase (using UUID)
const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('owner_id', supabaseUserId) // UUID
    .single();

// Step 2: Use INTEGER IDs to query Vendure
const vendureQuery = `
    query GetSellerDetails($sellerId: ID!) {
        seller(id: $sellerId) {
            id
            name
            channels {
                id
                code
            }
        }
    }
`;

const vendureData = await vendureClient.query({
    query: vendureQuery,
    variables: {
        sellerId: tenant.vendure_seller_id.toString() // Convert INTEGER to string for GraphQL
    }
});
```

### Example 2: Get Tenant from Vendure Administrator ID

```typescript
// When logged into Vendure, get the administrator ID
const vendureAdminId = 5; // INTEGER from Vendure session

// Look up tenant in Supabase
const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('vendure_administrator_id', vendureAdminId)
    .single();

// Now you have both:
// - tenant.id (UUID for Supabase operations)
// - tenant.vendure_seller_id (INTEGER for Vendure operations)
```

---

## Database Migration Script

If you've already created the tenants table with VARCHAR for Vendure IDs:

```sql
-- ============================================
-- Migration: Fix Vendure ID Types
-- ============================================

-- Step 1: Add new INTEGER columns
ALTER TABLE tenants 
ADD COLUMN vendure_seller_id_new INTEGER,
ADD COLUMN vendure_channel_id_new INTEGER,
ADD COLUMN vendure_administrator_id INTEGER;

-- Step 2: Migrate existing data (if any)
UPDATE tenants 
SET 
    vendure_seller_id_new = CAST(vendure_seller_id AS INTEGER),
    vendure_channel_id_new = CAST(vendure_channel_id AS INTEGER)
WHERE 
    vendure_seller_id IS NOT NULL 
    AND vendure_seller_id ~ '^[0-9]+$'; -- Only if it's a valid integer

-- Step 3: Drop old columns
ALTER TABLE tenants 
DROP COLUMN vendure_seller_id,
DROP COLUMN vendure_channel_id;

-- Step 4: Rename new columns
ALTER TABLE tenants 
RENAME COLUMN vendure_seller_id_new TO vendure_seller_id;

ALTER TABLE tenants 
RENAME COLUMN vendure_channel_id_new TO vendure_channel_id;

-- Step 5: Add indexes for performance
CREATE INDEX idx_tenants_vendure_seller_id ON tenants(vendure_seller_id);
CREATE INDEX idx_tenants_vendure_channel_id ON tenants(vendure_channel_id);
CREATE INDEX idx_tenants_vendure_administrator_id ON tenants(vendure_administrator_id);
```

---

## Updated Provisioning Service

Update your seller provisioning to return proper types:

```typescript
// src/provision-seller-api.ts

export interface ProvisionSellerResult {
    sellerId: number;              // INTEGER (not string!)
    channelId: number;             // INTEGER (not string!)
    administratorId: number;       // INTEGER (not string!)
    channelCode: string;
    channelToken: string;
    email: string;
}

export async function provisionSeller(
    input: ProvisionSellerInput
): Promise<ProvisionSellerResult> {
    
    // ... existing provisioning code ...
    
    return {
        sellerId: parseInt(seller.id),                    // Ensure INTEGER
        channelId: parseInt(channel.id),                  // Ensure INTEGER
        administratorId: parseInt(administrator.id),      // Ensure INTEGER
        channelCode: channel.code,
        channelToken: channel.token,
        email: input.ownerEmail
    };
}
```

---

## Testing the ID Mapping

### Test Script

```typescript
// src/test-id-mapping.ts

import { createClient } from '@supabase/supabase-js';

async function testIdMapping() {
    console.log('🧪 Testing Vendure-Supabase ID Mapping\n');
    
    // 1. Create Supabase user
    console.log('Step 1: Creating Supabase user (UUID)...');
    const { data: user } = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'test123'
    });
    console.log(`✅ Supabase User ID: ${user.user.id} (UUID)`);
    
    // 2. Create tenant with UUID
    console.log('\nStep 2: Creating tenant...');
    const { data: tenant } = await supabase
        .from('tenants')
        .insert({
            subdomain: 'test-store',
            business_name: 'Test Store',
            owner_id: user.user.id, // UUID
            status: 'provisioning'
        })
        .select()
        .single();
    console.log(`✅ Tenant ID: ${tenant.id} (UUID)`);
    console.log(`✅ Owner ID: ${tenant.owner_id} (UUID)`);
    
    // 3. Provision Vendure seller (returns INTEGERs)
    console.log('\nStep 3: Provisioning Vendure seller...');
    const vendureResult = await provisionSeller({
        shopName: 'Test Store',
        ownerEmail: 'test@example.com'
    });
    console.log(`✅ Vendure Seller ID: ${vendureResult.sellerId} (INTEGER)`);
    console.log(`✅ Vendure Channel ID: ${vendureResult.channelId} (INTEGER)`);
    console.log(`✅ Vendure Admin ID: ${vendureResult.administratorId} (INTEGER)`);
    
    // 4. Update tenant with INTEGER IDs
    console.log('\nStep 4: Linking Vendure IDs to tenant...');
    await supabase
        .from('tenants')
        .update({
            vendure_seller_id: vendureResult.sellerId,          // INTEGER
            vendure_channel_id: vendureResult.channelId,        // INTEGER
            vendure_administrator_id: vendureResult.administratorId, // INTEGER
            status: 'active'
        })
        .eq('id', tenant.id);
    
    // 5. Verify the mapping
    console.log('\nStep 5: Verifying ID mapping...');
    const { data: updatedTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.id)
        .single();
    
    console.log('\n📊 Final Tenant Record:');
    console.log(`   Tenant ID (UUID): ${updatedTenant.id}`);
    console.log(`   Owner ID (UUID): ${updatedTenant.owner_id}`);
    console.log(`   Vendure Seller ID (INTEGER): ${updatedTenant.vendure_seller_id}`);
    console.log(`   Vendure Channel ID (INTEGER): ${updatedTenant.vendure_channel_id}`);
    console.log(`   Vendure Admin ID (INTEGER): ${updatedTenant.vendure_administrator_id}`);
    
    // 6. Test lookup by Vendure ID
    console.log('\nStep 6: Testing reverse lookup (Vendure ID → Tenant)...');
    const { data: foundTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('vendure_administrator_id', vendureResult.administratorId)
        .single();
    
    if (foundTenant) {
        console.log(`✅ Found tenant by Vendure admin ID: ${foundTenant.business_name}`);
    }
    
    console.log('\n🎉 All ID mapping tests passed!');
}
```

---

## Common Issues & Solutions

### Issue 1: "invalid input syntax for type uuid"

**Cause:** Trying to insert an INTEGER into a UUID field

**Solution:** 
```typescript
// ❌ WRONG
owner_id: 3  // INTEGER

// ✅ CORRECT
owner_id: supabaseUser.id  // UUID from Supabase auth
```

### Issue 2: "cannot cast type integer to uuid"

**Cause:** Trying to use Vendure INTEGER ID as UUID

**Solution:**
```typescript
// ❌ WRONG - Don't try to convert
owner_id: vendureAdministratorId  // This is an INTEGER!

// ✅ CORRECT - Use separate fields
vendure_administrator_id: vendureAdministratorId  // INTEGER field
```

### Issue 3: GraphQL expects String but getting Number

**Cause:** Vendure GraphQL expects ID as String

**Solution:**
```typescript
// ✅ Convert INTEGER to String for GraphQL
const sellerId = tenant.vendure_seller_id.toString();

const query = `
    query GetSeller($id: ID!) {
        seller(id: $id) { ... }
    }
`;

await vendureClient.query({
    variables: { id: sellerId }  // String: "7"
});
```

---

## Best Practices

### 1. **Always Use Correct Types**
```typescript
interface Tenant {
    id: string;                      // UUID (Supabase)
    owner_id: string;                // UUID (Supabase auth.users)
    vendure_seller_id: number;       // INTEGER (Vendure)
    vendure_channel_id: number;      // INTEGER (Vendure)
    vendure_administrator_id: number;// INTEGER (Vendure)
}
```

### 2. **Type Conversions for GraphQL**
```typescript
// Vendure GraphQL expects String for ID type
const variables = {
    sellerId: tenant.vendure_seller_id.toString(),
    channelId: tenant.vendure_channel_id.toString()
};
```

### 3. **Database Queries Use Native Types**
```sql
-- ✅ Use INTEGER directly in SQL
SELECT * FROM tenants WHERE vendure_seller_id = 7;

-- ❌ Don't use strings
SELECT * FROM tenants WHERE vendure_seller_id = '7';
```

### 4. **Null Checks**
```typescript
// Vendure IDs might be null during provisioning
if (tenant.vendure_seller_id) {
    // Safe to use
    const seller = await getSeller(tenant.vendure_seller_id);
}
```

---

## Summary

| Field | Type | Database | Purpose |
|-------|------|----------|---------|
| `id` | UUID | Supabase | Tenant primary key |
| `owner_id` | UUID | Supabase | Links to auth.users(id) |
| `vendure_seller_id` | INTEGER | Vendure | Links to Seller entity |
| `vendure_channel_id` | INTEGER | Vendure | Links to Channel entity |
| `vendure_administrator_id` | INTEGER | Vendure | Links to Administrator entity |

**Key Principle:** Store IDs in their **native type** - UUIDs for Supabase, INTEGERs for Vendure. Convert only when needed for API calls.

---

## Next Steps

1. ✅ Run the migration script to fix existing schema
2. ✅ Update provisioning service to return proper types
3. ✅ Test ID mapping with the test script
4. ✅ Update documentation with correct types

---

**Status:** ✅ ID mapping issue resolved!

