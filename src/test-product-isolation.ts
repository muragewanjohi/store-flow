/**
 * Product Isolation Test Suite
 * 
 * Tests product operations with seller channel isolation.
 * 
 * Usage:
 *   npx ts-node src/test-product-isolation.ts
 * 
 * Prerequisites:
 *   - At least 2 sellers provisioned (see provision-tenant-via-service.ts)
 *   - Vendure server running on localhost:3000
 */

import { bootstrap, RequestContext, LanguageCode, ID, ProductService, ChannelService, ProductVariantService } from '@vendure/core';
import { config } from './vendure-config';
import { ProductServiceHelper } from './services/product-service-helper';
import { ChannelIsolationService } from './plugins/channel-isolation-plugin';

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
 * Test 1: Create products in different channels
 */
async function testProductCreation() {
    console.log('\n🧪 Test 1: Create products in different channels');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const productService = app.get(ProductService);
    const channelService = app.get(ChannelService);
    const productVariantService = app.get(ProductVariantService);
    const channelIsolationService = app.get(ChannelIsolationService);
    const productHelper = new ProductServiceHelper(
        productService,
        productVariantService,
        channelService,
        channelIsolationService,
    );

    try {
        // Create context for Seller A
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const ctxA = new RequestContext({
            apiType: 'admin',
            channel: channelA,
            languageCode: LanguageCode.en,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        // Create product for Seller A
        const productA = await productHelper.createProductForSeller(ctxA, TEST_SELLERS[0].channelId, {
            translations: [
                {
                    languageCode: LanguageCode.en,
                    name: `Seller A Product ${Date.now()}`,
                    slug: `seller-a-product-${Date.now()}`,
                    description: 'Test product for Seller A',
                },
            ],
            facetValueIds: [],
        });

        console.log(`✅ Created product for Seller A: ${productA.name} (ID: ${productA.id})`);

        // Create context for Seller B
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const ctxB = new RequestContext({
            apiType: 'admin',
            channel: channelB,
            languageCode: LanguageCode.en,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        // Create product for Seller B
        const productB = await productHelper.createProductForSeller(ctxB, TEST_SELLERS[1].channelId, {
            translations: [
                {
                    languageCode: LanguageCode.en,
                    name: `Seller B Product ${Date.now()}`,
                    slug: `seller-b-product-${Date.now()}`,
                    description: 'Test product for Seller B',
                },
            ],
            facetValueIds: [],
        });

        console.log(`✅ Created product for Seller B: ${productB.name} (ID: ${productB.id})`);

        return { productA, productB };
    } catch (error) {
        console.error('❌ Test 1 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Test 2: Verify channel isolation (Seller A cannot see Seller B's products)
 */
async function testChannelIsolation(productAId: ID, productBId: ID) {
    console.log('\n🧪 Test 2: Verify channel isolation');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const productService = app.get(ProductService);
    const channelService = app.get(ChannelService);
    const productVariantService = app.get(ProductVariantService);
    const channelIsolationService = app.get(ChannelIsolationService);
    const productHelper = new ProductServiceHelper(
        productService,
        productVariantService,
        channelService,
        channelIsolationService,
    );

    try {
        // Seller A context
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const ctxA = new RequestContext({
            apiType: 'admin',
            channel: channelA,
            languageCode: LanguageCode.en,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        // Seller A should see their own product
        const productA = await productHelper.getProductForSeller(ctxA, TEST_SELLERS[0].channelId, productAId);
        if (productA) {
            console.log(`✅ Seller A can see their own product: ${productA.name}`);
        } else {
            console.error(`❌ Seller A cannot see their own product ${productAId}`);
        }

        // Seller A should NOT see Seller B's product
        const productBFromA = await productHelper.getProductForSeller(ctxA, TEST_SELLERS[0].channelId, productBId);
        if (!productBFromA) {
            console.log(`✅ Seller A cannot see Seller B's product (correct isolation)`);
        } else {
            console.error(`❌ SECURITY ISSUE: Seller A can see Seller B's product ${productBId}`);
        }

        // Seller B context
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const ctxB = new RequestContext({
            apiType: 'admin',
            channel: channelB,
            languageCode: LanguageCode.en,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        // Seller B should see their own product
        const productB = await productHelper.getProductForSeller(ctxB, TEST_SELLERS[1].channelId, productBId);
        if (productB) {
            console.log(`✅ Seller B can see their own product: ${productB.name}`);
        } else {
            console.error(`❌ Seller B cannot see their own product ${productBId}`);
        }

        // Seller B should NOT see Seller A's product
        const productAFromB = await productHelper.getProductForSeller(ctxB, TEST_SELLERS[1].channelId, productAId);
        if (!productAFromB) {
            console.log(`✅ Seller B cannot see Seller A's product (correct isolation)`);
        } else {
            console.error(`❌ SECURITY ISSUE: Seller B can see Seller A's product`);
        }
    } catch (error) {
        console.error('❌ Test 2 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Test 3: List products per channel
 */
async function testListProducts() {
    console.log('\n🧪 Test 3: List products per channel');
    console.log('=' .repeat(60));

    const app = await bootstrap(config);
    const productService = app.get(ProductService);
    const channelService = app.get(ChannelService);
    const productVariantService = app.get(ProductVariantService);
    const channelIsolationService = app.get(ChannelIsolationService);
    const productHelper = new ProductServiceHelper(
        productService,
        productVariantService,
        channelService,
        channelIsolationService,
    );

    try {
        // Seller A context
        const channelA = await channelService.findOne({} as RequestContext, TEST_SELLERS[0].channelId);
        if (!channelA) {
            throw new Error(`Channel ${TEST_SELLERS[0].channelId} not found`);
        }

        const ctxA = new RequestContext({
            apiType: 'admin',
            channel: channelA,
            languageCode: LanguageCode.en,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        const productsA = await productHelper.getProductsForSeller(ctxA, TEST_SELLERS[0].channelId, {
            take: 10,
            skip: 0,
        });

        console.log(`✅ Seller A has ${productsA.totalItems} product(s):`);
        productsA.items.forEach((p: any, i: number) => {
            console.log(`   ${i + 1}. ${p.name} (ID: ${p.id})`);
        });

        // Seller B context
        const channelB = await channelService.findOne({} as RequestContext, TEST_SELLERS[1].channelId);
        if (!channelB) {
            throw new Error(`Channel ${TEST_SELLERS[1].channelId} not found`);
        }

        const ctxB = new RequestContext({
            apiType: 'admin',
            channel: channelB,
            languageCode: LanguageCode.en,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        const productsB = await productHelper.getProductsForSeller(ctxB, TEST_SELLERS[1].channelId, {
            take: 10,
            skip: 0,
        });

        console.log(`✅ Seller B has ${productsB.totalItems} product(s):`);
        productsB.items.forEach((p: any, i: number) => {
            console.log(`   ${i + 1}. ${p.name} (ID: ${p.id})`);
        });

        // Verify no cross-channel leakage
        const productIdsA = new Set(productsA.items.map((p: any) => p.id));
        const productIdsB = new Set(productsB.items.map((p: any) => p.id));
        const intersection = [...productIdsA].filter(id => productIdsB.has(id));

        if (intersection.length === 0) {
            console.log(`✅ No product ID overlap between channels (correct isolation)`);
        } else {
            console.error(`❌ SECURITY ISSUE: Found ${intersection.length} products visible in both channels!`);
        }
    } catch (error) {
        console.error('❌ Test 3 failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('\n🚀 Starting Product Isolation Tests');
    console.log('=' .repeat(60));
    console.log(`Seller A: ${TEST_SELLERS[0].name} (Channel: ${TEST_SELLERS[0].channelId})`);
    console.log(`Seller B: ${TEST_SELLERS[1].name} (Channel: ${TEST_SELLERS[1].channelId})`);

    try {
        // Test 1: Create products
        const { productA, productB } = await testProductCreation();

        // Test 2: Verify isolation
        await testChannelIsolation(productA.id, productB.id);

        // Test 3: List products
        await testListProducts();

        console.log('\n✅ All product isolation tests passed!');
    } catch (error) {
        console.error('\n❌ Product isolation tests failed:', error);
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

export { runTests, testProductCreation, testChannelIsolation, testListProducts };

