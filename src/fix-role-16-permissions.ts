/**
 * Fix Role 16 Permissions - Replace with Correct Permissions
 * 
 * Role 16 has corrupted permissions. This script replaces them with the correct list.
 */

import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 6543);
const DB_NAME = process.env.DB_NAME || 'vendure';
const DB_USERNAME = process.env.DB_USERNAME || 'vendure';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const STORE_ADMIN_PERMISSIONS = [
    'Authenticated',
    'UpdateGlobalSettings',
    'CreateCatalog',
    'ReadCatalog',
    'UpdateCatalog',
    'DeleteCatalog',
    'CreateSettings',
    'ReadSettings',
    'UpdateSettings',
    'DeleteSettings',
    'CreateAdministrator',
    'ReadAdministrator',
    'UpdateAdministrator',
    'DeleteAdministrator',
    'CreateAsset',
    'ReadAsset',
    'UpdateAsset',
    'DeleteAsset',
    'ReadChannel',
    'CreateCollection',
    'ReadCollection',
    'UpdateCollection',
    'DeleteCollection',
    'CreateCountry',
    'ReadCountry',
    'UpdateCountry',
    'DeleteCountry',
    'CreateCustomer',
    'ReadCustomer',
    'UpdateCustomer',
    'DeleteCustomer',
    'CreateCustomerGroup',
    'ReadCustomerGroup',
    'UpdateCustomerGroup',
    'DeleteCustomerGroup',
    'CreateFacet',
    'ReadFacet',
    'UpdateFacet',
    'DeleteFacet',
    'CreateOrder',
    'ReadOrder',
    'UpdateOrder',
    'DeleteOrder',
    'CreatePaymentMethod',
    'ReadPaymentMethod',
    'UpdatePaymentMethod',
    'DeletePaymentMethod',
    'CreateProduct',
    'ReadProduct',
    'UpdateProduct',
    'DeleteProduct',
    'CreatePromotion',
    'ReadPromotion',
    'UpdatePromotion',
    'DeletePromotion',
    'CreateShippingMethod',
    'ReadShippingMethod',
    'UpdateShippingMethod',
    'DeleteShippingMethod',
    'CreateTag',
    'ReadTag',
    'UpdateTag',
    'DeleteTag',
    'CreateTaxCategory',
    'ReadTaxCategory',
    'UpdateTaxCategory',
    'DeleteTaxCategory',
    'CreateTaxRate',
    'ReadTaxRate',
    'UpdateTaxRate',
    'DeleteTaxRate',
    'CreateSeller',
    'ReadSeller',
    'UpdateSeller',
    'DeleteSeller',
    'CreateStockLocation',
    'ReadStockLocation',
    'UpdateStockLocation',
    'DeleteStockLocation',
    'CreateSystem',
    'ReadSystem',
    'UpdateSystem',
    'DeleteSystem',
    'CreateZone',
    'ReadZone',
    'UpdateZone',
    'DeleteZone',
];

async function fixRolePermissions(roleId: number) {
    const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USERNAME, password: DB_PASSWORD });
    await client.connect();

    try {
        console.log(`\n🔧 Fixing corrupted permissions for role ${roleId}...\n`);

        // Verify role exists
        const roleResult = await client.query(
            `SELECT id, code, description FROM role WHERE id = $1`,
            [roleId]
        );

        if (roleResult.rows.length === 0) {
            console.log(`❌ Role ${roleId} not found`);
            return;
        }

        const role = roleResult.rows[0];
        console.log(`📋 Role: ${role.code} (${role.description || 'no description'})`);
        console.log(`   Current permissions: CORRUPTED (showing as individual characters)`);
        console.log(`   Replacing with ${STORE_ADMIN_PERMISSIONS.length} explicit permissions...`);

        await client.query('BEGIN');

        // Replace with correct permissions - ensure it's a proper array
        // Use JSON.stringify to ensure proper array format, then parse it back
        // This ensures pg library treats it as an array, not a string
        const permissionsArray = JSON.parse(JSON.stringify(STORE_ADMIN_PERMISSIONS));
        
        await client.query(
            `UPDATE role SET permissions = $1::text[], "updatedAt" = NOW() WHERE id = $2`,
            [permissionsArray, roleId]
        );

        await client.query('COMMIT');

        console.log(`\n✅ Successfully fixed role ${roleId} permissions`);
        console.log(`   Permissions: ${STORE_ADMIN_PERMISSIONS.length} explicit permissions`);
        console.log(`   Includes: Authenticated, ReadChannel, and all store management permissions`);
        console.log(`   Excludes: CreateChannel, UpdateChannel, DeleteChannel`);
        console.log(`\n💡 The user should now be able to log in successfully.`);

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
        console.log('Usage: npx ts-node src/fix-role-16-permissions.ts <roleId>');
        console.log('Example: npx ts-node src/fix-role-16-permissions.ts 16');
        console.log('   or: npx ts-node src/fix-role-16-permissions.ts 17');
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

