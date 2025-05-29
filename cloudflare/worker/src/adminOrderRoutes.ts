import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Interfaces for Order Management (matching frontend expectations)
interface OrderInfoResponse {
    id: number;
    out_order_id: string; // Mapped from trade_no
    name: string;         // Mapped from title (product name)
    payment?: string;
    contact?: string;
    contact_txt?: string;
    num: number;
    total_price: number;  // Mapped from money
    updatetime: string;   // Mapped from create_time (ISO8601 string)
    status?: number;      // Optional, if needed by frontend
}

interface TempOrderInfoResponse {
    id: number;
    out_order_id: string; // Mapped from trade_no
    name: string;         // Mapped from title (product name)
    payment?: string;
    contact?: string;
    contact_txt?: string;
    unit_price?: number;   // Mapped from price
    num: number;
    total_price: number;  // Mapped from money
    auto: boolean;        // Converted from 0/1
    updatetime: string;   // Mapped from create_time (ISO8601 string)
    status: boolean;      // Converted from 0/1
    endtime?: string;     // Mapped from endtime (ISO8601 string)
}

// DB results interfaces (raw from D1, before mapping/conversion)
interface RawOrderFromDB {
    id: number;
    trade_no: string;
    title: string; // Product name
    payment?: string;
    contact?: string;
    contact_txt?: string;
    num: number;
    money: number; // Total price
    create_time: number; // Unix timestamp
    status: number;
}

interface RawTempOrderFromDB {
    id: number;
    trade_no: string;
    title: string; // Product name
    payment?: string;
    contact?: string;
    contact_txt?: string;
    price?: number; // Unit price from TempOrder.price
    num: number;
    money: number; // Total price from TempOrder.money
    auto: number;  // 0 or 1
    create_time: number; // Unix timestamp
    status: number; // 0 or 1
    endtime?: number; // Unix timestamp
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

// POST /api/v4/orders/list - List Orders table
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
        // Query using actual column names from Orders table
        const stmt = env.DB.prepare(
            'SELECT id, trade_no, title, payment, contact, contact_txt, num, money, create_time, status FROM Orders ORDER BY id DESC LIMIT ? OFFSET ?'
        );
        const { results: rawResults } = await stmt.bind(PAGE_SIZE, offset).all<RawOrderFromDB>();
        
        const formattedResults: OrderInfoResponse[] = (rawResults || []).map(row => ({
            id: row.id,
            out_order_id: row.trade_no,
            name: row.title,
            payment: row.payment,
            contact: row.contact,
            contact_txt: row.contact_txt,
            num: row.num,
            total_price: row.money,
            updatetime: new Date(row.create_time * 1000).toISOString(), // Convert Unix timestamp to ISO string
            status: row.status
        }));
        return json(formattedResults);
    } catch (e: any) {
        console.error('Error fetching orders:', e);
        return error(500, 'Failed to fetch orders: ' + e.message);
    }
});

// GET /api/v4/orders/pages - Total pages for Orders
orderRouter.get('/pages', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare('SELECT COUNT(*) as count FROM Orders'); // Use Orders table
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
        // Query using actual column names from TempOrder table
        const stmt = env.DB.prepare(
            'SELECT id, trade_no, title, payment, contact, contact_txt, price, num, money, auto, create_time, status, endtime FROM TempOrder ORDER BY id DESC LIMIT ? OFFSET ?'
        );
        const { results: rawResults } = await stmt.bind(PAGE_SIZE, offset).all<RawTempOrderFromDB>();
        
        const formattedResults: TempOrderInfoResponse[] = (rawResults || []).map(row => ({
            id: row.id,
            out_order_id: row.trade_no,
            name: row.title,
            payment: row.payment,
            contact: row.contact,
            contact_txt: row.contact_txt,
            unit_price: row.price, // TempOrder.price is unit_price
            num: row.num,
            total_price: row.money, // TempOrder.money is total_price
            auto: Boolean(row.auto),
            updatetime: new Date(row.create_time * 1000).toISOString(),
            status: Boolean(row.status),
            endtime: row.endtime ? new Date(row.endtime * 1000).toISOString() : undefined,
        }));
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

// POST /api/v4/orders/delete - Delete Order from Orders table
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
            stmt = env.DB.prepare('DELETE FROM Orders'); // Use Orders table
            result = await stmt.run();
        } else if (typeof id === 'number') {
            stmt = env.DB.prepare('DELETE FROM Orders WHERE id = ?'); // Use Orders table
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
