/**
 * Check Role-Channel Mapping
 * 
 * Usage:
 *   npx ts-node src/check-role-channels.ts
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

async function checkRoleChannels() {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();
    
    try {
        // Check role 6 (working) and role 14 (not working)
        const result = await client.query(`
            SELECT 
                r.id as role_id,
                r.code as role_code,
                c.id as channel_id,
                c.code as channel_code
            FROM role r
            LEFT JOIN role_channels_channel rcc ON r.id = rcc."roleId"
            LEFT JOIN channel c ON c.id = rcc."channelId"
            WHERE r.id IN (6, 14)
            ORDER BY r.id, c.id
        `);
        
        console.log('\n📋 Role-Channel Mappings:\n');
        
        let currentRole = null;
        for (const row of result.rows) {
            if (currentRole !== row.role_id) {
                if (currentRole !== null) console.log('');
                currentRole = row.role_id;
                console.log(`Role: ${row.role_code} (ID: ${row.role_id})`);
            }
            
            if (row.channel_id) {
                console.log(`  ✅ Mapped to: ${row.channel_code} (Channel ${row.channel_id})`);
            } else {
                console.log(`  ❌ NOT mapped to any channel!`);
            }
        }
        
        // Check permissions
        console.log('\n\n🔑 Permission Check:\n');
        
        const permResult = await client.query(`
            SELECT 
                id,
                code,
                permissions
            FROM role
            WHERE id IN (6, 14)
        `);
        
        for (const role of permResult.rows) {
            console.log(`\nRole: ${role.code} (ID: ${role.id})`);
            let perms = role.permissions || [];
            if (typeof perms === 'string') {
                try {
                    perms = JSON.parse(perms);
                } catch {
                    perms = [];
                }
            }
            
            const hasAuth = perms.includes && perms.includes('Authenticated');
            const hasReadChannel = perms.includes && perms.includes('ReadChannel');
            const hasSuperAdmin = perms.includes && perms.includes('SuperAdmin');
            
            console.log(`  Permissions: ${Array.isArray(perms) ? perms.length : 'N/A'}`);
            console.log(`  ✅ Authenticated: ${hasAuth ? 'YES' : 'NO'}`);
            console.log(`  ✅ ReadChannel: ${hasReadChannel ? 'YES' : 'NO'}`);
            console.log(`  ✅ SuperAdmin: ${hasSuperAdmin ? 'YES' : 'NO'}`);
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkRoleChannels().catch(console.error);

