/**
 * Add ReadChannel Permission to Role
 * 
 * Adds ReadChannel permission to a role if it's missing.
 * ReadChannel is required for the activeChannel query to work.
 * 
 * Usage:
 *   npx ts-node src/add-readchannel-permission.ts <roleId>
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

async function addReadChannelPermission(roleId: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        console.log(`\n🔧 Adding ReadChannel permission to role ${roleId}...\n`);

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
        console.log(`   Current permissions: ${currentPermissions.length}`);

        // Check if ReadChannel already exists
        if (currentPermissions.includes('ReadChannel')) {
            console.log(`\n✅ Role already has ReadChannel permission`);
            return;
        }

        // Add ReadChannel permission
        await client.query('BEGIN');

        const updatedPermissions = [...currentPermissions, 'ReadChannel'];

        await client.query(
            `UPDATE role SET permissions = $1::text[], "updatedAt" = NOW() WHERE id = $2`,
            [updatedPermissions, roleId]
        );

        await client.query('COMMIT');

        console.log(`\n✅ Successfully added ReadChannel permission to role ${roleId}`);
        console.log(`   Role: ${role.code}`);
        console.log(`   Permissions before: ${currentPermissions.length}`);
        console.log(`   Permissions after: ${updatedPermissions.length}`);
        console.log(`\n💡 The activeChannel query should now work correctly.`);

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
        console.log('Usage: npx ts-node src/add-readchannel-permission.ts <roleId>');
        console.log('Example: npx ts-node src/add-readchannel-permission.ts 15');
        process.exit(1);
    }

    const roleId = Number(roleIdStr);
    if (isNaN(roleId)) {
        console.log(`❌ Invalid role ID: ${roleIdStr}`);
        process.exit(1);
    }

    await addReadChannelPermission(roleId);
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

