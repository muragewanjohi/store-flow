/**
 * Create an Administrator using Vendure services (bypasses GraphQL permission constraints)
 * 
 * NOTE: For full tenant provisioning (seller + channel + admin), use:
 *   npx ts-node src/provision-tenant-via-service.ts
 * 
 * This script is ONLY for creating/updating administrators when seller/channel already exist.
 * 
 * Usage:
 *   npx ts-node src/create-admin-via-service.ts info@carpetmasters.com supersecret Admin Carpet 6
 */

import { bootstrap } from '@vendure/core';
import { AdministratorService, ChannelService, RoleService, RequestContext } from '@vendure/core';
import { config } from './vendure-config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

// DB connection for role updates
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

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

async function main() {
    const [email, password, firstName, lastName, roleIdStr] = process.argv.slice(2);
    if (!email || !password || !firstName || !lastName || !roleIdStr) {
        console.log('Usage: ts-node src/create-admin-via-service.ts <email> <password> <firstName> <lastName> <roleId>');
        process.exit(1);
    }
    const roleId = Number(roleIdStr);

    const app = await bootstrap(config);
    const administratorService = app.get(AdministratorService);
    const channelService = app.get(ChannelService);
    const roleService = app.get(RoleService);

    try {
        const defaultChannel = await channelService.getDefaultChannel();

        const basicCtx = new RequestContext({
            apiType: 'admin',
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
            channel: defaultChannel,
        });

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

        // Ensure the bootstrap user has SuperAdmin role to grant roles
        try {
            await administratorService.update(superAdminCtx, { id: 1, roleIds: [1] });
        } catch {}

        // If admin exists, update role directly
        const existing = await administratorService.findAll(superAdminCtx, {
            filter: { emailAddress: { eq: email } },
            take: 1,
        } as any);

        if (existing && existing.items && existing.items.length > 0) {
            const admin = existing.items[0];
            console.log(`Found existing administrator: ${email} (ID: ${admin.id})`);
            console.log('Updating role...');
            await administratorService.update(superAdminCtx, {
                id: admin.id,
                firstName,
                lastName,
                roleIds: [roleId],
            });
            console.log(`✅ Administrator role updated: ${email} (ID: ${admin.id}) -> Role ${roleId}`);
        } else {
            console.log('Creating new administrator...');
            console.log('Step 1: Creating with SuperAdmin role (temporary)...');
            // Create with SuperAdmin role first to bypass permission check
            const created = await administratorService.create(superAdminCtx, {
                firstName,
                lastName,
                emailAddress: email,
                password,
                roleIds: [1], // Start with SuperAdmin
            });
            console.log(`✅ Administrator created: ${email} (ID: ${created.id})`);
            console.log(`   Initial role: SuperAdmin (1)`);

            if (roleId !== 1) {
                console.log(`Step 2: Updating to desired role ${roleId} via SQL...`);
                // Update role directly via SQL to bypass permission check
                await updateAdminRoleViaSQL(Number(created.user.id), roleId);
                console.log(`✅ Role updated to: ${roleId}`);

                // Verify the update by checking role details
                const targetRole = await roleService.findOne(superAdminCtx, roleId);
                if (targetRole) {
                    console.log(`   Verified role: ${targetRole.code || 'unknown'} (${targetRole.description || ''})`);
                }
            } else {
                console.log('✅ Administrator created with SuperAdmin role (no update needed)');
            }
        }

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


