import { 
    VendurePlugin, 
    PluginCommonModule, 
    RequestContext,
    ChannelService,
    AdministratorService,
    TransactionalConnection,
    ID
} from '@vendure/core';
import { Injectable } from '@nestjs/common';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ChannelIsolationResolver } from './channel-isolation-resolver-ui';

@Injectable()
export class ChannelIsolationService {
    constructor(
        private channelService: ChannelService,
        private administratorService: AdministratorService,
        private connection: TransactionalConnection,
    ) {}

    /**
     * Get the seller's assigned channel by querying the Supabase tenants table
     * FIXED: Now properly maps user.id → administrator.id → channel
     * 
     * This integrates with Day 7's SaaS database schema where:
     * - tenants.vendure_administrator_id links to Vendure administrator.id (INTEGER)
     * - tenants.vendure_channel_id stores the seller's channel ID (INTEGER)
     */
    async getSellerChannelForAdministrator(ctx: RequestContext, administratorId: ID): Promise<number | null> {
        try {
            // Query the external Supabase database for the tenant record
            // Note: This requires database connection to your Supabase database
            // For now, we'll query Vendure's local database if you've synced the data
            
            const rawConnection = this.connection.rawConnection;
            
            // Query to find the channel ID for this administrator
            const result = await rawConnection.query(
                `SELECT vendure_channel_id 
                 FROM tenants 
                 WHERE vendure_administrator_id = $1 
                 AND status = 'active'
                 LIMIT 1`,
                [parseInt(String(administratorId))]
            );
            
            if (result && result.length > 0 && result[0].vendure_channel_id) {
                return result[0].vendure_channel_id;
            }
            
            return null;
        } catch (error) {
            console.error('[ChannelIsolation] Error fetching seller channel:', error);
            return null;
        }
    }

    /**
     * NEW: Get seller's channel by user ID (activeUserId)
     * This is the key fix - Vendure uses user.id as activeUserId, not administrator.id
     */
    async getSellerChannelForUser(ctx: RequestContext, userId: ID): Promise<number | null> {
        try {
            // First, get the administrator for this user
            const administrator = await this.administratorService.findOneByUserId(ctx, userId);
            if (!administrator) {
                console.log(`[ChannelIsolation] No administrator found for user ${userId}`);
                return null;
            }

            console.log(`[ChannelIsolation] User ${userId} maps to administrator ${administrator.id} (${administrator.emailAddress})`);

            // Now get the channel for this administrator
            return await this.getSellerChannelForAdministrator(ctx, administrator.id);
        } catch (error) {
            console.error('[ChannelIsolation] Error mapping user to channel:', error);
            return null;
        }
    }

    /**
     * Alternative: Get channel using Vendure's built-in channel-seller relationship
     * Use this if you're not connecting to Supabase directly
     */
    async getSellerChannelFromVendure(ctx: RequestContext, administratorId: ID): Promise<ID | null> {
        try {
            // Get all channels with seller information
        const channels = await this.channelService.findAll(ctx);
        
            // Find the channel that belongs to a seller linked to this administrator
            // This assumes your channels have sellerId field
            for (const channel of channels.items) {
                const channelWithDetails = await this.channelService.findOne(ctx, channel.id);
                
                // Check if this channel has a seller
                if ((channelWithDetails as any).sellerId) {
                    // In a full implementation, you'd check if this seller's
                    // administrator matches the given administratorId
                    // For now, return the first channel with a seller
                    return channel.id;
                }
        }

        return null;
        } catch (error) {
            console.error('[ChannelIsolation] Error fetching channel from Vendure:', error);
            return null;
        }
    }

    /**
     * Switch the request context to the seller's channel
     */
    async switchToSellerChannel(ctx: RequestContext, sellerChannelId: ID) {
        try {
        const channel = await this.channelService.findOne(ctx, sellerChannelId);
        
        if (channel) {
                console.log(`[ChannelIsolation] Switching to channel: ${channel.code} (ID: ${channel.id})`);
                
            // Create a new request context with the seller's channel
            const newCtx = new RequestContext({
                    req: ctx.req as any,
                apiType: ctx.apiType,
                    channel: channel,
                languageCode: ctx.languageCode,
                    isAuthorized: ctx.isAuthorized,
                    authorizedAsOwnerOnly: ctx.authorizedAsOwnerOnly,
                    session: ctx.session,
            });

            return newCtx;
        }

            console.warn(`[ChannelIsolation] Channel ${sellerChannelId} not found`);
            return ctx;
        } catch (error) {
            console.error('[ChannelIsolation] Error switching channel:', error);
        return ctx;
    }
}

    /**
     * Check if an administrator is restricted to a specific channel
     * FIXED: Now uses user.id → administrator.id mapping
     * (i.e., they are a seller, not a super admin)
     */
    async isSellerAdministrator(ctx: RequestContext, userId: ID): Promise<boolean> {
        try {
            const channelId = await this.getSellerChannelForUser(ctx, userId);
            return channelId !== null;
        } catch (error) {
            console.error('[ChannelIsolation] Error checking if seller admin:', error);
            return false;
        }
    }

    /**
     * Get all accessible channels for an administrator
     * FIXED: Now uses user.id → administrator.id mapping
     * For sellers, this returns only their assigned channel
     * For super admins, this returns all channels
     */
    async getAccessibleChannels(ctx: RequestContext, userId: ID): Promise<ID[]> {
        try {
            // Check if this is a seller (has a specific channel)
            const sellerChannelId = await this.getSellerChannelForUser(ctx, userId);
            
            if (sellerChannelId) {
                // Seller: only their channel
                return [sellerChannelId as unknown as ID];
            }
            
            // Super admin: all channels
            const allChannels = await this.channelService.findAll(ctx);
            return allChannels.items.map(c => c.id);
        } catch (error) {
            console.error('[ChannelIsolation] Error getting accessible channels:', error);
            return [];
        }
    }
}

