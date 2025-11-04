/**
 * Quick check of role 20 permissions
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

async function check() {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();
    
    try {
        const result = await client.query('SELECT permissions FROM role WHERE id = 20');
        const permissions = result.rows[0].permissions;
        
        console.log('Permissions array type:', Array.isArray(permissions) ? 'Array ✅' : 'Not Array ❌');
        console.log('Permissions count:', permissions.length);
        console.log('Has Authenticated:', permissions.includes('Authenticated'));
        console.log('Has ReadChannel:', permissions.includes('ReadChannel'));
        console.log('First 10 permissions:', permissions.slice(0, 10));
    } finally {
        await client.end();
    }
}

check();

