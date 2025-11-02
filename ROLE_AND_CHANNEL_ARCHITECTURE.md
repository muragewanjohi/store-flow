# **Role & Channel Architecture**

## **Overview**

We use a **"General Roles + Per-Admin Channel Access"** model:

- ✅ **Roles are generic** (e.g., "SuperAdmin", "Administrator", "Inventory Manager") - NOT channel-specific
- ✅ **Channel access is controlled at the administrator level** via Supabase `tenants` table
- ✅ **One administrator can access multiple channels** if needed (future: multi-store admins)
- ❌ **NO role-to-channel mapping** - this would create endless roles

---

## **Architecture**

### **1. Generic Roles (Limited Set)**

Vendure roles define **permissions**, not channel access:

| Role ID | Role Name | Purpose | Permissions |
|---------|-----------|---------|-------------|
| 1 | SuperAdmin | Platform operators | All permissions, all channels |
| 3 | Administrator | Store managers | Product, order, customer management |
| 4 | Inventory Manager | Stock management | Inventory read/write only |
| 5 | Order Manager | Fulfillment staff | Order processing only |
| 6 | Analytics Viewer | Read-only access | View reports and analytics |

**Key Point:** These roles are **channel-agnostic**. An admin with "Administrator" role can manage products/orders, but their **channel access** is determined separately.

---

### **2. Channel Access via Supabase `tenants` Table**

Channel access is controlled by linking administrators to channels in the Supabase `tenants` table:

```sql
-- Supabase tenants table structure
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    subdomain TEXT UNIQUE,
    business_name TEXT,
    
    -- Channel Access Mapping
    vendure_administrator_id INTEGER,  -- Links to administrator.id
    vendure_channel_id INTEGER,        -- Links to channel.id
    vendure_seller_id INTEGER,
    
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP
);
```

**Example:**
```
Tenant: "regis-cars"
├─ Administrator ID: 17 (info@regiscars.com)
├─ Channel ID: 15 (regis-cars-store)
└─ Role: 3 (Administrator)
```

When `info@regiscars.com` logs in:
1. Vendure assigns them **Role 3** (Administrator permissions)
2. Channel Isolation Plugin queries `tenants` table → finds Channel 15
3. All queries are automatically scoped to Channel 15

---

### **3. How Channel Isolation Works**

The `ChannelIsolationPlugin` enforces channel access **without role-to-channel mapping**:

```typescript
// From channel-isolation-plugin.ts

async getSellerChannelForAdministrator(
    ctx: RequestContext, 
    administratorId: ID
): Promise<number | null> {
    // Query Supabase tenants table - NOT role_channels_channel!
    const result = await rawConnection.query(
        `SELECT vendure_channel_id 
         FROM tenants 
         WHERE vendure_administrator_id = $1 
         AND status = 'active'
         LIMIT 1`,
        [administratorId]
    );
    
    return result[0]?.vendure_channel_id || null;
}
```

**Flow:**
1. Admin logs in → Gets session with `activeUserId`
2. Middleware calls `getSellerChannelForAdministrator(adminId)`
3. Queries `tenants` table → Gets `vendure_channel_id`
4. Auto-switches `RequestContext` to that channel
5. All subsequent queries are scoped to that channel

---

## **Benefits**

### ✅ **Scalable**
- **5 general roles** cover all use cases
- No need for "regis-cars-admin", "toys-r-us-admin", etc.

### ✅ **Flexible**
- One admin can manage multiple stores (add multiple rows in `tenants`)
- Change channel access without changing roles
- Roles define **what** they can do, channels define **where**

### ✅ **Simple**
- No complex role-channel matrix
- Clear separation: Roles = Permissions, Channels = Data Isolation

---

## **Provisioning Flow**

When creating a new tenant:

```typescript
// 1. Create seller
const seller = await sellerService.create({ name: "Regis Cars" });

// 2. Create channel
const channel = await channelService.create({ 
    code: "regis-cars-store",
    sellerId: seller.id 
});

// 3. Create administrator with generic role
const admin = await administratorService.create({
    emailAddress: "info@regiscars.com",
    roleIds: [3] // Generic "Administrator" role
});

// 4. Link administrator → channel in Supabase
await supabase.from('tenants').insert({
    subdomain: 'regis-cars',
    vendure_administrator_id: admin.id,
    vendure_channel_id: channel.id,
    vendure_seller_id: seller.id,
    status: 'active'
});

// ❌ NO role-to-channel mapping needed!
```

---

## **Multi-Channel Administrators (Future)**

If an admin needs access to multiple channels:

```sql
-- Option 1: Multiple tenant rows (one per channel)
INSERT INTO tenants (subdomain, vendure_administrator_id, vendure_channel_id, status)
VALUES 
    ('store-a', 17, 15, 'active'),
    ('store-b', 17, 22, 'active');

-- Option 2: New table (cleaner for many-to-many)
CREATE TABLE administrator_channels (
    administrator_id INTEGER,
    channel_id INTEGER,
    PRIMARY KEY (administrator_id, channel_id)
);
```

The Channel Isolation Plugin can be extended to return **all accessible channels** from the `tenants` table.

---

## **Comparison: Role-Based vs Administrator-Based Channel Access**

| Approach | Pros | Cons |
|----------|------|------|
| **Role-to-Channel** (❌ Not used) | Vendure native | Creates endless roles (regis-admin, toys-admin, etc.) |
| **Admin-to-Channel** (✅ Used) | Scalable, flexible | Requires custom plugin (already built!) |

---

## **Implementation Status**

✅ **Completed:**
- Channel Isolation Plugin queries `tenants` table
- Middleware auto-switches channels on login
- Provisioning script links admin → channel in Supabase
- No role-to-channel mapping in scripts

✅ **Future Enhancements:**
- Multi-channel admin support (multiple `tenants` rows)
- Channel switching UI (filter by accessible channels)
- Caching channel mappings in Redis

---

## **Files Updated**

1. ✅ `create-regis-cars-tenant.ts` - Removed `mapRoleToChannel()` function
2. ✅ `create-admin-via-service.ts` - No role-to-channel mapping
3. ✅ Channel Isolation Plugin - Already uses `tenants` table (no changes needed)

---

## **Summary**

**Roles** = What permissions an admin has (generic, reusable)  
**Channels** = Which store(s) they can access (via `tenants` table)

This architecture scales to **hundreds of stores** with just **5 general roles**! 🎉

