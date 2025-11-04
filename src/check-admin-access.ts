/**
 * Check Administrator Access and Role Assignment
 * 
 * Usage:
 *   npx ts-node src/check-admin-access.ts test3@seller.com
 */

import 'dotenv/config';
import { bootstrap } from '@vendure/core';
import {
    AdministratorService,
    RoleService,
    RequestContext,
    ChannelService,
    LanguageCode,
} from '@vendure/core';
import { config } from './vendure-config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

async function checkAdminRoles(email: string) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();
    try {
        // Get user ID from administrator email
        const userResult = await client.query(
            `SELECT u.id as user_id, a.id as admin_id, a."emailAddress"
             FROM "user" u
             JOIN administrator a ON a."userId" = u.id
             WHERE a."emailAddress" = $1`,
            [email]
        );

        if (userResult.rows.length === 0) {
            console.log(`❌ Administrator with email ${email} not found`);
            return;
        }

        const { user_id, admin_id } = userResult.rows[0];
        console.log(`\n📋 Administrator: ${email}`);
        console.log(`   User ID: ${user_id}`);
        console.log(`   Admin ID: ${admin_id}`);

        // Get roles assigned to this user
        const rolesResult = await client.query(
            `SELECT r.id, r.code, r.description, r.permissions
             FROM role r
             JOIN user_roles_role urr ON urr."roleId" = r.id
             WHERE urr."userId" = $1`,
            [user_id]
        );

        if (rolesResult.rows.length === 0) {
            console.log(`\n❌ No roles assigned to this user!`);
            console.log(`   This is likely why login is failing.`);
        } else {
            console.log(`\n✅ Assigned Roles (${rolesResult.rows.length}):`);
            for (const role of rolesResult.rows) {
                console.log(`\n   Role ID: ${role.id}`);
                console.log(`   Code: ${role.code}`);
                console.log(`   Description: ${role.description || '(no description)'}`);
                
                // Check if permissions include "Authenticated" (required for login)
                // Handle PostgreSQL array types - ensure it's a proper array
                let permissions: string[] = [];
                try {
                    if (Array.isArray(role.permissions)) {
                        permissions = role.permissions.map((p: any) => String(p));
                    } else if (role.permissions) {
                        permissions = Array.from(role.permissions as any).map((p: any) => String(p));
                    }
                } catch (e: any) {
                    console.error(`   ⚠️  Could not parse permissions: ${e.message}`);
                }
                
                const hasAuthenticated = permissions.includes('Authenticated');
                const hasSuperAdmin = permissions.includes('SuperAdmin');
                const hasReadChannel = permissions.includes('ReadChannel');
                
                console.log(`   Permissions: ${permissions.length} total`);
                if (hasAuthenticated) {
                    console.log(`   ✅ Has "Authenticated" permission (required for login)`);
                } else {
                    console.log(`   ❌ MISSING "Authenticated" permission! Login will fail!`);
                }
                if (hasSuperAdmin) {
                    console.log(`   ✅ Has "SuperAdmin" permission`);
                }
                if (hasReadChannel) {
                    console.log(`   ✅ Has "ReadChannel" permission (required for activeChannel query)`);
                } else {
                    console.log(`   ❌ MISSING "ReadChannel" permission! activeChannel query will fail!`);
                }
                
                // Show first few permissions
                if (permissions.length > 0) {
                    console.log(`   Sample permissions: ${permissions.slice(0, 5).join(', ')}${permissions.length > 5 ? '...' : ''}`);
                }

                // Check role-channel mapping
                const channelMappingResult = await client.query(
                    `SELECT c.id, c.code
                     FROM channel c
                     JOIN role_channels_channel rcc ON rcc."channelId" = c.id
                     WHERE rcc."roleId" = $1`,
                    [role.id]
                );

                if (channelMappingResult.rows.length > 0) {
                    console.log(`   Mapped to channels: ${channelMappingResult.rows.map((r: any) => `${r.code} (${r.id})`).join(', ')}`);
                } else {
                    console.log(`   ⚠️  No channels mapped to this role`);
                }
            }
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

async function main() {
    const [email] = process.argv.slice(2);

    if (!email) {
        console.log('Usage: npx ts-node src/check-admin-access.ts <email>');
        console.log('Example: npx ts-node src/check-admin-access.ts test3@seller.com');
        process.exit(1);
    }

    console.log(`🔍 Checking access for: ${email}\n`);

    // Check via database directly
    await checkAdminRoles(email);

    // Also check via Vendure service
    const app = await bootstrap(config);
    const adminService = app.get(AdministratorService);
    const channelService = app.get(ChannelService);

    try {
        const defaultChannel = await channelService.getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'admin',
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            channel: defaultChannel,
            languageCode: LanguageCode.en,
        });

        const admin = await adminService.findAll(ctx, {
            filter: { emailAddress: { eq: email } },
        } as any);

        if (admin.items.length > 0) {
            const a = admin.items[0];
            console.log(`\n\n✅ Vendure Service Confirms:`);
            console.log(`   Administrator exists: ${a.emailAddress} (ID: ${a.id})`);
            if (a.user) {
                console.log(`   User ID: ${a.user.id}`);
                console.log(`   User Roles: ${a.user.roles?.length || 0} roles assigned`);
            }
        }
    } catch (error: any) {
        console.error('\n❌ Error checking via Vendure service:', error.message);
    } finally {
        await app.close();
    }
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

