/**
 * Unified Tenant Provisioning Script using Vendure Services
 * 
 * This is the SINGLE script to use for creating complete tenant setups:
 * - Seller (marketplace seller)
 * - Channel (seller-specific store)
 * - Administrator (with role assignment via SQL)
 * - Supabase tenant link (for channel isolation)
 * 
 * Architecture:
 * - Roles are generic (Role 6 = default) - NOT channel-specific
 * - Channel access is controlled via Supabase tenants table (administrator → channel)
 * - NO role-to-channel mapping needed (see ROLE_AND_CHANNEL_ARCHITECTURE.md)
 * 
 * Usage:
 *   npx ts-node src/provision-tenant-via-service.ts \
 *     "Seller Name" \
 *     channel-code \
 *     admin@email.com \
 *     password \
 *     FirstName \
 *     LastName \
 *     6 \
 *     subdomain
 * 
 * Example:
 *   npx ts-node src/provision-tenant-via-service.ts \
 *     "Ruaka School Uniform" \
 *     ruaka-school-uniform-store \
 *     info@ruakaschooluniform.com \
 *     supersecret \
 *     Info \
 *     Ruaka \
 *     6 \
 *     ruaka-school-uniform
 */

import { bootstrap } from '@vendure/core';
import {
    AdministratorService,
    ChannelService,
    RoleService,
    SellerService,
    RequestContext,
    LanguageCode,
    CurrencyCode,
} from '@vendure/core';
import { config } from './vendure-config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');
import { createClient } from '@supabase/supabase-js';

