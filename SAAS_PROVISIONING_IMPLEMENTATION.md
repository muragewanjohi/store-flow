# SaaS Seller Provisioning Implementation

## 🎯 The Goal

When a tenant signs up in your SaaS app, automatically provision their Vendure seller account.

---

## 📋 Current State vs. Desired State

### **Current:** Manual Process
- User runs GraphQL mutations in GraphiQL
- One mutation at a time
- Manual copy/paste of IDs
- Tedious and error-prone

### **Desired:** Automated Process
- Tenant signs up in SaaS app
- Calls `/api/provision-seller` endpoint
- Receives credentials and channel details
- Fully automated

---

## 🏗️ Architecture

### **Flow:**

```
User Signup → Supabase Auth → Next.js API → Vendure Provisioning Service → Vendure Database
```

**Step-by-step:**

1. **User signs up** in your SaaS app (Next.js frontend)
2. **Creates Supabase account** (tenant management)
3. **Calls Next.js API** `/api/provision-seller` with tenant details
4. **API creates Vendure seller** (seller, channel, admin, etc.)
5. **Returns credentials** to user
6. **User can log in** to Vendure dashboard

---

## 📂 Where to Implement

### **Day 6 in Roadmap: "Seller Provisioning Script & API"**

**Files to Create:**

1. **`src/provision-seller-api.ts`** ✅ (Already created)
   - Service class for provisioning logic
   - Reusable across different entry points

2. **`src/api/provision-seller/route.ts`** (Next.js API route)
   - HTTP endpoint for your SaaS app
   - Receives signup payload
   - Calls provisioning service
   - Returns result

3. **Integration with Supabase Auth** (Next.js)
   - Hook into signup flow
   - Call provisioning API after account creation
   - Store mapping in Supabase

---

## 🔧 Implementation Steps

### **Step 1: Create Next.js API Endpoint**

Create `app/api/provision-seller/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SellerProvisioningService } from '@/src/provision-seller-api';
import { getVendureContext } from '@/lib/vendure-context';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { 
            shopName, 
            sellerEmail, 
            sellerPassword, 
            firstName, 
            lastName, 
            tenantId 
        } = body;

        // Get Vendure request context
        const ctx = await getVendureContext();

        // Create provisioning service
        const service = new SellerProvisioningService(
            // Inject Vendure services
        );

        // Provision the seller
        const result = await service.provisionSeller(ctx, {
            shopName,
            sellerEmail,
            sellerPassword,
            firstName,
            lastName,
            tenantId,
        });

        // Store mapping in Supabase
        await storeVendureMapping(tenantId, result);

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
```

### **Step 2: Integrate with Supabase Auth**

In your signup flow (Supabase Auth hook):

```typescript
// app/auth/callback/route.ts or similar
import { createClient } from '@/utils/supabase/server';

export async function handleSignUp(userId: string, userDetails: any) {
    // 1. Create tenant in Supabase
    const supabase = createClient();
    await supabase.from('tenants').insert({
        id: userId,
        name: userDetails.shopName,
        email: userDetails.email,
        created_at: new Date(),
    });

    // 2. Call Vendure provisioning API
    const response = await fetch('/api/provision-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shopName: userDetails.shopName,
            sellerEmail: userDetails.email,
            sellerPassword: generatePassword(), // or let user set it
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            tenantId: userId,
        }),
    });

    const result = await response.json();

    // 3. Store mapping in Supabase
    await supabase.from('vendure_mappings').insert({
        tenant_id: userId,
        seller_id: result.sellerId,
        channel_id: result.channelId,
        channel_code: result.channelCode,
    });
}
```

### **Step 3: Create Supabase Tables**

```sql
-- Map Supabase tenants to Vendure sellers
CREATE TABLE vendure_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id),
    seller_id VARCHAR(255) NOT NULL, -- Vendure seller ID
    channel_id VARCHAR(255) NOT NULL, -- Vendure channel ID
    channel_code VARCHAR(255) NOT NULL,
    channel_token VARCHAR(255) NOT NULL,
    administrator_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Track provisioning status
CREATE TABLE tenant_provisioning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id),
    status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 How It Works

### **Complete Flow:**

1. **User visits signup page** → `app/signup/page.tsx`
2. **Fills form** → shop name, email, password, etc.
3. **Submits** → Creates Supabase account + triggers provisioning
4. **API calls Vendure** → Creates seller, channel, admin
5. **User receives credentials** → Can log in to Vendure dashboard
6. **Can start creating products** → In their seller channel

---

## 📝 API Request Example

### **POST /api/provision-seller**

**Request:**
```json
{
    "shopName": "Bob's Electronics",
    "sellerEmail": "bob@example.com",
    "sellerPassword": "secure-password",
    "firstName": "Bob",
    "lastName": "Seller",
    "tenantId": "uuid-from-supabase"
}
```

**Response:**
```json
{
    "sellerId": "1",
    "channelId": "2",
    "channelCode": "bob-electronics",
    "channelToken": "bob-electronics-token",
    "administratorId": "3"
}
```

---

## 🧪 Testing

### **Test Manually:**

```bash
curl -X POST http://localhost:3000/api/provision-seller \
  -H "Content-Type: application/json" \
  -d '{
    "shopName": "Test Shop",
    "sellerEmail": "test@example.com",
    "sellerPassword": "test123",
    "firstName": "Test",
    "lastName": "User",
    "tenantId": "test-tenant-123"
  }'
```

### **Test in Your App:**

1. Go to signup page
2. Fill in details
3. Submit
4. Check Supabase `vendure_mappings` table
5. Verify seller created in Vendure

---

## 📍 Roadmap Integration

### **Day 6 Tasks:**
- ✅ Create `provision-seller-api.ts` (framework)
- ⬜ Implement actual Vendure service calls
- ⬜ Create Next.js API route
- ⬜ Integrate with Supabase signup
- ⬜ Add error handling
- ⬜ Test provisioning flow
- ⬜ Document API

### **When to Implement:**
- **Sprint 0, Day 6** - Core provisioning API
- **Sprint 1, Day 11-13** - SaaS integration & testing

---

## 🔐 Security Considerations

1. **Authentication:** Only authenticated users can call this
2. **Rate Limiting:** Prevent spam provisioning
3. **Validation:** Validate all inputs
4. **Error Handling:** Graceful failures
5. **Logging:** Track all provisioning attempts
6. **Rollback:** Handle partial failures

---

## 🎯 Next Steps

1. **Day 6:** Implement the provisioning service
2. **Day 7:** Connect to Supabase
3. **Day 8:** Add error handling and testing
4. **Week 2:** Test with real signups

**Status:** Framework created, ready for Day 6 implementation!

