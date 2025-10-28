/**
 * GraphQL Mutation Test Script
 * 
 * This script tests the actual GraphQL mutations for seller provisioning.
 * Run this after starting the Vendure server.
 */

import fetch from 'node-fetch';

// Store cookies for session management
let sessionCookies: string[] = [];

const VENDURE_URL = 'http://localhost:3000/admin-api';

// Admin credentials
const ADMIN_CREDENTIALS = {
    username: process.env.SUPERADMIN_USERNAME || 'superadmin',
    password: process.env.SUPERADMIN_PASSWORD || 'superadmin'
};

// Test data
const TEST_DATA = {
    shopName: 'Demo Electronics Store',
    sellerEmail: 'demo@demo-electronics.com',
    sellerPassword: 'DemoPassword123!',
    firstName: 'Demo',
    lastName: 'User'
};

// Store authentication token
let authToken: string | null = null;

/**
 * Login as admin and get session cookie
 */
async function authenticate() {
    console.log('   Attempting login with credentials...');
    
    const mutation = `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser {
                    id
                    identifier
                }
                ... on InvalidCredentialsError {
                    errorCode
                    message
                }
            }
        }
    `;

    const response = await fetch(VENDURE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: mutation,
            variables: ADMIN_CREDENTIALS,
        }),
    });

    const result = await response.json() as any;
    
    if (result.errors || result.data?.login?.errorCode) {
        console.error('❌ Authentication failed:', result.errors || result.data?.login);
        return false;
    }

    // Extract all cookies from set-cookie headers
    const setCookieHeader = response.headers.raw()['set-cookie'];
    if (setCookieHeader && setCookieHeader.length > 0) {
        // Store all session cookies
        sessionCookies = setCookieHeader.map(cookie => cookie.split(';')[0]);
        console.log(`   Received ${sessionCookies.length} session cookie(s)`);
        console.log('✅ Authenticated successfully');
        console.log(`   User: ${result.data.login.identifier}`);
        return true;
    }

    console.error('❌ No session cookies received');
    return false;
}

/**
 * Execute GraphQL query/mutation with session cookies
 */
async function graphqlRequest(query: string, variables: any = {}) {
    try {
        const headers: any = {
            'Content-Type': 'application/json',
        };

        // Add session cookies if available
        if (sessionCookies.length > 0) {
            headers['Cookie'] = sessionCookies.join('; ');
        }

        const response = await fetch(VENDURE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                query,
                variables,
            }),
        });

        const result = await response.json() as any;
        
        if (result.errors) {
            console.error('GraphQL Errors:', result.errors);
            return null;
        }
        
        return result.data;
    } catch (error) {
        console.error('Request failed:', error);
        return null;
    }
}

/**
 * Test 1: Get Zones
 */
async function testGetZones() {
    console.log('🔍 Step 1: Getting zones...');
    
    const query = `
        query {
            zones {
                items {
                    id
                    name
                }
            }
        }
    `;
    
    const data = await graphqlRequest(query);
    
    if (data && data.zones && data.zones.items.length > 0) {
        console.log('✅ Zones found:', data.zones.items);
        return data.zones.items[0].id; // Return first zone ID
    } else {
        console.log('❌ No zones found');
        return '1'; // Fallback
    }
}

/**
 * Test 2: Get Roles
 */
async function testGetRoles() {
    console.log('🔍 Step 2: Getting roles...');
    
    const query = `
        query {
            roles {
                items {
                    id
                    code
                    description
                }
            }
        }
    `;
    
    const data = await graphqlRequest(query);
    
    if (data && data.roles && data.roles.items.length > 0) {
        console.log('✅ Roles found:', data.roles.items);
        return data.roles.items[0].id; // Return first role ID
    } else {
        console.log('❌ No roles found');
        return '1'; // Fallback
    }
}

/**
 * Test 3: Create Seller
 */
