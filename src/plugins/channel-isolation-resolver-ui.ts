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
     */
    @Query()
    @Allow(Permission.Authenticated)
    async channels(@Ctx() ctx: RequestContext): Promise<{ items: Channel[]; totalItems: number }> {
        console.log(`[ChannelResolver] channels() method called`);
        
        const userId = ctx.activeUserId;
        console.log(`[ChannelResolver] activeUserId: ${userId}`);
        
        if (!userId) {
            console.log(`[ChannelResolver] No active user ID, returning empty`);
            return { items: [], totalItems: 0 };
        }

        // FIXED: Get administrator by user ID (activeUserId is user.id, not administrator.id)
        const administrator = await this.administratorService.findOneByUserId(ctx, userId);
        console.log(`[ChannelResolver] Administrator found: ${administrator ? 'YES' : 'NO'}`);
        
        if (!administrator) {
            console.log(`[ChannelResolver] No administrator found for user ID ${userId}`);
            return { items: [], totalItems: 0 };
        }
        
        console.log(`[ChannelResolver] Found administrator: ${administrator.emailAddress} (ID: ${administrator.id})`);

        // FIXED: Use the new user-based channel lookup instead of hardcoded email check
        const sellerChannelId = await this.getSellerChannelForUser(ctx, userId);
        
        if (sellerChannelId) {
            // This is a seller - only return their assigned channel, absolutely no others
            const sellerChannel = await this.channelService.findOne(ctx, sellerChannelId);
            if (sellerChannel && sellerChannel.id.toString() !== '1') {
                // Only return the assigned channel
                console.log(`[ChannelResolver] ✅ Seller ${administrator.id} (user ${userId}) sees ONLY channel: ${sellerChannel.code} (ID: ${sellerChannelId})`);
                return { items: [sellerChannel], totalItems: 1 };
            } else {
                // Either channel not found or is default channel (which is never allowed for sellers)
                console.log(`[ChannelResolver] ⚠️ Seller ${administrator.id} attempted to access forbidden/default channel (ID: ${sellerChannelId})`);
                return { items: [], totalItems: 0 };
            }
        } else {
            // This is a super admin - return all channels
            const allChannels = await this.channelService.findAll(ctx);
            console.log(`[ChannelResolver] ✅ Super admin ${administrator.id} (user ${userId}) sees all ${allChannels.items.length} channels`);
            return { items: allChannels.items, totalItems: allChannels.totalItems };
        }
    }

    /**
     * Override activeChannel query to automatically switch to seller's channel
     * This ensures sellers always see their assigned channel as active
     */
    @Query()
    @Allow(Permission.Authenticated)
    async activeChannel(@Ctx() ctx: RequestContext): Promise<Channel | null> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return null;
        }

        // Get the administrator for this user
        const administrator = await this.administratorService.findOneByUserId(ctx, userId);
        if (!administrator) {
            return null;
        }

        // Check if this administrator is a seller (has a specific channel)
        const sellerChannelId = await this.getSellerChannelForUser(ctx, userId);
        
        if (sellerChannelId) {
            // This is a seller - return their assigned channel as active
            const sellerChannel = await this.channelService.findOne(ctx, sellerChannelId);
            if (sellerChannel) {
                console.log(`[ChannelResolver] ✅ Active channel set to seller channel: ${sellerChannel.code} (ID: ${sellerChannelId})`);
                return sellerChannel;
            }
        }

        // For super admins or if no seller channel found, return the default channel
        const defaultChannel = await this.channelService.findOne(ctx, 1); // Default channel ID
        return defaultChannel || null;
    }

    /**
     * Override activeAdministrator query to ensure proper channel context
     */
    @Query()
    @Allow(Permission.Authenticated)
    async activeAdministrator(@Ctx() ctx: RequestContext): Promise<Administrator | null> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return null;
        }

        // FIXED: Get administrator by user ID (activeUserId is user.id, not administrator.id)
        const administrator = await this.administratorService.findOneByUserId(ctx, userId);
        if (!administrator) {
            return null;
        }

        // Check if this administrator is a seller using the new user-based mapping
        const sellerChannelId = await this.getSellerChannelForUser(ctx, userId);
        
        if (sellerChannelId) {
            console.log(`[ChannelResolver] Seller ${administrator.id} active - channel: ${sellerChannelId}`);
        } else {
            console.log(`[ChannelResolver] Super admin ${administrator.id} active`);
        }

        return administrator;
    }

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
