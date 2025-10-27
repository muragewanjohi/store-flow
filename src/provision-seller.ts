/**
 * Seller Provisioning Script
 * 
 * This script demonstrates how to provision a complete seller with:
 * - Seller entity
 * - Channel for the seller
 * - Administrator account
 * 
 * Run this in GraphiQL or via a provisioning API
 */

// ===================================================================
// STEP 1: Create a Seller
// ===================================================================

export const CREATE_SELLER = `
  mutation CreateSeller($input: CreateSellerInput!) {
    createSeller(input: $input) {
      id
      name
      createdAt
    }
  }
`;

// Variables for Step 1:
/*
{
  "input": {
    "name": "Bob's Electronics"
  }
}
*/

// ===================================================================
// STEP 2: Create a Channel for the Seller
// ===================================================================

export const CREATE_CHANNEL = `
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
`;

// Variables for Step 2 (replace sellerId with the ID from Step 1):
/*
{
  "input": {
    "code": "bob-electronics",
    "token": "bob-electronics-token",
    "defaultLanguageCode": "en",
    "availableLanguageCodes": ["en"],
    "pricesIncludeTax": false,
    "defaultCurrencyCode": "USD",
    "availableCurrencyCodes": ["USD"],
    "defaultTaxZoneId": "1",
    "defaultShippingZoneId": "1",
    "sellerId": "<seller-id-from-step-1>"
  }
}
*/

// ===================================================================
// STEP 3: Create an Administrator for the Seller
// ===================================================================

export const CREATE_ADMINISTRATOR = `
  mutation CreateAdministrator($input: CreateAdministratorInput!) {
    createAdministrator(input: $input) {
      id
      firstName
      lastName
      emailAddress
    }
  }
`;

// Variables for Step 3 (replace roleIds with actual role IDs from GET_ROLES query):
/*
{
  "input": {
    "firstName": "Bob",
    "lastName": "Dobalina",
    "emailAddress": "bob@bobs-parts.com",
    "password": "test123",
    "roleIds": ["1", "2"]  // Add role IDs here!
  }
}
*/

// ===================================================================
// STEP 4: Query Roles (needed for Administrator creation)
// ===================================================================

export const GET_ROLES = `
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
`;

// Variables for Step 4:
/*
{
  // No variables needed - just run the query to get role IDs
}
*/

// ===================================================================
// STEP 5: Query Tax Zones (needed for Channel creation)
// ===================================================================

export const GET_TAX_ZONES = `
  query GetTaxZones {
    zones {
      items {
        id
        name
        members {
          id
          name
        }
      }
    }
  }
`;

// ===================================================================
// Example: Complete Seller Provisioning Flow
// ===================================================================

/*
To provision a seller, run these mutations in order:

1. Get Roles:
   - Run GET_ROLES to get role IDs (needed for administrator creation)
   - Save the role ID(s) you want to assign

2. Get Tax Zones:
   - Run GET_TAX_ZONES to get defaultTaxZoneId and defaultShippingZoneId

3. Create Seller:
   - Run CREATE_SELLER with seller name
   - Save the seller ID

4. Create Channel:
   - Run CREATE_CHANNEL with sellerId from step 3
   - Save the channel code and token

5. Create Administrator:
   - Run CREATE_ADMINISTRATOR with seller admin details and roleIds from step 1

6. Assign Administrator to Channel (optional):
   - Use assignRoleToAdministrator mutation to set up additional permissions
*/

// ===================================================================
// Alternative: Direct GraphQL in GraphiQL
// ===================================================================

/*
Copy and paste this into GraphiQL to get the tax zones:

query {
  zones {
    items {
      id
      name
    }
  }
}

Then use the first zone ID for both defaultTaxZoneId and defaultShippingZoneId
*/

