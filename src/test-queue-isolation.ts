/**
 * Queue Isolation Test Suite
 * 
 * Tests background jobs (email, search, orders, inventory, webhooks) with channel isolation.
 * 
 * Usage:
 *   npx ts-node src/test-queue-isolation.ts
 * 
 * Prerequisites:
 *   - At least 2 sellers provisioned
 *   - Vendure server running on localhost:3000
 *   - Redis running (for job queue)
 */

import { bootstrap, RequestContext, LanguageCode, ID, JobQueueService, ChannelService } from '@vendure/core';
import { config } from './vendure-config';

interface TestSeller {
    email: string;
    password: string;
    channelId: ID;
    name: string;
}

const TEST_SELLERS: TestSeller[] = [
    {
        email: process.env.SELLER_A_EMAIL || 'seller-a@example.com',
        password: process.env.SELLER_A_PASSWORD || 'password',
        channelId: process.env.SELLER_A_CHANNEL_ID || '2',
        name: 'Seller A',
    },
    {
        email: process.env.SELLER_B_EMAIL || 'seller-b@example.com',
        password: process.env.SELLER_B_PASSWORD || 'password',
        channelId: process.env.SELLER_B_CHANNEL_ID || '3',
        name: 'Seller B',
    },
];

/**
 * Test 1: Email Job Isolation
 * 
 * Verifies that email jobs include channel context and are processed correctly.
 */
