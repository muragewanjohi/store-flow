/**
 * Channel Isolation Dashboard Extension
 * 
 * This is the main entry point for the dashboard extension.
 * It follows Vendure v3.5.0 dashboard extension patterns.
 */

import { defineDashboardExtension } from '@vendure/dashboard';

export const channelIsolationExtension = defineDashboardExtension({
    id: 'channel-isolation',
    version: '1.0.0',
    
    // Extension configuration
    config: {
        enabled: true,
        showWarnings: true,
        allowSuperAdminBypass: true
    },

    // Custom components
    components: {
        // Override the channel selector
        'ChannelSelector': () => import('./custom-channel-selector'),
        // Add channel isolation context
        'ChannelIsolationProvider': () => import('./channel-isolation-extension'),
    },

    // Custom hooks
    hooks: {
        // Override channel switching
        'useChannelSwitch': () => import('./custom-channel-selector').then(m => m.useChannelSwitch),
        // Override channel filtering
        'useFilteredChannels': () => import('./channel-isolation-extension').then(m => m.useFilteredChannels),
    },

    // Custom pages
    pages: [
        {
            path: '/channel-restrictions',
            component: () => import('./channel-restrictions-page'),
            title: 'Channel Restrictions',
            permissions: ['ReadChannel']
        }
    ],

    // Custom navigation items
    navigation: [
        {
            label: 'Channel Info',
            path: '/channel-restrictions',
            icon: 'channel',
            condition: (context) => {
                // Check if user is a seller (has channel restrictions)
                return context.user?.isSeller || false;
            }
        }
    ]
});

export default channelIsolationExtension;
