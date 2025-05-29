import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts

// --- Interfaces ---
interface SystemConfigItem {
    name: string; // Corresponds to 'key' or 'name' in Config table based on schema used
    info: string; // Corresponds to 'value' or 'info' in Config table
}

interface PaymentMethod {
    id: number;
    name: string;
    icon: string;
}

interface SystemInfoResponse {
    configs: Record<string, string>; // Key-value pair for configs
    payment_methods: PaymentMethod[];
}

interface ProductInfoUser {
    id: number;
    cag_name: string;
    name: string;
    info?: string;
    img_url?: string;
    sort: number;
    price: number;
    price_wholesale?: string;
    auto: boolean;
    sales: number;
    tag?: string;
    isactive: boolean; // Keep for filtering, might not be sent to user directly
    stock_status?: string; // "充足", "少量", "缺货"
}

interface ProductCategoryUser {
    cag_name: string; // Original field name from Python response
    shops: ProductInfoUser[];
}

interface ProductsListResponse {
    theme: string;
    categories: ProductCategoryUser[];
    // flat_products_list?: ProductInfoUser[]; // Optional, as per instructions
}

interface ProductDetailResponse extends ProductInfoUser {
    stock_value: number;
    pifa?: {
        nums: string[];
        prices: number[];
        slice: string[];
    };
}

interface OrderSearchBody {
    contact: string;
}

interface OrderSearchResultItem {
    out_order_id: string;
    name: string;
    contact: string;
    card: string; // Assuming 'card' content is directly in Order table
    updatetime: string; // YYYY-MM-DD HH:MM
}

interface PaymentInitiateBody {
    out_order_id: string;
    name: string; // product name
    payment_method: string;
    contact: string;
    contact_txt?: string;
    num: number;
}

interface PaymentInitiateResponse {
    qr_url?: string; // Example field, actual fields depend on gateway
    payment_url?: string;
    success: boolean;
    message?: string;
    // Add other fields specific to payment gateway responses
}

// Placeholder for actual gateway interaction logic
async function getPaymentGatewayDetails(
    paymentMethod: string, 
    outOrderId: string, 
    totalPrice: number, 
    env: Env
): Promise<{ payment_url?: string; success: boolean; error?: string, qr_url?: string }> {
    // In a real scenario, this function would:
    // 1. Fetch gateway configuration from `Payment` table based on `paymentMethod`.
    // 2. Make an API call to the payment gateway with order details.
    // 3. Return the payment URL or parameters.
    
    // For now, returning a dummy success response
    console.log(`Initiating payment via ${paymentMethod} for order ${outOrderId} with total ${totalPrice}`);
    // Simulate different responses based on gateway for example
    if (paymentMethod.toLowerCase().includes("alipay")) {
        return { payment_url: `https://example.com/pay/alipay/${outOrderId}`, success: true, qr_url: `alipay://pay?orderId=${outOrderId}` };
    } else if (paymentMethod.toLowerCase().includes("wechat")) {
         return { payment_url: `https://example.com/pay/wechat/${outOrderId}`, success: true, qr_url: `weixin://pay/bizpayurl?pr=XXXXXX` };
    }
    return { payment_url: `https://example.com/pay/placeholder/${outOrderId}`, success: true };
}


const userRouter = Router({ base: '/api/v2' });

