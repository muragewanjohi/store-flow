/**
 * Quick script to check existing sellers in Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSellers() {
    console.log('🔍 Checking existing sellers in Supabase...\n');

    const { data: tenants, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (!tenants || tenants.length === 0) {
        console.log('📭 No tenants found in database\n');
        return;
    }

    console.log(`📊 Found ${tenants.length} tenant(s):\n`);

    tenants.forEach((tenant, index) => {
        console.log(`${index + 1}. ${tenant.business_name}`);
        console.log(`   Subdomain: ${tenant.subdomain}`);
        console.log(`   Status: ${tenant.status}`);
        console.log(`   Vendure Seller ID: ${tenant.vendure_seller_id || 'NOT SET'}`);
        console.log(`   Vendure Channel ID: ${tenant.vendure_channel_id || 'NOT SET'}`);
        console.log(`   Vendure Admin ID: ${tenant.vendure_administrator_id || 'NOT SET'}`);
        console.log(`   Created: ${new Date(tenant.created_at).toLocaleString()}`);
        console.log('');
    });

    const fullyProvisioned = tenants.filter(t => 
        t.vendure_seller_id && t.vendure_channel_id && t.vendure_administrator_id
    );

    console.log(`✅ Fully provisioned: ${fullyProvisioned.length}/${tenants.length}`);
    console.log('');

    if (fullyProvisioned.length < 2) {
        console.log('💡 Need at least 2 fully provisioned sellers for channel isolation testing');
        console.log('   Run: npx ts-node src/test-complete-signup-flow.ts');
        console.log('   (Run it multiple times to create more sellers)');
    } else {
        console.log('🎉 Ready for channel isolation testing!');
        console.log('   Run: npx ts-node src/test-channel-isolation.ts');
    }
}

checkSellers();

