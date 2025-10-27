# 🎯 Seller Provisioning Guide

## ❌ The Problem: `registerNewSeller` Doesn't Exist!

The mutation `registerNewSeller` **does not exist** in Vendure. You need to use multiple separate mutations.

---

## ✅ The Solution: Use These Mutations

### **Step 1: Get Tax Zones** (Required for Channel creation)

```graphql
query {
  zones {
    items {
      id
      name
    }
  }
}
```

**Save the zone ID** - you'll need it for `defaultTaxZoneId` and `defaultShippingZoneId`.

---

### **Step 2: Create a Seller**

```graphql
mutation CreateSeller($input: CreateSellerInput!) {
  createSeller(input: $input) {
    id
    name
    createdAt
  }
}
```

**Variables:**
```json
{
  "input": {
    "name": "Bob's Electronics"
  }
}
```

**Result:** Save the `id` field - you'll need it for Step 3!

---

### **Step 3: Create a Channel for the Seller**

```graphql
mutation CreateChannel($input: CreateChannelInput!) {
  createChannel(input: $input) {
    ... on Channel {
      id
      code
      token
      seller {
        id
        name
      }
    }
    ... on LanguageNotAvailableError {
      errorCode
      message
      languageCode
    }
  }
}
```

**Variables:** (Replace `sellerId` with the ID from Step 2, and zone IDs from Step 1)
```json
{
  "input": {
    "code": "bob-electronics",
    "token": "bob-electronics-token",
    "defaultLanguageCode": "en",
    "availableLanguageCodes": ["en"],
    "pricesIncludeTax": false,
    "defaultCurrencyCode": "USD",
    "availableCurrencyCodes": ["USD"],
    "defaultTaxZoneId": "<zone-id-from-step-1>",
    "defaultShippingZoneId": "<zone-id-from-step-1>",
    "sellerId": "<seller-id-from-step-2>"
  }
}
```

**Result:** Save the `code` and `token` fields.

---

### **Step 4: Get Roles** (Required for Administrator creation)

```graphql
query GetRoles {
  roles {
    items {
      id
      code
      description
      permissions {
        id
        name
      }
    }
  }
}
```

**Result:** Save the role `id` you want to assign to the administrator. Common roles include:
- `SuperAdmin` - Full access
- `ContentAdmin` - Content management
- `ProductAdmin` - Product management
- `OrderAdmin` - Order management
- `CustomerAdmin` - Customer management

---

### **Step 5: Create an Administrator for the Seller**

```graphql
mutation CreateAdministrator($input: CreateAdministratorInput!) {
  createAdministrator(input: $input) {
    id
    firstName
    lastName
    emailAddress
  }
}
```

**Variables:** (Replace `roleIds` with actual role IDs from Step 4)
```json
{
  "input": {
    "firstName": "Bob",
    "lastName": "Dobalina",
    "emailAddress": "bob@bobs-parts.com",
    "password": "test123",
    "roleIds": ["1", "2"]  // Add role IDs here!
  }
}
```

---

## 🚀 Quick Test in GraphiQL

### 1. Get Zones First
Run this query and copy the first zone ID:

```graphql
query {
  zones {
    items {
      id
      name
    }
  }
}
```

### 2. Create Seller
```graphql
mutation {
  createSeller(input: { name: "Test Seller" }) {
    id
    name
  }
}
```

### 3. Create Channel (replace IDs with actual values)
```graphql
mutation {
  createChannel(input: {
    code: "test-seller"
    token: "test-token"
    defaultLanguageCode: en
    availableLanguageCodes: [en]
    pricesIncludeTax: false
    defaultCurrencyCode: USD
    availableCurrencyCodes: [USD]
    defaultTaxZoneId: "1"
    defaultShippingZoneId: "1"
    sellerId: "2"
  }) {
    ... on Channel {
      id
      code
      seller {
        name
      }
    }
    ... on LanguageNotAvailableError {
      errorCode
      message
      languageCode
    }
  }
}
```

### 4. Get Roles (Do this first!)
```graphql
query {
  roles {
    items {
      id
      code
      description
    }
  }
}
```

**Copy the role ID** you want to use (commonly the first role with ID like "1" or "2").

### 5. Create Administrator (include roleIds!)
```graphql
mutation {
  createAdministrator(input: {
    firstName: "Test"
    lastName: "User"
    emailAddress: "test@example.com"
    password: "test123"
    roleIds: ["1"]  # Add the role ID(s) here!
  }) {
    id
    emailAddress
  }
}
```

---

## ⚠️ **Important: Channel Isolation**

When a seller logs in, they can see **all channels** in the dropdown. For proper multi-vendor SaaS:

**Option A: Quick Fix (Testing)**
- Manual channel switching is acceptable for testing
- Switch to seller's channel after login

**Option B: Production (Recommended)**
- Create **limited roles** for sellers (see `CHANNEL_ISOLATION_GUIDE.md`)
- Implement middleware to auto-switch to seller's channel
- Restrict channel dropdown visibility

See `CHANNEL_ISOLATION_GUIDE.md` for details.

---

## 📝 Why This Approach?

**Vendure doesn't have a single `registerNewSeller` mutation.** Instead:

1. The Seller entity is separate from the Channel
2. Channels must be created explicitly
3. Administrators must be created separately
4. This allows for more flexibility in how sellers are set up

The documentation you saw referencing `registerNewSeller` was likely describing the **conceptual flow** of what needs to happen, not an actual mutation name.

---

## 🔧 Next Steps

After provisioning sellers:

1. **Assign products to seller channels** (via product assignments)
2. **Set up shipping methods** per seller channel
3. **Create stock locations** for each seller
4. **Test multi-vendor order splitting**

---

## 📚 Related Files

- `src/provision-seller.ts` - Complete provisioning script reference
- `MULTI_VENDOR_SETUP.md` - Multi-vendor architecture overview
- `TESTING_GUIDE.md` - How to test multi-vendor functionality

---

**Status:** ✅ Ready to provision sellers using the correct mutations!