// GET /api/v2/system_info
userRouter.get('/system_info', async (request: IRequest, env: Env) => {
    try {
        // Fetch relevant system configurations using the target schema:
        // Config(id, name, info, description, isshow, updatetime)
        // 'name' is the key, 'info' is the value.
        const relevantConfigNames = [
            'web_name',             // Site name
            'web_keyword',          // SEO Keywords
            'description',          // SEO Description (using 'description' as name from original python)
            'web_url',              // Site URL
            'web_footer',           // Copyright
            'top_notice',           // Top notice text
            'toast_notice',         // Toast notice text
            'tos_url',              // Terms of Service URL (new)
            'privacy_policy_url',   // Privacy Policy URL (new)
            // 'web_bg_url',        // Not in original python config list for direct mapping
            // 'contact_us',        // Not in original python config list
            // 'contact_option',    // Not in original python config list
        ];
        
        const placeholders = relevantConfigNames.map(() => '?').join(',');
        const configStmt = env.DB.prepare(
            `SELECT name, info FROM Config WHERE name IN (${placeholders}) AND isshow = 1`
        ).bind(...relevantConfigNames);

        // Fetch active payment methods
        const paymentMethodsStmt = env.DB.prepare(
            'SELECT id, name, icon FROM Payment WHERE isactive = 1 ORDER BY id'
        );

        const [configResults, paymentMethodsResults] = await Promise.all([
            configStmt.all<{ name: string; info: string }>(),
            paymentMethodsStmt.all<PaymentMethod>()
        ]);

        const configsMap: Record<string, string> = {};
        if (configResults?.results) {
            configResults.results.forEach(row => {
                configsMap[row.name] = row.info;
            });
        }

        // top_notice and toast_notice are now fetched from Config table directly.
        // If any specific keys were missed from relevantConfigNames but expected by frontend,
        // they will be absent from configsMap.

        const response: SystemInfoResponse = {
            configs: configsMap,
            payment_methods: paymentMethodsResults?.results || []
        };

        return json(response);

    } catch (e: any) {
        console.error('Error fetching system info:', e);
        return error(500, 'Failed to fetch system information: ' + e.message);
    }
});


// GET /api/v2/products_list
userRouter.get('/products_list', async (request: IRequest, env: Env) => {
    try {
        // Fetch theme name using target Config schema: (name, info) where name = 'theme'
        const themeStmt = env.DB.prepare("SELECT info FROM Config WHERE name = 'theme' AND isshow = 1");
        
        // Fetch all active products
        // ProdInfo schema: (id, cag_name, name, info, img_url, sort, discription, price, price_wholesale, auto, sales, tag, isactive)
        const productsStmt = env.DB.prepare(
            'SELECT id, cag_name, name, info, img_url, sort, price, price_wholesale, auto, sales, tag, isactive FROM ProdInfo WHERE isactive = 1 ORDER BY sort ASC'
        );

        // Fetch all product categories
        // ProdCag schema: (id, name, info, sort) - using the corrected schema from previous step
        const categoriesStmt = env.DB.prepare(
            'SELECT name as cag_name, sort FROM ProdCag ORDER BY sort ASC' // Corrected schema has 'name', not 'cag_name' for category's own name
        );
        
        const [themeResult, productsResults, categoriesResults] = await Promise.all([
            themeStmt.first<{ info: string }>(), // Expect 'info' column
            productsStmt.all<ProductInfoUser>(),
            categoriesStmt.all<{ cag_name: string }>()
        ]);

        const themeName = themeResult?.info || 'default'; // Default theme if not found, from 'info' field
        let allProducts = productsResults?.results || [];

        // Stock calculation
        const stockPromises = allProducts.map(async (product) => {
            if (Boolean(product.auto)) { // Check if auto is 1 (true)
                // ProdInfo.name is the product's name. Card.prod_name links to this.
                const stockStmt = env.DB.prepare('SELECT COUNT(*) as stock_count FROM Card WHERE prod_name = ? AND isused = 0')
                                        .bind(product.name); // Use product.name to query Card table
                const stockCountResult = await stockStmt.first< { stock_count: number } >();
                const stock = stockCountResult?.stock_count ?? 0;

                if (stock > 10) product.stock_status = "充足";
                else if (stock > 0 && stock <= 10) product.stock_status = "少量";
                else product.stock_status = "缺货";
            } else {
                product.stock_status = "充足"; // Default for non-auto
            }
            // Convert boolean fields for response
            product.auto = Boolean(product.auto);
            product.isactive = Boolean(product.isactive); // Though already filtered by isactive = 1
            return product;
        });

        allProducts = await Promise.all(stockPromises);

        const categorizedProducts: ProductCategoryUser[] = [];
        const productMap = new Map<string, ProductInfoUser[]>();

        allProducts.forEach(product => {
            if (!productMap.has(product.cag_name)) {
                productMap.set(product.cag_name, []);
            }
            productMap.get(product.cag_name)?.push(product);
        });

        const categories = categoriesResults?.results || [];
        categories.forEach(category => {
            categorizedProducts.push({
                cag_name: category.cag_name,
                shops: productMap.get(category.cag_name) || []
            });
        });
        
        // Ensure categories with no products are also listed if necessary (current logic includes them if fetched from ProdCag)
        // Add categories that might not have products yet
        productMap.forEach((shops, cag_name) => {
            if (!categories.find(c => c.cag_name === cag_name)) {
                 // This case implies a product exists with a cag_name not in ProdCag table, which is a data integrity issue.
                 // Or, if we want to list all categories from ProdCag, even if they have no active products:
                 // The current loop over `categories` already does this.
            }
        });


        const response: ProductsListResponse = {
            theme: themeName,
            categories: categorizedProducts,
            // flat_products_list: allProducts // Optional, as per instruction
        };

        return json(response);

    } catch (e: any) {
        console.error('Error fetching products list:', e);
        return error(500, 'Failed to fetch products list: ' + e.message);
    }
});

