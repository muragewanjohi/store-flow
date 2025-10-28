# Verify Channel Isolation: Orders & Items

## 🎯 Goal
Verify that orders and products are properly isolated by seller channel.

---

## Step 1: See All Available Channels

### Query in GraphiQL (Admin API):

```graphql
query {
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

**Note the channel codes** - you should see:
- `default` - Default channel
- `test-seller` (or your seller channel name)
- Any other seller channels

---

## Step 2: Switch to Your Seller Channel

### In the Admin Dashboard:

1. **Click on "Default channel"** at the top-left
2. **Select your seller channel** from the dropdown
3. **Verify it's now active** (should show your channel name at top)

### To Verify Channel Switch:

```graphql
query {
  activeChannel {
    id
    code
    seller {
      id
      name
    }
  }
}
```

---

## Step 3: Test Orders Are Isolated

### Create an Order with Products from Your Channel:

#### A. Get Active Order:
```graphql
query {
  activeOrder {
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
      sellerChannelId
      quantity
    }
  }
}
```

#### B. Add Item to Order:
```graphql
mutation AddItemToOrder($productVariantId: ID!, $quantity: Int!) {
  addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
    ... on Order {
      id
      code
      lines {
        id
        productVariant {
          id
          name
        }
        sellerChannelId  # Should show your channel ID!
        quantity
      }
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
  "productVariantId": "1",  # Use a variant from your channel
  "quantity": 1
}
```

#### C. Check Orders in Your Channel:

```graphql
query GetOrdersInMyChannel {
  orders {
    items {
      id
      code
      state
      total
      lines {
        id
        productVariant {
          name
        }
        sellerChannelId  # Should be YOUR channel ID
      }
    }
  }
}
```

---

## Step 4: Verify Products Are Isolated

```graphql
query GetProductsInMyChannel {
  products {
    items {
      id
      name
      slug
      channels {
        id
        code  # Should include YOUR channel
      }
    }
  }
}
```

**Expected Result:**
- Only products assigned to YOUR channel
- Should NOT see products from other sellers

---

## Step 5: Test Multi-Vendor Order Splitting

### If you add products from multiple sellers to the same order:

```graphql
mutation AddMultipleItems {
  addItemToOrder(productVariantId: "1", quantity: 1) {
    ... on Order { id code }
  }
}

# Add item from another seller
addItemToOrder(productVariantId: "10", quantity: 1) {
  ... on Order { id code }
}
```

### Check if Order Splits:

```graphql
query CheckOrderSplit {
  order(id: "<order-id>") {
    id
    type
    sellerOrders {
      id
      code
      lines {
        id
        sellerChannelId
      }
    }
  }
}
```

---

## ✅ Success Criteria

When properly isolated, you should see:

1. **In Seller Channel View:**
   - ✅ Only YOUR products
   - ✅ Only YOUR orders
   - ✅ Each order line has YOUR `sellerChannelId`
   - ✅ Cannot see other sellers' data

2. **After Switching Channels:**
   - ✅ Different products show
   - ✅ Different orders show
   - ✅ `sellerChannelId` changes

3. **Multi-Vendor Orders:**
   - ✅ Orders split by seller
   - ✅ Each seller gets their own order
   - ✅ Commission tracked per seller

---

## 🔍 Troubleshooting

### If you can't see your seller channel:

1. **Check if channel exists:**
```graphql
query {
  channels {
    items {
      id
      code
      seller {
        id
        name
      }
    }
  }
}
```

2. **Verify administrator has access:**
```graphql
query {
  activeAdministrator {
    id
    emailAddress
    roles {
      code
    }
  }
}
```

### If `sellerChannelId` is NULL:

- Product must be in **2 channels** (default + seller channel)
- See `SELLER_PROVISIONING_GUIDE.md` for channel assignment

---

## 📊 Database Check

### Verify in Database:

```sql
-- Check order lines have sellerChannelId
SELECT 
    ol.id,
    ol."sellerChannelId",
    pv.name as product_name,
    c.code as seller_channel_code
FROM order_line ol
JOIN product_variant pv ON ol."productVariantId" = pv.id
LEFT JOIN channel c ON ol."sellerChannelId" = c.id
ORDER BY ol."createdAt" DESC
LIMIT 10;
```

**Expected:**
- `sellerChannelId` should have a value
- `seller_channel_code` shows the seller's channel

---

**Status:** Ready to test channel isolation!