async function testCreateSeller() {
    console.log('🔍 Step 3: Creating seller...');
    
    const mutation = `
        mutation CreateSeller($input: CreateSellerInput!) {
            createSeller(input: $input) {
                id
                name
                createdAt
            }
        }
    `;
    
    const variables = {
        input: {
            name: TEST_DATA.shopName
        }
    };
    
    const data = await graphqlRequest(mutation, variables);
    
    if (data && data.createSeller) {
        console.log('✅ Seller created:', data.createSeller);
        return data.createSeller.id;
    } else {
        console.log('❌ Failed to create seller');
        return null;
    }
}

/**
 * Test 4: Create Channel
 */
async function testCreateChannel(sellerId: string, zoneId: string) {
    console.log('🔍 Step 4: Creating channel...');
    
    const mutation = `
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
    
    const channelCode = TEST_DATA.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    const variables = {
        input: {
            code: channelCode,
            token: `${channelCode}-token`,
            defaultLanguageCode: 'en',
            availableLanguageCodes: ['en'],
            pricesIncludeTax: false,
            defaultCurrencyCode: 'USD',
            availableCurrencyCodes: ['USD'],
            defaultTaxZoneId: zoneId,
            defaultShippingZoneId: zoneId,
            sellerId: sellerId
        }
    };
    
    const data = await graphqlRequest(mutation, variables);
    
    if (data && data.createChannel && data.createChannel.id) {
        console.log('✅ Channel created:', data.createChannel);
        return data.createChannel.id;
    } else {
        console.log('❌ Failed to create channel:', data?.createChannel);
        return null;
    }
}

/**
 * Test 5: Create Administrator
 */
async function testCreateAdministrator(roleId: string) {
    console.log('🔍 Step 5: Creating administrator...');
    
    const mutation = `
        mutation CreateAdministrator($input: CreateAdministratorInput!) {
            createAdministrator(input: $input) {
                id
                firstName
                lastName
                emailAddress
            }
        }
    `;
    
    const variables = {
        input: {
            firstName: TEST_DATA.firstName,
            lastName: TEST_DATA.lastName,
            emailAddress: TEST_DATA.sellerEmail,
            password: TEST_DATA.sellerPassword,
            roleIds: [roleId]
        }
    };
    
    const data = await graphqlRequest(mutation, variables);
    
    if (data && data.createAdministrator) {
        console.log('✅ Administrator created:', data.createAdministrator);
        return data.createAdministrator.id;
    } else {
        console.log('❌ Failed to create administrator');
        return null;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🧪 Starting GraphQL Mutation Tests...\n');
    
    try {
        // Step 0: Authenticate
        console.log('🔐 Authenticating...');
        const authenticated = await authenticate();
        if (!authenticated) {
            throw new Error('Authentication failed');
        }
        console.log('');
        
        // Step 1: Get zones
        const zoneId = await testGetZones();
        console.log('');
        
        // Step 2: Get roles
        const roleId = await testGetRoles();
        console.log('');
        
        // Step 3: Create seller
        const sellerId = await testCreateSeller();
        if (!sellerId) {
            throw new Error('Failed to create seller');
        }
        console.log('');
        
        // Step 4: Create channel
        const channelId = await testCreateChannel(sellerId, zoneId);
        if (!channelId) {
            throw new Error('Failed to create channel');
        }
        console.log('');
        
        // Step 5: Create administrator
        const administratorId = await testCreateAdministrator(roleId);
        if (!administratorId) {
            throw new Error('Failed to create administrator');
        }
        console.log('');
        
        console.log('🎉 All tests passed!');
        console.log('📊 Final Results:');
        console.log(`   - Seller ID: ${sellerId}`);
        console.log(`   - Channel ID: ${channelId}`);
        console.log(`   - Administrator ID: ${administratorId}`);
        console.log(`   - Email: ${TEST_DATA.sellerEmail}`);
        console.log(`   - Password: ${TEST_DATA.sellerPassword}`);
        console.log('\n✅ Demo Store seller provisioned successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}
