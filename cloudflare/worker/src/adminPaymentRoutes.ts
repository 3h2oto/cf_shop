import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Interfaces for Payment Gateway Management
interface PaymentGateway {
    id: number;
    name: string;
    icon: string;
    config: any; // Parsed JSON object
    info?: string;
    isactive: boolean; // D1 stores as 0 or 1
}

interface PaymentGatewayUpdateBody {
    icon: string;
    config: any; // JSON object from request
    isactive: boolean;
}

const paymentRouter = Router({ base: '/api/v4/payments' });

// Apply JWT middleware to all routes in this router
paymentRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue
});

// GET /api/v4/payments - List all payment gateways
paymentRouter.get('/', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare(
            'SELECT id, name, icon, config, info, isactive FROM Payment ORDER BY id'
        );
        const { results } = await stmt.all<any>(); // Get raw results

        if (!results) {
            return json([]);
        }

        const formattedResults = results.map(p => {
            let parsedConfig = {};
            try {
                if (p.config) parsedConfig = JSON.parse(p.config);
            } catch (e) {
                console.error(`Error parsing config for payment ID ${p.id}:`, e);
                // Keep default empty object or handle error as needed
            }
            return {
                ...p,
                config: parsedConfig,
                isactive: Boolean(p.isactive),
            };
        });

        return json(formattedResults);
    } catch (e: any) {
        console.error('Error fetching payment gateways:', e);
        return error(500, 'Failed to fetch payment gateways: ' + e.message);
    }
});

// GET /api/v4/payments/:id - Get specific payment gateway by ID
paymentRouter.get('/:id', async (request: IRequest, env: Env) => {
    const idParam = request.params?.id;
    if (!idParam) {
        return error(400, 'Missing payment gateway ID in path.');
    }
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
        return error(400, 'Invalid payment gateway ID format.');
    }

    try {
        const stmt = env.DB.prepare(
            'SELECT id, name, icon, config, info, isactive FROM Payment WHERE id = ?'
        );
        const rawGateway = await stmt.bind(id).first<any>();

        if (!rawGateway) {
            return error(404, `Payment gateway with ID ${id} not found.`);
        }

        let parsedConfig = {};
        try {
            if (rawGateway.config) parsedConfig = JSON.parse(rawGateway.config);
        } catch (e) {
            console.error(`Error parsing config for payment ID ${rawGateway.id}:`, e);
        }

        const formattedGateway: PaymentGateway = {
            ...rawGateway,
            config: parsedConfig,
            isactive: Boolean(rawGateway.isactive),
        };

        return json(formattedGateway);
    } catch (e: any) {
        console.error('Error fetching payment gateway:', e);
        return error(500, 'Failed to fetch payment gateway: ' + e.message);
    }
});

// POST /api/v4/payments/:id/update - Update payment gateway
paymentRouter.post('/:id/update', async (request: IRequest, env: Env) => {
    const idParam = request.params?.id;
    if (!idParam) {
        return error(400, 'Missing payment gateway ID in path.');
    }
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
        return error(400, 'Invalid payment gateway ID format.');
    }

    let body: PaymentGatewayUpdateBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { icon, config, isactive } = body;

    if (icon === undefined || config === undefined || isactive === undefined) {
        return error(400, 'Missing required fields: icon, config, isactive.');
    }

    try {
        const stringifiedConfig = JSON.stringify(config);
        const isActiveInt = isactive ? 1 : 0;

        const stmt = env.DB.prepare(
            'UPDATE Payment SET icon = ?, config = ?, isactive = ? WHERE id = ?'
        );
        const result = await stmt.bind(icon, stringifiedConfig, isActiveInt, id).run();

        if (result.meta.changes === 0) {
            return error(404, `Payment gateway with ID ${id} not found or no changes made.`);
        }

        return json({ message: 'Payment gateway updated successfully' });
    } catch (e: any) {
        console.error('Error updating payment gateway:', e);
        return error(500, 'Failed to update payment gateway: ' + e.message);
    }
});

export default paymentRouter;
