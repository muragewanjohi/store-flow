# 🔧 Channel Visibility Fix for Toys R Us Administrator

## **🎯 The Problem**

The administrator `info@toysrus.com` cannot see the `toys-r-us-demo-store` channel in the dashboard dropdown because:

1. The `administrator` role (ID: 3) is only assigned to **channel 1 (default)**
2. Vendure only shows channels that are explicitly assigned to a user's roles
3. We need to create a **channel-specific role** or update the existing role to include channel 7

## **✅ Solution: Use GraphiQL to Fix**

### **Step 1: Open GraphiQL**
Go to: `http://localhost:3000/graphiql/admin`

### **Step 2: Login as Superadmin**
Run this mutation first:

```graphql
mutation {
  login(username: "superadmin", password: "superadmin") {
    ... on CurrentUser {
      id
      identifier
    }
  }
}
```

### **Step 3: Create a Channel-Specific Role**

Run this mutation to create a new role for the Toys R Us channel:

```graphql
mutation {
  createRole(input: {
    code: "toys-r-us-admin"
    description: "Administrator for Toys R Us Demo Store"
    permissions: [
      Authenticated
      ReadCatalog
      CreateCatalog
      UpdateCatalog
      DeleteCatalog
      ReadCustomer
      CreateCustomer
      UpdateCustomer
      DeleteCustomer
      ReadOrder
      CreateOrder
      UpdateOrder
      DeleteOrder
      ReadSettings
      ReadPaymentMethod
      ReadShippingMethod
      ReadPromotion
      ReadChannel
      ReadAdministrator
    ]
    channelIds: ["7"]
  }) {
    id
    code
    description
    channels {
      id
      code
    }
  }
}
```

### **Step 4: Assign the New Role to the Administrator**

Get the role ID from Step 3 (let's say it's `6`), then run:

```graphql
mutation {
  updateAdministrator(input: {
    id: "8"
    roleIds: ["6"]
  }) {
    id
    emailAddress
    user {
      id
      roles {
        id
        code
        channels {
          id
          code
        }
      }
    }
  }
}
```

### **Step 5: Verify the Assignment**

Check what the administrator can now see:

```graphql
query {
  administrator(id: "8") {
    id
    emailAddress
    user {
      id
      roles {
        id
        code
        channels {
          id
          code
        }
      }
    }
  }
}
```

## **🎯 Expected Result**

After these steps:
1. Log out of the dashboard
2. Log back in as `info@toysrus.com` / `TestPass123!`
3. You should now see the **Toys R Us Demo Store** channel in the dropdown

## **🔍 Alternative: Update Existing Role to Include Both Channels**

If you want the administrator to see BOTH the default channel AND the Toys R Us channel, you can update the existing role:

```graphql
mutation {
  updateRole(input: {
    id: "3"
    channelIds: ["1", "7"]
  }) {
    id
    code
    channels {
      id
      code
    }
  }
}
```

Then the administrator will see both channels in the dropdown.

## **📋 Why This is Necessary**

In Vendure:
- **Roles** define what actions a user can perform
- **Roles** are assigned to **specific channels**
- **Administrators** can only see channels that their roles have access to
- If a role doesn't have `channelIds: [7]`, the administrator won't see channel 7

This is a **security feature** to ensure proper multi-tenant isolation!

---

**Try the GraphiQL approach now!** 🚀
