/**
 * Remove Channel Permissions from Existing Store Admin Roles
 * 
 * This script removes channel permissions (CreateChannel, ReadChannel, UpdateChannel, DeleteChannel)
 * from existing seller admin roles. Store admins should not manage channels - channel access
 * is controlled via role-channel mapping, not permissions.
 * 
 * Usage:
 *   npx ts-node src/remove-channel-permissions.ts <roleId>
 * 
 * Or to update all seller roles:
 *   npx ts-node src/remove-channel-permissions.ts --all
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Only remove channel management permissions, keep ReadChannel (required for accessing channel)
const CHANNEL_MANAGEMENT_PERMISSIONS = ['CreateChannel', 'UpdateChannel', 'DeleteChannel'];

async function removeChannelPermissions(roleId?: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        let rolesToUpdate: any[] = [];

        if (roleId) {
            // Update specific role
            const result = await client.query(
                `SELECT id, code, description, permissions FROM role WHERE id = $1`,
                [roleId]
            );
            
            if (result.rows.length === 0) {
                console.log(`❌ Role ${roleId} not found`);
                return;
            }
            
            rolesToUpdate = result.rows;
        } else {
            // Update all seller roles (roles with code starting with "seller-admin-")
            const result = await client.query(
                `SELECT id, code, description, permissions FROM role WHERE code LIKE 'seller-admin-%'`
            );
            
            if (result.rows.length === 0) {
                console.log(`⚠️  No seller roles found (roles with code 'seller-admin-*')`);
                return;
            }
            
            rolesToUpdate = result.rows;
        }

        console.log(`\n🔧 Removing channel permissions from ${rolesToUpdate.length} role(s)...\n`);

        await client.query('BEGIN');

        for (const role of rolesToUpdate) {
            // PostgreSQL arrays - ensure we have a proper array
            // The pg library returns arrays, but handle edge cases
            let currentPermissions: string[] = [];
            
            if (!role.permissions) {
                console.log(`⏭️  Role ${role.id} (${role.code}) - No permissions to process`);
                continue;
            }
            
            // Convert to array safely - same pattern as provisioning script
            try {
                // PostgreSQL arrays should already be arrays, but ensure type safety
                const perms = role.permissions;
                if (Array.isArray(perms)) {
                    currentPermissions = perms.map((p: any) => String(p));
                } else {
                    // Fallback: try to coerce to array
                    currentPermissions = Array.from(perms as any).map((p: any) => String(p));
                }
            } catch (e: any) {
                console.error(`⚠️  Could not parse permissions for role ${role.id}: ${e.message}`);
                console.error(`   Permissions value type: ${typeof role.permissions}`);
                continue;
            }
            
            // Check if role has any channel management permissions to remove
            const hasChannelManagementPerms = CHANNEL_MANAGEMENT_PERMISSIONS.some((cp) => currentPermissions.includes(cp));
            
            if (!hasChannelManagementPerms) {
                console.log(`⏭️  Role ${role.id} (${role.code}) - No channel management permissions to remove`);
                continue;
            }

            // Remove channel management permissions (but keep ReadChannel)
            const removedPerms = currentPermissions.filter((p: string) => CHANNEL_MANAGEMENT_PERMISSIONS.includes(p));
            const updatedPermissions = currentPermissions.filter(
                (p: string) => !CHANNEL_MANAGEMENT_PERMISSIONS.includes(p)
            );

            // Ensure Authenticated permission remains
            if (!updatedPermissions.includes('Authenticated')) {
                updatedPermissions.push('Authenticated');
            }

            // Update role
            await client.query(
                `UPDATE role SET permissions = $1::text[], "updatedAt" = NOW() WHERE id = $2`,
                [updatedPermissions, role.id]
            );

            console.log(`✅ Role ${role.id} (${role.code}):`);
            console.log(`   Removed: ${removedPerms.join(', ')}`);
            const hasReadChannel = updatedPermissions.includes('ReadChannel');
            if (hasReadChannel) {
                console.log(`   Kept: ReadChannel (required for accessing assigned channel)`);
            }
            console.log(`   Remaining permissions: ${updatedPermissions.length}`);
        }

        await client.query('COMMIT');

        console.log(`\n✅ Successfully updated ${rolesToUpdate.length} role(s)`);
        console.log(`\n💡 Note:`);
        console.log(`   - Removed: CreateChannel, UpdateChannel, DeleteChannel (channel management)`);
        console.log(`   - Kept: ReadChannel (required for accessing assigned channel)`);
        console.log(`   - Store admins can access their assigned channel but cannot manage channels`);

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
    const [arg] = process.argv.slice(2);

    if (!arg) {
        console.log('Usage: npx ts-node src/remove-channel-permissions.ts <roleId>');
        console.log('   or: npx ts-node src/remove-channel-permissions.ts --all');
        console.log('');
        console.log('Examples:');
        console.log('  npx ts-node src/remove-channel-permissions.ts 15  # Remove from role 15');
        console.log('  npx ts-node src/remove-channel-permissions.ts --all  # Remove from all seller roles');
        process.exit(1);
    }

    if (arg === '--all') {
        await removeChannelPermissions();
    } else {
        const roleId = Number(arg);
        if (isNaN(roleId)) {
            console.log(`❌ Invalid role ID: ${arg}`);
            process.exit(1);
        }
        await removeChannelPermissions(roleId);
    }
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

