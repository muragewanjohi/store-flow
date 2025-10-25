-- Storage buckets setup for Vendure integration
-- These buckets will store tenant-specific assets

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('tenant-assets', 'tenant-assets', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']),
    ('tenant-themes', 'tenant-themes', false, 104857600, ARRAY['application/json', 'text/css', 'text/javascript', 'application/javascript']),
    ('tenant-uploads', 'tenant-uploads', false, 104857600, ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

-- Create RLS policies for tenant-assets bucket
CREATE POLICY "Public can view tenant assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'tenant-assets');

CREATE POLICY "Users can upload assets for their tenants" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'tenant-assets' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update assets for their tenants" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'tenant-assets' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete assets for their tenants" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'tenant-assets' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Create RLS policies for tenant-themes bucket
CREATE POLICY "Users can view themes for their tenants" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'tenant-themes' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage themes for their tenants" ON storage.objects
    FOR ALL USING (
        bucket_id = 'tenant-themes' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Create RLS policies for tenant-uploads bucket
CREATE POLICY "Users can view uploads for their tenants" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'tenant-uploads' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage uploads for their tenants" ON storage.objects
    FOR ALL USING (
        bucket_id = 'tenant-uploads' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] IN (
            SELECT subdomain FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Service role policies for backend operations
CREATE POLICY "Service role can manage all tenant assets" ON storage.objects
    FOR ALL USING (bucket_id = 'tenant-assets' AND auth.role() = 'service_role');

CREATE POLICY "Service role can manage all tenant themes" ON storage.objects
    FOR ALL USING (bucket_id = 'tenant-themes' AND auth.role() = 'service_role');

CREATE POLICY "Service role can manage all tenant uploads" ON storage.objects
    FOR ALL USING (bucket_id = 'tenant-uploads' AND auth.role() = 'service_role');
