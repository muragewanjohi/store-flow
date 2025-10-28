/**
 * Channel Restrictions Page
 * 
 * Shows sellers information about their channel restrictions.
 */

import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    Alert,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider
} from '@mui/material';
import {
    ChannelIcon,
    LockIcon,
    InfoIcon,
    CheckCircleIcon
} from '@mui/icons-material';
import { useChannelIsolation } from './channel-isolation-extension';
import { useActiveChannel } from './custom-channel-selector';

export const ChannelRestrictionsPage: React.FC = () => {
    const { sellerChannelId, administratorId, allowedChannels } = useChannelIsolation();
    const activeChannel = useActiveChannel();

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Channel Restrictions
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                As a seller, you have restricted access to channels. You can only view and manage 
                data within your assigned channel.
            </Typography>

            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                {/* Current Channel */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <ChannelIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Current Channel
                        </Typography>
                        
                        {activeChannel && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Chip 
                                    label={activeChannel.code} 
                                    color="primary" 
                                    variant="outlined"
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {activeChannel.token}
                                </Typography>
                            </Box>
                        )}

                        <Typography variant="body2" color="text.secondary">
                            This is your assigned channel. All products, orders, and customers 
                            you manage are scoped to this channel.
                        </Typography>
                    </CardContent>
                </Card>

                {/* Accessible Channels */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Accessible Channels
                        </Typography>
                        
                        <List dense>
                            {allowedChannels.map((channel: any) => (
                                <ListItem key={channel.id}>
                                    <ListItemIcon>
                                        <ChannelIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={channel.code}
                                        secondary={`ID: ${channel.id}`}
                                    />
                                    {channel.id === sellerChannelId.toString() && (
                                        <Chip 
                                            label="Your Channel" 
                                            size="small" 
                                            color="primary"
                                        />
                                    )}
                                </ListItem>
                            ))}
                        </List>

                        <Alert severity="info" sx={{ mt: 2 }}>
                            You have access to {allowedChannels.length} channel(s) only.
                        </Alert>
                    </CardContent>
                </Card>

                {/* Restrictions Info */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <LockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Restrictions
                        </Typography>
                        
                        <List dense>
                            <ListItem>
                                <ListItemIcon>
                                    <InfoIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Channel Switching"
                                    secondary="You cannot switch to other channels"
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    <InfoIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Data Access"
                                    secondary="You can only see data from your assigned channel"
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    <InfoIcon />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Product Management"
                                    secondary="Products are scoped to your channel only"
                                />
                            </ListItem>
                        </List>
                    </CardContent>
                </Card>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Technical Info */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Technical Information
                    </Typography>
                    
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                Administrator ID
                            </Typography>
                            <Typography variant="body1" fontFamily="monospace">
                                {administratorId}
                            </Typography>
                        </Box>
                        
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                Assigned Channel ID
                            </Typography>
                            <Typography variant="body1" fontFamily="monospace">
                                {sellerChannelId}
                            </Typography>
                        </Box>
                        
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                Channel Count
                            </Typography>
                            <Typography variant="body1" fontFamily="monospace">
                                {allowedChannels.length}
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ChannelRestrictionsPage;
