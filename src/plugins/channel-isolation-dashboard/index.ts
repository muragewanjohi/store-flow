/**
 * Channel Isolation Dashboard Extension
 * 
 * This file defines the dashboard extension that enforces channel isolation.
 * It follows Vendure's dashboard extension patterns.
 */

import { defineDashboardExtension } from '@vendure/dashboard';

export const channelIsolationExtension = defineDashboardExtension({
    id: 'channel-isolation',
    version: '1.0.0',
    
    // Extension configuration
    config: {
        // Enable channel isolation by default
        enabled: true,
        // Show restriction warnings
        showWarnings: true,
        // Allow super admins to bypass restrictions
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

    // Custom pages (if needed)
    pages: [
        {
            path: '/channel-restrictions',
            component: () => import('./channel-restrictions-page'),
            title: 'Channel Restrictions',
            // Only show to sellers
            permissions: ['ReadChannel']
        }
    ],

    // Custom navigation items
    navigation: [
        {
            label: 'Channel Info',
            path: '/channel-restrictions',
            icon: 'channel',
            // Only show to restricted users
            condition: (context) => {
                // Check if user is a seller (has channel restrictions)
                return context.user?.isSeller || false;
            }
        }
    ],

    // Custom settings
    settings: [
        {
            key: 'channelIsolation.enabled',
            label: 'Enable Channel Isolation',
            type: 'boolean',
            default: true,
            description: 'Restrict sellers to their assigned channels only'
        },
        {
            key: 'channelIsolation.showWarnings',
            label: 'Show Restriction Warnings',
            type: 'boolean',
            default: true,
            description: 'Display warnings when channel access is restricted'
        }
    ]
});

export default channelIsolationExtension;
