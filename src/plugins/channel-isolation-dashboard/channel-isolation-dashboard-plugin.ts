/**
 * Channel Isolation Dashboard Extension Plugin
 * 
 * Integrates channel isolation into the Vendure Dashboard.
 * This plugin provides:
 * 1. Channel filtering for sellers
 * 2. Custom channel selector component
 * 3. Navigation restrictions
 * 4. UI overrides for channel access
 */

import { VendurePlugin } from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';

@VendurePlugin({
    imports: [],
    providers: [],
    configuration: config => {
        return config;
    },
})
export class ChannelIsolationDashboardPlugin {
    static init() {
        return DashboardPlugin.init({
            route: 'dashboard',
            appDir: './dist/dashboard',
            // Custom dashboard extensions
            extensions: [
                {
                    id: 'channel-isolation-extension',
                    type: 'extension',
                    extensionPath: './src/plugins/channel-isolation-dashboard',
                    // Override the default channel selector
                    overrides: {
                        'ChannelSelector': './custom-channel-selector.tsx',
                        'ChannelContext': './channel-isolation-extension.tsx'
                    }
                }
            ]
        });
    }
}
