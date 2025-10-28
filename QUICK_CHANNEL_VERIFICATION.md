# Quick Channel Verification Guide

## 🔍 Step 1: See Your Seller Channel

### Run in GraphiQL (Admin API):

```graphql
query GetMyChannels {
  channels {
    items {
      id
      code
      token
      seller {
        id
        name
      }
    }
  }
}
```

**Copy your seller channel:**
- ID: `"2"` (example)
- Code: `"254_code"` or `"test-seller"`

---

## 🔄 Step 2: Switch Channel in Admin

Unfortunately, the Vendure admin UI doesn't have a "switch channel" button in GraphiQL.

**Workaround:** Switch using the dropdown at top-left in the admin dashboard UI.

**Or:** Include channel context in your queries.

---

## 🛒 Step 3: Test Order Creation

### A. Add Product to Order (Shop API):

```graphql
mutation AddToOrder($productVariantId: ID!, $quantity: Int!) {
  addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
    ... on Order {
      id
      code
      state
      lines {
        id
        productVariant {
          id
          name
          sku
        }
        sellerChannelId  # KEY FIELD - Should have value!
        quantity
      }
      total
    }
    ... on ErrorResult {
      errorCode
      message
    }
  }
}
```

**Variables:**
```json
{
  "productVariantId": "1",
  "quantity": 1
}
```

### B. Check Order Lines:

```graphql
query CheckOrderLines {
  activeOrder {
    id
    code
    lines {
      id
      sellerChannelId  # Check this field!
      productVariant {
        name
        sku
      }
      quantity
    }
  }
}
```

---

## ✅ Step 4: Verify Orders Are Isolated

### Check Orders Per Channel:

```graphql
query GetOrdersInChannel {
  orders {
    items {
      id
      code
      state
      lines {
        id
        sellerChannelId
        productVariant {
          id
          name
        }
      }
    }
  }
}
```

### Filter by Your Channel:

Check the `sellerChannelId` field on each order line. It should match your seller channel ID.

---

## 📊 Step 5: Verify Products Are Assigned

### Check Products in Your Channel:

```graphql
query GetProductsInChannel {
  products {
    items {
      id
      name
      slug
      channels {
        id
        code
        seller {
          name
        }
      }
    }
  }
}
```

**Look for:**
- `channels` array should include YOUR seller channel
- Should NOT include other sellers' channels (unless cross-listed)

---

## 🧪 Complete Test: Multi-Vendor Order

### Test Order with Multiple Sellers:

1. **Add item from Seller 1:**
```graphql
mutation {
  addItemToOrder(productVariantId: "1", quantity: 1) {
    ... on Order { id code }
  }
}
```

2. **Add item from Seller 2:**
```graphql
mutation {
  addItemToOrder(productVariantId: "10", quantity: 1) {
    ... on Order { id code }
  }
}
```

3. **Check the order splits:**
```graphql
query {
  order(id: "<order-id>") {
    id
    code
    lines {
      id
      productVariant {
        name
      }
      sellerChannelId  # Different for each seller!
    }
  }
}
```

---

## 📋 Checklist

- [ ] Query shows your seller channel exists
- [ ] Can add products to order
- [ ] `sellerChannelId` is populated on order lines
- [ ] Different sellers' products show different `sellerChannelId`
- [ ] Orders are split by seller when checked out

---

**If `sellerChannelId` is NULL:**
→ Product needs to be in 2 channels (default + seller channel)
→ See `SELLER_PROVISIONING_GUIDE.md`

