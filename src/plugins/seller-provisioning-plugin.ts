import { VendurePlugin, PluginCommonModule } from '@vendure/core';
import { SellerProvisioningService } from '../provision-seller-api';

/**
 * Seller Provisioning Plugin
 * 
 * Provides automated seller provisioning for SaaS tenants.
 * Creates sellers, channels, administrators, and basic infrastructure.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [SellerProvisioningService],
    exports: [SellerProvisioningService],
})
export class SellerProvisioningPlugin {
    // Plugin configuration
}
