import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Interfaces for Notice Management
// Schema: (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, config TEXT NOT NULL, admin_account TEXT NOT NULL, admin_switch BOOLEAN DEFAULT 0, user_switch BOOLEAN DEFAULT 0)
interface NoticeInfo {
    id: number;
    name: string;
    config: any; // Parsed JSON object
    admin_account: string;
    admin_switch: boolean; // D1 stores as 0 or 1
    user_switch: boolean;  // D1 stores as 0 or 1
}

interface NoticeUpdateBodyItem {
    id: number;
    name?: string; // Name is usually not updatable if it's a key, but included if needed by client
    config_obj: any; // JSON object from request
    admin_account: string;
    admin_switch: boolean;
    user_switch: boolean;
}

const noticeRouter = Router({ base: '/api/v4/notices' });

// Apply JWT middleware to all routes in this router
noticeRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue
});

// GET /api/v4/notices - Get all notices
noticeRouter.get('/', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare(
            'SELECT id, name, config, admin_account, admin_switch, user_switch FROM Notice ORDER BY id'
        );
        const { results } = await stmt.all<any>(); // Get raw results

        if (!results) {
            return json([]);
        }

        const formattedResults: NoticeInfo[] = results.map(n => {
            let parsedConfig = {};
            try {
                if (n.config) parsedConfig = JSON.parse(n.config);
            } catch (e) {
                console.error(`Error parsing config for notice ID ${n.id}:`, e);
            }
            return {
                id: n.id,
                name: n.name,
                config: parsedConfig,
                admin_account: n.admin_account,
                admin_switch: Boolean(n.admin_switch),
                user_switch: Boolean(n.user_switch),
            };
        });

        return json(formattedResults);
    } catch (e: any) {
        console.error('Error fetching notices:', e);
        return error(500, 'Failed to fetch notices: ' + e.message);
    }
});

// POST /api/v4/notices/update - Update notices
noticeRouter.post('/update', async (request: IRequest, env: Env) => {
    let body: NoticeUpdateBodyItem[];
    try {
        body = await request.json();
        if (!Array.isArray(body)) {
            return error(400, 'Request body must be an array of notice objects.');
        }
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    if (body.length === 0) {
        return json({ message: 'No notices to update.' });
    }

    const statements = [];
    for (const item of body) {
        if (item.id === undefined || item.config_obj === undefined || item.admin_account === undefined || item.admin_switch === undefined || item.user_switch === undefined) {
            return error(400, `Missing required fields for one or more notice objects. Required: id, config_obj, admin_account, admin_switch, user_switch. Problematic item ID: ${item.id || 'unknown'}`);
        }
        const stringifiedConfig = JSON.stringify(item.config_obj);
        const adminSwitchInt = item.admin_switch ? 1 : 0;
        const userSwitchInt = item.user_switch ? 1 : 0;
        
        // Assuming 'name' is not updatable as it's often a unique key.
        // If 'name' can be updated, the SQL query would need to include it.
        statements.push(
            env.DB.prepare('UPDATE Notice SET config = ?, admin_account = ?, admin_switch = ?, user_switch = ? WHERE id = ?')
                      .bind(stringifiedConfig, item.admin_account, adminSwitchInt, userSwitchInt, item.id)
        );
    }

    try {
        await env.DB.batch(statements);
        return json({ message: 'Notices updated successfully' });
    } catch (e: any) {
        console.error('Error updating notices:', e);
        // Check for specific errors like constraint violations if needed
        return error(500, 'Failed to update notices: ' + e.message);
    }
});

export default noticeRouter;
