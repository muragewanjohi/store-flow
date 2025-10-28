/**
 * Custom Channel Selector Component
 * 
 * Replaces the default Vendure channel selector with one that enforces
 * channel isolation for sellers.
 */

import React, { useState } from 'react';
import {
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Box,
    Typography,
    Alert
} from '@mui/material';
import { useChannelIsolation, useFilteredChannels } from './channel-isolation-extension';
import { useDataProvider, useNotify } from '@vendure/dashboard';

interface CustomChannelSelectorProps {
    currentChannelId?: string;
    onChannelChange?: (channelId: string) => void;
}

export const CustomChannelSelector: React.FC<CustomChannelSelectorProps> = ({
    currentChannelId,
    onChannelChange
}) => {
    const { sellerChannelId, administratorId } = useChannelIsolation();
    const allowedChannels = useFilteredChannels();
    const notify = useNotify();
    const dataProvider = useDataProvider();
    const [isChanging, setIsChanging] = useState(false);

    const handleChannelChange = async (event: any) => {
        const newChannelId = event.target.value;
        
        if (newChannelId === currentChannelId) {
            return; // No change needed
        }

        // Check if this is allowed
        const isAllowed = allowedChannels.some(
            (channel: any) => channel.id === newChannelId
        );

        if (!isAllowed) {
            notify('You do not have permission to access this channel', 'error');
            return;
        }

        setIsChanging(true);

        try {
            // Update the active channel
            await dataProvider.update({
                resource: 'activeChannel',
                id: 'current',
                data: { channelId: newChannelId }
            });

            // Notify parent component
            onChannelChange?.(newChannelId);
            
            notify('Channel switched successfully', 'success');
        } catch (error) {
            console.error('Channel switch error:', error);
            notify('Failed to switch channel', 'error');
        } finally {
            setIsChanging(false);
        }
    };

    // If only one channel is allowed, show it as a chip instead of dropdown
    if (allowedChannels.length === 1) {
        const channel = allowedChannels[0];
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Channel:
                </Typography>
                <Chip 
                    label={channel.code} 
                    color="primary" 
                    size="small"
                    variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                    (Restricted)
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ minWidth: 200 }}>
            <FormControl fullWidth size="small">
                <InputLabel>Channel</InputLabel>
                <Select
                    value={currentChannelId || ''}
                    label="Channel"
                    onChange={handleChannelChange}
                    disabled={isChanging}
                >
                    {allowedChannels.map((channel: any) => (
                        <MenuItem key={channel.id} value={channel.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">
                                    {channel.code}
                                </Typography>
                                {channel.id === sellerChannelId.toString() && (
                                    <Chip 
                                        label="Your Channel" 
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            
            {allowedChannels.length < 2 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                    You have access to {allowedChannels.length} channel(s) only.
                </Alert>
            )}
        </Box>
    );
};

// Hook to get the current active channel
export const useActiveChannel = () => {
    const { data: activeChannel } = useDataProvider().getOne({
        resource: 'activeChannel',
        id: 'current'
    });

    return activeChannel;
};

// Hook to switch channels with isolation checks
export const useChannelSwitch = () => {
    const { sellerChannelId, onChannelSwitch } = useChannelIsolation();
    const notify = useNotify();

    const switchChannel = async (channelId: string) => {
        // Check if switch is allowed
        if (!onChannelSwitch(channelId)) {
            return false;
        }

        try {
            // Perform the actual switch
            // This would integrate with Vendure's channel switching mechanism
            console.log(`[ChannelIsolation] Switching to channel ${channelId}`);
            return true;
        } catch (error) {
            console.error('Channel switch error:', error);
            notify('Failed to switch channel', 'error');
            return false;
        }
    };

    return { switchChannel, sellerChannelId };
};