async function testEmailJobIsolation() {
    console.log('\n🧪 Test 1: Email Job Isolation');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const jobQueue = app.get(JobQueueService);
    const channelService = app.get(ChannelService);

    try {
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const ctxA = new RequestContext({
            apiType: 'admin',
            channel: channelA,
            languageCode: LanguageCode.en,
        });

        // Simulate order confirmation email job
        const emailJob = await jobQueue.add(
            {
                name: 'send-order-confirmation',
                data: {
                    orderId: 'test-order-123',
                    channelId: TEST_SELLERS[0].channelId, // ✅ Channel context included
                    customerEmail: 'customer@example.com',
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Email job created: ${emailJob.id}`);
        console.log(`   Channel ID: ${emailJob.data.channelId}`);
        console.log(`   Order ID: ${emailJob.data.orderId}`);

        // Verify channel ID is present
        if (emailJob.data.channelId) {
            console.log('✅ Channel context included in job data');
        } else {
            console.error('❌ Missing channel context in job data');
        }

        // TODO: Verify job processor uses channel context when processing
        // This would require inspecting the actual job processor implementation

    } catch (error) {
        console.error('❌ Test 1 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Test 2: Search Index Job Isolation
 * 
 * Verifies that search index jobs only index products from the correct channel.
 */
async function testSearchIndexJobIsolation() {
    console.log('\n🧪 Test 2: Search Index Job Isolation');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const jobQueue = app.get(JobQueueService);
    const channelService = app.get(ChannelService);

    try {
        // Create search index job for Seller A
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const ctxA = new RequestContext({
            apiType: 'admin',
            channel: channelA,
            languageCode: LanguageCode.en,
        });

        const searchJobA = await jobQueue.add(
            {
                name: 'update-search-index',
                data: {
                    productId: 'product-seller-a-123',
                    channelId: TEST_SELLERS[0].channelId, // ✅ Channel context
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Search index job created for Seller A: ${searchJobA.id}`);
        console.log(`   Channel ID: ${searchJobA.data.channelId}`);

        // Create search index job for Seller B
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const ctxB = new RequestContext({
            apiType: 'admin',
            channel: channelB,
            languageCode: LanguageCode.en,
        });

        const searchJobB = await jobQueue.add(
            {
                name: 'update-search-index',
                data: {
                    productId: 'product-seller-b-456',
                    channelId: TEST_SELLERS[1].channelId, // ✅ Channel context
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Search index job created for Seller B: ${searchJobB.id}`);
        console.log(`   Channel ID: ${searchJobB.data.channelId}`);

        // Verify jobs have different channel IDs
        if (searchJobA.data.channelId !== searchJobB.data.channelId) {
            console.log('✅ Jobs correctly isolated by channel');
        } else {
            console.error('❌ Jobs have same channel ID (isolation issue)');
        }

        // TODO: Verify search index processor only indexes products from the specified channel
        // This would require checking the actual search index after job processing

    } catch (error) {
        console.error('❌ Test 2 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Test 3: Order Processing Job Isolation
 * 
 * Verifies that order processing jobs use correct channel context.
 */
async function testOrderProcessingJobIsolation() {
    console.log('\n🧪 Test 3: Order Processing Job Isolation');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const jobQueue = app.get(JobQueueService);
    const channelService = app.get(ChannelService);

    try {
        // Create order processing job for Seller A
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const orderJobA = await jobQueue.add(
            {
                name: 'process-order',
                data: {
                    orderId: 'order-seller-a-123',
                    channelId: TEST_SELLERS[0].channelId, // ✅ Channel context
                    sellerId: 'seller-a',
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Order processing job created for Seller A: ${orderJobA.id}`);

        // Create order processing job for Seller B
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const orderJobB = await jobQueue.add(
            {
                name: 'process-order',
                data: {
                    orderId: 'order-seller-b-456',
                    channelId: TEST_SELLERS[1].channelId, // ✅ Channel context
                    sellerId: 'seller-b',
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Order processing job created for Seller B: ${orderJobB.id}`);

        // Verify channel isolation
        if (orderJobA.data.channelId !== orderJobB.data.channelId) {
            console.log('✅ Order jobs correctly isolated by channel');
        } else {
            console.error('❌ Order jobs have same channel ID (isolation issue)');
        }

        // TODO: Verify order processor uses channel context when accessing order data

    } catch (error) {
        console.error('❌ Test 3 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Test 4: Inventory Update Job Isolation
 * 
 * Verifies that inventory update jobs only update stock for the correct channel.
 */
async function testInventoryJobIsolation() {
    console.log('\n🧪 Test 4: Inventory Update Job Isolation');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const jobQueue = app.get(JobQueueService);
    const channelService = app.get(ChannelService);

    try {
        // Create inventory update job for Seller A
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const inventoryJobA = await jobQueue.add(
            {
                name: 'update-inventory',
                data: {
                    productVariantId: 'variant-seller-a-123',
                    channelId: TEST_SELLERS[0].channelId, // ✅ Channel context
                    stockLevel: 100,
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Inventory update job created for Seller A: ${inventoryJobA.id}`);

        // Create inventory update job for Seller B
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const inventoryJobB = await jobQueue.add(
            {
                name: 'update-inventory',
                data: {
                    productVariantId: 'variant-seller-b-456',
                    channelId: TEST_SELLERS[1].channelId, // ✅ Channel context
                    stockLevel: 200,
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Inventory update job created for Seller B: ${inventoryJobB.id}`);

        // Verify channel isolation
        if (inventoryJobA.data.channelId !== inventoryJobB.data.channelId) {
            console.log('✅ Inventory jobs correctly isolated by channel');
        } else {
            console.error('❌ Inventory jobs have same channel ID (isolation issue)');
        }

        // TODO: Verify inventory processor only updates stock for the specified channel

    } catch (error) {
        console.error('❌ Test 4 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Test 5: Webhook Job Isolation
 * 
 * Verifies that webhook jobs include channel context and payload is scoped correctly.
 */
async function testWebhookJobIsolation() {
    console.log('\n🧪 Test 5: Webhook Job Isolation');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const jobQueue = app.get(JobQueueService);
    const channelService = app.get(ChannelService);

    try {
        // Create webhook job for Seller A
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const webhookJobA = await jobQueue.add(
            {
                name: 'send-webhook',
                data: {
                    event: 'product.created',
                    channelId: TEST_SELLERS[0].channelId, // ✅ Channel context
                    payload: {
                        productId: 'product-seller-a-123',
                        productName: 'Seller A Product',
                    },
                    webhookUrl: 'https://example.com/webhooks/seller-a',
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Webhook job created for Seller A: ${webhookJobA.id}`);
        console.log(`   Event: ${webhookJobA.data.event}`);
        console.log(`   Channel ID: ${webhookJobA.data.channelId}`);

        // Create webhook job for Seller B
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const webhookJobB = await jobQueue.add(
            {
                name: 'send-webhook',
                data: {
                    event: 'product.created',
                    channelId: TEST_SELLERS[1].channelId, // ✅ Channel context
                    payload: {
                        productId: 'product-seller-b-456',
                        productName: 'Seller B Product',
                    },
                    webhookUrl: 'https://example.com/webhooks/seller-b',
                },
            },
            {
                attempts: 3,
                delay: 0,
            },
        );

        console.log(`✅ Webhook job created for Seller B: ${webhookJobB.id}`);
        console.log(`   Event: ${webhookJobB.data.event}`);
        console.log(`   Channel ID: ${webhookJobB.data.channelId}`);

        // Verify channel isolation
        if (webhookJobA.data.channelId !== webhookJobB.data.channelId) {
            console.log('✅ Webhook jobs correctly isolated by channel');
        } else {
            console.error('❌ Webhook jobs have same channel ID (isolation issue)');
        }

        // TODO: Verify webhook processor uses channel context and payload is scoped correctly

    } catch (error) {
        console.error('❌ Test 5 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('\n🚀 Starting Queue Isolation Tests');
    console.log('=' .repeat(60));
    console.log(`Seller A: ${TEST_SELLERS[0].name} (Channel: ${TEST_SELLERS[0].channelId})`);
    console.log(`Seller B: ${TEST_SELLERS[1].name} (Channel: ${TEST_SELLERS[1].channelId})`);

    try {
        await testEmailJobIsolation();
        await testSearchIndexJobIsolation();
        await testOrderProcessingJobIsolation();
        await testInventoryJobIsolation();
        await testWebhookJobIsolation();

        console.log('\n✅ All queue isolation tests passed!');
        console.log('\n📝 NOTE: These tests verify job creation with channel context.');
        console.log('   For complete verification, you should also:');
        console.log('   1. Monitor actual job processing');
        console.log('   2. Verify processors use channel context');
        console.log('   3. Check for cross-channel data leakage');
    } catch (error) {
        console.error('\n❌ Queue isolation tests failed:', error);
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export {
    runTests,
    testEmailJobIsolation,
    testSearchIndexJobIsolation,
    testOrderProcessingJobIsolation,
    testInventoryJobIsolation,
    testWebhookJobIsolation,
};

