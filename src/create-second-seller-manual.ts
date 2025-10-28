/**
 * Manually create a second seller for testing channel isolation
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const VENDURE_URL = 'http://localhost:3000/admin-api';
const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let sessionCookies: string[] = [];

async function authenticate() {
    const mutation = `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser {
                    id
                    identifier
                }
            }
        }
    `;

    const response = await fetch(VENDURE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: mutation,
            variables: { username: 'superadmin', password: 'superadmin' }
        })
    });

    const setCookieHeader = response.headers.raw()['set-cookie'];
    if (setCookieHeader && setCookieHeader.length > 0) {
        sessionCookies = setCookieHeader.map(cookie => cookie.split(';')[0]);
        console.log('✅ Authenticated as superadmin\n');
        return true;
    }
    return false;
}

async function graphqlRequest(query: string, variables: any = {}) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (sessionCookies.length > 0) {
        headers['Cookie'] = sessionCookies.join('; ');
    }

    const response = await fetch(VENDURE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json() as any;
    if (result.errors) {
        console.error('GraphQL Errors:', result.errors);
    }
    return result.data;
}

async function createSecondSeller() {
    console.log('🚀 Creating Second Seller for Channel Isolation Testing\n');

    // Authenticate
    await authenticate();

    // Create Seller
    console.log('Step 1: Creating seller...');
    const createSellerMutation = `
        mutation CreateSeller($input: CreateSellerInput!) {
            createSeller(input: $input) {
                id
                name
            }
        }
    `;

    const sellerData = await graphqlRequest(createSellerMutation, {
        input: {
            name: 'Second Demo Store',
            customFields: {}
        }
    });

    const sellerId = sellerData?.createSeller?.id;
    console.log(`✅ Seller created: ID ${sellerId}\n`);

    // Create Channel
    console.log('Step 2: Creating channel...');
    const createChannelMutation = `
        mutation CreateChannel($input: CreateChannelInput!) {
            createChannel(input: $input) {
                ... on Channel {
                    id
                    code
                    token
                }
            }
        }
    `;

    const channelData = await graphqlRequest(createChannelMutation, {
        input: {
            code: 'second-demo-store',
            token: 'second-demo-store-token',
            defaultLanguageCode: 'en',
            currencyCode: 'USD',
            pricesIncludeTax: false,
            defaultShippingZoneId: '1',
            defaultTaxZoneId: '1',
            sellerId: sellerId
        }
    });

    const channelId = channelData?.createChannel?.id;
    const channelCode = channelData?.createChannel?.code;
    console.log(`✅ Channel created: ${channelCode} (ID: ${channelId})\n`);

    // Create Administrator
    console.log('Step 3: Creating administrator...');
    const createAdminMutation = `
        mutation CreateAdmin($input: CreateAdministratorInput!) {
            createAdministrator(input: $input) {
                id
                emailAddress
            }
        }
    `;

    const adminEmail = `second.seller${Date.now()}@example.com`;
    const adminData = await graphqlRequest(createAdminMutation, {
        input: {
            firstName: 'Second',
            lastName: 'Seller',
            emailAddress: adminEmail,
            password: 'TestPass123!',
            roleIds: ['2'] // Assuming role 2 exists
        }
    });

    const adminId = adminData?.createAdministrator?.id;
    console.log(`✅ Administrator created: ${adminEmail} (ID: ${adminId})\n`);

    // Update a tenant to use these new IDs
    console.log('Step 4: Updating tenant record...');
    
    // Get the second tenant (the one we just created)
    const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (tenants && tenants[0]) {
        const tenant = tenants[0];
        
        const { error } = await supabase
            .from('tenants')
            .update({
                vendure_seller_id: parseInt(sellerId),
                vendure_channel_id: parseInt(channelId),
                vendure_administrator_id: parseInt(adminId),
                status: 'active'
            })
            .eq('id', tenant.id);

        if (error) {
            console.error('Error updating tenant:', error);
        } else {
            console.log(`✅ Tenant updated: ${tenant.subdomain}\n`);
        }
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 Second Seller Created Successfully');
    console.log('='.repeat(70));
    console.log(`Seller ID:        ${sellerId}`);
    console.log(`Channel ID:       ${channelId}`);
    console.log(`Administrator ID: ${adminId}`);
    console.log(`Admin Email:      ${adminEmail}`);
    console.log(`Admin Password:   TestPass123!`);
    console.log('');
    console.log('🎯 Next: Run channel isolation tests');
    console.log('   npx ts-node src/test-channel-isolation.ts');
}

createSecondSeller().catch(console.error);

