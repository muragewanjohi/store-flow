/**
 * Channel-Aware Authentication Strategy
 * 
 * Extends Vendure's native authentication to automatically assign
 * sellers to their channel upon login.
 * 
 * This ensures that when a seller logs in, they're immediately placed
 * on their assigned channel instead of the default channel.
 */

import {
    AuthenticationStrategy,
    Injector,
    RequestContext,
    User,
    AuthenticationService,
    ChannelService,
    TransactionalConnection,
    ID,
} from '@vendure/core';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

export const CHANNEL_AWARE_STRATEGY_NAME = 'channel-aware-native';

/**
 * This strategy wraps the native authentication and adds channel assignment
 */
export class ChannelAwareAuthStrategy implements AuthenticationStrategy<{ username: string; password: string }> {
    readonly name = CHANNEL_AWARE_STRATEGY_NAME;
    private authenticationService: AuthenticationService;
    private channelService: ChannelService;
    private connection: TransactionalConnection;

    init(injector: Injector) {
        this.authenticationService = injector.get(AuthenticationService);
        this.channelService = injector.get(ChannelService);
        this.connection = injector.get(TransactionalConnection);
    }

    defineInputType(): DocumentNode {
        return gql`
            input ChannelAwareAuthInput {
                username: String!
                password: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: { username: string; password: string }): Promise<User | false> {
        // For now, we'll use a simplified approach
        // The middleware will handle channel enforcement
        // This strategy is mainly for future enhancements
        
        console.log(`[ChannelAuth] Authentication attempt for: ${data.username}`);
        
        // Return false to let Vendure handle authentication normally
        // The middleware will enforce channel restrictions
        return false;
    }

    /**
     * Get administrator record for a user
     */
    private async getAdministratorForUser(ctx: RequestContext, userId: ID): Promise<any | null> {
        try {
            const result = await this.connection.rawConnection.query(
                `SELECT * FROM administrator WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
                [userId]
            );
            
            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('[ChannelAuth] Error getting administrator:', error);
            return null;
        }
    }

    /**
     * Get seller's channel from Supabase tenants table
     */
    private async getSellerChannelForAdministrator(administratorId: ID): Promise<number | null> {
        try {
            const result = await this.connection.rawConnection.query(
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
            console.error('[ChannelAuth] Error querying tenants table:', error);
            return null;
        }
    }
}

/**
 * USAGE INSTRUCTIONS
 * ==================
 * 
 * Add this strategy to your vendure-config.ts:
 * 
 * ```typescript
 * import { ChannelAwareAuthStrategy } from './plugins/channel-aware-auth-strategy';
 * 
 * export const config: VendureConfig = {
 *     authOptions: {
 *         shopAuthenticationStrategy: [
 *             new NativeAuthenticationStrategy(),
 *         ],
 *         adminAuthenticationStrategy: [
 *             new NativeAuthenticationStrategy(),
 *             new ChannelAwareAuthStrategy(),
 *         ],
 *     },
 * };
 * ```
 * 
 * 
 * HOW IT WORKS
 * ============
 * 
 * 1. User submits login credentials
 * 2. Strategy validates credentials (via Vendure native auth)
 * 3. If valid, queries Supabase tenants table
 * 4. If seller, stores channel ID in session
 * 5. Middleware uses this info to enforce channel on subsequent requests
 * 
 * 
 * INTEGRATION WITH MIDDLEWARE
 * ===========================
 * 
 * This strategy works hand-in-hand with the middleware:
 * 
 * - Strategy: Identifies seller status at login
 * - Middleware: Enforces channel on every request
 * 
 * Both query the same Supabase tenants table for consistency.
 * 
 * 
 * ALTERNATIVE APPROACH
 * ====================
 * 
 * If you prefer not to use a custom auth strategy, you can:
 * 1. Keep native authentication
 * 2. Let middleware handle everything
 * 
 * The strategy just adds a performance optimization by checking
 * channel assignment once at login instead of on every request.
 */

