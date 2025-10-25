-- Authentication setup for Vendure integration
-- This includes custom claims and user metadata

-- Create a function to get tenant information for a user
CREATE OR REPLACE FUNCTION get_user_tenants(user_id UUID)
RETURNS TABLE (
    tenant_id UUID,
    subdomain VARCHAR,
    business_name VARCHAR,
    vendure_seller_id VARCHAR,
    vendure_channel_id VARCHAR,
    plan_tier plan_tier
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as tenant_id,
        t.subdomain,
        t.business_name,
        t.vendure_seller_id,
        t.vendure_channel_id,
        p.tier as plan_tier
    FROM tenants t
    LEFT JOIN plans p ON t.plan_id = p.id
    WHERE t.owner_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user has access to tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(user_id UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenants 
        WHERE id = tenant_uuid AND owner_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get tenant by subdomain
CREATE OR REPLACE FUNCTION get_tenant_by_subdomain(subdomain_input VARCHAR)
RETURNS TABLE (
    id UUID,
    subdomain VARCHAR,
    custom_domain VARCHAR,
    business_name VARCHAR,
    vendure_seller_id VARCHAR,
    vendure_channel_id VARCHAR,
    status tenant_status,
    plan_tier plan_tier
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.subdomain,
        t.custom_domain,
        t.business_name,
        t.vendure_seller_id,
        t.vendure_channel_id,
        t.status,
        p.tier as plan_tier
    FROM tenants t
    LEFT JOIN plans p ON t.plan_id = p.id
    WHERE t.subdomain = subdomain_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get tenant by custom domain
CREATE OR REPLACE FUNCTION get_tenant_by_custom_domain(domain_input VARCHAR)
RETURNS TABLE (
    id UUID,
    subdomain VARCHAR,
    custom_domain VARCHAR,
    business_name VARCHAR,
    vendure_seller_id VARCHAR,
    vendure_channel_id VARCHAR,
    status tenant_status,
    plan_tier plan_tier
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.subdomain,
        t.custom_domain,
        t.business_name,
        t.vendure_seller_id,
        t.vendure_channel_id,
        t.status,
        p.tier as plan_tier
    FROM tenants t
    LEFT JOIN plans p ON t.plan_id = p.id
    WHERE t.custom_domain = domain_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to create a new tenant (for signup flow)
CREATE OR REPLACE FUNCTION create_tenant(
    p_subdomain VARCHAR,
    p_business_name VARCHAR,
    p_owner_id UUID,
    p_plan_tier plan_tier DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
BEGIN
    -- Get plan ID for the tier
    SELECT id INTO v_plan_id FROM plans WHERE tier = p_plan_tier LIMIT 1;
    
    -- Create tenant
    INSERT INTO tenants (subdomain, business_name, owner_id, plan_id)
    VALUES (p_subdomain, p_business_name, p_owner_id, v_plan_id)
    RETURNING id INTO v_tenant_id;
    
    -- Create initial subscription
    INSERT INTO subscriptions (tenant_id, plan_id, status)
    VALUES (v_tenant_id, v_plan_id, 'trialing');
    
    -- Initialize usage counters
    INSERT INTO usage_counters (tenant_id, metric_name, count, period_start, period_end)
    VALUES 
        (v_tenant_id, 'orders', 0, date_trunc('month', NOW()), date_trunc('month', NOW()) + interval '1 month'),
        (v_tenant_id, 'products', 0, date_trunc('month', NOW()), date_trunc('month', NOW()) + interval '1 month'),
        (v_tenant_id, 'storage_gb', 0, date_trunc('month', NOW()), date_trunc('month', NOW()) + interval '1 month');
    
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update Vendure integration details
CREATE OR REPLACE FUNCTION update_tenant_vendure_details(
    p_tenant_id UUID,
    p_vendure_seller_id VARCHAR,
    p_vendure_channel_id VARCHAR
)
RETURNS VOID AS $$
BEGIN
    UPDATE tenants 
    SET 
        vendure_seller_id = p_vendure_seller_id,
        vendure_channel_id = p_vendure_channel_id,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
