/**
 * Channel Isolation Dashboard Extension
 * 
 * Customizes the Vendure Dashboard to enforce channel isolation for sellers.
 * Sellers only see their assigned channel and cannot switch to others.
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
    useNotification, 
    useDataProvider,
    useGetIdentity,
    useGetList,
    useUpdate,
    useNotify
} from '@vendure/dashboard';
import { createClient } from '@supabase/supabase-js';

// Supabase client for SaaS database
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co',
    process.env.REACT_APP_SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw'
);

interface ChannelIsolationExtensionProps {
    children: React.ReactNode;
}

export const ChannelIsolationExtension: React.FC<ChannelIsolationExtensionProps> = ({ children }) => {
    const { data: identity } = useGetIdentity();
    const notify = useNotify();
    const navigate = useNavigate();
    const [sellerChannelId, setSellerChannelId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Get seller's assigned channel from Supabase
    useEffect(() => {
        const fetchSellerChannel = async () => {
            if (!identity?.administrator?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('tenants')
                    .select('vendure_channel_id')
                    .eq('vendure_administrator_id', identity.administrator.id)
                    .eq('status', 'active')
                    .limit(1)
                    .single();

                if (error) {
                    console.error('[ChannelIsolation] Supabase query error:', error);
                    setIsLoading(false);
                    return;
                }

                if (data?.vendure_channel_id) {
                    setSellerChannelId(data.vendure_channel_id);
                    console.log(`[ChannelIsolation] Seller assigned to channel: ${data.vendure_channel_id}`);
                }
            } catch (error) {
                console.error('[ChannelIsolation] Error fetching seller channel:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSellerChannel();
    }, [identity?.administrator?.id]);

    // If this is a seller (has channel restriction), enforce it
    if (!isLoading && sellerChannelId && identity?.administrator) {
        return (
            <ChannelIsolationProvider 
                sellerChannelId={sellerChannelId}
                administratorId={identity.administrator.id}
            >
                {children}
            </ChannelIsolationProvider>
        );
    }

    // Super admin or loading - no restrictions
    return <>{children}</>;
};

interface ChannelIsolationProviderProps {
    sellerChannelId: number;
    administratorId: string;
    children: React.ReactNode;
}

const ChannelIsolationProvider: React.FC<ChannelIsolationProviderProps> = ({ 
    sellerChannelId, 
    administratorId, 
    children 
}) => {
    const notify = useNotify();
    const navigate = useNavigate();

    // Override channel switching
    const handleChannelSwitch = (channelId: string) => {
        const targetChannelId = parseInt(channelId);
        
        if (targetChannelId !== sellerChannelId) {
            notify('You do not have permission to access this channel', 'error');
            return false; // Block the switch
        }
        
        return true; // Allow the switch
    };

    // Override channel list to only show seller's channel
    const { data: channels } = useGetList({
        resource: 'channels',
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'code', order: 'ASC' },
    });

    const filteredChannels = channels?.data?.filter(
        (channel: any) => channel.id === sellerChannelId.toString()
    ) || [];

    // Inject channel restrictions into the dashboard context
    useEffect(() => {
        // Override global channel switching
        const originalChannelSwitch = (window as any).vendureChannelSwitch;
        (window as any).vendureChannelSwitch = handleChannelSwitch;

        return () => {
            (window as any).vendureChannelSwitch = originalChannelSwitch;
        };
    }, [sellerChannelId]);

    return (
        <ChannelIsolationContext.Provider 
            value={{ 
                sellerChannelId, 
                administratorId,
                allowedChannels: filteredChannels,
                onChannelSwitch: handleChannelSwitch
            }}
        >
            {children}
        </ChannelIsolationContext.Provider>
    );
};

// Context for channel isolation
const ChannelIsolationContext = React.createContext<{
    sellerChannelId: number;
    administratorId: string;
    allowedChannels: any[];
    onChannelSwitch: (channelId: string) => boolean;
} | null>(null);

export const useChannelIsolation = () => {
    const context = React.useContext(ChannelIsolationContext);
    if (!context) {
        throw new Error('useChannelIsolation must be used within ChannelIsolationProvider');
    }
    return context;
};

// Custom hook to get filtered channels
export const useFilteredChannels = () => {
    const { allowedChannels } = useChannelIsolation();
    return allowedChannels;
};

// Custom hook to handle channel switching
export const useChannelSwitch = () => {
    const { onChannelSwitch } = useChannelIsolation();
    return onChannelSwitch;
};
