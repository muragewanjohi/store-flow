# **Cleanup Summary - Deprecated Files Removed**

## **Deleted Files**

The following deprecated tenant creation scripts have been removed. They've been replaced by the unified `provision-tenant-via-service.ts` script.

### **Hardcoded Tenant Scripts (Replaced)**
- ✅ `create-regis-cars-tenant.ts` - Hardcoded Regis Cars tenant
- ✅ `create-ruaka-tenant.ts` - Hardcoded Ruaka School Uniform tenant
- ✅ `create-truefruits-tenant.ts` - Hardcoded TrueFruits tenant
- ✅ `create-third-tenant-truefruits.ts` - Similar hardcoded script
- ✅ `create-third-seller-truefruits.ts` - Uses GraphQL, redundant

### **GraphQL-Based Scripts (Replaced - Had Permission Issues)**
- ✅ `create-tenant-admin-session.ts` - Used GraphQL, had permission issues
- ✅ `provision-tenant-and-admin.ts` - Used GraphQL, had permission issues
- ✅ `provision-admin-with-role.ts` - Used GraphQL, also mapped roles to channels (deprecated pattern)
- ✅ `create-second-seller-manual.ts` - Used GraphQL for testing

### **Other Redundant Scripts**
- ✅ `create-seller-with-role.ts` - Used role-to-channel mapping (deprecated pattern)

---

## **Remaining Files (Active)**

### **✅ Production Scripts**
- **`provision-tenant-via-service.ts`** - **UNIFIED script for all tenant provisioning** (seller + channel + admin + Supabase link)
- **`create-admin-via-service.ts`** - For creating/updating admins when seller/channel already exist

### **✅ Services & Plugins**
- `provision-seller-api.ts` - HTTP API service (for production use)
- `plugins/seller-provisioning-plugin.ts` - Vendure plugin code
- `plugins/channel-isolation-plugin.ts` - Channel isolation plugin

### **✅ Test & Utility Scripts**
- `check-existing-sellers.ts` - Utility for checking existing sellers
- `test-channel-isolation.ts` - Testing channel isolation
- `test-complete-signup-flow.ts` - Testing complete signup flow
- `fix-seller-channel-assignment.ts` - Utility for fixing channel assignments

---

## **Usage After Cleanup**

### **For Creating New Tenants:**
```bash
npx ts-node src/provision-tenant-via-service.ts \
  "Seller Name" \
  channel-code \
  admin@email.com \
  password \
  FirstName \
  LastName \
  6 \
  subdomain
```

### **For Creating/Updating Admins Only:**
```bash
npx ts-node src/create-admin-via-service.ts \
  email password firstName lastName roleId
```

---

## **Architecture Notes**

✅ **Roles are generic** (Role 6 = default) - NOT channel-specific  
✅ **Channel access via Supabase** `tenants` table (administrator → channel)  
❌ **NO role-to-channel mapping** (deprecated pattern removed)

See `ROLE_AND_CHANNEL_ARCHITECTURE.md` for complete architecture details.

