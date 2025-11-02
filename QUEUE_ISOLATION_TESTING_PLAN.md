# **Queue Isolation Testing Plan**

## **🎯 Overview**

Background jobs (email sending, search indexing, order processing, etc.) must be **channel-aware** to ensure complete multi-tenant isolation. This document outlines the testing strategy for queue isolation.

---

## **🚨 Why Queue Isolation Matters**

In a multi-tenant system, background jobs can:
- Send emails to wrong tenants
- Index products from wrong channels
- Process orders for wrong sellers
- Access unauthorized data

**We need:** Jobs to automatically include `RequestContext` with the correct channel.

---

## **📋 Current State**

### **Vendure Job Queue Setup**
- ✅ **DefaultJobQueuePlugin** configured (uses database buffer)
- ✅ Redis/BullMQ available for job processing
- ✅ Jobs can be scheduled and processed

### **Missing:**
- ❌ No channel context in job data
- ❌ No job isolation testing
- ❌ No verification that jobs respect channel boundaries

---

## **🧪 Testing Plan**

### **Test 1: Email Job Isolation**

**Scenario:** Seller A triggers order confirmation email

**Test Steps:**
1. Create product in Seller A's channel
2. Place order in Seller A's channel
3. Trigger order confirmation email job
4. Verify email sent to correct customer
5. Verify email contains Seller A's branding/channel data
6. Verify Seller B does NOT receive email

**Expected Result:**
- ✅ Email job includes `RequestContext` with Seller A's channel
- ✅ Email content scoped to Seller A's channel
- ✅ No cross-channel email leakage

---

### **Test 2: Search Index Job Isolation**

**Scenario:** Seller B adds a product, search index job runs

**Test Steps:**
1. Login as Seller A → Query products (should not see Seller B's product)
2. Login as Seller B → Add product → Trigger search indexing job
3. Wait for index job to complete
4. Login as Seller A → Search products
5. Verify Seller A cannot see Seller B's product in search results

**Expected Result:**
- ✅ Search index job includes channel ID
- ✅ Products indexed only in seller's channel scope
- ✅ Cross-channel search results blocked

---

### **Test 3: Order Processing Job Isolation**

**Scenario:** Multiple sellers have pending orders

**Test Steps:**
1. Create order for Seller A
2. Create order for Seller B
3. Trigger order processing jobs
4. Verify Seller A's order processed with Seller A's channel context
5. Verify Seller B's order processed with Seller B's channel context
6. Check that Seller A cannot see Seller B's order processing jobs

**Expected Result:**
- ✅ Each order processing job uses correct channel context
- ✅ Job data includes `channelId`
- ✅ Jobs isolated per channel

---

### **Test 4: Inventory Update Job Isolation**

**Scenario:** Stock level updates triggered from multiple channels

**Test Steps:**
1. Seller A updates product stock
2. Seller B updates different product stock
3. Trigger inventory sync jobs
4. Verify Seller A's inventory job only updates Seller A's products
5. Verify Seller B's inventory job only updates Seller B's products

**Expected Result:**
- ✅ Inventory jobs scoped to correct channel
- ✅ No cross-channel stock updates

---

### **Test 5: Webhook Job Isolation**

**Scenario:** Webhooks triggered for different sellers

**Test Steps:**
1. Seller A creates product → Triggers `products/create` webhook
2. Seller B creates product → Triggers `products/create` webhook
3. Verify webhook jobs include channel ID
4. Verify webhook payload contains only seller's channel data
5. Verify webhook handlers process with correct channel context

**Expected Result:**
- ✅ Webhook jobs include `channelId` in metadata
- ✅ Webhook payloads scoped to sender's channel
- ✅ Handlers use correct channel context

---

## **🔧 Implementation Requirements**

### **1. Channel-Aware Job Creation**

When creating jobs, include channel context:

```typescript
// Example: Email job creation
await jobQueue.add('send-order-confirmation', {
    orderId: order.id,
    channelId: ctx.channel.id, // ✅ Include channel context
    administratorId: ctx.activeUserId,
}, {
    attempts: 3,
    delay: 0,
});
```

### **2. Channel-Aware Job Processing**

Job processors must restore channel context:

```typescript
// Example: Email job processor
@Injectable()
export class OrderConfirmationEmailProcessor implements JobQueueStrategy {
    async process(job: Job) {
        const { orderId, channelId } = job.data;
        
        // ✅ Restore channel context
        const channel = await channelService.findOne(ctx, channelId);
        const ctx = new RequestContext({
            apiType: 'admin',
            channel: channel,
            // ... other context
        });
        
        // Process with correct channel context
        const order = await orderService.findOne(ctx, orderId);
        // ... send email scoped to channel
    }
}
```

### **3. Job Query Isolation**

When querying jobs, filter by channel (for sellers):

```typescript
// Sellers should only see their channel's jobs
if (isSeller) {
    const jobs = await jobQueue.findJobs({
        // ✅ Filter by channel ID
        channelId: sellerChannelId,
    });
}
```

---

## **📝 Test Script Structure**

### **`test-queue-isolation.ts`**

```typescript
/**
 * Test suite for queue isolation in multi-tenant setup
 * 
 * Tests:
 * 1. Email job channel isolation
 * 2. Search index job channel isolation
 * 3. Order processing job channel isolation
 * 4. Inventory update job channel isolation
 * 5. Webhook job channel isolation
 */

async function testQueueIsolation() {
    // Test 1: Email isolation
    await testEmailJobIsolation();
    
    // Test 2: Search index isolation
    await testSearchIndexJobIsolation();
    
    // Test 3: Order processing isolation
    await testOrderProcessingJobIsolation();
    
    // Test 4: Inventory update isolation
    await testInventoryJobIsolation();
    
    // Test 5: Webhook isolation
    await testWebhookJobIsolation();
}
```

---

## **📅 Suggested Timeline**

Add to **Day 9** or create a new **Day 9.5**:

- [ ] **Day 9.5: Queue Isolation Testing**
  - [ ] Create test suite for queue isolation
  - [ ] Test email job channel awareness
  - [ ] Test search index job channel awareness
  - [ ] Test order processing job channel awareness
  - [ ] Test inventory update job channel awareness
  - [ ] Test webhook job channel awareness
  - [ ] Fix any isolation issues found
  - [ ] Document job creation patterns with channel context

---

## **🎯 Success Criteria**

✅ All background jobs include channel context  
✅ Jobs process data only within their channel scope  
✅ Cross-channel data leakage prevented  
✅ Job queries filtered by channel for sellers  
✅ Comprehensive test coverage for all job types

---

## **📚 Related Documentation**

- [Vendure Job Queue](https://docs.vendure.io/guides/developer-guide/job-queue/)
- [RequestContext](https://docs.vendure.io/reference/typescript-api/request/request-context/)
- [Channel Isolation Plugin](./src/plugins/channel-isolation-plugin.ts)
- [Channel Isolation Testing](./src/test-channel-isolation.ts)

