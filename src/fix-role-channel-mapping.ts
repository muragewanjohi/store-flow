/**
 * Fix Role-Channel Mapping - Remove Default Channel Mapping
 * 
 * Removes default channel mapping from a role, keeping only the seller's specific channel.
 * 
 * Usage:
 *   npx ts-node src/fix-role-channel-mapping.ts <roleId> <channelId>
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

async function fixRoleChannelMapping(roleId: number, channelId: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        console.log(`\n🔧 Fixing role-channel mapping for role ${roleId}...\n`);

        // Get current mappings
        const currentMappings = await client.query(
            `SELECT c.id, c.code, c.token 
             FROM role_channels_channel rcc
             JOIN channel c ON c.id = rcc."channelId"
             WHERE rcc."roleId" = $1`,
            [roleId]
        );

        console.log(`📋 Current channel mappings for role ${roleId}:`);
        if (currentMappings.rows.length === 0) {
            console.log(`   No mappings found`);
        } else {
            currentMappings.rows.forEach((row: any) => {
                console.log(`   - Channel ${row.id}: ${row.code} (${row.token})`);
            });
        }

        await client.query('BEGIN');

        // Remove all mappings
        await client.query(
            `DELETE FROM role_channels_channel WHERE "roleId" = $1`,
            [roleId]
        );
        console.log(`\n   ✅ Removed all existing channel mappings`);

        // Add only the seller's channel mapping
        await client.query(
            `INSERT INTO role_channels_channel ("roleId", "channelId") 
             VALUES ($1, $2)`,
            [roleId, channelId]
        );
        console.log(`   ✅ Added mapping: Role ${roleId} → Channel ${channelId}`);

        await client.query('COMMIT');

        console.log(`\n✅ Successfully fixed role-channel mapping`);
        console.log(`   Role ${roleId} is now mapped ONLY to channel ${channelId}`);

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
    const [roleIdStr, channelIdStr] = process.argv.slice(2);

    if (!roleIdStr || !channelIdStr) {
        console.log('Usage: npx ts-node src/fix-role-channel-mapping.ts <roleId> <channelId>');
        console.log('Example: npx ts-node src/fix-role-channel-mapping.ts 18 28');
        process.exit(1);
    }

    const roleId = Number(roleIdStr);
    const channelId = Number(channelIdStr);
    
    if (isNaN(roleId) || isNaN(channelId)) {
        console.log(`❌ Invalid role ID or channel ID`);
        process.exit(1);
    }

    await fixRoleChannelMapping(roleId, channelId);
}

main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
});