/**
 * Channel Isolation Plugin
 * 
 * Complete multi-vendor channel isolation system.
 * 
 * Features:
 * - Auto-switch to seller's channel on every request (via middleware)
 * - Filter visible channels in GraphQL responses (via resolver)
 * - Block unauthorized channel access (via resolver)
 * - Integrate with Supabase tenants table (Days 6, 7, 8)
 * 
 * Components:
 * - ChannelIsolationService: Core utilities
 * - ChannelIsolationMiddleware: Request-level enforcement (see channel-isolation-middleware.ts)
 * - ChannelIsolationResolver: GraphQL filtering (see channel-isolation-resolver.ts)
 * - ChannelAwareAuthStrategy: Login integration (see channel-aware-auth-strategy.ts)
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [ChannelIsolationService],
    adminApiExtensions: {
        resolvers: [ChannelIsolationResolver],
    },
    configuration: config => {
        // Register middleware for active enforcement
        // Note: Middleware registration happens in vendure-config.ts
        // This is just configuration setup
        return config;
    },
})
export class ChannelIsolationPlugin implements OnApplicationBootstrap {
    async onApplicationBootstrap() {
        console.log('✅ Channel Isolation Plugin initialized');
        console.log('   - Service: ChannelIsolationService');
        console.log('   - Middleware: Apply in vendure-config.ts');
        console.log('   - Resolver: Add to adminApiExtensions');
        console.log('   - Auth Strategy: Add to authOptions');
        console.log('   - UI Extension: Channel filter provider');
    }
}

/**
 * ============================================================================
 * USAGE INSTRUCTIONS
 * ============================================================================
 * 
 * This plugin provides channel isolation for multi-vendor marketplaces.
 * It integrates with the Supabase tenants table to map administrators to channels.
 * 
 * 
 * STEP 1: Add to vendure-config.ts
 * ============================================================================
 * 
 * import { ChannelIsolationPlugin } from './plugins/channel-isolation-plugin';
 * 
 * export const config: VendureConfig = {
 *   plugins: [
 *     ChannelIsolationPlugin,
 *     // ... other plugins
 *   ],
 * };
 * 
 * 
 * STEP 2: Database Setup
 * ============================================================================
 * 
 * Option A: If using the same database for Vendure and Supabase tables:
 *   - The plugin will automatically query the tenants table
 *   - No additional setup needed
 * 
 * Option B: If using separate databases:
 *   - Set up a database link or connection pool
 *   - Modify the SQL query to connect to external database
 *   - Or sync tenants data to Vendure database periodically
 * 
 * 
 * STEP 3: Test Channel Isolation
 * ============================================================================
 * 
 * 1. Create two sellers using the provisioning script
 * 2. Login as Seller A
 * 3. Check ctx.channel - should be Seller A's channel
 * 4. Try to access Seller B's data - should fail
 * 
 * 
 * STEP 4: Use in Your Resolvers
 * ============================================================================
 * 
 * @Resolver()
 * export class ProductResolver {
 *   constructor(private channelIsolation: ChannelIsolationService) {}
 * 
 *   @Query()
 *   async products(@Ctx() ctx: RequestContext) {
 *     // Get administrator from session
 *     const adminId = ctx.activeUserId;
 * 
 *     // Check if this is a seller (has channel restriction)
 *     const isSeller = await this.channelIsolation.isSellerAdministrator(ctx, adminId);
 * 
 *     if (isSeller) {
 *       // Auto-switch to seller's channel
 *       const channelId = await this.channelIsolation.getSellerChannelForAdministrator(ctx, adminId);
 *       if (channelId) {
 *         ctx = await this.channelIsolation.switchToSellerChannel(ctx, channelId);
 *       }
 *     }
 * 
 *     // Now queries will be scoped to the correct channel
 *     return this.productService.findAll(ctx);
 *   }
 * }
 * 
 * 
 * STEP 5: Auto-Switch on Login (Advanced)
 * ============================================================================
 * 
 * To automatically switch channels when a seller logs in, you can:
 * 
 * 1. Create a custom authentication strategy
 * 2. Hook into the login mutation
 * 3. Call switchToSellerChannel after authentication
 * 
 * See Day 8 documentation for full implementation.
 * 
 * 
 * PRODUCTION CONSIDERATIONS
 * ============================================================================
 * 
 * 1. **Caching**: Cache channel mappings in Redis for performance
 * 2. **Logging**: Add detailed logs for debugging
 * 3. **Error Handling**: Handle cases where channel lookup fails
 * 4. **Testing**: Write comprehensive integration tests
 * 5. **Monitoring**: Track channel switches and access patterns
 * 
 * 
 * INTEGRATION WITH DAY 6 & 7
 * ============================================================================
 * 
 * This plugin integrates with:
 * - Day 6: Vendure seller provisioning (creates the seller entities)
 * - Day 7: Supabase tenants table (stores the mappings)
 * 
 * The tenants table links:
 * - tenants.vendure_administrator_id → administrator.id (INTEGER)
 * - tenants.vendure_channel_id → channel.id (INTEGER)
 * 
 * When a seller logs in:
 * 1. Get their administrator ID from session
 * 2. Query tenants table for their channel ID
 * 3. Auto-switch request context to that channel
 * 4. All subsequent queries are scoped to that channel
 */

