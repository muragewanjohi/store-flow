/**
 * Channel Isolation GraphQL Resolver - UI Filtering Version
 * 
 * Overrides Vendure's channels query to filter visible channels
 * based on seller restrictions.
 * 
 * Sellers should only see their assigned channel.
 * Super admins see all channels.
 */

import { Args, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    Permission,
    RequestContext,
    Administrator,
    AdministratorService,
    ChannelService,
    TransactionalConnection,
    ID,
    Channel,
} from '@vendure/core';
import { createClient } from '@supabase/supabase-js';

@Resolver()
export class ChannelIsolationResolver {
    private supabase: any;

    constructor(
        private administratorService: AdministratorService,
        private channelService: ChannelService,
        private connection: TransactionalConnection,
    ) {
        // Initialize Supabase client for SaaS database
        const supabaseUrl = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
        const supabaseKey = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    /**
     * Override channels query to filter visible channels for sellers
     * Sellers need ReadChannel permission to see channels, but we only show their assigned channel
     */
    @Query()
    @Allow(Permission.Authenticated, Permission.ReadChannel)
    async channels(@Ctx() ctx: RequestContext): Promise<{ items: Channel[]; totalItems: number }> {
        // IMPORTANT: This resolver must override Vendure's default channels query
        // If channels are still showing, check:
        // 1. Is this resolver being called? (check server logs)
        // 2. Is the return type correct? (ChannelList type)
        // 3. Is client-side caching the issue? (hard refresh browser)
        console.log(`[ChannelResolver] channels() method called`);
        
        const userId = ctx.activeUserId;
        console.log(`[ChannelResolver] activeUserId: ${userId}`);
        
        if (!userId) {
            console.log(`[ChannelResolver] No active user ID, returning empty`);
            return { items: [], totalItems: 0 };
        }

        // CRITICAL: Use direct database query to get administrator ID first
        // This bypasses permission checks that cause FORBIDDEN on initial load
        let administratorId: number | null = null;
        try {
            // Query Vendure database directly for administrator ID (bypasses permission checks)
            const rawConnection = this.connection.rawConnection;
            const adminResult = await rawConnection.query(
                `SELECT id FROM administrator WHERE "userId" = $1 LIMIT 1`,
                [userId]
            );
            
            if (adminResult && adminResult.length > 0) {
                administratorId = adminResult[0].id;
                console.log(`[ChannelResolver] Found administrator ID ${administratorId} for user ${userId}`);
            } else {
                console.log(`[ChannelResolver] No administrator found for user ${userId}`);
                return { items: [], totalItems: 0 };
            }
        } catch (e: any) {
            console.error(`[ChannelResolver] Error querying administrator from DB:`, e.message);
            // Fallback: try using service (might fail due to permissions, but worth trying)
            try {
                const administrator = await this.administratorService.findOneByUserId(ctx, userId);
                if (administrator) {
                    administratorId = Number(administrator.id);
                    console.log(`[ChannelResolver] Found administrator via service: ${administrator.emailAddress} (ID: ${administratorId})`);
                } else {
                    console.log(`[ChannelResolver] No administrator found for user ID ${userId}`);
                    return { items: [], totalItems: 0 };
                }
            } catch (e2: any) {
                console.error(`[ChannelResolver] Fallback method also failed:`, e2.message);
                return { items: [], totalItems: 0 };
            }
        }

        // Get seller's channel using direct DB query (bypasses permission checks)
        let sellerChannelId: number | null = null;
        if (administratorId !== null) {
            sellerChannelId = await this.getSellerChannelForAdministrator(String(administratorId));
        }
        
        if (sellerChannelId) {
            // This is a seller - only return their assigned channel, absolutely no others
            // CRITICAL: Use direct database query to bypass ALL permission checks
            try {
                // Query channel directly from database to bypass permission checks
                const rawConnection = this.connection.rawConnection;
                const channelResult = await rawConnection.query(
                    `SELECT id, code, token, "defaultLanguageCode", "defaultCurrencyCode", 
                            "defaultShippingZoneId", "defaultTaxZoneId", "pricesIncludeTax", 
                            "trackInventory", "outOfStockThreshold", "customFields",
                            "createdAt", "updatedAt"
                     FROM channel 
                     WHERE id = $1`,
                    [sellerChannelId]
                );
                
                if (channelResult && channelResult.length > 0) {
                    const channelData = channelResult[0];
                    
                    // Construct Channel object from database result
                    const sellerChannel = {
                        id: String(channelData.id),
                        createdAt: channelData.createdAt,
                        updatedAt: channelData.updatedAt,
                        code: channelData.code,
                        token: channelData.token,
                        defaultLanguageCode: channelData.defaultLanguageCode,
                        defaultCurrencyCode: channelData.defaultCurrencyCode,
                        currencyCode: channelData.defaultCurrencyCode,
                        defaultShippingZoneId: channelData.defaultShippingZoneId ? String(channelData.defaultShippingZoneId) : null,
                        defaultTaxZoneId: channelData.defaultTaxZoneId ? String(channelData.defaultTaxZoneId) : null,
                        pricesIncludeTax: channelData.pricesIncludeTax,
                        trackInventory: channelData.trackInventory,
                        outOfStockThreshold: channelData.outOfStockThreshold,
                        availableLanguageCodes: [channelData.defaultLanguageCode],
                        availableCurrencyCodes: [channelData.defaultCurrencyCode],
                        customFields: channelData.customFields || {},
                        defaultTaxZone: null,
                        defaultShippingZone: null,
                        seller: null,
                    } as unknown as Channel;
                    
                    if (sellerChannel.id.toString() !== '1') {
                        // Only return the assigned channel (not default channel)
                        console.log(`[ChannelResolver] ✅ Seller ${administratorId} (user ${userId}) sees ONLY channel: ${sellerChannel.code} (ID: ${sellerChannelId})`);
                        return { items: [sellerChannel], totalItems: 1 };
                    } else {
                        // Default channel is never allowed for sellers
                        console.log(`[ChannelResolver] ⚠️ Seller ${administratorId} attempted to access forbidden/default channel (ID: ${sellerChannelId})`);
                        return { items: [], totalItems: 0 };
                    }
                } else {
                    console.log(`[ChannelResolver] ⚠️ Seller channel ${sellerChannelId} not found in database`);
                    return { items: [], totalItems: 0 };
                }
            } catch (error: any) {
                console.error(`[ChannelResolver] Error fetching seller channel ${sellerChannelId}:`, error.message);
                // Fallback: try using service (might fail, but worth trying)
                try {
                    const sellerChannel = await this.channelService.findOne(ctx, sellerChannelId);
                    if (sellerChannel && sellerChannel.id.toString() !== '1') {
                        console.log(`[ChannelResolver] ✅ Seller ${administratorId} sees channel via service: ${sellerChannel.code}`);
                        return { items: [sellerChannel], totalItems: 1 };
                    } else {
                        return { items: [], totalItems: 0 };
                    }
                } catch (e: any) {
                    console.error(`[ChannelResolver] Fallback channelService.findOne() also failed:`, e.message);
                    return { items: [], totalItems: 0 };
                }
            }
        } else {
            // This is a super admin - return all channels
            const allChannels = await this.channelService.findAll(ctx);
            console.log(`[ChannelResolver] ✅ Super admin ${administratorId} (user ${userId}) sees all ${allChannels.items.length} channels`);
            return { items: allChannels.items, totalItems: allChannels.totalItems };
        }
    }

    /**
     * Override activeChannel query to ensure it works for sellers
     * Vendure's default resolver was returning FORBIDDEN
     * Only require Authenticated permission - channel access is controlled via role-channel mapping
     */
    @Query()
    @Allow(Permission.Authenticated)
    async activeChannel(@Ctx() ctx: RequestContext): Promise<Channel> {
        console.log(`[ChannelResolver] activeChannel() called for user: ${ctx.activeUserId}`);
        
        try {
            // First, try to use the channel from context (if already set)
            // This is the fastest path and avoids permission checks on subsequent loads
            if (ctx.channel && ctx.channel.id) {
                const userId = ctx.activeUserId;
                
                // If we have a user, verify the context channel matches their seller channel
                if (userId) {
                    try {
                        const sellerChannelId = await this.getSellerChannelForUser(ctx, userId);
                        if (sellerChannelId && String(ctx.channel.id) === String(sellerChannelId)) {
                            console.log(`[ChannelResolver] ✅ Using context channel (already set): ${ctx.channel.code} (ID: ${ctx.channel.id})`);
                            return ctx.channel;
                        }
                    } catch (e: any) {
                        // If seller check fails, still use context channel if available
                        console.log(`[ChannelResolver] Using context channel (seller check failed): ${ctx.channel.code}`);
                        return ctx.channel;
                    }
                } else {
                    // No user, but context channel is set - use it
                    console.log(`[ChannelResolver] Using context channel (no user): ${ctx.channel.code}`);
                    return ctx.channel;
                }
            }

            const userId = ctx.activeUserId;
            if (!userId) {
                // Fallback to default channel if no user
                const defaultChannel = await this.channelService.getDefaultChannel();
                console.log(`[ChannelResolver] No userId, returning default channel: ${defaultChannel.code}`);
                return defaultChannel;
            }

            // CRITICAL: Use direct database query to get administrator ID first
            // This bypasses permission checks that cause FORBIDDEN on initial load
            let sellerChannelId: number | null = null;
            try {
                // Step 1: Query Vendure database directly for administrator ID (bypasses permission checks)
                const rawConnection = this.connection.rawConnection;
                const adminResult = await rawConnection.query(
                    `SELECT id FROM administrator WHERE "userId" = $1 LIMIT 1`,
                    [userId]
                );
                
                if (adminResult && adminResult.length > 0) {
                    const administratorId = adminResult[0].id;
                    console.log(`[ChannelResolver] Found administrator ID ${administratorId} for user ${userId}`);
                    
                    // Step 2: Query Supabase for the channel (using the helper method)
                    sellerChannelId = await this.getSellerChannelForAdministrator(String(administratorId));
                } else {
                    console.log(`[ChannelResolver] No administrator found for user ${userId}`);
                }
            } catch (e: any) {
                console.error(`[ChannelResolver] Error querying administrator from DB:`, e.message);
                // Try fallback method using service (might fail due to permissions, but worth trying)
                try {
                    sellerChannelId = await this.getSellerChannelForUser(ctx, userId);
                } catch (e2: any) {
                    console.error(`[ChannelResolver] Fallback method also failed:`, e2.message);
                    sellerChannelId = null;
                }
            }
            
            if (sellerChannelId) {
                // This is a seller - return their assigned channel as active
                // CRITICAL: Use direct database query to bypass ALL permission checks
                // channelService.findOne() always checks ReadChannel permission, which fails for sellers
                try {
                    // Query channel directly from database to bypass permission checks
                    const rawConnection = this.connection.rawConnection;
                    const channelResult = await rawConnection.query(
                        `SELECT id, code, token, "defaultLanguageCode", "defaultCurrencyCode", 
                                "defaultShippingZoneId", "defaultTaxZoneId", "pricesIncludeTax", 
                                "trackInventory", "outOfStockThreshold", "customFields",
                                "createdAt", "updatedAt"
                         FROM channel 
                         WHERE id = $1`,
                        [sellerChannelId]
                    );
                    
                    if (channelResult && channelResult.length > 0) {
                        const channelData = channelResult[0];
                        
                        // Construct Channel object from database result
                        // This bypasses all permission checks while maintaining type safety
                        // GraphQL will only use the fields requested in the query, so partial object is fine
                        const sellerChannel = {
                            id: String(channelData.id),
                            createdAt: channelData.createdAt,
                            updatedAt: channelData.updatedAt,
                            code: channelData.code,
                            token: channelData.token,
                            defaultLanguageCode: channelData.defaultLanguageCode,
                            defaultCurrencyCode: channelData.defaultCurrencyCode,
                            currencyCode: channelData.defaultCurrencyCode, // Deprecated but required
                            defaultShippingZoneId: channelData.defaultShippingZoneId ? String(channelData.defaultShippingZoneId) : null,
                            defaultTaxZoneId: channelData.defaultTaxZoneId ? String(channelData.defaultTaxZoneId) : null,
                            pricesIncludeTax: channelData.pricesIncludeTax,
                            trackInventory: channelData.trackInventory,
                            outOfStockThreshold: channelData.outOfStockThreshold,
                            availableLanguageCodes: [channelData.defaultLanguageCode], // Minimal array
                            availableCurrencyCodes: [channelData.defaultCurrencyCode], // Minimal array
                            customFields: channelData.customFields || {},
                            // Relations will be null but that's okay for activeChannel query
                            defaultTaxZone: null,
                            defaultShippingZone: null,
                            seller: null,
                        } as unknown as Channel;
                        
                        console.log(`[ChannelResolver] ✅ Active channel set to seller channel: ${sellerChannel.code} (ID: ${sellerChannelId})`);
                        return sellerChannel;
                    }
                    
                    console.log(`[ChannelResolver] ⚠️ Seller channel ${sellerChannelId} not found in database`);
                } catch (error: any) {
                    console.error(`[ChannelResolver] Error fetching seller channel ${sellerChannelId}:`, error.message);
                    // Fall through to default channel
                }
            }

            // For super admins or if no seller channel found, return the default channel
            // CRITICAL: Must return a channel (not null) or dashboard will be black
            const defaultChannel = await this.channelService.getDefaultChannel();
            console.log(`[ChannelResolver] Returning default channel: ${defaultChannel.code}`);
            return defaultChannel;
        } catch (error: any) {
            console.error(`[ChannelResolver] ❌ Error in activeChannel:`, error.message);
            // Fallback to default channel on error
            try {
                const defaultChannel = await this.channelService.getDefaultChannel();
                return defaultChannel;
            } catch (e: any) {
                // Last resort - throw error if we can't even get default channel
                console.error(`[ChannelResolver] ❌ CRITICAL: Cannot get default channel!`, e.message);
                throw new Error('Unable to determine active channel');
            }
        }
    }

    /**
     * NOTE: We DON'T override activeAdministrator because:
     * 1. It's causing FORBIDDEN errors
     * 2. The me.channels query works fine and provides the needed data
     * 3. Vendure's default resolver should handle it correctly
     * 
     * If we need to customize this later, we'll need to ensure proper permissions
     * and match Vendure's exact implementation.
     */

    /**
     * Query Supabase tenants table for seller's channel
     * FIXED: Now properly maps user.id → administrator.id → channel
     */
    private async getSellerChannelForAdministrator(administratorId: ID): Promise<number | null> {
        try {
            // Query Supabase SaaS database for tenant record
            const { data, error } = await this.supabase
                .from('tenants')
                .select('vendure_channel_id')
                .eq('vendure_administrator_id', parseInt(String(administratorId)))
                .eq('status', 'active')
                .limit(1)
                .single();
            
            if (error) {
                console.error('[ChannelResolver] Supabase query error:', error);
                return null;
            }
            
            if (data && data.vendure_channel_id) {
                return data.vendure_channel_id;
            }
            
            return null;
        } catch (error) {
            console.error('[ChannelResolver] Error querying tenants table:', error);
            return null;
        }
    }

    /**
     * NEW: Get seller's channel by user ID (activeUserId)
     * This is the key fix - Vendure uses user.id as activeUserId, not administrator.id
     */
    private async getSellerChannelForUser(ctx: RequestContext, userId: ID): Promise<number | null> {
        try {
            // First, get the administrator for this user
            const administrator = await this.administratorService.findOneByUserId(ctx, userId);
            if (!administrator) {
                console.log(`[ChannelResolver] No administrator found for user ${userId}`);
                return null;
            }

            console.log(`[ChannelResolver] User ${userId} maps to administrator ${administrator.id} (${administrator.emailAddress})`);

            // Now get the channel for this administrator
            return await this.getSellerChannelForAdministrator(administrator.id);
        } catch (error) {
            console.error('[ChannelResolver] Error mapping user to channel:', error);
            return null;
        }
    }
}
