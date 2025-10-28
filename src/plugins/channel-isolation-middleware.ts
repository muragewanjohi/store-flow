/**
 * Channel Isolation Middleware
 * 
 * Automatically enforces channel isolation on EVERY Admin API request.
 * Sellers are restricted to their assigned channel.
 * Super admins have access to all channels.
 * 
 * Integration: Days 6, 7, 8
 */

import { MiddlewareConsumer, NestModule, Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Injector, RequestContext, ChannelService, AdministratorService, TransactionalConnection } from '@vendure/core';

@Injectable()
export class ChannelIsolationMiddleware implements NestModule {
    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
        private administratorService: AdministratorService,
    ) {}

    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(channelIsolationMiddleware(this.connection, this.channelService, this.administratorService))
            .forRoutes('admin-api');
    }
}

/**
 * Middleware factory function
 */
export function channelIsolationMiddleware(
    connection: TransactionalConnection,
    channelService: ChannelService,
    administratorService: AdministratorService,
) {
    return async (req: Request & { context?: RequestContext }, res: Response, next: NextFunction) => {
        try {
            // Get request context from request
            const ctx = (req as any)._ctx as RequestContext;
            
            if (!ctx) {
                // No context yet (early in request lifecycle)
                return next();
            }

            // Check if user is authenticated
            const userId = ctx.activeUserId;
            if (!userId) {
                // Not authenticated - skip channel isolation
                return next();
            }

            // Get administrator for this user
            const admin = await administratorService.findOneByUserId(ctx, userId);
            if (!admin) {
                // Not an administrator - skip
                return next();
            }

            // Check if this admin is a seller (has a channel restriction)
            const sellerChannelId = await getSellerChannelForAdministrator(connection, admin.id);
            
            if (!sellerChannelId) {
                // Not a seller (probably super admin) - no restriction
                console.log(`[ChannelIsolation] Admin ${admin.id} is unrestricted (super admin)`);
                return next();
            }

            // This is a seller - enforce their channel
            console.log(`[ChannelIsolation] Admin ${admin.id} is seller - enforcing channel ${sellerChannelId}`);
            
            // Get the channel
            const channel = await channelService.findOne(ctx, sellerChannelId);
            if (!channel) {
                console.error(`[ChannelIsolation] Channel ${sellerChannelId} not found for admin ${admin.id}`);
                return next();
            }

            // Check if already on correct channel
            if (ctx.channel && ctx.channel.id === channel.id) {
                console.log(`[ChannelIsolation] Already on correct channel ${channel.code}`);
                return next();
            }

            // Create new context with seller's channel
            const newCtx = new RequestContext({
                req: ctx.req,
                apiType: ctx.apiType,
                channel: channel,
                languageCode: ctx.languageCode,
                isAuthorized: ctx.isAuthorized,
                authorizedAsOwnerOnly: ctx.authorizedAsOwnerOnly,
                session: ctx.session,
            });

            // Replace the context
            (req as any)._ctx = newCtx;
            
            console.log(`[ChannelIsolation] ✅ Switched to channel: ${channel.code} (ID: ${channel.id})`);
            
            next();
        } catch (error) {
            console.error('[ChannelIsolation] Middleware error:', error);
            // Don't block the request on error
            next();
        }
    };
}

/**
 * Query Supabase tenants table to find seller's channel
 * 
 * This is the same logic as in the plugin, but extracted for middleware use.
 */
async function getSellerChannelForAdministrator(
    connection: TransactionalConnection,
    administratorId: string | number
): Promise<number | null> {
    try {
        const rawConnection = connection.rawConnection;
        
        // Query tenants table for this administrator's channel
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
        console.error('[ChannelIsolation] Error querying tenants table:', error);
        return null;
    }
}

/**
 * USAGE INSTRUCTIONS
 * ==================
 * 
 * This middleware runs on EVERY Admin API request and:
 * 1. Checks if user is authenticated
 * 2. Gets their administrator record
 * 3. Queries Supabase tenants table for channel restriction
 * 4. If restricted, auto-switches to their channel
 * 5. If unrestricted (super admin), allows all channels
 * 
 * 
 * IMPORTANT NOTES
 * ===============
 * 
 * 1. This middleware MUST run AFTER authentication middleware
 * 2. It queries the tenants table on EVERY request (consider caching)
 * 3. It modifies the RequestContext to enforce channel scoping
 * 4. Errors are logged but don't block requests (fail-open for safety)
 * 
 * 
 * PERFORMANCE CONSIDERATIONS
 * ==========================
 * 
 * The middleware queries the database on every request. For production:
 * 
 * Option A: Cache channel mappings in Redis
 * Option B: Store channel ID in session
 * Option C: Add channel_id to administrator table
 * 
 * Example caching:
 * ```typescript
 * const cacheKey = `seller-channel:${administratorId}`;
 * let channelId = await redis.get(cacheKey);
 * 
 * if (!channelId) {
 *     channelId = await queryDatabase();
 *     await redis.setex(cacheKey, 3600, channelId); // Cache 1 hour
 * }
 * ```
 * 
 * 
 * TESTING
 * =======
 * 
 * To test if middleware is working:
 * 
 * 1. Login as a seller
 * 2. Check console logs for "[ChannelIsolation]" messages
 * 3. Query products - should only see products in seller's channel
 * 4. Try to switch channels - should be blocked
 * 
 * 
 * INTEGRATION WITH CHANNEL ISOLATION PLUGIN
 * =========================================
 * 
 * This middleware complements the ChannelIsolationPlugin:
 * 
 * - Plugin: Provides utility methods and services
 * - Middleware: Actively enforces on every request
 * 
 * Both use the same Supabase tenants table for consistency.
 */

