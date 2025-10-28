# Seller Provisioning API Documentation

## Overview

The Seller Provisioning API automates the creation of complete seller accounts in Vendure when new tenants sign up for your SaaS platform. This API creates all necessary infrastructure including sellers, channels, administrators, and basic settings.

## Architecture

### Components

1. **SellerProvisioningService** - Core service that orchestrates the provisioning process
2. **SellerProvisioningPlugin** - Vendure plugin that registers the service
3. **HTTP API Endpoint** - REST endpoint for external SaaS integration
4. **Test Scripts** - Verification and testing utilities

### Provisioning Flow

```
Tenant Signup → SaaS API → Seller Provisioning Service → Vendure Infrastructure
     ↓
1. Create Seller Entity
2. Create Channel for Seller
3. Get Default Tax/Shipping Zones
4. Create Administrator Account
5. Create Default Shipping Method
6. Create Stock Location
7. Link Channel to Seller
```

## API Reference

### POST /api/provision-seller

Creates a complete seller account with all necessary infrastructure.

#### Request Body

```json
{
  "shopName": "Bob's Electronics",
  "sellerEmail": "bob@bobs-electronics.com",
  "sellerPassword": "SecurePassword123!",
  "firstName": "Bob",
  "lastName": "Dobalina",
  "tenantId": "supabase-tenant-id"
}
```

#### Response

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "sellerId": "1",
    "channelId": "2",
    "channelCode": "bobs-electronics",
    "channelToken": "bobs-electronics-token",
    "administratorId": "3"
  },
  "message": "Seller provisioned successfully"
}
```

**Error (400/500):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Stack trace (development only)"
}
```

## GraphQL Mutations

For manual testing or direct integration, you can use these GraphQL mutations:

### 1. Get Zones
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

### 2. Get Roles
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

### 3. Create Seller
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

### 4. Create Channel
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

**Variables:**
```json
{
  "input": {
    "code": "bobs-electronics",
    "token": "bobs-electronics-token",
    "defaultLanguageCode": "en",
    "availableLanguageCodes": ["en"],
    "pricesIncludeTax": false,
    "defaultCurrencyCode": "USD",
    "availableCurrencyCodes": ["USD"],
    "defaultTaxZoneId": "1",
    "defaultShippingZoneId": "1",
    "sellerId": "<seller-id-from-step-3>"
  }
}
```

### 5. Create Administrator
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

**Variables:**
```json
{
  "input": {
    "firstName": "Bob",
    "lastName": "Dobalina",
    "emailAddress": "bob@bobs-electronics.com",
    "password": "SecurePassword123!",
    "roleIds": ["<role-id-from-step-2>"]
  }
}
```

## Integration Guide

### 1. SaaS Application Integration

In your SaaS signup flow, call the provisioning API:

```typescript
// In your Next.js/Supabase API route
export async function POST(request: Request) {
  const { shopName, sellerEmail, sellerPassword, firstName, lastName, tenantId } = await request.json();
  
  // Call Vendure provisioning API
  const response = await fetch(`${process.env.VENDURE_API_URL}/api/provision-seller`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VENDURE_API_TOKEN}`,
    },
    body: JSON.stringify({
      shopName,
      sellerEmail,
      sellerPassword,
      firstName,
      lastName,
      tenantId,
    }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Store the Vendure IDs in your SaaS database
    await updateTenantWithVendureIds(tenantId, result.data);
    
    // Send welcome email with dashboard links
    await sendWelcomeEmail(sellerEmail, result.data);
  }
  
  return Response.json(result);
}
```

### 2. Environment Variables

Add these to your environment:

```env
# Vendure API Configuration
VENDURE_API_URL=http://localhost:3000
VENDURE_API_TOKEN=your-api-token

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vendure
DB_USERNAME=vendure
DB_PASSWORD=password

# Admin Credentials
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=superadmin
```

## Testing

### Manual Testing

1. **Start Vendure server:**
   ```bash
   npm run dev
   ```

2. **Run test script:**
   ```bash
   npm run test:provisioning
   ```

3. **Test GraphQL mutations:**
   - Open GraphiQL at `http://localhost:3000/admin-api`
   - Run the mutations in order
   - Verify results in the admin dashboard

### Automated Testing

```typescript
import { testSellerProvisioning } from './test-seller-provisioning';

describe('Seller Provisioning', () => {
  it('should provision seller successfully', async () => {
    await testSellerProvisioning();
  });
});
```

## Error Handling

### Common Errors

1. **No zones found**
   - **Cause:** No tax/shipping zones exist
   - **Solution:** Create zones in Vendure admin or seed data

2. **No roles found**
   - **Cause:** No administrator roles exist
   - **Solution:** Create roles in Vendure admin

3. **Channel code already exists**
   - **Cause:** Duplicate channel code
   - **Solution:** Use unique channel codes or check for existing channels

4. **Email already exists**
   - **Cause:** Administrator email already in use
   - **Solution:** Use unique email addresses

### Error Recovery

The service includes error recovery for optional components:
- Shipping methods (continues without if creation fails)
- Stock locations (continues without if creation fails)
- Non-critical infrastructure (logs warnings but continues)

## Security Considerations

1. **Authentication:** Implement proper API authentication
2. **Input Validation:** Validate all input parameters
3. **Rate Limiting:** Implement rate limiting for provisioning endpoints
4. **Audit Logging:** Log all provisioning activities
5. **Password Security:** Ensure strong password requirements

## Monitoring

### Key Metrics

- Provisioning success rate
- Average provisioning time
- Error rates by component
- Resource usage per seller

### Logging

The service logs:
- Successful provisioning events
- Error details with stack traces
- Performance metrics
- Security events

## Troubleshooting

### Debug Mode

Enable debug logging:

```typescript
// In your environment
DEBUG=vendure:seller-provisioning
```

### Common Issues

1. **Service injection errors**
   - Ensure all Vendure services are properly injected
   - Check plugin registration in vendure-config.ts

2. **Database connection issues**
   - Verify database credentials
   - Check network connectivity
   - Ensure database exists and is accessible

3. **Permission errors**
   - Verify administrator has necessary permissions
   - Check role assignments
   - Ensure proper authentication context

## Future Enhancements

1. **Bulk Provisioning:** Support for provisioning multiple sellers
2. **Template System:** Predefined seller templates
3. **Custom Fields:** Support for custom seller metadata
4. **Webhooks:** Integration with external systems
5. **Analytics:** Detailed provisioning analytics and reporting
