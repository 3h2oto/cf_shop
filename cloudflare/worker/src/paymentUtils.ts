import { Env } from './index'; // Assuming index.ts exports Env

/**
 * Placeholder for webhook verification logic.
 * In a real scenario, this would involve checking signatures, IPs, etc.
 * specific to the payment gateway.
 * @param gatewayName The name of the payment gateway.
 * @param request The incoming Request object from the gateway.
 * @param env The Cloudflare Worker environment.
 * @returns True if the webhook is valid, false otherwise.
 */
export async function verifyWebhook(gatewayName: string, request: Request, env: Env): Promise<boolean> {
    console.log(`Received webhook for gateway: ${gatewayName}`);
    // const body = await request.clone().text(); // Clone to read body multiple times if needed
    // console.log('Webhook Headers:', JSON.stringify(Object.fromEntries(request.headers)));
    // console.log('Webhook Body:', body);
    
    // TODO: Implement actual verification logic for each gateway.
    // Example: Check signature header, verify against a secret stored in env.
    // if (gatewayName === 'stripe') {
    //   const signature = request.headers.get('stripe-signature');
    //   const secret = env.STRIPE_WEBHOOK_SECRET;
    //   // ... verify ...
    // }
    return true; // Placeholder: assume valid for now
}

/**
 * Processes a successful payment notification.
 * @param out_order_id The external order ID.
 * @param gatewayName The name of the payment gateway.
 * @param env The Cloudflare Worker environment.
 * @returns True if processing was successful, false otherwise.
 */
