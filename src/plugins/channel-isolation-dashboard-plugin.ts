/**
 * Channel Isolation Dashboard Extension Plugin
 * 
 * This plugin provides dashboard extensions for channel isolation.
 * It follows Vendure v3.5.0 dashboard extension patterns.
 */

import { VendurePlugin } from '@vendure/core';

@VendurePlugin({
    imports: [],
    providers: [],
    configuration: config => {
        return config;
    },
})
export class ChannelIsolationDashboardPlugin {
    // Dashboard extensions are automatically discovered by the vendureDashboardPlugin
    // in vite.config.mts when this plugin is imported
}
