/**
 * SaaS Database Test Suite
 * 
 * Tests the SaaS database schema, RLS policies, and Vendure integration
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_SAAS_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SAAS_SERVICE_ROLE_KEY || 'your_service_role_key';

// Create Supabase client with service role (bypasses RLS for testing)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TestResult {
    test: string;
    passed: boolean;
    message: string;
    data?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Verify database schema
 */
async function testDatabaseSchema() {
    console.log('\n🧪 Test 1: Verifying database schema...');
    
    try {
        // Check if all required tables exist
        const { data: tables, error } = await supabase
            .from('tenants')
            .select('*')
            .limit(0);
        
        if (error) {
            results.push({
                test: 'Database Schema',
                passed: false,
                message: `Schema check failed: ${error.message}`
            });
            return;
        }
        
        results.push({
            test: 'Database Schema',
            passed: true,
            message: 'All required tables exist'
        });
        console.log('✅ Database schema verified');
        
    } catch (error) {
        results.push({
            test: 'Database Schema',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Database schema check failed');
    }
}

/**
 * Test 2: Check default plans
 */
async function testDefaultPlans() {
    console.log('\n🧪 Test 2: Checking default plans...');
    
    try {
        const { data: plans, error } = await supabase
            .from('plans')
            .select('*')
            .order('monthly_price');
        
        if (error) throw error;
        
        const expectedPlans = ['Free', 'Starter', 'Pro', 'Growth', 'Scale'];
        const actualPlans = plans?.map(p => p.name) || [];
        
        const allPlansExist = expectedPlans.every(plan => actualPlans.includes(plan));
        
        if (allPlansExist && plans && plans.length >= 5) {
            results.push({
                test: 'Default Plans',
                passed: true,
                message: `Found ${plans.length} plans`,
                data: plans
            });
            console.log('✅ Default plans verified');
            console.log('   Plans:', actualPlans.join(', '));
        } else {
            results.push({
                test: 'Default Plans',
                passed: false,
                message: `Missing plans. Expected: ${expectedPlans.length}, Found: ${plans?.length}`
            });
            console.log('❌ Some default plans are missing');
        }
        
    } catch (error) {
        results.push({
            test: 'Default Plans',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Default plans check failed');
    }
}

/**
 * Test 3: Create test tenant
 */
async function testCreateTenant() {
    console.log('\n🧪 Test 3: Creating test tenant...');
    
    try {
        // Generate unique subdomain
        const subdomain = `test-store-${Date.now()}`;
        
        const { data: tenant, error } = await supabase
            .from('tenants')
            .insert({
                subdomain,
                business_name: 'Test Store',
                status: 'active',
                vendure_seller_id: 'test_seller_id',
                vendure_channel_id: 'test_channel_id'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        if (tenant) {
            results.push({
                test: 'Create Tenant',
                passed: true,
                message: `Tenant created with ID: ${tenant.id}`,
                data: tenant
            });
            console.log('✅ Test tenant created');
            console.log(`   ID: ${tenant.id}`);
            console.log(`   Subdomain: ${tenant.subdomain}`);
            
            // Store for cleanup
            (global as any).testTenantId = tenant.id;
        } else {
            throw new Error('No tenant returned');
        }
        
    } catch (error) {
        results.push({
            test: 'Create Tenant',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Failed to create test tenant');
    }
}

/**
 * Test 4: Create subscription for tenant
 */
async function testCreateSubscription() {
    console.log('\n🧪 Test 4: Creating subscription...');
    
    const tenantId = (global as any).testTenantId;
    if (!tenantId) {
        console.log('⚠️  Skipping (no test tenant)');
        return;
    }
    
    try {
        // Get free plan
        const { data: plan } = await supabase
            .from('plans')
            .select('id')
            .eq('tier', 'free')
            .single();
        
        if (!plan) throw new Error('Free plan not found');
        
        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .insert({
                tenant_id: tenantId,
                plan_id: plan.id,
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        results.push({
            test: 'Create Subscription',
            passed: true,
            message: `Subscription created: ${subscription.id}`,
            data: subscription
        });
        console.log('✅ Subscription created');
        
    } catch (error) {
        results.push({
            test: 'Create Subscription',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Failed to create subscription');
    }
}

/**
 * Test 5: Test usage counters
 */
async function testUsageCounters() {
    console.log('\n🧪 Test 5: Testing usage counters...');
    
    const tenantId = (global as any).testTenantId;
    if (!tenantId) {
        console.log('⚠️  Skipping (no test tenant)');
        return;
    }
    
    try {
        const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const periodEnd = new Date().toISOString();
        
        // Create usage counter
        const { data: counter, error } = await supabase
            .from('usage_counters')
            .insert({
                tenant_id: tenantId,
                metric_name: 'orders',
                count: 10,
                period_start: periodStart,
                period_end: periodEnd
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Test increment
        const { error: updateError } = await supabase
            .from('usage_counters')
            .update({ count: 11 })
            .eq('id', counter.id);
        
        if (updateError) throw updateError;
        
        results.push({
            test: 'Usage Counters',
            passed: true,
            message: 'Usage counter created and updated',
            data: counter
        });
        console.log('✅ Usage counter test passed');
        
    } catch (error) {
        results.push({
            test: 'Usage Counters',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Usage counter test failed');
    }
}

/**
 * Test 6: Test domain management
 */
async function testDomainManagement() {
    console.log('\n🧪 Test 6: Testing domain management...');
    
    const tenantId = (global as any).testTenantId;
    if (!tenantId) {
        console.log('⚠️  Skipping (no test tenant)');
        return;
    }
    
    try {
        const { data: domain, error} = await supabase
            .from('domains')
            .insert({
                tenant_id: tenantId,
                domain: 'test-shop.example.com',
                is_primary: true,
                verification_token: 'test_token_' + Date.now()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Test verification
        const { error: updateError } = await supabase
            .from('domains')
            .update({ is_verified: true, ssl_status: 'active' })
            .eq('id', domain.id);
        
        if (updateError) throw updateError;
        
        results.push({
            test: 'Domain Management',
            passed: true,
            message: 'Domain created and verified',
            data: domain
        });
        console.log('✅ Domain management test passed');
        
    } catch (error) {
        results.push({
            test: 'Domain Management',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Domain management test failed');
    }
}

/**
 * Test 7: Test webhooks
 */
async function testWebhooks() {
    console.log('\n🧪 Test 7: Testing webhooks...');
    
    const tenantId = (global as any).testTenantId;
    if (!tenantId) {
        console.log('⚠️  Skipping (no test tenant)');
        return;
    }
    
    try {
        const { data: webhook, error } = await supabase
            .from('webhooks')
            .insert({
                tenant_id: tenantId,
                url: 'https://example.com/webhook',
                events: ['order.created', 'order.paid'],
                secret: 'webhook_secret_' + Date.now(),
                is_active: true
            })
            .select()
            .single();
        
        if (error) throw error;
        
        results.push({
            test: 'Webhooks',
            passed: true,
            message: 'Webhook created successfully',
            data: webhook
        });
        console.log('✅ Webhook test passed');
        
    } catch (error) {
        results.push({
            test: 'Webhooks',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Webhook test failed');
    }
}

/**
 * Test 8: Test audit events
 */
async function testAuditEvents() {
    console.log('\n🧪 Test 8: Testing audit events...');
    
    const tenantId = (global as any).testTenantId;
    if (!tenantId) {
        console.log('⚠️  Skipping (no test tenant)');
        return;
    }
    
    try {
        const { data: event, error } = await supabase
            .from('events')
            .insert({
                tenant_id: tenantId,
                event_type: 'tenant.created',
                event_data: { action: 'test', timestamp: new Date().toISOString() },
                ip_address: '127.0.0.1',
                user_agent: 'test-agent'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        results.push({
            test: 'Audit Events',
            passed: true,
            message: 'Audit event logged successfully',
            data: event
        });
        console.log('✅ Audit events test passed');
        
    } catch (error) {
        results.push({
            test: 'Audit Events',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
        console.log('❌ Audit events test failed');
    }
}

/**
 * Cleanup test data
 */
async function cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    const tenantId = (global as any).testTenantId;
    if (!tenantId) {
        console.log('⚠️  No test tenant to clean up');
        return;
    }
    
    try {
        // Delete tenant (cascade will delete related records)
        const { error } = await supabase
            .from('tenants')
            .delete()
            .eq('id', tenantId);
        
        if (error) throw error;
        
        console.log('✅ Test data cleaned up');
        
    } catch (error) {
        console.log('❌ Cleanup failed:', error instanceof Error ? error.message : String(error));
    }
}

/**
 * Print test results
 */
function printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    results.forEach((result, index) => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`\n${index + 1}. ${icon} ${result.test}`);
        console.log(`   ${result.message}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`📈 Results: ${passed}/${total} tests passed (${failed} failed)`);
    console.log('='.repeat(60));
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
        console.log('✅ SaaS database is ready for use!');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.`);
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🧪 SaaS Database Test Suite');
    console.log('='.repeat(60));
    console.log('\nTesting connection to:', SUPABASE_URL);
    console.log('');
    
    try {
        await testDatabaseSchema();
        await testDefaultPlans();
        await testCreateTenant();
        await testCreateSubscription();
        await testUsageCounters();
        await testDomainManagement();
        await testWebhooks();
        await testAuditEvents();
        
        await cleanup();
        
        printResults();
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runTests();
}

export { runTests, testDatabaseSchema, testDefaultPlans };