export async function processSuccessfulPayment(
    out_order_id: string, 
    gatewayName: string, // Can be used for logging or specific logic
    env: Env
): Promise<boolean> {
    try {
        console.log(`Processing successful payment for order: ${out_order_id} via ${gatewayName}`);

        // 1. Fetch TempOrder
        const tempOrderStmt = env.DB.prepare(
            'SELECT * FROM TempOrder WHERE trade_no = ? AND status = 0' // trade_no is out_order_id
        );
        const tempOrder = await tempOrderStmt.bind(out_order_id).first<any>(); // Using any for full TempOrder structure

        if (!tempOrder) {
            console.log(`TempOrder ${out_order_id} not found or already processed.`);
            // If already processed (status != 0), it might be a duplicate webhook.
            // If not found, it's an issue.
            // For idempotency, if it was already processed successfully, we might want to return true.
            // To check if it was already processed and moved to Order table:
            const existingOrderStmt = env.DB.prepare('SELECT id FROM Orders WHERE trade_no = ?'); // Changed "Order" to Orders
            const existingOrder = await existingOrderStmt.bind(out_order_id).first();
            if (existingOrder) {
                console.log(`Order ${out_order_id} already exists in Orders table. Assuming already processed.`);
                return true; // Idempotency: already processed
            }
            return false; // Truly not found or status was not 0 initially.
        }

        // --- Begin conceptual transaction ---
        // D1 does not support rollback, so operations must be idempotent or handle partial failures carefully.

        // 2. Update TempOrder status
        const updateTempOrderStmt = env.DB.prepare(
            'UPDATE TempOrder SET status = 1, update_time = ? WHERE id = ?'
        ).bind(Math.floor(Date.now() / 1000), tempOrder.id);
        await updateTempOrderStmt.run();

        // 3. Create Order
        const now = Math.floor(Date.now() / 1000);
        // Added 'card' to the INSERT statement for initial card allocation if available
        const createOrderStmt = env.DB.prepare(
            `INSERT INTO Orders (prod_id, trade_no, num, money, status, create_time, update_time, pay_id, title, email, remark, coupon_code, payment, contact, contact_txt, unit_price, card, auto)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` // Matched fields to schema.sql Orders table, using unit_price.
        ).bind( // money is total_price. unit_price is tempOrder.price
            tempOrder.prod_id, tempOrder.trade_no, tempOrder.num, tempOrder.money, // tempOrder.money is total_price
            1, // status = paid
            tempOrder.create_time, // Use TempOrder's create_time
            now, // update_time
            tempOrder.pay_id, tempOrder.title, tempOrder.email, tempOrder.remark, tempOrder.coupon_code,
            gatewayName, // Store the gateway name that confirmed the payment
            tempOrder.contact, tempOrder.contact_txt, tempOrder.price, /* allocatedCardsContent initially null */ null, tempOrder.auto
        );
        const orderInsertResult = await createOrderStmt.run();
        const newOrderId = orderInsertResult.meta.last_row_id;

        if (!newOrderId) {
            console.error(`Failed to create Order for TempOrder ${out_order_id}. Critical error.`);
            // This is a critical failure point. TempOrder is marked paid but Order creation failed.
            // Manual intervention would be needed. For now, we'll proceed but log heavily.
            // In a real system, might try to revert TempOrder status or queue for retry.
            return false;
        }
        
        let allocatedCardsContent = null;

        // 4. Card Allocation (if tempOrder.auto == 1)
        if (Boolean(tempOrder.auto)) {
            const cardsToAllocate = tempOrder.num;
            // Fetch available cards for the product
            const fetchCardsStmt = env.DB.prepare(
                'SELECT id, card FROM Card WHERE prod_name = ? AND isused = 0 LIMIT ?'
            ).bind(tempOrder.title, cardsToAllocate); // tempOrder.title is product name
            
            const { results: availableCards } = await fetchCardsStmt.all<{ id: number; card: string }>();

            if (!availableCards || availableCards.length < cardsToAllocate) {
                console.error(`CRITICAL: Insufficient cards for product "${tempOrder.title}" (order ${out_order_id}). Expected ${cardsToAllocate}, found ${availableCards?.length || 0}. Stock check should have prevented this.`);
                // This is a major issue. Order is paid, but cards cannot be allocated.
                // Mark order for manual review, potentially refund.
                // For now, we'll proceed without card details in the order.
                // Update Order with an error remark:
                const errorRemark = `Failed to allocate ${cardsToAllocate} cards. Insufficient stock.`;
                await env.DB.prepare('UPDATE Orders SET remark = ? WHERE id = ?').bind( // Changed "Order" to Orders
                    tempOrder.remark ? `${tempOrder.remark}; ${errorRemark}` : errorRemark, 
                    newOrderId
                ).run();
                // Continue processing other parts like sales update, but the order is incomplete.
            } else {
                allocatedCardsContent = availableCards.map(c => c.card).join('\n');
                
                // Update Order with card details (if not inserted initially or needs update)
                const updateOrderCardStmt = env.DB.prepare(
                    'UPDATE Orders SET card = ? WHERE id = ?' // Changed "Order" to Orders
                ).bind(allocatedCardsContent, newOrderId);
                await updateOrderCardStmt.run();

                // Mark cards as used in a batch
                const cardUpdateStatements = availableCards.map(card => 
                    env.DB.prepare('UPDATE Card SET isused = 1, order_id = ? WHERE id = ?').bind(newOrderId, card.id)
                );
                await env.DB.batch(cardUpdateStatements);
            }
        }

        // 5. Update Product Sales
        const updateSalesStmt = env.DB.prepare(
            'UPDATE ProdInfo SET sales = sales + ? WHERE name = ?'
        ).bind(tempOrder.num, tempOrder.title); // tempOrder.title is product name
        await updateSalesStmt.run();

        console.log(`Successfully processed payment and created order for ${out_order_id}.`);
        // Optional: Send notifications (email, webhook to merchant, etc.)
        // await sendOrderConfirmationEmail(tempOrder, allocatedCardsContent);

        return true;

    } catch (e: any) {
        console.error(`Error in processSuccessfulPayment for order ${out_order_id}:`, e);
        return false;
    }
}
