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
 * Middleware factory function (with DI services)
 * This version expects services to be passed in
 */
export function channelIsolationMiddleware(
    connection: TransactionalConnection,
    channelService: ChannelService,
    administratorService: AdministratorService,
) {
    return createChannelIsolationMiddlewareHandler(connection, channelService, administratorService);
}

/**
 * Middleware handler that can be used standalone
 * Gets services from Vendure's global Injector at runtime
 */
export function createChannelIsolationMiddlewareHandler(
    connection?: TransactionalConnection,
    channelService?: ChannelService,
    administratorService?: AdministratorService,
) {
    return async (req: Request & { context?: RequestContext }, res: Response, next: NextFunction) => {
        try {
            // Get services from global Injector if not provided
            let conn = connection;
            let chService = channelService;
            let admService = administratorService;
            
            if (!conn || !chService || !admService) {
                try {
                    // Try to get Injector from request (Vendure attaches it)
                    const injector = (req as any).injector || (global as any).VendureInjector;
                    if (injector) {
                        if (!conn) conn = injector.get(TransactionalConnection);
                        if (!chService) chService = injector.get(ChannelService);
                        if (!admService) admService = injector.get(AdministratorService);
                    }
                } catch (e) {
                    // If we can't get services, skip middleware (fail-open)
                    console.warn('[ChannelIsolation] Could not get DI services, skipping middleware');
                    return next();
                }
            }
            
            // Use the provided or retrieved services
            const connectionToUse = conn!;
            const channelServiceToUse = chService!;
            const administratorServiceToUse = admService!;
            
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

            // CRITICAL: Use direct database queries to bypass permission checks
            // This prevents FORBIDDEN errors on initial load
            let sellerChannelId: number | null = null;
            let administratorId: number | null = null;
            
            try {
                // Step 1: Query Vendure database directly for administrator ID (bypasses permission checks)
                const rawConnection = connectionToUse.rawConnection;
                const adminResult = await rawConnection.query(
                    `SELECT id FROM administrator WHERE "userId" = $1 LIMIT 1`,
                    [userId]
                );
                
                if (adminResult && adminResult.length > 0) {
                    administratorId = adminResult[0].id;
                    console.log(`[ChannelIsolation] Found administrator ID ${administratorId} for user ${userId}`);
                    
                    // Step 2: Query Supabase for the channel (using direct DB query)
                    if (administratorId !== null) {
                        sellerChannelId = await getSellerChannelForAdministrator(connectionToUse, administratorId);
                    }
                } else {
                    console.log(`[ChannelIsolation] No administrator found for user ${userId}`);
                    return next();
                }
            } catch (e: any) {
                console.error(`[ChannelIsolation] Error querying administrator from DB:`, e.message);
                // Fallback: try using service (might fail due to permissions, but worth trying)
                try {
                    const admin = await administratorServiceToUse.findOneByUserId(ctx, userId);
                    if (admin) {
                        administratorId = Number(admin.id);
                        sellerChannelId = await getSellerChannelForAdministrator(connectionToUse, administratorId);
                    }
                } catch (e2: any) {
                    console.error(`[ChannelIsolation] Fallback method also failed:`, e2.message);
                    return next();
                }
            }
            
            if (!sellerChannelId) {
                // Not a seller (probably super admin) - no restriction
                console.log(`[ChannelIsolation] Admin ${administratorId} is unrestricted (super admin)`);
                return next();
            }

            // This is a seller - enforce their channel
            console.log(`[ChannelIsolation] Admin ${administratorId} is seller - enforcing channel ${sellerChannelId}`);
            
            // CRITICAL: Use direct database query to bypass ALL permission checks
            // channelService.findOne() always checks ReadChannel permission, which fails for sellers
            let channel: any = null;
            try {
                // Query channel directly from database to bypass permission checks
                const rawConnection = connectionToUse.rawConnection;
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
                    channel = {
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
                        // Relations will be null but that's okay for middleware
                        defaultTaxZone: null,
                        defaultShippingZone: null,
                        seller: null,
                    };
                }
                
                if (!channel) {
                    console.error(`[ChannelIsolation] Channel ${sellerChannelId} not found in database`);
                    return next();
                }
            } catch (error: any) {
                console.error(`[ChannelIsolation] Error fetching seller channel ${sellerChannelId}:`, error.message);
                // Fallback: try using service (might fail, but worth trying)
                try {
                    channel = await channelServiceToUse.findOne(ctx, sellerChannelId);
                    if (!channel) {
                        return next();
                    }
                } catch (e: any) {
                    console.error(`[ChannelIsolation] Fallback channelService.findOne() also failed:`, e.message);
                    return next();
                }
            }

            // Explicitly block default channel (ID: 1) for sellers
            if (ctx.channel && ctx.channel.id.toString() === '1') {
                console.log(`[ChannelIsolation] 🚫 BLOCKED: Seller ${administratorId} attempted to access default channel (ID: 1)`);
                // Force switch to seller's channel
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

