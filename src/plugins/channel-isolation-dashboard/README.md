# Channel Isolation Dashboard Extension

This extension enforces channel isolation in the Vendure Dashboard for multi-vendor marketplaces.

## Features

- **Channel Filtering**: Sellers only see their assigned channel
- **Custom Channel Selector**: Replaces default channel selector with restricted version
- **Navigation Restrictions**: Blocks unauthorized channel switching
- **Channel Info Page**: Shows sellers their channel restrictions
- **Supabase Integration**: Queries SaaS database for channel assignments

## Architecture

### Components

1. **ChannelIsolationExtension** (`channel-isolation-extension.tsx`)
   - Main extension component that wraps the dashboard
   - Queries Supabase for seller channel assignments
   - Provides context for channel restrictions

2. **CustomChannelSelector** (`custom-channel-selector.tsx`)
   - Replaces Vendure's default channel selector
   - Only shows channels the seller has access to
   - Blocks unauthorized channel switches

3. **ChannelRestrictionsPage** (`channel-restrictions-page.tsx`)
   - Dedicated page showing channel restrictions
   - Technical information for sellers
   - Accessible via navigation menu

### Integration Points

- **Supabase SaaS Database**: Queries `tenants` table for channel assignments
- **Vendure Dashboard**: Extends the default dashboard with custom components
- **Channel Context**: Provides channel isolation context throughout the app

## Usage

### For Sellers

1. Login to the dashboard
2. See only your assigned channel in the channel selector
3. Cannot switch to other channels
4. Access "Channel Info" page to see restrictions

### For Super Admins

- No restrictions applied
- See all channels as normal
- Can switch between channels freely

## Configuration

The extension is configured in `vendure-config.ts`:

```typescript
DashboardPlugin.init({
    route: 'dashboard',
    appDir: './dist/dashboard',
    extensions: [
        {
            id: 'channel-isolation',
            type: 'extension',
            extensionPath: './src/plugins/channel-isolation-dashboard',
        }
    ]
})
```

## Environment Variables

Required environment variables for Supabase integration:

```env
REACT_APP_SUPABASE_SAAS_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_SAAS_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Schema

The extension queries the `tenants` table in the Supabase SaaS database:

```sql
SELECT vendure_channel_id 
FROM tenants 
WHERE vendure_administrator_id = $1 
AND status = 'active'
```

## Testing

1. Create a seller with channel assignment
2. Login as the seller
3. Verify only assigned channel is visible
4. Try to switch channels (should be blocked)
5. Check "Channel Info" page

## Troubleshooting

### Channels Not Filtered

- Check Supabase connection
- Verify `tenants` table has correct data
- Check console logs for errors

### Extension Not Loading

- Verify `vendure-config.ts` configuration
- Check file paths are correct
- Restart Vendure server

### Supabase Errors

- Verify environment variables
- Check service role key permissions
- Ensure `tenants` table exists

## Future Enhancements

- [ ] Cache channel assignments in Redis
- [ ] Add channel switching audit logs
- [ ] Implement role-based channel access
- [ ] Add channel usage analytics
- [ ] Support for multiple channel assignments per seller
