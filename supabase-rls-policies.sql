-- Row Level Security (RLS) Policies for Vendure Integration
-- These policies ensure tenant isolation and secure access

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Plans table is public (no RLS needed)
-- ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Users can view their own tenants" ON tenants
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own tenants" ON tenants
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own tenants" ON tenants
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Subscriptions policies
CREATE POLICY "Users can view subscriptions for their tenants" ON subscriptions
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update subscriptions for their tenants" ON subscriptions
    FOR UPDATE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert subscriptions for their tenants" ON subscriptions
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Usage counters policies
CREATE POLICY "Users can view usage for their tenants" ON usage_counters
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update usage for their tenants" ON usage_counters
    FOR UPDATE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert usage for their tenants" ON usage_counters
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Domains policies
CREATE POLICY "Users can view domains for their tenants" ON domains
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage domains for their tenants" ON domains
    FOR ALL USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Webhooks policies
CREATE POLICY "Users can view webhooks for their tenants" ON webhooks
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage webhooks for their tenants" ON webhooks
    FOR ALL USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- API Keys policies
CREATE POLICY "Users can view API keys for their tenants" ON api_keys
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage API keys for their tenants" ON api_keys
    FOR ALL USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Events policies
CREATE POLICY "Users can view events for their tenants" ON events
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "System can insert events for tenants" ON events
    FOR INSERT WITH CHECK (true); -- Allow system to log events

-- Service role policies (for backend operations)
CREATE POLICY "Service role can manage all tenants" ON tenants
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all usage counters" ON usage_counters
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all domains" ON domains
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all webhooks" ON webhooks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all API keys" ON api_keys
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all events" ON events
    FOR ALL USING (auth.role() = 'service_role');
