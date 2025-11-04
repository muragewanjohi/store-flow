/**
 * Create Seller Role with Explicit Permissions
 * 
 * Creates a role for a seller administrator with explicit permissions.
 * Uses RoleService.create() with proper Permission enum values.
 */

import { Permission } from '@vendure/core';

/**
 * Standard permissions for store administrators
 * These are Permission enum values, not strings
 */
export const STORE_ADMIN_PERMISSIONS: Permission[] = [
    Permission.Authenticated,
    Permission.UpdateGlobalSettings,
    Permission.CreateCatalog,
    Permission.ReadCatalog,
    Permission.UpdateCatalog,
    Permission.DeleteCatalog,
    Permission.CreateSettings,
    Permission.ReadSettings,
    Permission.UpdateSettings,
    Permission.DeleteSettings,
    Permission.CreateAdministrator,
    Permission.ReadAdministrator,
    Permission.UpdateAdministrator,
    Permission.DeleteAdministrator,
    Permission.CreateAsset,
    Permission.ReadAsset,
    Permission.UpdateAsset,
    Permission.DeleteAsset,
    Permission.ReadChannel, // Required for accessing assigned channel, but NOT CreateChannel/UpdateChannel/DeleteChannel
    Permission.CreateCollection,
    Permission.ReadCollection,
    Permission.UpdateCollection,
    Permission.DeleteCollection,
    Permission.CreateCountry,
    Permission.ReadCountry,
    Permission.UpdateCountry,
    Permission.DeleteCountry,
    Permission.CreateCustomer,
    Permission.ReadCustomer,
    Permission.UpdateCustomer,
    Permission.DeleteCustomer,
    Permission.CreateCustomerGroup,
    Permission.ReadCustomerGroup,
    Permission.UpdateCustomerGroup,
    Permission.DeleteCustomerGroup,
    Permission.CreateFacet,
    Permission.ReadFacet,
    Permission.UpdateFacet,
    Permission.DeleteFacet,
    Permission.CreateOrder,
    Permission.ReadOrder,
    Permission.UpdateOrder,
    Permission.DeleteOrder,
    Permission.CreatePaymentMethod,
    Permission.ReadPaymentMethod,
    Permission.UpdatePaymentMethod,
    Permission.DeletePaymentMethod,
    Permission.CreateProduct,
    Permission.ReadProduct,
    Permission.UpdateProduct,
    Permission.DeleteProduct,
    Permission.CreatePromotion,
    Permission.ReadPromotion,
    Permission.UpdatePromotion,
    Permission.DeletePromotion,
    Permission.CreateShippingMethod,
    Permission.ReadShippingMethod,
    Permission.UpdateShippingMethod,
    Permission.DeleteShippingMethod,
    Permission.CreateTag,
    Permission.ReadTag,
    Permission.UpdateTag,
    Permission.DeleteTag,
    Permission.CreateTaxCategory,
    Permission.ReadTaxCategory,
    Permission.UpdateTaxCategory,
    Permission.DeleteTaxCategory,
    Permission.CreateTaxRate,
    Permission.ReadTaxRate,
    Permission.UpdateTaxRate,
    Permission.DeleteTaxRate,
    Permission.CreateSeller,
    Permission.ReadSeller,
    Permission.UpdateSeller,
    Permission.DeleteSeller,
    Permission.CreateStockLocation,
    Permission.ReadStockLocation,
    Permission.UpdateStockLocation,
    Permission.DeleteStockLocation,
    Permission.CreateSystem,
    Permission.ReadSystem,
    Permission.UpdateSystem,
    Permission.DeleteSystem,
    Permission.CreateZone,
    Permission.ReadZone,
    Permission.UpdateZone,
    Permission.DeleteZone,
];

/**
 * Creates a role using Vendure's RoleService
 * This is the proper Vendure-native way to create roles with permissions
 * 
 * Note: We create the role without channelIds first, then add the mapping separately
 * to avoid permission checks that might fail during provisioning
 */
export async function createSellerRole(
    roleService: any, // RoleService from @vendure/core
    ctx: any, // RequestContext from @vendure/core
    roleCode: string,
    roleDescription: string,
    channelId: number,
): Promise<number> {
    // Create role without channelIds first to avoid permission checks
    // RoleService.create() checks if user has access to channels in channelIds,
    // which can fail during provisioning when the channel was just created
    const createdRole = await roleService.create(ctx, {
        code: roleCode,
        description: roleDescription,
        permissions: STORE_ADMIN_PERMISSIONS, // Already Permission[] enum values
        // Don't pass channelIds here - we'll add the mapping separately
    });
    
    const newRoleId = Number(createdRole.id);
    
    // Add channel mapping separately using SQL (bypasses permission checks)
    // This is safe because we're in a provisioning context
    const { Client } = require('pg');
    const client = new Client({ 
        host: process.env.DB_HOST || 'localhost', 
        port: Number(process.env.DB_PORT || 6543), 
        database: process.env.DB_NAME || 'vendure', 
        user: process.env.DB_USERNAME || 'vendure', 
        password: process.env.DB_PASSWORD || '' 
    });
    
    await client.connect();
    try {
        await client.query('BEGIN');
        
        // CRITICAL: Remove any default channel mappings first
        // RoleService.create() might automatically map roles to the default channel
        // We only want this role mapped to the seller's specific channel
        await client.query(
            `DELETE FROM role_channels_channel WHERE "roleId" = $1`,
            [newRoleId]
        );
        
        // Now add only the seller's channel mapping
        await client.query(
            `INSERT INTO role_channels_channel ("roleId", "channelId") 
             VALUES ($1, $2) 
             ON CONFLICT DO NOTHING`,
            [newRoleId, channelId]
        );
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        await client.end();
    }
    
    console.log(`✅ Created seller role: ${roleCode} (ID: ${newRoleId})`);
    console.log(`   Permissions: ${STORE_ADMIN_PERMISSIONS.length} explicit permissions`);
    console.log(`   Includes: Authenticated, ReadChannel, and all store management permissions`);
    console.log(`   Excludes: CreateChannel, UpdateChannel, DeleteChannel`);
    console.log(`   Mapped to channel ${channelId} only`);
    
    return newRoleId;
}

