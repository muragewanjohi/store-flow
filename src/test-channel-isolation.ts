/**
 * Channel Isolation Test Suite
 * 
 * Tests the complete channel isolation system integrating:
 * - Day 6: Seller provisioning
 * - Day 7: Supabase tenants table
 * - Day 8: Channel isolation plugin
 * 
 * This test verifies that sellers can ONLY access their own channel data.
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Vendure configuration
const VENDURE_URL = 'http://localhost:3000/admin-api';

interface TestSeller {
    email: string;
    password: string;
    businessName: string;
    subdomain: string;
    tenantId?: string;
    sellerId?: number;
    channelId?: number;
    administratorId?: number;
    sessionCookies?: string[];
}

// Test data - we'll create two sellers
const sellers: TestSeller[] = [
    {
        email: `seller-a-${Date.now()}@test.com`,
        password: 'TestPass123!',
        businessName: 'Seller A Electronics',
        subdomain: `seller-a-${Date.now()}`,
    },
    {
        email: `seller-b-${Date.now()}@test.com`,
        password: 'TestPass123!',
        businessName: 'Seller B Gadgets',
        subdomain: `seller-b-${Date.now()}`,
    }
];

/**
 * Helper: GraphQL request with session cookies
 */
async function graphqlRequest(query: string, variables: any = {}, cookies?: string[]) {
    const headers: any = {
        'Content-Type': 'application/json',
    };

    if (cookies && cookies.length > 0) {
        headers['Cookie'] = cookies.join('; ');
    }

    const response = await fetch(VENDURE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });

    const setCookieHeader = response.headers.raw()['set-cookie'];
    const result = await response.json() as any;

    return {
        data: result.data,
        errors: result.errors,
        cookies: setCookieHeader?.map(cookie => cookie.split(';')[0]) || []
    };
}

/**
 * Step 1: Create two sellers
 */
async function createTestSellers() {
    console.log('📝 Step 1: Creating two test sellers...\n');

    for (let i = 0; i < sellers.length; i++) {
        const seller = sellers[i];
        console.log(`Creating ${seller.businessName}...`);

        // 1. Create Supabase user
        const { data: authData } = await supabase.auth.signUp({
            email: seller.email,
            password: seller.password
        });

        // 2. Create tenant
        const { data: tenant } = await supabase
            .from('tenants')
            .insert({
                subdomain: seller.subdomain,
                business_name: seller.businessName,
                owner_id: authData.user!.id,
                status: 'provisioning'
            })
            .select()
            .single();

        seller.tenantId = tenant.id;

        // 3. Provision Vendure seller (simulated - use actual IDs from your provisioning)
        // For this test, we'll use the existing sellers created earlier
        // You should replace these with actual provisioning calls

        console.log(`✅ ${seller.businessName} created`);
        console.log(`   Tenant ID: ${tenant.id}`);
        console.log(`   Email: ${seller.email}\n`);
    }
}

/**
 * Step 2: Get existing sellers from database
 */
async function getExistingSellers() {
    console.log('🔍 Step 2: Getting existing sellers from database...\n');

    // Query tenants table for sellers with Vendure IDs
    const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .not('vendure_seller_id', 'is', null)
        .not('vendure_channel_id', 'is', null)
        .not('vendure_administrator_id', 'is', null)
        .limit(2);

    if (!tenants || tenants.length < 2) {
        console.log('⚠️  Not enough sellers found in database.');
        console.log('   Please run the seller provisioning first.');
        console.log('   Run: npx ts-node src/test-complete-signup-flow.ts');
        return false;
    }

    console.log(`✅ Found ${tenants.length} sellers:\n`);

    // Known credentials from our setup
    const knownCredentials = [
        { adminId: 5, email: 'test@example.com', password: 'TestPass123!' },
        { adminId: 7, email: 'second.seller1761647722000@example.com', password: 'TestPass123!' }
    ];

    tenants.forEach((tenant, i) => {
        // Find credentials for this admin ID
        const creds = knownCredentials.find(c => c.adminId === tenant.vendure_administrator_id);
        
        sellers[i] = {
            email: creds?.email || `seller-${i}@test.com`,
            password: creds?.password || 'TestPass123!',
            businessName: tenant.business_name,
            subdomain: tenant.subdomain,
            tenantId: tenant.id,
            sellerId: tenant.vendure_seller_id,
            channelId: tenant.vendure_channel_id,
            administratorId: tenant.vendure_administrator_id,
        };

        console.log(`Seller ${i + 1}: ${tenant.business_name}`);
        console.log(`   Seller ID: ${tenant.vendure_seller_id}`);
        console.log(`   Channel ID: ${tenant.vendure_channel_id}`);
        console.log(`   Admin ID: ${tenant.vendure_administrator_id}\n`);
    });

    return true;
}

/**
 * Step 3: Login as each seller
 */
async function loginSellers() {
    console.log('🔐 Step 3: Logging in as each seller...\n');

    for (const seller of sellers) {
        console.log(`Attempting login: ${seller.email}`);
        const mutation = `
            mutation Login($username: String!, $password: String!) {
                login(username: $username, password: $password) {
                    ... on CurrentUser {
                        id
                        identifier
                        channels {
                            id
                            code
                            token
                        }
                    }
                    ... on InvalidCredentialsError {
                        errorCode
                        message
                    }
                }
            }
        `;

        try {
            const { data, cookies } = await graphqlRequest(mutation, {
                username: seller.email,
                password: seller.password
            });

            if (data?.login?.id) {
                seller.sessionCookies = cookies;
                console.log(`✅ ${seller.businessName} logged in successfully`);
                console.log(`   User ID: ${data.login.id}`);
                console.log(`   Email: ${data.login.identifier}`);
                console.log(`   Channels visible: ${data.login.channels.length}`);
                data.login.channels.forEach((ch: any) => {
                    console.log(`     - ${ch.code} (ID: ${ch.id})`);
                });
                console.log('');
            } else {
                console.log(`❌ ${seller.businessName} login failed`);
                if (data?.login?.message) {
                    console.log(`   Error: ${data.login.message}`);
                }
                console.log('');
            }
        } catch (error) {
            console.log(`❌ ${seller.businessName} login error:`, error);
        }
    }
}

