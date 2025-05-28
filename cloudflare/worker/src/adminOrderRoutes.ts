import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Interfaces for Order Management
interface OrderInfo {
    id: number;
    out_order_id: string;
    name: string;
    payment: string;
    contact?: string;
    contact_txt?: string;
    num: number;
    total_price: number;
    updatetime: string; // D1 DATETIME will be string
    // card and price omitted as per request for list view
    // status also omitted for brevity in admin list
}

interface TempOrderInfo {
    id: number;
    out_order_id: string;
    name: string;
    payment: string;
    contact?: string;
    contact_txt?: string;
    price: number;
    num: number;
    total_price: number;
    auto: boolean;    // D1 stores as 0 or 1
    updatetime: string; // D1 DATETIME will be string
    status: boolean;  // D1 stores as 0 or 1
    endtime?: string; // D1 DATETIME will be string, optional
}

interface OrderListRequestBody {
    page: number;
}

interface OrderDeleteRequestBody {
    id: number | "all";
}

const orderRouter = Router({ base: '/api/v4/orders' });
const PAGE_SIZE = 20;

// Apply JWT middleware to all routes in this router
orderRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue
});

// POST /api/v4/orders/list - List Order table
orderRouter.post('/list', async (request: IRequest, env: Env) => {
    let body: OrderListRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const page = body.page && Number(body.page) > 0 ? Number(body.page) : 1;
    const offset = (page - 1) * PAGE_SIZE;

    try {
        const stmt = env.DB.prepare(
            'SELECT id, out_order_id, name, payment, contact, contact_txt, num, total_price, updatetime FROM "Order" ORDER BY id DESC LIMIT ? OFFSET ?'
        ); // "Order" is quoted because it's a keyword
        const { results } = await stmt.bind(PAGE_SIZE, offset).all<OrderInfo>();
        return json(results || []);
    } catch (e: any) {
        console.error('Error fetching orders:', e);
        return error(500, 'Failed to fetch orders: ' + e.message);
    }
});

// GET /api/v4/orders/pages - Total pages for Order
orderRouter.get('/pages', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare('SELECT COUNT(*) as count FROM "Order"');
        const result = await stmt.first<{ count: number }>();
        const count = result ? result.count : 0;
        const pages = Math.ceil(count / PAGE_SIZE);
        return json({ pages });
    } catch (e: any) {
        console.error('Error fetching order pages:', e);
        return error(500, 'Failed to fetch order pages: ' + e.message);
    }
});

// POST /api/v4/orders/temp/list - List TempOrder table
orderRouter.post('/temp/list', async (request: IRequest, env: Env) => {
    let body: OrderListRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const page = body.page && Number(body.page) > 0 ? Number(body.page) : 1;
    const offset = (page - 1) * PAGE_SIZE;

    try {
        const stmt = env.DB.prepare(
            'SELECT id, out_order_id, name, payment, contact, contact_txt, price, num, total_price, auto, updatetime, status, endtime FROM TempOrder ORDER BY id DESC LIMIT ? OFFSET ?'
        );
        const { results } = await stmt.bind(PAGE_SIZE, offset).all<TempOrderInfo>();
        
        // Convert 0/1 from D1 to boolean for response
        const formattedResults = results ? results.map(order => ({
            ...order,
            auto: Boolean(order.auto),
            status: Boolean(order.status),
        })) : [];

        return json(formattedResults);
    } catch (e: any) {
        console.error('Error fetching temp orders:', e);
        return error(500, 'Failed to fetch temp orders: ' + e.message);
    }
});

// GET /api/v4/orders/temp/pages - Total pages for TempOrder
orderRouter.get('/temp/pages', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare('SELECT COUNT(*) as count FROM TempOrder');
        const result = await stmt.first<{ count: number }>();
        const count = result ? result.count : 0;
        const pages = Math.ceil(count / PAGE_SIZE);
        return json({ pages });
    } catch (e: any) {
        console.error('Error fetching temp order pages:', e);
        return error(500, 'Failed to fetch temp order pages: ' + e.message);
    }
});

// POST /api/v4/orders/delete - Delete Order
orderRouter.post('/delete', async (request: IRequest, env: Env) => {
    let body: OrderDeleteRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { id } = body;
    if (id === undefined) {
        return error(400, 'Missing "id" in request body.');
    }

    try {
        let stmt;
        let result;
        if (id === "all") {
            stmt = env.DB.prepare('DELETE FROM "Order"');
            result = await stmt.run();
        } else if (typeof id === 'number') {
            stmt = env.DB.prepare('DELETE FROM "Order" WHERE id = ?');
            result = await stmt.bind(id).run();
        } else {
            return error(400, 'Invalid "id". Must be a number or "all".');
        }

        if (result.meta.changes === 0 && id !== "all") {
             return error(404, `Order with ID ${id} not found.`);
        }
        return json({ message: `Successfully deleted orders. Changes: ${result.meta.changes}` });

    } catch (e: any) {
        console.error('Error deleting order(s):', e);
        return error(500, 'Failed to delete order(s): ' + e.message);
    }
});

export default orderRouter;
