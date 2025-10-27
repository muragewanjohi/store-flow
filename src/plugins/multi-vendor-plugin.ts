import {
    Channel,
    ChannelService,
    CustomFields,
    EntityHydrator,
    idsAreEqual,
    OrderSellerStrategy,
    RequestContext,
    ShippingEligibilityChecker,
    ShippingLineAssignmentStrategy,
    OrderLine,
    Order,
    ShippingLine,
    ID,
    SplitOrderContents,
    OrderState,
    LanguageCode,
} from '@vendure/core';

const DEFAULT_CHANNEL_CODE = 'default';

class MultiVendorOrderSellerStrategyClass implements OrderSellerStrategy {
    constructor(
        private channelService?: ChannelService,
        private entityHydrator?: EntityHydrator,
    ) {}

    async setOrderLineSellerChannel(ctx: RequestContext, orderLine: OrderLine): Promise<Channel | undefined> {
        if (!this.channelService || !this.entityHydrator) {
            return undefined;
        }
        await this.entityHydrator.hydrate(ctx, orderLine.productVariant, { relations: ['channels'] });
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);

        // If a ProductVariant is assigned to exactly 2 Channels, then one is the default Channel
        // and the other is the seller's Channel.
        if (orderLine.productVariant.channels.length === 2) {
            const sellerChannel = orderLine.productVariant.channels.find(
                c => !idsAreEqual(c.id, defaultChannel.id),
            );
            if (sellerChannel) {
                return sellerChannel;
            }
        }
        
        // If the variant is only assigned to one channel (the default), 
        // return undefined to use default behavior
        return undefined;
    }

    async splitOrder(ctx: RequestContext, order: Order): Promise<SplitOrderContents[]> {
        if (!this.channelService) {
            // Return order as-is for single channel
            // Get the first channel ID from order's channels
            const channelId = order.channels && order.channels.length > 0 ? order.channels[0].id : '';
            return [
                {
                    channelId,
                    state: order.state as OrderState,
                    lines: order.lines,
                    shippingLines: [],
                },
            ];
        }
        
        // Group order lines by their seller channel
        const linesByChannel = new Map<ID, OrderLine[]>();
        
        for (const line of order.lines) {
            if (line.sellerChannelId) {
                const channelId = line.sellerChannelId;
                if (!linesByChannel.has(channelId)) {
                    linesByChannel.set(channelId, []);
                }
                linesByChannel.get(channelId)!.push(line);
            }
        }

        // If all lines belong to the same seller or no seller channels, return single order
        if (linesByChannel.size === 0) {
            const channelId = order.channels && order.channels.length > 0 ? order.channels[0].id : '';
            return [
                {
                    channelId,
                    state: order.state as OrderState,
                    lines: order.lines,
                    shippingLines: [],
                },
            ];
        }

        // Split order by seller channels
        const splitOrders: SplitOrderContents[] = [];
        for (const [channelId, orderLines] of linesByChannel) {
            splitOrders.push({
                channelId,
                state: order.state as OrderState,
                lines: orderLines,
                shippingLines: [],
            });
        }

        return splitOrders;
    }

    async afterSellerOrdersCreated(ctx: RequestContext, aggregateOrder: Order, sellerOrders: Order[]): Promise<void> {
        // Add any post-processing logic here, such as:
        // - Calculating platform fees
        // - Creating commission records
        // - Sending notifications to sellers
        // For MVP, this can be left empty
    }
}

export const multiVendorShippingEligibilityChecker = new ShippingEligibilityChecker({
    code: 'multi-vendor-shipping-checker',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Multi-vendor shipping eligibility checker',
        },
    ],
    args: {},
    check: async (ctx, order, args, method) => {
        // We need to hydrate the method and order with the necessary relations
        // This is a simplified check - in production you'd want more robust logic
        return true;
    },
});

class MultiVendorShippingLineAssignmentStrategyClass implements ShippingLineAssignmentStrategy {
    constructor(
        private channelService?: ChannelService,
        private entityHydrator?: EntityHydrator,
    ) {}

    async assignShippingLineToOrderLines(ctx: RequestContext, shippingLine: ShippingLine, order: Order) {
        if (!this.channelService || !this.entityHydrator) {
            return order.lines;
        }
        
        // First we need to ensure the required relations are available
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        
        await this.entityHydrator.hydrate(ctx, shippingLine, { relations: ['shippingMethod.channels'] });
        const { channels } = shippingLine.shippingMethod;

        // We assume that, if a ShippingMethod is assigned to exactly 2 Channels,
        // then one is the default Channel and the other is the seller's Channel.
        if (channels.length === 2) {
            const sellerChannel = channels.find(c => !idsAreEqual(c.id, defaultChannel.id));
            if (sellerChannel) {
                // Once we have established the seller's Channel, we can filter the OrderLines
                // that belong to that Channel.
                return order.lines.filter(line => idsAreEqual(line.sellerChannelId, sellerChannel.id));
            }
        }
        
        return order.lines;
    }
}

// Note: Channel entity already has a built-in 'sellerId' field in Vendure v3.x
// We don't need to add custom fields for multi-vendor support

// Export the strategies for use in config
export const multiVendorOrderSellerStrategy = new MultiVendorOrderSellerStrategyClass();
export const multiVendorShippingLineAssignmentStrategy = new MultiVendorShippingLineAssignmentStrategyClass();