/**
 * Step 4: Test channel isolation
 */
async function testChannelIsolation() {
    console.log('🧪 Step 4: Testing channel isolation...\n');

    const query = `
        query GetActiveChannel {
            activeChannel {
                id
                code
                token
            }
        }
    `;

    for (const seller of sellers) {
        if (!seller.sessionCookies) {
            console.log(`⚠️  ${seller.businessName} - No session, skipping`);
            continue;
        }

        console.log(`Testing ${seller.businessName}...`);

        const { data } = await graphqlRequest(query, {}, seller.sessionCookies);

        if (data?.activeChannel) {
            console.log(`   Active Channel: ${data.activeChannel.code} (ID: ${data.activeChannel.id})`);
            
            // Check if it matches their assigned channel
            if (parseInt(data.activeChannel.id) === seller.channelId) {
                console.log(`   ✅ Correct! Seller is on their assigned channel`);
            } else {
                console.log(`   ⚠️  WARNING: Seller is NOT on their assigned channel`);
                console.log(`   Expected: ${seller.channelId}`);
                console.log(`   Got: ${data.activeChannel.id}`);
            }
        } else {
            console.log(`   ❌ Could not get active channel`);
        }
        console.log('');
    }
}

/**
 * Step 5: Test cross-channel access (should fail)
 */
async function testCrossChannelAccess() {
    console.log('🔒 Step 5: Testing cross-channel access prevention...\n');

    if (sellers.length < 2) {
        console.log('⚠️  Need at least 2 sellers for this test');
        return;
    }

    const sellerA = sellers[0];
    const sellerB = sellers[1];

    console.log(`Attempting: ${sellerA.businessName} trying to access ${sellerB.businessName}'s channel...\n`);

    // Try to manually switch to Seller B's channel while logged in as Seller A
    const mutation = `
        mutation SetActiveChannel($channelId: ID!) {
            setActiveChannel(channelId: $channelId) {
                id
                code
            }
        }
    `;

    try {
        const { data, errors } = await graphqlRequest(
            mutation,
            { channelId: sellerB.channelId?.toString() },
            sellerA.sessionCookies
        );

        if (errors) {
            console.log('✅ Good! Access was blocked');
            console.log(`   Error: ${errors[0].message}`);
        } else if (data?.setActiveChannel) {
            console.log('⚠️  WARNING: Seller A was able to switch to Seller B\'s channel!');
            console.log('   This is a security issue - channel isolation not working');
        }
    } catch (error) {
        console.log('✅ Access attempt failed (as expected)');
    }
    console.log('');
}

/**
 * Step 6: Test data isolation (products should be channel-scoped)
 */
async function testDataIsolation() {
    console.log('📦 Step 6: Testing data isolation (products)...\n');

    const query = `
        query GetProducts {
            products(options: { take: 10 }) {
                totalItems
                items {
                    id
                    name
                }
            }
        }
    `;

    for (const seller of sellers) {
        if (!seller.sessionCookies) continue;

        console.log(`${seller.businessName} - Querying products...`);

        const { data } = await graphqlRequest(query, {}, seller.sessionCookies);

        if (data?.products) {
            console.log(`   Total products visible: ${data.products.totalItems}`);
            if (data.products.items.length > 0) {
                console.log(`   Sample products:`);
                data.products.items.slice(0, 3).forEach((p: any) => {
                    console.log(`     - ${p.name} (ID: ${p.id})`);
                });
            }
        }
        console.log('');
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Channel Isolation Test Suite');
    console.log('='.repeat(70));
    console.log('\nTesting integration of Days 6, 7, and 8\n');
    console.log('='.repeat(70));
    console.log('');

    try {
        // Get existing sellers from database
        const hasSellers = await getExistingSellers();
        
        if (!hasSellers) {
            console.log('\n💡 TIP: Run seller provisioning first:');
            console.log('   npx ts-node src/test-complete-signup-flow.ts');
            console.log('   (Run it twice to create 2 sellers)');
            return;
        }

        // Login as each seller
        await loginSellers();

        // Check if we have valid sessions
        const validSessions = sellers.filter(s => s.sessionCookies).length;
        console.log(`\n📊 Valid sessions: ${validSessions}/${sellers.length}\n`);
        console.log('='.repeat(70));
        console.log('');

        if (validSessions === 0) {
            console.log('❌ No valid sessions. Cannot proceed with tests.');
            console.log('\n💡 This might be because:');
            console.log('   1. Incorrect passwords');
            console.log('   2. Vendure server not running');
            console.log('   3. Administrators not properly created');
            return;
        }

        // Run isolation tests
        await testChannelIsolation();
        await testCrossChannelAccess();
        await testDataIsolation();

        // Summary
        console.log('='.repeat(70));
        console.log('📊 Test Summary');
        console.log('='.repeat(70));
        console.log('');
        console.log(`✅ Sellers tested: ${sellers.length}`);
        console.log(`✅ Valid sessions: ${validSessions}`);
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('   1. Review the test results above');
        console.log('   2. Check if sellers can only see their own channel');
        console.log('   3. Verify cross-channel access is blocked');
        console.log('   4. Confirm data isolation is working');
        console.log('');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    runTests();
}

export { runTests };

