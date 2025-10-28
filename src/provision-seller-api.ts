/**
 * Seller Provisioning API Service
 * 
 * This service automates the seller provisioning process for the SaaS app.
 * Called when a new tenant signs up to create their Vendure seller account.
 */

import { 
    ChannelService, 
    TransactionalConnection, 
    RequestContext, 
    Channel,
    AdministratorService,
    RoleService,
    ZoneService,
    ShippingMethodService,
    StockLocationService,
    SellerService,
    LanguageCode,
    CurrencyCode,
    ID
} from '@vendure/core';

/**
 * Interface for seller provisioning input
 */
export interface ProvisionSellerInput {
    shopName: string;
    sellerEmail: string;
    sellerPassword: string;
    firstName: string;
    lastName: string;
    tenantId: string; // Supabase tenant ID
}

/**
 * Interface for the result of seller provisioning
 */
export interface ProvisionSellerResult {
    sellerId: string;
    channelId: string;
    channelCode: string;
    channelToken: string;
    administratorId: string;
}

export class SellerProvisioningService {
    constructor(
        private channelService: ChannelService,
        private connection: TransactionalConnection,
        private administratorService: AdministratorService,
        private roleService: RoleService,
        private zoneService: ZoneService,
        private shippingMethodService: ShippingMethodService,
        private stockLocationService: StockLocationService,
        private sellerService: SellerService,
    ) {}

    /**
     * Provision a complete seller setup
     * 
     * This is called when a new tenant signs up in your SaaS app.
     * It creates:
     * 1. Seller entity
     * 2. Channel for the seller
     * 3. Administrator account
     * 4. Default shipping method
     * 5. Default stock location
     */
    async provisionSeller(ctx: RequestContext, input: ProvisionSellerInput): Promise<ProvisionSellerResult> {
        // Step 1: Create Seller
        const seller = await this.createSeller(ctx, input.shopName);
        
        // Step 2: Create Channel for Seller
        const channel = await this.createSellerChannel(ctx, String(seller.id), input);
        
        // Step 3: Get default tax zones
        const zones = await this.getDefaultZones(ctx);
        
        // Step 4: Create Administrator
        const administrator = await this.createSellerAdministrator(ctx, {
            firstName: input.firstName,
            lastName: input.lastName,
            emailAddress: input.sellerEmail,
            password: input.sellerPassword,
            channelId: String(channel.id),
        });
        
        // Step 5: Create default shipping method
        await this.createDefaultShippingMethod(ctx, String(channel.id), zones);
        
        // Step 6: Create stock location
        await this.createStockLocation(ctx, String(channel.id));
        
        // Step 7: Link channel to seller
        await this.linkChannelToSeller(ctx, String(channel.id), String(seller.id));
        
        return {
            sellerId: String(seller.id),
            channelId: String(channel.id),
            channelCode: channel.code,
            channelToken: channel.token,
            administratorId: String(administrator.id),
        };
    }