// DB connection for role updates (via SQL to bypass permission checks)
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Supabase (SaaS) for tenants table
const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updateAdminRoleViaSQL(adminUserId: number, roleId: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();
    try {
        await client.query('BEGIN');
        // Remove existing roles
        await client.query(`DELETE FROM user_roles_role WHERE "userId" = $1;`, [adminUserId]);
        // Add the new role
        await client.query(
            `INSERT INTO user_roles_role ("userId", "roleId") VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [adminUserId, roleId]
        );
        await client.query('COMMIT');
        console.log(`✅ Updated admin user ${adminUserId} to role ${roleId} via SQL`);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        await client.end();
    }
}

/**
 * Creates a unique role for a seller using Vendure's RoleService
 * This ensures each seller gets their own role with consistent permissions, preventing cross-channel visibility
 */
async function createUniqueSellerRole(
    roleService: RoleService,
    ctx: RequestContext,
    templateRoleId: number, // Kept for backwards compatibility, but not used
    sellerName: string,
    channelId: number,
): Promise<number> {
    // Import the role creation function
    const { createSellerRole, STORE_ADMIN_PERMISSIONS } = require('./create-seller-role');
    
    // Create unique role code for this seller
    const roleCode = `seller-admin-${channelId}`;
    const roleDescription = `Administrator for ${sellerName} (Channel ${channelId})`;

    // Check if role already exists
    const allRoles = await roleService.findAll(ctx);
    const existingRole = allRoles.items.find((r) => r.code === roleCode);

    if (existingRole) {
        console.log(`✅ Unique seller role already exists: ${roleCode} (ID: ${existingRole.id})`);
        return Number(existingRole.id);
    }

    // Use Vendure's RoleService.create() - the proper Vendure-native way
    console.log(`   ℹ️  Creating role with explicit permissions using RoleService.create()`);
    console.log(`      Includes: Authenticated, ReadChannel, and all store management permissions`);
    console.log(`      Excludes: CreateChannel, UpdateChannel, DeleteChannel (channel management disabled)`);
    
    const newRoleId = await createSellerRole(roleService, ctx, roleCode, roleDescription, channelId);
    
    return newRoleId;
}

async function linkTenant(
    subdomain: string, 
    sellerName: string, 
    sellerId: number, 
    channelId: number, 
    channelToken: string,
    administratorId: number
) {
    // Check if tenant already exists
    const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('subdomain', subdomain)
        .single();
    
    if (existing) {
        // Update existing tenant
        const { error } = await supabase
            .from('tenants')
            .update({
                business_name: sellerName,
                vendure_seller_id: sellerId,
                vendure_channel_id: channelId,
                vendure_channel_token: channelToken, // Store channel token for Store API
                vendure_administrator_id: administratorId,
                status: 'active',
            })
            .eq('subdomain', subdomain);
        
        if (error) throw error;
        console.log(`✅ Tenant updated in Supabase: ${subdomain}`);
        console.log(`   Channel token stored: ${channelToken.substring(0, 20)}...`);
    } else {
        // Insert new tenant
        const { error } = await supabase.from('tenants').insert({
            subdomain,
            business_name: sellerName,
            vendure_seller_id: sellerId,
            vendure_channel_id: channelId,
            vendure_channel_token: channelToken, // Store channel token for Store API
            vendure_administrator_id: administratorId,
            status: 'active',
        });
        if (error) throw error;
        console.log(`✅ Tenant linked in Supabase: ${subdomain}`);
        console.log(`   Channel token stored: ${channelToken.substring(0, 20)}...`);
    }
}

async function addRoleChannelMapping(roleId: number, channelId: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();
    try {
        await client.query('BEGIN');
        
        // Check if mapping already exists
        const existing = await client.query(
            `SELECT * FROM role_channels_channel WHERE "roleId" = $1 AND "channelId" = $2`,
            [roleId, channelId]
        );
        
        if (existing.rows.length > 0) {
            console.log(`✅ Role-channel mapping already exists: Role ${roleId} → Channel ${channelId}`);
            await client.query('COMMIT');
            return;
        }
        
        // Add the mapping
        await client.query(
            `INSERT INTO role_channels_channel ("roleId", "channelId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [roleId, channelId]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Added role-channel mapping: Role ${roleId} → Channel ${channelId}`);
        console.log(`   This enables menu items (Catalog, Sales, etc.) for sellers`);
        console.log(`   Channel filtering ensures they only see their assigned channel`);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        await client.end();
    }
}

async function main() {
    const [
        sellerName,
        channelCode,
        adminEmail,
        adminPassword,
        adminFirst,
        adminLast,
        roleIdStr,
        subdomain,
    ] = process.argv.slice(2);

    if (!sellerName || !channelCode || !adminEmail || !adminPassword || !adminFirst || !adminLast || !roleIdStr || !subdomain) {
        console.log('Usage: npx ts-node src/provision-tenant-via-service.ts <sellerName> <channelCode> <adminEmail> <adminPassword> <firstName> <lastName> <roleId> <subdomain>');
        console.log('');
        console.log('Example:');
        console.log('  npx ts-node src/provision-tenant-via-service.ts \\');
        console.log('    "Ruaka School Uniform" \\');
        console.log('    ruaka-school-uniform-store \\');
        console.log('    info@ruakaschooluniform.com \\');
        console.log('    supersecret \\');
        console.log('    Info \\');
        console.log('    Ruaka \\');
        console.log('    6 \\');
        console.log('    ruaka-school-uniform');
        process.exit(1);
    }

    const roleId = Number(roleIdStr);

    console.log('🚀 Provisioning Tenant via Vendure Services\n');
    console.log(`Seller:       ${sellerName}`);
    console.log(`Channel:      ${channelCode}`);
    console.log(`Admin:        ${adminEmail}`);
    console.log(`Role ID:      ${roleId}`);
    console.log(`Subdomain:    ${subdomain}\n`);

    const app = await bootstrap(config);
    const administratorService = app.get(AdministratorService);
    const channelService = app.get(ChannelService);
    const roleService = app.get(RoleService);
    const sellerService = app.get(SellerService);

    try {
        const defaultChannel = await channelService.getDefaultChannel();

        const basicCtx = new RequestContext({
            apiType: 'admin',
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            channel: defaultChannel,
        });

        // Get SuperAdmin administrator for RequestContext
        const superAdminAdmin = await administratorService.findOne(basicCtx, 1);

        if (!superAdminAdmin) {
            throw new Error('SuperAdmin administrator (id=1) not found');
        }

        // Use the administrator's user directly (it's already loaded)
        const superAdminCtx = new RequestContext({
            apiType: 'admin',
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            channel: defaultChannel,
            session: {
                user: superAdminAdmin.user,
                activeChannelId: defaultChannel.id,
            } as any,
        });

        // Ensure bootstrap user has SuperAdmin role
        try {
            await administratorService.update(superAdminCtx, { id: 1, roleIds: [1] });
        } catch {}

        console.log('Step 1: Creating seller...');
        // Check if seller already exists
        const existingSellers = await sellerService.findAll(superAdminCtx);
        let seller = existingSellers.items.find((s) => s.name === sellerName);
        
        if (!seller) {
            seller = await sellerService.create(superAdminCtx, {
                name: sellerName,
                customFields: {},
            });
            console.log(`✅ Seller created: ${seller.name} (ID: ${seller.id})\n`);
        } else {
            console.log(`✅ Seller already exists: ${seller.name} (ID: ${seller.id})\n`);
        }

        console.log('Step 2: Creating channel...');
        // Check if channel already exists
        const existingChannels = await channelService.findAll(superAdminCtx);
        let channel = existingChannels.items.find((c) => c.code === channelCode);
        
        if (!channel) {
            const channelResult = await channelService.create(superAdminCtx, {
                code: channelCode,
                token: `${channelCode}-token`,
                defaultLanguageCode: LanguageCode.en,
                availableLanguageCodes: [LanguageCode.en],
                defaultCurrencyCode: CurrencyCode.USD,
                availableCurrencyCodes: [CurrencyCode.USD],
                pricesIncludeTax: false,
                defaultShippingZoneId: 1,
                defaultTaxZoneId: 1,
                sellerId: seller.id,
            });

            // Handle the union type result
            if ('errorCode' in channelResult) {
                throw new Error(`Failed to create channel: ${channelResult.message}`);
            }

            channel = channelResult;
            console.log(`✅ Channel created: ${channel.code} (ID: ${channel.id})`);
            console.log(`   Channel token: ${channel.token}\n`);
        } else {
            console.log(`✅ Channel already exists: ${channel.code} (ID: ${channel.id})`);
            console.log(`   Channel token: ${channel.token}\n`);
        }

        console.log('Step 3: Creating administrator with SuperAdmin role (temporary)...');
        // Check if admin already exists
        const existingAdmins = await administratorService.findAll(superAdminCtx, {
            filter: { emailAddress: { eq: adminEmail } },
            take: 1,
        } as any);

        let createdAdmin;
        if (existingAdmins && existingAdmins.items && existingAdmins.items.length > 0) {
            createdAdmin = existingAdmins.items[0];
            console.log(`✅ Administrator already exists: ${createdAdmin.emailAddress} (ID: ${createdAdmin.id})`);
            console.log(`   Current roles will be updated\n`);
        } else {
            // Create with SuperAdmin role first (roleId 1)
            createdAdmin = await administratorService.create(superAdminCtx, {
                firstName: adminFirst,
                lastName: adminLast,
                emailAddress: adminEmail,
                password: adminPassword,
                roleIds: [1], // Start with SuperAdmin to bypass permission check
            });
            console.log(`✅ Administrator created: ${createdAdmin.emailAddress} (ID: ${createdAdmin.id})`);
            console.log(`   Initial role: SuperAdmin (1)\n`);
        }

        console.log('Step 4: Creating unique seller role...');
        // Create a unique role for this seller (prevents cross-channel visibility)
        // Permissions are copied from the template role (roleId parameter)
        const uniqueRoleId = await createUniqueSellerRole(
            roleService,
            superAdminCtx,
            roleId, // Template role ID to copy permissions from
            sellerName,
            Number(channel.id),
        );
        console.log(`✅ Unique seller role created/retrieved: ${uniqueRoleId}\n`);

        console.log('Step 5: Assigning unique role to administrator...');
        // Update administrator to use the unique role
        await updateAdminRoleViaSQL(Number(createdAdmin.user.id), uniqueRoleId);
        console.log(`✅ Administrator assigned unique role: ${uniqueRoleId}\n`);

        // Verify the role
        const uniqueRole = await roleService.findOne(superAdminCtx, uniqueRoleId);
        if (uniqueRole) {
            console.log(`   Role: ${uniqueRole.code} (${uniqueRole.description || ''})`);
            console.log(`   Mapped to channels: ${uniqueRole.channels.map((c: any) => c.code).join(', ')}`);
        }

        console.log('\nStep 6: Linking tenant in Supabase...');
        // Store channel token so Store API can use the correct channel
        const channelToken = channel.token || `${channelCode}-token`;
        await linkTenant(
            subdomain, 
            sellerName, 
            Number(seller.id), 
            Number(channel.id), 
            channelToken,
            Number(createdAdmin.id)
        );

        console.log('\n' + '='.repeat(70));
        console.log('📊 Tenant Provisioned Successfully');
        console.log('='.repeat(70));
        console.log(`Seller ID:        ${seller.id}`);
        console.log(`Channel ID:       ${channel.id}`);
        console.log(`Channel Token:    ${channelToken}`);
        console.log(`Administrator ID: ${createdAdmin.id}`);
        console.log(`Admin Email:      ${adminEmail}`);
        console.log(`Admin Password:   ${adminPassword}`);
        console.log(`Unique Role ID:   ${uniqueRoleId}`);
        console.log(`Template Role:    ${roleId} (permissions copied from this)`);
        console.log(`Subdomain:        ${subdomain}`);
        console.log('');
        console.log('🎯 Next: Log in to test channel isolation');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        console.log('');
        console.log('📚 Architecture:');
        console.log(`   - Unique Role ${uniqueRoleId} (${uniqueRole?.code || 'unknown'}): Seller-specific`);
        console.log(`   - Mapped to Channel ${channel.id} only (prevents cross-channel visibility)`);
        console.log(`   - Permissions copied from template Role ${roleId}`);
        console.log(`   - Channel Isolation Plugin: Auto-scopes queries to channel ${channel.id}`);

    } catch (error: any) {
        if (error.code === 'EADDRINUSE') {
            console.error('\n❌ Error: Port already in use. Please stop the running Vendure server first.');
            console.error('   Run: Stop any running "npm run dev" processes');
        } else {
            console.error('\n❌ Error:', error.message);
            if (error.stack) {
                console.error('\nStack trace:');
                console.error(error.stack);
            }
        }
        process.exit(1);
    } finally {
        await app.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

