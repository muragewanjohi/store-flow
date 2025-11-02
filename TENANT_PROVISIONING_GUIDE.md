# **Tenant Provisioning Guide**

## **🎯 Single Service for Tenant Creation**

**Use this ONE script for all tenant provisioning:**

### **`provision-tenant-via-service.ts`**

This is the **unified, production-ready script** that creates complete tenant setups:

✅ **Seller** (marketplace seller)  
✅ **Channel** (seller-specific store)  
✅ **Administrator** (with role assignment via SQL bypass)  
✅ **Supabase tenant link** (for channel isolation)

---

## **Usage**

```bash
npx ts-node src/provision-tenant-via-service.ts \
  <sellerName> \
  <channelCode> \
  <adminEmail> \
  <adminPassword> \
  <firstName> \
  <lastName> \
  <roleId> \
  <subdomain>
```

### **Example**

```bash
npx ts-node src/provision-tenant-via-service.ts \
  "Ruaka School Uniform" \
  ruaka-school-uniform-store \
  info@ruakaschooluniform.com \
  supersecret \
  Info \
  Ruaka \
  6 \
  ruaka-school-uniform
```

---

## **Architecture**

- ✅ **Uses Vendure Services** (no GraphQL permission issues)
- ✅ **Generic Roles** (Role 6 = default, NOT channel-specific)
- ✅ **Channel Access** controlled via Supabase `tenants` table
- ✅ **Idempotent** (handles existing sellers/channels/admins gracefully)
- ✅ **SQL Role Update** (bypasses Vendure permission checks)

---

## **Parameters**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sellerName` | Business/store name | `"Ruaka School Uniform"` |
| `channelCode` | Unique channel identifier | `ruaka-school-uniform-store` |
| `adminEmail` | Administrator email | `info@ruakaschooluniform.com` |
| `adminPassword` | Administrator password | `supersecret` |
| `firstName` | Admin first name | `Info` |
| `lastName` | Admin last name | `Ruaka` |
| `roleId` | Generic role ID (default: 6) | `6` |
| `subdomain` | Tenant subdomain | `ruaka-school-uniform` |

---

## **What It Creates**

1. **Seller** (if doesn't exist)
   - Name: `sellerName`
   - ID stored in Supabase

2. **Channel** (if doesn't exist)
   - Code: `channelCode`
   - Token: `{channelCode}-token`
   - Linked to seller
   - Default language: English
   - Default currency: USD

3. **Administrator** (if doesn't exist)
   - Email: `adminEmail`
   - Password: `adminPassword`
   - Created with SuperAdmin (role 1) first
   - Updated to `roleId` via SQL (bypasses permission check)

4. **Supabase Tenant Link**
   - Links `vendure_administrator_id` → `vendure_channel_id`
   - Enables Channel Isolation Plugin to auto-scope queries

---

## **Other Scripts (When to Use)**

### **`create-admin-via-service.ts`**
**Use ONLY when:** You need to create/update an admin for an **existing** seller/channel.

```bash
npx ts-node src/create-admin-via-service.ts \
  email password firstName lastName roleId
```

**DO NOT use for:** Creating new tenants (use `provision-tenant-via-service.ts` instead).

---

## **Deprecated Scripts**

These scripts are **kept for reference** but should NOT be used for new tenants:

- ❌ `create-regis-cars-tenant.ts` - Hardcoded, use `provision-tenant-via-service.ts`
- ❌ `create-ruaka-tenant.ts` - Hardcoded, use `provision-tenant-via-service.ts`
- ❌ `provision-tenant-and-admin.ts` - Uses GraphQL (has permission issues)
- ❌ `create-tenant-admin-session.ts` - Uses GraphQL (has permission issues)

---

## **Error Handling**

The script handles:

- ✅ **Existing sellers** - Reuses existing seller
- ✅ **Existing channels** - Reuses existing channel
- ✅ **Existing admins** - Updates role of existing admin
- ✅ **Port conflicts** - Clear error message if Vendure is running
- ✅ **SQL transaction rollback** - On role update errors

---

## **Output Example**

```
🚀 Provisioning Tenant via Vendure Services

Seller:       Ruaka School Uniform
Channel:      ruaka-school-uniform-store
Admin:        info@ruakaschooluniform.com
Role ID:      6
Subdomain:    ruaka-school-uniform

Step 1: Creating seller...
✅ Seller created: Ruaka School Uniform (ID: 24)

Step 2: Creating channel...
✅ Channel created: ruaka-school-uniform-store (ID: 17)

Step 3: Creating administrator with SuperAdmin role (temporary)...
✅ Administrator created: info@ruakaschooluniform.com (ID: 18)
   Initial role: SuperAdmin (1)

Step 4: Updating administrator to desired role via SQL...
✅ Updated admin user 20 to role 6 via SQL
✅ Administrator role updated to: 6

Step 5: Linking tenant in Supabase...
✅ Tenant linked in Supabase: ruaka-school-uniform

======================================================================
📊 Tenant Provisioned Successfully
======================================================================
Seller ID:        24
Channel ID:       17
Administrator ID: 18
Admin Email:      info@ruakaschooluniform.com
Admin Password:   supersecret
Role ID:          6
Subdomain:        ruaka-school-uniform

🎯 Next: Log in to test channel isolation
   Email: info@ruakaschooluniform.com
   Password: supersecret

📚 Architecture:
   - Role 6 (Analytics Viewer): Generic permissions
   - Channel 17: Access controlled via Supabase tenants table
   - Channel Isolation Plugin: Auto-scopes queries to channel 17
```

---

## **Prerequisites**

1. **Stop running Vendure server** (if `npm run dev` is running)
2. **Database connection** - Ensure Vendure DB is accessible
3. **Supabase connection** - Ensure Supabase service key is set

---

## **Next Steps After Provisioning**

1. **Log in** to Vendure admin at `http://localhost:3000/dashboard`
2. **Verify channel isolation** - Admin should only see their channel
3. **Test permissions** - Verify role permissions are correct
4. **Add products** - Start building the store catalog

---

## **Summary**

✅ **One script for everything:** `provision-tenant-via-service.ts`  
✅ **Parameterized:** Works for any tenant  
✅ **Production-ready:** Idempotent, error-handled, uses services  
✅ **Architecture-compliant:** Generic roles + Supabase channel mapping

