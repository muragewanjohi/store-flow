/**
 * Fix Role Permissions - Add Missing Authenticated and ReadChannel
 * 
 * Fixes roles that are missing critical permissions by adding them.
 * 
 * Usage:
 *   npx ts-node src/fix-role-permissions-batch.ts <roleId>
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

async function fixRolePermissions(roleId: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        console.log(`\n🔧 Fixing permissions for role ${roleId}...\n`);

        // Get current role
        const roleResult = await client.query(
            `SELECT id, code, description, permissions FROM role WHERE id = $1`,
            [roleId]
        );

        if (roleResult.rows.length === 0) {
            console.log(`❌ Role ${roleId} not found`);
            return;
        }

        const role = roleResult.rows[0];

        // Parse permissions
        let currentPermissions: string[] = [];
        try {
            if (Array.isArray(role.permissions)) {
                currentPermissions = role.permissions.map((p: any) => String(p));
            } else if (role.permissions) {
                currentPermissions = Array.from(role.permissions as any).map((p: any) => String(p));
            }
        } catch (e: any) {
            console.error(`❌ Could not parse permissions: ${e.message}`);
            return;
        }

        console.log(`📋 Current Role: ${role.code} (${role.description || 'no description'})`);
        console.log(`   Current permissions count: ${currentPermissions.length}`);
        
        // Check what's missing
        const needsAuthenticated = !currentPermissions.includes('Authenticated');
        const needsReadChannel = !currentPermissions.includes('ReadChannel');
        
        if (!needsAuthenticated && !needsReadChannel) {
            console.log(`\n✅ Role already has Authenticated and ReadChannel permissions`);
            return;
        }

        // Add missing permissions
        await client.query('BEGIN');

        const updatedPermissions = [...currentPermissions];
        
        if (needsAuthenticated) {
            updatedPermissions.unshift('Authenticated'); // Add at beginning
            console.log(`   ➕ Adding: Authenticated`);
        }
        
        if (needsReadChannel) {
            updatedPermissions.push('ReadChannel');
            console.log(`   ➕ Adding: ReadChannel`);
        }

        await client.query(
            `UPDATE role SET permissions = $1::text[], "updatedAt" = NOW() WHERE id = $2`,
            [updatedPermissions, roleId]
        );

        await client.query('COMMIT');

        console.log(`\n✅ Successfully fixed permissions for role ${roleId}`);
        console.log(`   Role: ${role.code}`);
        console.log(`   Permissions before: ${currentPermissions.length}`);
        console.log(`   Permissions after: ${updatedPermissions.length}`);
        if (needsAuthenticated) {
            console.log(`   ✅ Added Authenticated permission (required for login)`);
        }
        if (needsReadChannel) {
            console.log(`   ✅ Added ReadChannel permission (required for activeChannel query)`);
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
    const [roleIdStr] = process.argv.slice(2);

    if (!roleIdStr) {
        console.log('Usage: npx ts-node src/fix-role-permissions-batch.ts <roleId>');
        console.log('Example: npx ts-node src/fix-role-permissions-batch.ts 16');
        process.exit(1);
    }

    const roleId = Number(roleIdStr);
    if (isNaN(roleId)) {
        console.log(`❌ Invalid role ID: ${roleIdStr}`);
        process.exit(1);
    }

    await fixRolePermissions(roleId);
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

