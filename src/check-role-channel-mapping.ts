/**
 * Check Role-Channel Mapping for Administrator
 * 
 * Diagnoses why dashboard menu items (Catalog, Sales, etc.) are missing.
 * Vendure requires role-channel mappings to display these menu items.
 * 
 * Usage:
 *   npx ts-node src/check-role-channel-mapping.ts finaltest@example.com
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

async function checkRoleChannelMapping(email: string) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        console.log(`\n🔍 Checking role-channel mapping for: ${email}\n`);

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
        console.log(`   Email: ${email}`);

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
            console.log(`   This is why menu items are missing.`);
            return;
        }

        console.log(`\n📋 Assigned Roles (${rolesResult.rows.length}):`);
        
        // Collect all role-channel mappings
        const roleMappings: Map<number, any[]> = new Map();
        let hasAnyMappings = false;

        for (const role of rolesResult.rows) {
            console.log(`   Role ID: ${role.id}`);
            console.log(`   Code: ${role.code}`);
            console.log(`   Description: ${role.description || '(no description)'}`);

            // Step 3: Check role-channel mapping
            const mappingResult = await client.query(
                `SELECT c.id, c.code
                 FROM channel c
                 JOIN role_channels_channel rcc ON rcc."channelId" = c.id
                 WHERE rcc."roleId" = $1`,
                [role.id]
            );

            roleMappings.set(role.id, mappingResult.rows);

            if (mappingResult.rows.length === 0) {
                console.log(`   ❌ NO CHANNELS MAPPED TO THIS ROLE!`);
                console.log(`   This is why menu items (Catalog, Sales, etc.) are missing.`);
                console.log(`   🔧 Fix: Run src/fix-menu-access.ts to add the mapping.`);
            } else {
                hasAnyMappings = true;
                console.log(`   ✅ Mapped to channels:`);
                mappingResult.rows.forEach((ch: any) => {
                    console.log(`      - ${ch.code} (ID: ${ch.id})`);
                });
            }
        }

        // Step 4: Get channel from Supabase tenants table
        const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('vendure_channel_id, vendure_administrator_id')
            .eq('vendure_administrator_id', admin_id)
            .eq('status', 'active')
            .limit(1)
            .single();

        if (tenantError) {
            console.log(`\n⚠️  Could not query Supabase tenants table:`, tenantError.message);
            console.log(`   This is normal if the tenant hasn't been linked yet.`);
        } else if (tenantData && tenantData.vendure_channel_id) {
            console.log(`\n📊 Supabase Tenant Mapping:`);
            console.log(`   Channel ID: ${tenantData.vendure_channel_id}`);
            console.log(`   Admin ID: ${tenantData.vendure_administrator_id}`);
            
            // Check if this channel is mapped to any of the user's roles
            const channelMapped = rolesResult.rows.some((role: any) => {
                const mappings = roleMappings.get(role.id) || [];
                return mappings.some((ch: any) => ch.id === tenantData.vendure_channel_id);
            });

            if (!channelMapped) {
                console.log(`\n❌ PROBLEM: Channel ${tenantData.vendure_channel_id} from Supabase is NOT mapped to any role!`);
                console.log(`   This is why menu items are missing.`);
                console.log(`   🔧 Fix: Run src/fix-menu-access.ts to add the mapping.`);
            } else {
                console.log(`   ✅ Channel is properly mapped to user's role(s)`);
            }
        }

        console.log(`\n💡 Summary:`);
        const hasMissingMappings = Array.from(roleMappings.values()).some((mappings) => mappings.length === 0);
        
        if (hasMissingMappings) {
            console.log(`   ❌ Missing role-channel mapping detected`);
            console.log(`   Run: npx ts-node src/fix-menu-access.ts ${email}`);
        } else {
            console.log(`   ✅ All roles have channel mappings`);
            console.log(`   If menu items are still missing, check browser console for errors.`);
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    } finally {
        await client.end();
    }
}

async function main() {
    const [email] = process.argv.slice(2);

    if (!email) {
        console.log('Usage: npx ts-node src/check-role-channel-mapping.ts <email>');
        console.log('Example: npx ts-node src/check-role-channel-mapping.ts finaltest@example.com');
        process.exit(1);
    }

    await checkRoleChannelMapping(email);
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

