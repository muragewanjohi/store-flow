/**
 * Fix Dashboard Menu Access
 * 
 * Adds missing role-channel mapping to enable menu items (Catalog, Sales, etc.)
 * Vendure requires role_channels_channel entries to display these menu items.
 * 
 * Usage:
 *   npx ts-node src/fix-menu-access.ts finaltest@example.com
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');
import { createClient } from '@supabase/supabase-js';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Supabase (SaaS) for tenants table
const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixMenuAccess(email: string) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        console.log(`\n🔧 Fixing menu access for: ${email}\n`);

        // Step 1: Get administrator and user info
        const adminResult = await client.query(
            `SELECT u.id as user_id, a.id as admin_id, a."emailAddress"
             FROM "user" u
             JOIN administrator a ON a."userId" = u.id
             WHERE a."emailAddress" = $1`,
            [email]
        );

        if (adminResult.rows.length === 0) {
            console.log(`❌ Administrator with email ${email} not found`);
            return;
        }

        const { user_id, admin_id } = adminResult.rows[0];
        console.log(`✅ Administrator found:`);
        console.log(`   User ID: ${user_id}`);
        console.log(`   Admin ID: ${admin_id}`);

        // Step 2: Get assigned roles
        const rolesResult = await client.query(
            `SELECT r.id, r.code, r.description
             FROM role r
             JOIN user_roles_role urr ON urr."roleId" = r.id
             WHERE urr."userId" = $1`,
            [user_id]
        );

        if (rolesResult.rows.length === 0) {
            console.log(`\n❌ No roles assigned to this user!`);
            console.log(`   Cannot fix menu access without a role.`);
            return;
        }

        console.log(`\n📋 Found ${rolesResult.rows.length} role(s):`);
        rolesResult.rows.forEach((role: any) => {
            console.log(`   - Role ${role.id}: ${role.code}`);
        });

        // Step 3: Get channel from Supabase tenants table
        const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('vendure_channel_id, vendure_administrator_id')
            .eq('vendure_administrator_id', admin_id)
            .eq('status', 'active')
            .limit(1)
            .single();

        if (tenantError || !tenantData || !tenantData.vendure_channel_id) {
            console.log(`\n❌ Could not find channel in Supabase tenants table`);
            console.log(`   Error: ${tenantError?.message || 'No tenant record found'}`);
            console.log(`   This account may need to be provisioned first.`);
            return;
        }

        const channelId = tenantData.vendure_channel_id;
        console.log(`\n📊 Supabase Tenant Mapping:`);
        console.log(`   Channel ID: ${channelId}`);

        // Step 4: Verify channel exists in Vendure
        const channelResult = await client.query(
            `SELECT id, code FROM channel WHERE id = $1`,
            [channelId]
        );

        if (channelResult.rows.length === 0) {
            console.log(`\n❌ Channel ${channelId} not found in Vendure!`);
            console.log(`   This channel may have been deleted.`);
            return;
        }

        const channel = channelResult.rows[0];
        console.log(`   Channel: ${channel.code} (ID: ${channel.id})`);

        // Step 5: Add role-channel mappings for all assigned roles
        await client.query('BEGIN');

        let mappingsAdded = 0;
        let mappingsSkipped = 0;

        for (const role of rolesResult.rows) {
            // Check if mapping already exists
            const existingMapping = await client.query(
                `SELECT * FROM role_channels_channel 
                 WHERE "roleId" = $1 AND "channelId" = $2`,
                [role.id, channelId]
            );

            if (existingMapping.rows.length > 0) {
                console.log(`\n   ⏭️  Role ${role.id} (${role.code}) already mapped to channel ${channelId}`);
                mappingsSkipped++;
            } else {
                // Add the mapping
                await client.query(
                    `INSERT INTO role_channels_channel ("roleId", "channelId") 
                     VALUES ($1, $2) 
                     ON CONFLICT DO NOTHING`,
                    [role.id, channelId]
                );
                console.log(`\n   ✅ Added mapping: Role ${role.id} (${role.code}) → Channel ${channelId} (${channel.code})`);
                mappingsAdded++;
            }
        }

        await client.query('COMMIT');

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 Summary`);
        console.log(`${'='.repeat(70)}`);
        console.log(`Mappings added: ${mappingsAdded}`);
        console.log(`Mappings skipped (already exist): ${mappingsSkipped}`);
        
        if (mappingsAdded > 0) {
            console.log(`\n✅ Menu access fixed!`);
            console.log(`\n📝 Next steps:`);
            console.log(`   1. Refresh your browser (hard refresh: Ctrl+Shift+R)`);
            console.log(`   2. You should now see: Catalog, Sales, Customers, Settings, etc.`);
            console.log(`   3. Channel dropdown should still only show: ${channel.code}`);
        } else {
            console.log(`\n✅ All role-channel mappings already exist`);
            console.log(`   If menu items are still missing, check:`);
            console.log(`   - Browser console for errors (F12)`);
            console.log(`   - Server logs for resolver messages`);
        }

    } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        await client.end();
    }
}

async function main() {
    const [email] = process.argv.slice(2);

    if (!email) {
        console.log('Usage: npx ts-node src/fix-menu-access.ts <email>');
        console.log('Example: npx ts-node src/fix-menu-access.ts finaltest@example.com');
        process.exit(1);
    }

    await fixMenuAccess(email);
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

