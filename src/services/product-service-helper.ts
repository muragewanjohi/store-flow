/**
 * ProductServiceHelper - Channel-Aware Product Operations
 * 
 * Provides helper utilities for product management with proper channel isolation.
 * Integrates with Vendure's ProductService and ChannelIsolationService.
 * 
 * Usage:
 *   const helper = new ProductServiceHelper(productService, channelIsolation, channelService);
 *   const products = await helper.getProductsForSeller(ctx, sellerId);
 */

import {
    RequestContext,
    ProductService,
    ChannelService,
    Product,
    ID,
    ProductVariantService,
    PaginatedList,
} from '@vendure/core';
import { Injectable } from '@nestjs/common';
import { ChannelIsolationService } from '../plugins/channel-isolation-plugin';

@Injectable()
export class ProductServiceHelper {
    constructor(
        private productService: ProductService,
        private productVariantService: ProductVariantService,
        private channelService: ChannelService,
        private channelIsolation: ChannelIsolationService,
    ) {}

    /**
     * Get products for a specific seller's channel
     * Ensures proper channel isolation
     */
    async getProductsForSeller(
        ctx: RequestContext,
        sellerChannelId: ID,
        options?: any,
    ): Promise<PaginatedList<Product>> {
        // Switch context to seller's channel
        const sellerCtx = await this.channelIsolation.switchToSellerChannel(ctx, sellerChannelId);
        
        if (!sellerCtx) {
            throw new Error(`Failed to switch to seller channel ${sellerChannelId}`);
        }

        // Query products scoped to seller's channel
        return await this.productService.findAll(sellerCtx, options);
    }

    /**
     * Get products for the current authenticated seller
     * Uses the channel from the current request context
     */
    async getProductsForCurrentSeller(
        ctx: RequestContext,
        options?: any,
    ): Promise<PaginatedList<Product>> {
        if (!ctx.activeUserId) {
            throw new Error('User not authenticated');
        }

        // Get seller's channel
        const channelId = await this.channelIsolation.getSellerChannelForUser(ctx, ctx.activeUserId);
        
        if (!channelId) {
            throw new Error('User is not a seller or channel not found');
        }

        return await this.getProductsForSeller(ctx, channelId as unknown as ID, options);
    }

    /**
     * Create a product in a seller's channel
     * Automatically assigns product to seller's channel
     */
    async createProductForSeller(
        ctx: RequestContext,
        sellerChannelId: ID,
        input: any,
    ): Promise<Product> {
        // Switch context to seller's channel
        const sellerCtx = await this.channelIsolation.switchToSellerChannel(ctx, sellerChannelId);
        
        if (!sellerCtx) {
            throw new Error(`Failed to switch to seller channel ${sellerChannelId}`);
        }

        // Create product (automatically scoped to channel)
        const product = await this.productService.create(sellerCtx, input);
        
        // Assign to seller's channel if not already assigned
        const channel = await this.channelService.findOne(sellerCtx, sellerChannelId);
        if (channel) {
            await this.productService.assignProductsToChannel(sellerCtx, {
                channelId: channel.id,
                productIds: [product.id],
            });
        }

        return product;
    }

    /**
     * Create a product for the current authenticated seller
     */
    async createProductForCurrentSeller(
        ctx: RequestContext,
        input: any,
    ): Promise<Product> {
        if (!ctx.activeUserId) {
            throw new Error('User not authenticated');
        }

        const channelId = await this.channelIsolation.getSellerChannelForUser(ctx, ctx.activeUserId);
        
        if (!channelId) {
            throw new Error('User is not a seller or channel not found');
        }

        return await this.createProductForSeller(ctx, channelId as unknown as ID, input);
    }

    /**
     * Update a product (ensures it belongs to seller's channel)
     */
    async updateProductForSeller(
        ctx: RequestContext,
        sellerChannelId: ID,
        input: any,
    ): Promise<Product> {
        // Verify product belongs to seller's channel
        const sellerCtx = await this.channelIsolation.switchToSellerChannel(ctx, sellerChannelId);
        
        if (!sellerCtx) {
            throw new Error(`Failed to switch to seller channel ${sellerChannelId}`);
        }

        // Check if product exists in seller's channel
        const product = await this.productService.findOne(sellerCtx, input.id);
        
        if (!product) {
            throw new Error(`Product ${input.id} not found in seller's channel`);
        }

        // Verify product is assigned to seller's channel
        const isAssigned = product.channels?.some(c => c.id === sellerChannelId);
        
        if (!isAssigned) {
            throw new Error(`Product ${input.id} is not assigned to seller's channel`);
        }

        // Update product
        return await this.productService.update(sellerCtx, input);
    }

    /**
     * Update a product for the current authenticated seller
     */
    async updateProductForCurrentSeller(
        ctx: RequestContext,
        input: any,
    ): Promise<Product> {
        if (!ctx.activeUserId) {
            throw new Error('User not authenticated');
        }

        const channelId = await this.channelIsolation.getSellerChannelForUser(ctx, ctx.activeUserId);
        
        if (!channelId) {
            throw new Error('User is not a seller or channel not found');
        }

        return await this.updateProductForSeller(ctx, channelId as unknown as ID, input);
    }

    /**
     * Delete a product (ensures it belongs to seller's channel)
     */
    async deleteProductForSeller(
        ctx: RequestContext,
        sellerChannelId: ID,
        productId: ID,
    ): Promise<boolean> {
        const sellerCtx = await this.channelIsolation.switchToSellerChannel(ctx, sellerChannelId);
        
        if (!sellerCtx) {
            throw new Error(`Failed to switch to seller channel ${sellerChannelId}`);
        }

        // Verify product belongs to seller's channel
        const product = await this.productService.findOne(sellerCtx, productId);
        
        if (!product) {
            throw new Error(`Product ${productId} not found in seller's channel`);
        }

        const isAssigned = product.channels?.some(c => c.id === sellerChannelId);
        
        if (!isAssigned) {
            throw new Error(`Product ${productId} is not assigned to seller's channel`);
        }

        // Delete product (Vendure uses remove method, not delete)
        // Note: ProductService doesn't have a delete method, use removeProductsFromChannel or similar
        // For now, we'll throw an error indicating this needs implementation
        throw new Error('Product deletion via ProductServiceHelper not yet implemented. Use ProductService directly.');
    }

    /**
     * Get a single product (ensures channel isolation)
     */
    async getProductForSeller(
        ctx: RequestContext,
        sellerChannelId: ID,
        productId: ID,
    ): Promise<Product | null> {
        const sellerCtx = await this.channelIsolation.switchToSellerChannel(ctx, sellerChannelId);
        
        if (!sellerCtx) {
            throw new Error(`Failed to switch to seller channel ${sellerChannelId}`);
        }

        const product = await this.productService.findOne(sellerCtx, productId);
        
        if (!product) {
            return null;
        }

        // Verify product is in seller's channel
        const isAssigned = product.channels?.some(c => c.id === sellerChannelId);
        
        if (!isAssigned) {
            return null; // Product exists but not in seller's channel
        }

        return product;
    }

    /**
     * Verify product belongs to seller's channel
     */
    async verifyProductOwnership(
        ctx: RequestContext,
        sellerChannelId: ID,
        productId: ID,
    ): Promise<boolean> {
        try {
            const product = await this.getProductForSeller(ctx, sellerChannelId, productId);
            return product !== null;
        } catch (error) {
            console.error('[ProductServiceHelper] Error verifying ownership:', error);
            return false;
        }
    }
}

