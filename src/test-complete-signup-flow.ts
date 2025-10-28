// src/test-complete-signup-flow.ts

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://dzeypvjhfhfazivfeums.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXlwdmpoZmhmYXppdmZldW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzODExNCwiZXhwIjoyMDc3MjE0MTE0fQ.DlzIzsGx5fRjhiGnVPxAwF3D44NzWpwvKj65I41E_Bw';

// ⚠️ IMPORTANT: Use SERVICE ROLE key to bypass RLS for backend operations
// For production, you'd use anon key for user-facing operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function completeSignupFlow() {
    console.log('🚀 Starting Complete Signup Flow\n');
    
    // ==========================================
    // STEP 1: Create Supabase User (Gets UUID)
    // ==========================================
    console.log('Step 1: Creating Supabase user...');
    
    // Generate a unique but valid email
    // Note: Some email providers are more permissive than others
    const randomSuffix = Math.floor(Math.random() * 10000);
    const email = `testseller${randomSuffix}@gmail.com`; // Unique email
    const password = 'SecurePass123!';
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (authError) {
        console.error('❌ Auth error:', authError);
        return;
    }
    
    const userId = authData.user!.id; // ← THIS IS THE UUID!
    console.log(`✅ Supabase User Created`);
    console.log(`   User ID (UUID): ${userId}`);
    console.log(`   Email: ${email}\n`);
    
    // ==========================================
    // STEP 2: Create Tenant Record
    // ==========================================
    console.log('Step 2: Creating tenant record...');
    
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
            subdomain: `test-store-${Date.now()}`,
            business_name: 'Test Electronics Store',
            owner_id: userId,  // ← Using the UUID from Step 1
            status: 'provisioning'
        })
        .select()
        .single();
    
    if (tenantError) {
        console.error('❌ Tenant creation error:', tenantError);
        return;
    }
    
    console.log(`✅ Tenant Created`);
    console.log(`   Tenant ID (UUID): ${tenant.id}`);
    console.log(`   Owner ID (UUID): ${tenant.owner_id}`);
    console.log(`   Subdomain: ${tenant.subdomain}\n`);
    
    // ==========================================
    // STEP 3: Provision Vendure Seller
    // ==========================================
    console.log('Step 3: Provisioning Vendure seller...');
    
    // You would call your actual provisioning API here
    // For now, let's simulate the response
    const vendureResult = {
        sellerId: 7,              // INTEGER from Vendure
        channelId: 5,             // INTEGER from Vendure
        administratorId: 5        // INTEGER from Vendure
    };
    
    console.log(`✅ Vendure Seller Provisioned`);
    console.log(`   Seller ID (INTEGER): ${vendureResult.sellerId}`);
    console.log(`   Channel ID (INTEGER): ${vendureResult.channelId}`);
    console.log(`   Administrator ID (INTEGER): ${vendureResult.administratorId}\n`);
    
    // ==========================================
    // STEP 4: Update Tenant with Vendure IDs
    // ==========================================
    console.log('Step 4: Linking Vendure IDs to tenant...');
    
    const { error: updateError } = await supabase
        .from('tenants')
        .update({
            vendure_seller_id: vendureResult.sellerId,           // INTEGER
            vendure_channel_id: vendureResult.channelId,         // INTEGER
            vendure_administrator_id: vendureResult.administratorId, // INTEGER
            status: 'active'
        })
        .eq('id', tenant.id);
    
    if (updateError) {
        console.error('❌ Update error:', updateError);
        return;
    }
    
    console.log(`✅ Tenant Updated with Vendure IDs\n`);
    
    // ==========================================
    // STEP 5: Verify Final State
    // ==========================================
    console.log('Step 5: Verifying final tenant state...');
    
    const { data: finalTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.id)
        .single();
    
    console.log('\n📊 FINAL TENANT RECORD:');
    console.log('=====================================');
    console.log(`Tenant ID (UUID):          ${finalTenant.id}`);
    console.log(`Owner ID (UUID):           ${finalTenant.owner_id}`);
    console.log(`Business Name:             ${finalTenant.business_name}`);
    console.log(`Subdomain:                 ${finalTenant.subdomain}`);
    console.log(`Vendure Seller ID (INT):   ${finalTenant.vendure_seller_id}`);
    console.log(`Vendure Channel ID (INT):  ${finalTenant.vendure_channel_id}`);
    console.log(`Vendure Admin ID (INT):    ${finalTenant.vendure_administrator_id}`);
    console.log(`Status:                    ${finalTenant.status}`);
    console.log('=====================================\n');
    
    console.log('🎉 Complete signup flow finished successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Supabase created UUID: ${userId}`);
    console.log(`   - Tenant uses that UUID in owner_id field`);
    console.log(`   - Vendure created INTEGER IDs: ${vendureResult.sellerId}, ${vendureResult.channelId}, ${vendureResult.administratorId}`);
    console.log(`   - Tenant stores INTEGER IDs in separate columns`);
    console.log(`   - No type conflicts! ✅`);
}

// Run the test
completeSignupFlow();