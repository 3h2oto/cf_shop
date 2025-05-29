import { IRequest, Router, error, text, json } from 'itty-router';
import { Env } from './index'; // Assuming index.ts exports Env
import { verifyWebhook, processSuccessfulPayment } from './paymentUtils'; // Import utility functions

const webhookRouter = Router({ base: '/notify' }); // Base path for webhook routes

// POST /notify/:gatewayName
webhookRouter.post('/:gatewayName', async (request: IRequest, env: Env) => {
    const gatewayName = request.params?.gatewayName;
    if (!gatewayName) {
        return new Response("Gateway name missing.", { status: 400 });
    }

    console.log(`Webhook received for gateway: ${gatewayName}`);

    // 1. Verify Webhook (Placeholder)
    const isValidWebhook = await verifyWebhook(gatewayName, request, env);
    if (!isValidWebhook) {
        console.warn(`Webhook verification failed for gateway: ${gatewayName}`);
        return new Response("Webhook verification failed.", { status: 400 });
    }
    console.log(`Webhook verified for gateway: ${gatewayName}`);

    // 2. Extract out_order_id and is_paid_status (Highly Gateway-Specific)
    // This part needs to be customized for each payment gateway.
    // We'll assume a generic JSON body for now, or try to parse based on common patterns.
    let out_order_id: string | undefined;
    let is_paid_status: boolean = false; // Default to not paid

    try {
        const payload = await request.json(); // Assuming JSON payload
        console.log(`Webhook payload for ${gatewayName}:`, JSON.stringify(payload));

        // Example extraction logic (to be heavily customized)
        // This is a very generic example. Real gateways have diverse structures.
        if (payload.order_id) out_order_id = payload.order_id as string;
        else if (payload.out_trade_no) out_order_id = payload.out_trade_no as string;
        else if (payload.data?.object?.id && gatewayName.includes('stripe')) { // Example for Stripe
             // Stripe often uses event types, you might need to check event type first
             // if (payload.type === 'checkout.session.completed') {
             //    out_order_id = payload.data.object.client_reference_id; // If you set this
             //    is_paid_status = true; // Or check payment_status
             // }
        }
        
        if (payload.status === 'paid' || payload.status === 'succeeded' || payload.trade_status === 'TRADE_SUCCESS' || payload.payment_status === 'COMPLETED') {
            is_paid_status = true;
        }
        // If specific to gateway
        if (gatewayName.toLowerCase().includes('alipay') && payload.trade_status === 'TRADE_SUCCESS') {
            is_paid_status = true;
            out_order_id = payload.out_trade_no as string;
        } else if (gatewayName.toLowerCase().includes('wechat') && payload.result_code === 'SUCCESS' && payload.return_code === 'SUCCESS') {
            is_paid_status = true;
            out_order_id = payload.out_trade_no as string;
        }
        // Add more gateway-specific parsing logic here...

        if (!out_order_id) {
            console.error(`Could not extract out_order_id from webhook for ${gatewayName}. Payload:`, payload);
            return new Response("Could not determine order ID from webhook.", { status: 400 });
        }

    } catch (e: any) {
        console.error(`Error parsing webhook payload for ${gatewayName}: ${e.message}. Attempting to read as text.`);
        // Fallback to text if JSON parsing fails, some gateways might send form data
        try {
            const textPayload = await request.text();
            console.log(`Webhook text payload for ${gatewayName}:`, textPayload);
            // TODO: Implement parsing for form-data or XML if necessary for specific gateways
            // For now, if JSON fails, we can't proceed with generic logic.
        } catch (textErr: any) {
            console.error(`Error reading webhook payload as text for ${gatewayName}: ${textErr.message}`);
        }
        return new Response("Invalid webhook payload format.", { status: 400 });
    }

    // 3. Process Payment if Paid
    if (is_paid_status && out_order_id) {
        console.log(`Processing successful payment for order ${out_order_id} from ${gatewayName}`);
        const processingResult = await processSuccessfulPayment(out_order_id, gatewayName, env);
        
        if (processingResult) {
            // Return success response to gateway
            // This is also gateway-specific.
            if (gatewayName.toLowerCase().includes("alipay")) {
                return new Response("success"); // Alipay expects "success" plain text
            } else if (gatewayName.toLowerCase().includes("wechat")) {
                return new Response("<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>", {
                    headers: { 'Content-Type': 'application/xml' }
                });
            }
            // Default success response
            return new Response("SUCCESS", { status: 200 });
        } else {
            console.error(`Failed to process payment for order ${out_order_id} from ${gatewayName} in backend.`);
            // Even if backend processing fails, gateway might have already considered payment successful.
            // Return 500 to indicate server-side issue, but gateway might retry or ignore.
            return new Response("Internal server error during payment processing.", { status: 500 });
        }
    } else if (!is_paid_status && out_order_id) {
        console.log(`Webhook for order ${out_order_id} from ${gatewayName} does not indicate successful payment (status: ${is_paid_status}).`);
        // Acknowledge receipt for non-success notifications if needed
        return new Response("Webhook received, but payment not successful or status unknown.", { status: 200 });
    } else {
        console.log(`Webhook from ${gatewayName} did not provide a clear paid status or order ID.`);
        return new Response("Webhook processed (status inconclusive).", { status: 200 });
    }
});


// Catch-all for any other methods or paths under /notify
webhookRouter.all('*', () => new Response('Not found or method not allowed.', { status: 404 }));

export default webhookRouter;
