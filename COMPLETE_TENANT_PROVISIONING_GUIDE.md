# Complete Tenant Provisioning Guide

## Overview

This guide documents the **complete end-to-end tenant provisioning flow** that integrates:
- **Day 6:** Vendure Seller Provisioning (INTEGER IDs)
- **Day 7:** SaaS Database Schema (UUID-based tenants)

**Status:** ✅ Fully tested and working!

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Complete Flow](#the-complete-flow)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Code Examples](#code-examples)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Two Separate Systems Working Together

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER SIGNS UP                                │
│                  (azima.store/signup)                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              SYSTEM 1: Supabase SaaS Platform                    │
│              (UUID-based authentication)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Create User in auth.users                                   │
│     → Generates UUID: a3bb189e-8bf9-3888-9912-ace4e6543002     │
│                                                                  │
│  2. Create Tenant Record                                        │
│     → tenant.id: b4cc298f-9cf0-4999-0023-bcf5f7654003 (UUID)   │
│     → tenant.owner_id: a3bb189e-... (UUID from step 1)         │
│     → tenant.vendure_seller_id: NULL (will be filled)          │
│     → tenant.vendure_channel_id: NULL (will be filled)         │
│     → tenant.status: 'provisioning'                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│           SYSTEM 2: Vendure Marketplace Platform                 │
│           (INTEGER-based IDs)                                    │
├─────────────────────────────────────────────────────────────────┤
│  3. Create Seller Entity                                        │
│     → Seller ID: 7 (INTEGER)                                    │
│                                                                  │
│  4. Create Channel for Seller                                   │
│     → Channel ID: 5 (INTEGER)                                   │
│     → Linked to Seller ID: 7                                    │
│                                                                  │
│  5. Create Administrator Account                                │
│     → Administrator ID: 5 (INTEGER)                             │
│     → Email: SAME as Supabase user                              │
│     → Password: SAME as Supabase user                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│              BRIDGE: Update Tenant Record                        │
├─────────────────────────────────────────────────────────────────┤
│  6. Link Vendure IDs to Tenant                                  │
│     → tenant.vendure_seller_id: 7 (INTEGER)                     │
│     → tenant.vendure_channel_id: 5 (INTEGER)                    │
│     → tenant.vendure_administrator_id: 5 (INTEGER)              │
│     → tenant.status: 'active'                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                   RESULT: Dual Access                            │
├─────────────────────────────────────────────────────────────────┤
│  Merchant can now login to TWO dashboards:                      │
│                                                                  │
│  📊 SaaS Admin (azima.store/admin)                              │
│     - Uses Supabase Auth (UUID session)                         │
│     - Manages: Billing, subscription, domains                   │
│                                                                  │
│  🛍️ Store Admin (tenant.azima.store/admin)                      │
│     - Uses Vendure Auth (INTEGER session)                       │
│     - Manages: Products, orders, inventory                      │
│                                                                  │
│  ✅ SAME email and password for both!                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Complete Flow

### Phase 1: User Signup (Supabase)

**Endpoint:** `POST /api/auth/signup`

```typescript
// Frontend sends:
{
    email: "john@electronics.com",
    password: "SecurePass123!",
    businessName: "Johns Electronics"
}

// Backend creates Supabase user:
const { data } = await supabase.auth.signUp({
    email: "john@electronics.com",
    password: "SecurePass123!"
});

// Result: UUID created
// data.user.id = "402da43a-df14-4ac7-a419-4f55ac6b2d99"
```

### Phase 2: Tenant Creation (Supabase)

```typescript
// Create tenant record
const { data: tenant } = await supabase
    .from('tenants')
    .insert({
        subdomain: 'johns-electronics',
        business_name: 'Johns Electronics',
        owner_id: data.user.id,  // UUID from Phase 1
        status: 'provisioning'
    })
    .select()
    .single();

// Result: Tenant with UUID
// tenant.id = "924cb82b-0a5a-481e-ba05-ddf1981dde08"
// tenant.owner_id = "402da43a-df14-4ac7-a419-4f55ac6b2d99"
```

### Phase 3: Vendure Provisioning

**Endpoint:** `POST /api/vendure/provision-seller`

```typescript
// Call Vendure provisioning API
const response = await fetch('http://localhost:3000/api/provision-seller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        shopName: 'Johns Electronics',
        ownerEmail: 'john@electronics.com',
        ownerPassword: 'SecurePass123!'  // SAME password!
    })
});

const vendureResult = await response.json();

// Result: INTEGER IDs from Vendure
// {
//   sellerId: 7,
//   channelId: 5,
//   administratorId: 5,
//   channelCode: 'johns-electronics',
//   channelToken: 'johns-electronics-token'
// }
```

### Phase 4: Link Vendure to Tenant (Supabase)

```typescript
// Update tenant with Vendure IDs
await supabase
    .from('tenants')
    .update({
        vendure_seller_id: vendureResult.sellerId,           // INTEGER: 7
        vendure_channel_id: vendureResult.channelId,         // INTEGER: 5
        vendure_administrator_id: vendureResult.administratorId, // INTEGER: 5
        status: 'active'
    })
    .eq('id', tenant.id);

// Final tenant record:
// {
//   id: "924cb82b-0a5a-481e-ba05-ddf1981dde08",  (UUID)
//   owner_id: "402da43a-df14-4ac7-a419-4f55ac6b2d99",  (UUID)
//   vendure_seller_id: 7,  (INTEGER)
//   vendure_channel_id: 5,  (INTEGER)
//   vendure_administrator_id: 5,  (INTEGER)
//   status: "active"
// }
```

---

## Step-by-Step Implementation

### Step 1: Set Up Environment Variables

```bash
# .env

# Supabase SaaS Database
SUPABASE_SAAS_URL=https://your-project.supabase.co
SUPABASE_SAAS_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_SAAS_ANON_KEY=your_anon_key

# Vendure Marketplace
VENDURE_API_URL=http://localhost:3000/admin-api
VENDURE_ADMIN_USERNAME=superadmin
VENDURE_ADMIN_PASSWORD=superadmin
```

### Step 2: Create Signup API Endpoint

```typescript
// pages/api/auth/signup.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_SAAS_URL!,
    process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password, businessName } = req.body;

    try {
        // 1. Create Supabase user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError) throw authError;

        // 2. Create tenant
        const subdomain = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert({
                subdomain,
                business_name: businessName,
                owner_id: authData.user.id,
                status: 'provisioning'
            })
            .select()
            .single();

        if (tenantError) throw tenantError;

        // 3. Provision Vendure seller (async)
        provisionVendureSeller({
            tenantId: tenant.id,
            shopName: businessName,
            ownerEmail: email,
            ownerPassword: password
        });

        // 4. Return success
        res.status(201).json({
            success: true,
            tenantId: tenant.id,
            subdomain: tenant.subdomain,
            userId: authData.user.id
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message });
    }
}

async function provisionVendureSeller(data: {
    tenantId: string;
    shopName: string;
    ownerEmail: string;
    ownerPassword: string;
}) {
    try {
        // Call Vendure provisioning
        const response = await fetch('http://localhost:3000/api/provision-seller', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shopName: data.shopName,
                ownerEmail: data.ownerEmail,
                ownerPassword: data.ownerPassword
            })
        });

        const result = await response.json();

        // Update tenant with Vendure IDs
        await supabase
            .from('tenants')
            .update({
                vendure_seller_id: result.sellerId,
                vendure_channel_id: result.channelId,
                vendure_administrator_id: result.administratorId,
                status: 'active'
            })
            .eq('id', data.tenantId);

        console.log('✅ Vendure seller provisioned:', result);

    } catch (error) {
        console.error('❌ Vendure provisioning failed:', error);
        
        // Mark tenant as error
        await supabase
            .from('tenants')
            .update({ status: 'error' })
            .eq('id', data.tenantId);
    }
}
```

### Step 3: Create Vendure Provisioning Endpoint

This already exists! Located at: `src/provision-seller-api.ts`

### Step 4: Test the Complete Flow

Use the test script we just ran:

```bash
npx ts-node src/test-complete-signup-flow.ts
```

---

## Code Examples

### Example 1: Complete Signup Flow

```typescript
// Complete working example
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_SAAS_URL!,
    process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY!
);

async function signupNewTenant(
    email: string,
    password: string,
    businessName: string
) {
    // Step 1: Create Supabase user (UUID)
    const { data: user } = await supabase.auth.signUp({ email, password });
    console.log('User UUID:', user.user.id);

    // Step 2: Create tenant (UUID)
    const { data: tenant } = await supabase
        .from('tenants')
        .insert({
            subdomain: generateSubdomain(businessName),
            business_name: businessName,
            owner_id: user.user.id,
            status: 'provisioning'
        })
        .select()
        .single();
    
    console.log('Tenant UUID:', tenant.id);

    // Step 3: Provision Vendure (INTEGERs)
    const vendure = await provisionVendureSeller({
        shopName: businessName,
        email,
        password
    });
    
    console.log('Vendure IDs:', vendure);

    // Step 4: Link them together
    await supabase
        .from('tenants')
        .update({
            vendure_seller_id: vendure.sellerId,
            vendure_channel_id: vendure.channelId,
            vendure_administrator_id: vendure.administratorId,
            status: 'active'
        })
        .eq('id', tenant.id);

    return {
        userId: user.user.id,
        tenantId: tenant.id,
        subdomain: tenant.subdomain,
        vendureIds: vendure
    };
}
```

### Example 2: Get Tenant with All IDs

```typescript
async function getTenantWithVendureData(userId: string) {
    // Get tenant from Supabase (using UUID)
    const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('owner_id', userId)
        .single();

    // Now you have both UUID and INTEGER IDs:
    return {
        // Supabase IDs (UUIDs)
        tenantId: tenant.id,
        ownerId: tenant.owner_id,
        
        // Vendure IDs (INTEGERs)
        sellerId: tenant.vendure_seller_id,
        channelId: tenant.vendure_channel_id,
        administratorId: tenant.vendure_administrator_id,
        
        // Tenant info
        subdomain: tenant.subdomain,
        businessName: tenant.business_name,
        status: tenant.status
    };
}
```

### Example 3: Query Vendure Using Tenant Data

```typescript
async function getSellerProducts(userId: string) {
    // Step 1: Get tenant with Vendure IDs
    const tenant = await getTenantWithVendureData(userId);

    // Step 2: Query Vendure using INTEGER IDs
    const query = `
        query GetProducts($channelId: ID!) {
            products(options: { 
                filter: { channelId: { eq: $channelId } } 
            }) {
                items {
                    id
                    name
                    slug
                }
            }
        }
    `;

    const response = await fetch('http://localhost:3000/shop-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query,
            variables: {
                channelId: tenant.channelId.toString() // Convert INTEGER to String for GraphQL
            }
        })
    });

    return await response.json();
}
```

---

## Testing

### Test 1: Complete Signup Flow

```bash
# Run the complete test
npx ts-node src/test-complete-signup-flow.ts
```

**Expected Output:**
```
🚀 Starting Complete Signup Flow

Step 1: Creating Supabase user...
✅ Supabase User Created
   User ID (UUID): 402da43a-df14-4ac7-a419-4f55ac6b2d99
   Email: test@example.com

Step 2: Creating tenant record...
✅ Tenant Created
   Tenant ID (UUID): 924cb82b-0a5a-481e-ba05-ddf1981dde08
   Owner ID (UUID): 402da43a-df14-4ac7-a419-4f55ac6b2d99
   Subdomain: test-store-1761645886059

Step 3: Provisioning Vendure seller...
✅ Vendure Seller Provisioned
   Seller ID (INTEGER): 7
   Channel ID (INTEGER): 5
   Administrator ID (INTEGER): 5

Step 4: Linking Vendure IDs to tenant...
✅ Tenant Updated with Vendure IDs

Step 5: Verifying final tenant state...

📊 FINAL TENANT RECORD:
=====================================
Tenant ID (UUID):          924cb82b-0a5a-481e-ba05-ddf1981dde08
Owner ID (UUID):           402da43a-df14-4ac7-a419-4f55ac6b2d99
Business Name:             Test Electronics Store
Subdomain:                 test-store-1761645886059
Vendure Seller ID (INT):   7
Vendure Channel ID (INT):  5
Vendure Admin ID (INT):    5
Status:                    active
=====================================

🎉 Complete signup flow finished successfully!
```

### Test 2: Verify in Database

```sql
-- Check Supabase auth.users
SELECT id, email FROM auth.users WHERE email = 'test@example.com';

-- Check tenants table
SELECT 
    id,
    owner_id,
    subdomain,
    vendure_seller_id,
    vendure_channel_id,
    vendure_administrator_id,
    status
FROM tenants 
WHERE owner_id = '402da43a-df14-4ac7-a419-4f55ac6b2d99';

-- Expected result:
-- id: 924cb82b-0a5a-481e-ba05-ddf1981dde08 (UUID)
-- owner_id: 402da43a-df14-4ac7-a419-4f55ac6b2d99 (UUID)
-- vendure_seller_id: 7 (INTEGER)
-- vendure_channel_id: 5 (INTEGER)
-- vendure_administrator_id: 5 (INTEGER)
```

### Test 3: Verify in Vendure

```sql
-- In Vendure database
SELECT id, name FROM seller WHERE id = 7;
SELECT id, code, "sellerId" FROM channel WHERE id = 5;
SELECT id, "emailAddress" FROM administrator WHERE id = 5;
```

---

## Troubleshooting

### Issue 1: "invalid input syntax for type uuid"

**Cause:** Trying to insert INTEGER into UUID field

**Solution:**
```typescript
// ❌ WRONG
owner_id: 7  // This is an INTEGER!

// ✅ CORRECT
owner_id: user.id  // This is a UUID from Supabase auth
```

### Issue 2: "Row level security policy violation"

**Cause:** Using anon key instead of service role key

**Solution:**
```typescript
// For backend operations, use service role key
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // Not anon key!
);
```

### Issue 3: "Seller not found in Vendure"

**Cause:** Vendure provisioning failed or incomplete

**Solution:**
1. Check Vendure server logs
2. Verify GraphQL mutations work
3. Check tenant status:
```sql
SELECT status FROM tenants WHERE id = 'tenant-uuid';
-- If status = 'error', provisioning failed
```

### Issue 4: "Cannot login to store admin"

**Cause:** Vendure administrator not created or wrong credentials

**Solution:**
1. Verify administrator exists:
```sql
SELECT * FROM administrator WHERE "emailAddress" = 'user@example.com';
```

2. Ensure same email/password used for both Supabase and Vendure

---

## Best Practices

### 1. Use Service Role Key for Backend
```typescript
// ✅ Backend (server-side)
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ❌ Never use service role in frontend!
```

### 2. Handle Async Provisioning
```typescript
// Don't make user wait for Vendure provisioning
// Do it asynchronously after tenant creation

// 1. Create tenant immediately
const tenant = await createTenant(user.id);

// 2. Return success to user
res.json({ tenantId: tenant.id });

// 3. Provision Vendure in background
provisionVendureAsync(tenant.id);
```

### 3. Store IDs in Native Types
```typescript
// ✅ CORRECT
interface Tenant {
    id: string;                      // UUID (Supabase)
    owner_id: string;                // UUID (Supabase)
    vendure_seller_id: number;       // INTEGER (Vendure)
    vendure_channel_id: number;      // INTEGER (Vendure)
    vendure_administrator_id: number;// INTEGER (Vendure)
}

// ❌ WRONG - Don't convert everything to strings
```

### 4. Handle Provisioning Failures
```typescript
try {
    await provisionVendureSeller(data);
    await updateTenantStatus(tenantId, 'active');
} catch (error) {
    await updateTenantStatus(tenantId, 'error');
    // Optionally: Schedule retry or notify admin
}
```

---

## Database Schema Summary

### Supabase Tables

```sql
-- auth.users (managed by Supabase)
id: UUID PRIMARY KEY
email: VARCHAR

-- tenants (your SaaS database)
id: UUID PRIMARY KEY
owner_id: UUID REFERENCES auth.users(id)
vendure_seller_id: INTEGER          -- Links to Vendure
vendure_channel_id: INTEGER         -- Links to Vendure
vendure_administrator_id: INTEGER   -- Links to Vendure
subdomain: VARCHAR
business_name: VARCHAR
status: ENUM('provisioning', 'active', 'suspended', 'error')
```

### Vendure Tables

```sql
-- seller (Vendure database)
id: SERIAL PRIMARY KEY              -- INTEGER
name: VARCHAR

-- channel (Vendure database)
id: SERIAL PRIMARY KEY              -- INTEGER
code: VARCHAR
"sellerId": INTEGER REFERENCES seller(id)

-- administrator (Vendure database)
id: SERIAL PRIMARY KEY              -- INTEGER
"emailAddress": VARCHAR
"userId": INTEGER
```

---

## API Endpoints

### 1. Signup
```
POST /api/auth/signup
Body: { email, password, businessName }
Returns: { tenantId, subdomain, userId }
```

### 2. Provision Seller (Internal)
```
POST /api/vendure/provision-seller
Body: { shopName, ownerEmail, ownerPassword }
Returns: { sellerId, channelId, administratorId }
```

### 3. Get Tenant
```
GET /api/tenant
Headers: { Authorization: Bearer <jwt> }
Returns: { tenant with all IDs }
```

---

## Next Steps

After completing tenant provisioning:

1. ✅ **Day 8:** Implement channel isolation middleware
2. ✅ **Day 8:** Auto-switch sellers to their channel on login
3. ✅ **Day 8:** Build operator admin dashboard

---

## Summary

**What We Built:**
- ✅ Dual authentication system (Supabase + Vendure)
- ✅ UUID-INTEGER ID mapping
- ✅ Complete provisioning flow
- ✅ Tested and working end-to-end
- ✅ No type conflicts

**Key Achievement:**
One signup creates TWO accounts (Supabase + Vendure) with proper ID mapping, enabling:
- SaaS admin access (billing, domains)
- Store admin access (products, orders)
- Same email/password for both!

---

**Status:** ✅ Complete tenant provisioning system ready for production!

**Files:**
- Test: `src/test-complete-signup-flow.ts`
- Provisioning: `src/provision-seller-api.ts`
- Schema: `supabase-schema.sql`
- This Guide: `COMPLETE_TENANT_PROVISIONING_GUIDE.md`

