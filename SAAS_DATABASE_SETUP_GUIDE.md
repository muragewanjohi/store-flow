# SaaS Database Setup Guide

## Overview

This guide covers the complete setup of the Azima.Store SaaS database schema, designed to work seamlessly with Vendure Multi-Vendor Plugin.

## Architecture

We use **two separate Supabase projects** for clear separation of concerns:

### 1. **`store-flow-saas` Project** (SaaS Platform)
- **Purpose**: Multi-tenant SaaS platform management
- **Tables**: `tenants`, `plans`, `subscriptions`, `usage_counters`, `domains`, `webhooks`, `api_keys`, `events`
- **Security**: RLS enabled for tenant isolation
- **Access**: SaaS API, Operator Admin

### 2. **`store-flow` Project** (Vendure Marketplace)
- **Purpose**: Multi-vendor marketplace operations
- **Tables**: Managed by Vendure (`sellers`, `channels`, `products`, `orders`, etc.)
- **Security**: Built-in seller isolation via Channels
- **Access**: Vendure APIs

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [Setup Instructions](#setup-instructions)
3. [RLS Policies](#rls-policies)
4. [Testing](#testing)
5. [Integration with Vendure](#integration-with-vendure)
6. [Troubleshooting](#troubleshooting)

---

## Database Schema

### Core Tables

#### 1. **tenants** - Central tenant management
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    subdomain VARCHAR(63) UNIQUE NOT NULL,
    custom_domain VARCHAR(255),
    business_name VARCHAR(255) NOT NULL,
    status tenant_status DEFAULT 'provisioning',
    owner_id UUID REFERENCES auth.users(id),
    vendure_seller_id VARCHAR(255),  -- Links to Vendure
    vendure_channel_id VARCHAR(255), -- Links to Vendure
    plan_id UUID REFERENCES plans(id),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

**Key Fields:**
- `subdomain`: Unique subdomain (e.g., "johns-electronics")
- `vendure_seller_id`: Links to Vendure Seller entity
- `vendure_channel_id`: Links to Vendure Channel entity
- `status`: provisioning | active | suspended | error

#### 2. **plans** - Subscription plans
```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier plan_tier NOT NULL,
    monthly_price DECIMAL(10,2),
    annual_price DECIMAL(10,2),
    max_stores INTEGER DEFAULT 1,
    max_products INTEGER,
    max_orders_per_month INTEGER,
    max_staff INTEGER,
    max_storage_gb INTEGER,
    features JSONB DEFAULT '{}'
);
```

**Default Plans:**
- Free: $0/mo, 20 products, 25 orders/mo
- Starter: $15/mo, 200 products, 200 orders/mo
- Pro: $39/mo, 2000 products, 1000 orders/mo
- Growth: $79/mo, 10k products, 3k orders/mo
- Scale: $149/mo, 50k products, 8k orders/mo

#### 3. **subscriptions** - Billing subscriptions
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    plan_id UUID REFERENCES plans(id),
    status subscription_status,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_end TIMESTAMP
);
```

#### 4. **usage_counters** - Usage tracking for billing
```sql
CREATE TABLE usage_counters (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    metric_name VARCHAR(100), -- 'orders', 'products', 'storage_gb'
    count INTEGER DEFAULT 0,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    UNIQUE(tenant_id, metric_name, period_start)
);
```

#### 5. **domains** - Custom domain management
```sql
CREATE TABLE domains (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    domain VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    ssl_status VARCHAR(50) DEFAULT 'pending'
);
```

#### 6. **webhooks** - Webhook subscriptions
```sql
CREATE TABLE webhooks (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    url VARCHAR(500) NOT NULL,
    events TEXT[], -- Array of event types
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 7. **api_keys** - API authentication
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{}',
    last_used TIMESTAMP,
    expires_at TIMESTAMP
);
```

#### 8. **events** - Audit logging
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES auth.users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP
);
```

---

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Create a new project: `store-flow-saas`
3. Choose a region (closest to your users)
4. Set a secure database password
5. Wait for project to initialize

### Step 2: Run Schema Migration

1. Open SQL Editor in Supabase dashboard
2. Run `supabase-schema.sql`:

```bash
# Option 1: Copy/paste in Supabase SQL Editor
cat supabase-schema.sql
# Then paste and execute

# Option 2: Use Supabase CLI
supabase db push
```

### Step 3: Apply RLS Policies

1. Run `supabase-rls-policies.sql`:

```sql
-- In Supabase SQL Editor
-- Run supabase-rls-policies.sql
```

### Step 4: Set Up Authentication

1. Run `supabase-auth-setup.sql`:

```sql
-- Configure auth settings
```

### Step 5: Set Up Storage

1. Run `supabase-storage-setup.sql`:

```sql
-- Create storage buckets for tenant assets
```

### Step 6: Verify Setup

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- Verify default plans
SELECT * FROM plans ORDER BY monthly_price;
```

---

## RLS Policies

### Tenant Isolation

All tables have RLS policies that ensure:
1. Users can only access their own tenant data
2. Service role has full access for backend operations
3. Audit events can be inserted by the system

### Key Policies

**Tenants:**
- Users can view/update their own tenants
- Service role can manage all tenants

**Subscriptions:**
- Users can manage subscriptions for their tenants
- Service role has full access

**Usage Counters:**
- Users can view usage for their tenants
- Service role can update usage metrics

**Domains:**
- Users can manage domains for their tenants
- Verification is handled by service role

**Events:**
- Users can view events for their tenants
- System can insert audit events

---

## Testing

### Test 1: Create Test Tenant

```sql
-- Insert test user (in Supabase auth.users)
-- This is usually done via Supabase Auth API

-- Insert test tenant
INSERT INTO tenants (
    subdomain, 
    business_name, 
    owner_id, 
    status
) VALUES (
    'test-store', 
    'Test Store', 
    '00000000-0000-0000-0000-000000000000', -- Replace with real user ID
    'active'
);
```

### Test 2: Verify RLS Policies

```sql
-- Switch to authenticated user context
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "USER_ID_HERE"}';

-- Try to access tenants (should only see own tenants)
SELECT * FROM tenants;

-- Try to access other tenant's data (should be empty)
SELECT * FROM tenants WHERE owner_id != 'USER_ID_HERE';
```

### Test 3: Test Usage Counters

```sql
-- Insert usage counter
INSERT INTO usage_counters (
    tenant_id,
    metric_name,
    count,
    period_start,
    period_end
) VALUES (
    (SELECT id FROM tenants WHERE subdomain = 'test-store'),
    'orders',
    10,
    '2025-10-01',
    '2025-10-31'
);

-- Query usage
SELECT 
    t.business_name,
    uc.metric_name,
    uc.count,
    uc.period_start,
    uc.period_end
FROM usage_counters uc
JOIN tenants t ON t.id = uc.tenant_id
WHERE t.subdomain = 'test-store';
```

### Test 4: Test Domain Management

```sql
-- Add custom domain
INSERT INTO domains (
    tenant_id,
    domain,
    is_primary,
    verification_token
) VALUES (
    (SELECT id FROM tenants WHERE subdomain = 'test-store'),
    'shop.example.com',
    true,
    'verification_token_here'
);

-- Verify domain
UPDATE domains 
SET is_verified = true 
WHERE domain = 'shop.example.com';
```

---

## Integration with Vendure

### Provisioning Flow

When a new tenant signs up:

1. **Create Supabase User** (SaaS auth)
   ```typescript
   const { user } = await supabase.auth.signUp({
       email: 'user@example.com',
       password: 'password'
   });
   ```

2. **Create Tenant Record**
   ```sql
   INSERT INTO tenants (subdomain, business_name, owner_id, status)
   VALUES ('johns-electronics', 'Johns Electronics', user_id, 'provisioning');
   ```

3. **Provision Vendure Seller & Channel**
   ```typescript
   const result = await provisionSeller({
       shopName: 'Johns Electronics',
       ownerEmail: 'user@example.com'
   });
   ```

4. **Update Tenant with Vendure IDs**
   ```sql
   UPDATE tenants 
   SET 
       vendure_seller_id = result.sellerId,
       vendure_channel_id = result.channelId,
       status = 'active'
   WHERE id = tenant_id;
   ```

5. **Create Default Subscription**
   ```sql
   INSERT INTO subscriptions (tenant_id, plan_id, status)
   VALUES (
       tenant_id,
       (SELECT id FROM plans WHERE tier = 'free'),
       'trialing'
   );
   ```

### Usage Tracking

Track usage from Vendure events:

```typescript
// On order created (Vendure webhook)
await incrementUsageCounter({
    tenantId: tenant.id,
    metric: 'orders',
    periodStart: startOfMonth(),
    periodEnd: endOfMonth()
});

// Check limits
const usage = await getUsageCounter(tenantId, 'orders');
const plan = await getPlan(tenant.planId);

if (usage.count >= plan.max_orders_per_month) {
    // Notify tenant of limit reached
    // Optionally block new orders
}
```

---

## Environment Variables

Required environment variables for SaaS database:

```env
# Supabase SaaS Project
SUPABASE_SAAS_URL=https://your-project.supabase.co
SUPABASE_SAAS_ANON_KEY=your_anon_key
SUPABASE_SAAS_SERVICE_ROLE_KEY=your_service_role_key

# Vendure Integration
VENDURE_API_URL=http://localhost:3000/admin-api
VENDURE_ADMIN_USERNAME=superadmin
VENDURE_ADMIN_PASSWORD=superadmin
```

---

## Database Migrations

For future schema changes:

```sql
-- migrations/001_add_tenant_settings.sql
ALTER TABLE tenants ADD COLUMN settings JSONB DEFAULT '{}';

-- migrations/002_add_plan_features.sql
ALTER TABLE plans ADD COLUMN custom_domains_limit INTEGER DEFAULT 1;
```

Apply migrations:
```bash
# Using Supabase CLI
supabase db push

# Or manually in SQL Editor
-- Copy/paste migration content
```

---

## Troubleshooting

### Issue: RLS Policies Blocking Queries

**Symptom:** Queries return no results even though data exists

**Solution:**
1. Check if you're authenticated:
   ```sql
   SELECT auth.uid(); -- Should return user ID
   ```

2. Verify policy applies to your user:
   ```sql
   SELECT * FROM tenants WHERE owner_id = auth.uid();
   ```

3. Use service role for backend operations

### Issue: Foreign Key Violations

**Symptom:** Cannot insert due to missing referenced rows

**Solution:**
1. Ensure parent records exist (plans, users)
2. Check order of insertions
3. Use transactions for related inserts

### Issue: Tenant Not Linked to Vendure

**Symptom:** `vendure_seller_id` or `vendure_channel_id` is NULL

**Solution:**
1. Check provisioning logs
2. Verify Vendure API is accessible
3. Re-run provisioning script
4. Update tenant manually if needed:
   ```sql
   UPDATE tenants 
   SET vendure_seller_id = 'X', vendure_channel_id = 'Y'
   WHERE id = tenant_id;
   ```

---

## Best Practices

### 1. Always Use Transactions
```sql
BEGIN;
    INSERT INTO tenants (...) RETURNING id;
    INSERT INTO subscriptions (...);
COMMIT;
```

### 2. Update Usage Counters Atomically
```sql
INSERT INTO usage_counters (tenant_id, metric_name, count, period_start, period_end)
VALUES (tenant_id, 'orders', 1, period_start, period_end)
ON CONFLICT (tenant_id, metric_name, period_start)
DO UPDATE SET count = usage_counters.count + 1;
```

### 3. Audit Important Operations
```sql
INSERT INTO events (tenant_id, event_type, event_data)
VALUES (tenant_id, 'plan_upgraded', '{"old_plan": "free", "new_plan": "starter"}');
```

### 4. Clean Up Old Data
```sql
-- Delete old events (keep 90 days)
DELETE FROM events 
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key stored securely
- [ ] API keys hashed before storage
- [ ] Webhook secrets validated
- [ ] SSL/TLS enabled for custom domains
- [ ] Audit logging enabled for sensitive operations
- [ ] Regular backups configured
- [ ] Database roles properly configured

---

## Next Steps

After setting up the SaaS database:

1. ✅ Connect SaaS API to Supabase
2. ✅ Implement tenant provisioning workflow
3. ✅ Set up usage tracking webhooks
4. ✅ Build SaaS admin dashboard
5. ✅ Implement billing integration (Stripe)
6. ✅ Set up monitoring and alerts

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Vendure Multi-Vendor Setup](./SELLER_PROVISIONING_GUIDE.md)
- [Schema Files](./supabase-schema.sql)
- [RLS Policies](./supabase-rls-policies.sql)

---

**Status:** ✅ SaaS Database Schema Complete and Ready for Use!