// GET /api/v2/products/:id/detail
userRouter.get('/products/:id/detail', async (request: IRequest, env: Env) => {
    const idParam = request.params?.id;
    if (!idParam) {
        return error(400, 'Missing product ID in path.');
    }
    const productId = parseInt(idParam, 10);
    if (isNaN(productId)) {
        return error(400, 'Invalid product ID format.');
    }

    try {
        const productStmt = env.DB.prepare(
            'SELECT id, cag_name, name, info, img_url, sort, discription, price, price_wholesale, auto, sales, tag, isactive FROM ProdInfo WHERE id = ? AND isactive = 1'
        );
        const product = await productStmt.bind(productId).first<ProductInfoUser>();

        if (!product) {
            return error(404, `Product with ID ${productId} not found or not active.`);
        }

        let stock_value = 9999; // Default for non-auto or error
        if (Boolean(product.auto)) { // product.auto is 0 or 1
            const stockCountStmt = env.DB.prepare(
                'SELECT COUNT(*) as stock_count FROM Card WHERE prod_name = ? AND isused = 0'
            ).bind(product.name);
            const stockResult = await stockCountStmt.first<{stock_count: number}>();
            let currentStock = stockResult?.stock_count ?? 0;

            if (currentStock === 1) {
                // Check if the single card is reusable
                const reusableCardStmt = env.DB.prepare(
                    'SELECT reuse FROM Card WHERE prod_name = ? AND isused = 0 LIMIT 1'
                ).bind(product.name);
                const reusableCard = await reusableCardStmt.first<{reuse: number}>();
                if (reusableCard && Boolean(reusableCard.reuse)) { // reuse is 0 or 1
                    stock_value = 9999; // Effectively infinite if reusable
                } else {
                    stock_value = 1;
                }
            } else {
                stock_value = currentStock;
            }
        }
        
        const responseProduct: ProductDetailResponse = {
            ...product,
            auto: Boolean(product.auto),
            isactive: Boolean(product.isactive),
            stock_value: stock_value,
        };

        // Wholesale pricing logic
        if (product.price_wholesale && typeof product.price_wholesale === 'string' && product.price_wholesale.trim() !== "") {
            const parts = product.price_wholesale.split('#');
            if (parts.length === 2) {
                const numStrings = parts[0].split(',');
                const priceStrings = parts[1].split(',');

                if (numStrings.length === priceStrings.length && numStrings.length > 0) {
                    const pifa: ProductDetailResponse['pifa'] = {
                        nums: [],
                        prices: [product.price], // Base price for the first tier
                        slice: numStrings,
                    };

                    let lastNum = 0;
                    numStrings.forEach((numStr, index) => {
                        const currentMaxNum = parseInt(numStr, 10);
                        if (isNaN(currentMaxNum)) return; // Skip if not a number
                        pifa.nums.push(`${lastNum + 1}~${currentMaxNum}`);
                        const wholesalePrice = parseFloat(priceStrings[index]);
                        if (!isNaN(wholesalePrice)) {
                           pifa.prices.push(wholesalePrice);
                        } else {
                            // Handle case where price might be invalid, perhaps use previous or base
                            pifa.prices.push(product.price); 
                        }
                        lastNum = currentMaxNum;
                    });
                    // Add the last tier (e.g., "101~")
                    pifa.nums.push(`${lastNum + 1}~`);
                    
                    // If there's one less price than num tier, it means the last price applies to the last tier.
                    // The logic above pushes base price first, then parsed prices.
                    // This aligns if priceStrings.length is equal to numStrings.length.
                    // If priceStrings can be longer, that's an undefined case from spec.

                    responseProduct.pifa = pifa;
                }
            } else if (parts.length === 1 && parts[0].includes(',')) { 
                // This case is not clearly defined by "num1,num2#price1,price2" or "num1#price1"
                // Assuming "num1,num2" implies prices are missing, which seems unlikely.
                // Or it could be just "price1,price2" if no num tiers, also unlikely.
                // For "num1#price1" (single tier discount)
                const numStr = parts[0];
                // This case is more like "9#8.8" for a single threshold.
                // The current structure expects numStrings and priceStrings to be same length.
                // Let's refine for "num1#price1"
                const singleNumMatch = product.price_wholesale.match(/^(\d+)#([\d.]+)$/);
                if (singleNumMatch) {
                     const pifa: ProductDetailResponse['pifa'] = {
                        nums: [],
                        prices: [product.price],
                        slice: [singleNumMatch[1]],
                    };
                    const thresholdNum = parseInt(singleNumMatch[1], 10);
                    const thresholdPrice = parseFloat(singleNumMatch[2]);
                    pifa.nums.push(`1~${thresholdNum}`);
                    pifa.prices.push(thresholdPrice);
                    pifa.nums.push(`${thresholdNum + 1}~`);
                    responseProduct.pifa = pifa;
                }
            }
        }

        return json(responseProduct);

    } catch (e: any) {
        console.error(`Error fetching product detail for ID ${productId}:`, e);
        return error(500, 'Failed to fetch product detail: ' + e.message);
    }
});


// POST /api/v2/orders/search
userRouter.post('/orders/search', async (request: IRequest, env: Env) => {
    let body: OrderSearchBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { contact } = body;
    if (!contact || typeof contact !== 'string' || contact.trim() === "") {
        return error(400, 'Contact is required and must be a non-empty string.');
    }

    try {
        // Fetch up to 2 latest orders for the contact
        // Order schema: id, prod_id, trade_no (out_order_id), num, money, status, create_time, update_time, pay_id, title, email, remark, coupon_code
        // The request asks for card, but the Order table in schema.sql doesn't have 'card'.
        // Assuming 'card' content is linked via `prod_id` to `Card` table or perhaps `remark` or a custom field.
        // For now, let's assume 'remark' might contain card info for simplicity, or it's a placeholder.
        // The original python had `o.card` which implies Order table had a card field.
        // Corrected SQL to use Orders table and the new 'card' field.
        const stmt = env.DB.prepare(
            'SELECT trade_no as out_order_id, title as name, contact, card, updatetime FROM Orders WHERE contact = ? ORDER BY id DESC LIMIT 2' // Changed "Order" to Orders, changed 'remark as card' to 'card'
        ).bind(contact.trim());
        
        const { results } = await stmt.all<OrderSearchResultItem>(); // Use interface, assuming card is string

        if (!results || results.length === 0) {
            return json({ message: "not found" }); // Or an empty array/object as per desired client handling
        }

        // Take the latest order (first one due to DESC order)
        const latestOrder = results[0];
        
        // Parse updatetime (assuming it's ISO 8601 or similar SQL datetime string from D1 which stores as TEXT or INTEGER timestamp)
        // If updatetime is stored as Unix timestamp (INTEGER):
        // const orderTime = new Date(latestOrder.updatetime * 1000); 
        // If updatetime is stored as ISO string (TEXT):
        const orderTime = new Date(latestOrder.updatetime); 
        const now = new Date();
        
        // Calculate difference in milliseconds
        const timeDifferenceMs = now.getTime() - orderTime.getTime();
        const twoHoursInMs = 2 * 60 * 60 * 1000;

        if (timeDifferenceMs < twoHoursInMs) {
            // Format updatetime to YYYY-MM-DD HH:MM
            const year = orderTime.getUTCFullYear();
            const month = (orderTime.getUTCMonth() + 1).toString().padStart(2, '0');
            const day = orderTime.getUTCDate().toString().padStart(2, '0');
            const hours = orderTime.getUTCHours().toString().padStart(2, '0');
            const minutes = orderTime.getUTCMinutes().toString().padStart(2, '0');
            
            const formattedOrder: OrderSearchResultItem = {
                out_order_id: latestOrder.out_order_id,
                name: latestOrder.name,
                contact: latestOrder.contact,
                card: latestOrder.card || '', // Use card (aliased from remark) or empty string
                updatetime: `${year}-${month}-${day} ${hours}:${minutes}`,
            };
            return json(formattedOrder);
        } else {
            return json({ message: "not found" });
        }

    } catch (e: any) {
        console.error('Error searching orders:', e);
        return error(500, 'Failed to search orders: ' + e.message);
    }
});


// POST /api/v2/payments/initiate
userRouter.post('/payments/initiate', async (request: IRequest, env: Env) => {
    let body: PaymentInitiateBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { out_order_id, name: productName, payment_method, contact, contact_txt, num } = body;

    if (!out_order_id || !productName || !payment_method || !contact || num === undefined || num <= 0) {
        return error(400, 'Missing or invalid required fields.');
    }

    try {
        // 1. Fetch Product
        const productStmt = env.DB.prepare(
            'SELECT id, name, info, price, price_wholesale, auto, isactive FROM ProdInfo WHERE name = ? AND isactive = 1'
        );
        const product = await productStmt.bind(productName).first<{ 
            id: number; name: string; info: string; price: number; price_wholesale: string | null; auto: number; isactive: number; 
        }>();

        if (!product) {
            return error(404, `Product "${productName}" not found or not active.`);
        }

        // 2. Stock Check (if auto == 1)
        if (Boolean(product.auto)) {
            const stockStmt = env.DB.prepare('SELECT COUNT(*) as count FROM Card WHERE prod_name = ? AND isused = 0');
            const stockCount = await stockStmt.bind(productName).first< { count: number } >();
            if (!stockCount || stockCount.count < num) {
                return error(400, 'Insufficient stock for product: ' + productName);
            }
        }

        // 3. Price Calculation (Simplified based on Python's TempOrder.__cal_price__)
        let unit_price = product.price;
        if (product.price_wholesale) {
            const wholesaleParts = product.price_wholesale.split('#');
            if (wholesaleParts.length === 2) {
                const quantities = wholesaleParts[0].split(',').map(Number);
                const prices = wholesaleParts[1].split(',').map(Number);
                if (quantities.length === prices.length) {
                    for (let i = quantities.length - 1; i >= 0; i--) {
                        if (num >= quantities[i]) {
                            unit_price = prices[i];
                            break;
                        }
                    }
                }
            }
        }
        const total_price = unit_price * num;

        // 4. Create TempOrder
        const now = Math.floor(Date.now() / 1000);
        // Assuming validity_period is 1 hour (3600 seconds)
        const validityPeriod = 3600; 
        const endTime = now + validityPeriod;

        const tempOrderStmt = env.DB.prepare(
            `INSERT INTO TempOrder (trade_no, prod_id, num, money, status, create_time, update_time, pay_id, title, email, remark, coupon_code, payment, contact, contact_txt, price, total_price, auto, endtime) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        // Note: pay_id, email, remark, coupon_code are not in request body for this simplified version.
        // Assuming trade_no is out_order_id from request. prod_id is product.id. money is total_price.
        // title is product.name. price is unit_price.
        await tempOrderStmt.bind(
            out_order_id,    // trade_no
            product.id,      // prod_id
            num,             // num
            total_price,     // money (total price)
            0,               // status (unpaid)
            now,             // create_time
            now,             // update_time
            null,            // pay_id (user identifier, not available here)
            product.name,    // title
            contact,         // email (using contact as email for now, as per python)
            contact_txt,     // remark (using contact_txt as remark)
            null,            // coupon_code
            payment_method,  // payment
            contact,         // contact
            contact_txt,     // contact_txt
            unit_price,      // price (unit price)
            total_price,     // total_price
            product.auto,    // auto
            endTime          // endtime
        ).run();
        
        // 5. Call Payment Gateway Logic (Placeholder)
        const paymentDetails = await getPaymentGatewayDetails(payment_method, out_order_id, total_price, env);

        if (paymentDetails.success) {
            const responsePayload: PaymentInitiateResponse = {
                success: true,
                payment_url: paymentDetails.payment_url,
                qr_url: paymentDetails.qr_url, // if applicable
                // Add any other necessary fields from paymentDetails
            };
            return json(responsePayload);
        } else {
            // Potentially delete TempOrder or mark as failed if gateway init fails
            return error(500, paymentDetails.error || 'Failed to initiate payment with gateway.');
        }

    } catch (e: any) {
        console.error('Error initiating payment:', e);
        // Check for specific D1 errors if needed (e.g., UNIQUE constraint on out_order_id for TempOrder)
        if (e.message && e.message.includes('UNIQUE constraint failed: TempOrder.trade_no')) {
            return error(409, `Order ID ${out_order_id} already exists. Please use a unique order ID.`);
        }
        return error(500, 'Failed to initiate payment: ' + e.message);
    }
});

// POST /api/v2/payments/status (Check Payment Status)
interface PaymentStatusBody {
    out_order_id: string; // maps to trade_no
}
interface PaymentStatusResponse {
    status: 'paid' | 'pending' | 'not_found';
    message?: string; // Optional additional message
}

userRouter.post('/payments/status', async (request: IRequest, env: Env) => {
    let body: PaymentStatusBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { out_order_id } = body;
    if (!out_order_id || typeof out_order_id !== 'string') {
        return error(400, 'Missing or invalid out_order_id.');
    }

    try {
        const stmt = env.DB.prepare('SELECT status FROM TempOrder WHERE trade_no = ?');
        const tempOrder = await stmt.bind(out_order_id).first<{ status: number }>();

        if (!tempOrder) {
            return json({ status: 'not_found', message: 'Order not found.' } as PaymentStatusResponse, { status: 404 });
        }

        if (tempOrder.status === 1) { // 1 means paid
            return json({ status: 'paid', message: 'Payment successful.' } as PaymentStatusResponse);
        } else {
            return json({ status: 'pending', message: 'Payment is pending or not yet confirmed.' } as PaymentStatusResponse);
        }

    } catch (e: any) {
        console.error('Error checking payment status:', e);
        return error(500, 'Failed to check payment status: ' + e.message);
    }
});


// POST /api/v2/orders/retrieve_card (Get Card Details)
interface RetrieveCardBody {
    out_order_id: string; // maps to trade_no
}
interface RetrieveCardResponse {
    card: string | null; // Card details, can be null if not applicable
    updatetime: string;  // ISO timestamp of order creation
    message?: string;    // Optional message
}

userRouter.post('/orders/retrieve_card', async (request: IRequest, env: Env) => {
    let body: RetrieveCardBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { out_order_id } = body;
    if (!out_order_id || typeof out_order_id !== 'string') {
        return error(400, 'Missing or invalid out_order_id.');
    }

    try {
        // Query Orders table for the card details and creation time
        const stmt = env.DB.prepare(
            'SELECT card, create_time FROM Orders WHERE trade_no = ? AND status = 1' // Ensure order is paid
        );
        const order = await stmt.bind(out_order_id).first<{ card: string | null; create_time: number }>();

        if (!order) {
            return json({ message: 'Order not found or not paid.' }, { status: 404 });
        }

        const response: RetrieveCardResponse = {
            card: order.card, // card can be null if not applicable for the product
            updatetime: new Date(order.create_time * 1000).toISOString(), // Convert Unix timestamp to ISO string
        };
        return json(response);

    } catch (e: any) {
        console.error('Error retrieving card details:', e);
        return error(500, 'Failed to retrieve card details: ' + e.message);
    }
});


export default userRouter;