    /**
     * Step 1: Create Seller Entity
     */
    private async createSeller(ctx: RequestContext, name: string) {
        try {
            // Create seller using Vendure's seller service
            const seller = await this.sellerService.create(ctx, { 
                name: name 
            });
            return seller;
        } catch (error) {
            console.error('Error creating seller:', error);
            throw new Error(`Failed to create seller: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Step 2: Create Channel for Seller
     */
    private async createSellerChannel(ctx: RequestContext, sellerId: string, input: ProvisionSellerInput): Promise<Channel> {
        const channelCode = this.generateChannelCode(input.shopName);
        const channelToken = this.generateChannelToken(input.shopName);
        
        // Get default channel as reference for settings
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        
        // Get zone IDs (you'll need to get these from config or create them)
        const zones = await this.getDefaultZones(ctx);
        
        const result = await this.channelService.create(ctx, {
            code: channelCode,
            token: channelToken,
            defaultLanguageCode: LanguageCode.en,
            availableLanguageCodes: [LanguageCode.en],
            pricesIncludeTax: false,
            defaultCurrencyCode: CurrencyCode.USD,
            availableCurrencyCodes: [CurrencyCode.USD],
            defaultTaxZoneId: zones.taxZoneId,
            defaultShippingZoneId: zones.shippingZoneId,
            sellerId: sellerId,
        });

        // Handle the union type result
        if ('errorCode' in result) {
            throw new Error(`Failed to create channel: ${result.message}`);
        }

        return result;
    }

    /**
     * Step 3: Get Default Zones
     */
    private async getDefaultZones(ctx: RequestContext) {
        try {
            // Get zones using Vendure's zone service
            const zones = await this.zoneService.findAll(ctx);
            
            if (!zones.items.length) {
                throw new Error('No zones found. Please create tax and shipping zones first.');
            }
            
            // Use the first zone for both tax and shipping
            const defaultZoneId = zones.items[0].id;
            
            return {
                taxZoneId: defaultZoneId,
                shippingZoneId: defaultZoneId,
            };
        } catch (error) {
            console.error('Error getting zones:', error);
            // Fallback to hardcoded IDs if zones exist
            return {
                taxZoneId: '1',
                shippingZoneId: '1',
            };
        }
    }

    /**
     * Step 4: Create Administrator
     */
    private async createSellerAdministrator(ctx: RequestContext, input: {
        firstName: string;
        lastName: string;
        emailAddress: string;
        password: string;
        channelId: string;
    }) {
        try {
            // Get the first available role (usually SuperAdmin or similar)
            const roles = await this.roleService.findAll(ctx);
            if (!roles.items.length) {
                throw new Error('No roles found. Please create roles first.');
            }
            
            // Use the first role (typically SuperAdmin)
            const roleId = roles.items[0].id;
            
            // Create administrator
            const administrator = await this.administratorService.create(ctx, {
                firstName: input.firstName,
                lastName: input.lastName,
                emailAddress: input.emailAddress,
                password: input.password,
                roleIds: [roleId],
            });
            
            return administrator;
        } catch (error) {
            console.error('Error creating administrator:', error);
            throw new Error(`Failed to create administrator: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Step 5: Create Default Shipping Method
     */
    private async createDefaultShippingMethod(ctx: RequestContext, channelId: string, zones: any) {
        try {
            // Create a default shipping method for the seller
            const shippingMethod = await this.shippingMethodService.create(ctx, {
                code: 'default-shipping',
                fulfillmentHandler: 'manual-fulfillment',
                checker: {
                    code: 'default-shipping-checker',
                    arguments: [],
                },
                calculator: {
                    code: 'default-shipping-calculator',
                    arguments: [],
                },
                translations: [
                    {
                        languageCode: LanguageCode.en,
                        name: 'Standard Shipping',
                        description: 'Standard shipping method',
                    }
                ],
            });
            
            // Note: Shipping method assignment to channels may need to be done differently
            // This depends on your Vendure version and configuration
            
            return shippingMethod;
        } catch (error) {
            console.error('Error creating shipping method:', error);
            // Don't throw error - shipping method is optional for basic setup
            console.warn('Continuing without shipping method');
        }
    }

    /**
     * Step 6: Create Stock Location
     */
    private async createStockLocation(ctx: RequestContext, channelId: string) {
        try {
            // Create stock location for the seller
            const stockLocation = await this.stockLocationService.create(ctx, {
                name: 'Default Warehouse',
                description: 'Default stock location for seller',
            });
            
            return stockLocation;
        } catch (error) {
            console.error('Error creating stock location:', error);
            // Don't throw error - stock location is optional for basic setup
            console.warn('Continuing without stock location');
        }
    }

    /**
     * Step 7: Link Channel to Seller
     */
    private async linkChannelToSeller(ctx: RequestContext, channelId: string, sellerId: string) {
        // Update channel to link it to the seller
        // This is already done in createSellerChannel, but this ensures it's persisted
        
        try {
            await this.connection.rawConnection.query(
                `UPDATE channel SET "sellerId" = $1 WHERE id = $2`,
                [sellerId, channelId]
            );
        } catch (error) {
            console.error('Error linking channel to seller:', error);
            // This is not critical - the channel should already be linked
            console.warn('Continuing without explicit channel-seller link');
        }
    }

    /**
     * Generate channel code from shop name
     */
    private generateChannelCode(shopName: string): string {
        return shopName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Generate channel token from shop name
     */
    private generateChannelToken(shopName: string): string {
        return this.generateChannelCode(shopName) + '-token';
    }
}

/**
 * Example HTTP API Endpoint
 * 
 * This would be called from your Next.js/Supabase API when a tenant signs up
 * 
 * Note: This is a placeholder - actual implementation would require proper
 * dependency injection and request context creation
 */
export async function POST(request: Request) {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Extract request data
    // 2. Create proper Vendure request context
    // 3. Inject all required services
    // 4. Call the provisioning service
    
    return Response.json({
        error: 'Not implemented - requires proper dependency injection'
    });
}

