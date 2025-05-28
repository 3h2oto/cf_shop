import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Interfaces for System Settings Management
// Schema: (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, info TEXT, description TEXT NOT NULL, isshow BOOLEAN DEFAULT 0, updatetime DATETIME)
// The schema.sql uses key, value, name (description), create_time, update_time for Config table.
// The request is for name, info, description, isshow. This seems to be a different "Config" table or a misinterpretation.
// Assuming the request refers to the existing `Config` table and we need to map fields:
// - 'name' in request -> 'key' in DB
// - 'info' in request -> 'value' in DB
// - 'description' in request -> 'name' in DB (description of the key)
// - 'isshow' is not in the current schema.sql for Config.
// For this task, I will proceed assuming the schema is as provided in this part of the request:
// (id, name TEXT NOT NULL UNIQUE, info TEXT, description TEXT NOT NULL, isshow BOOLEAN DEFAULT 0, updatetime DATETIME)
// This means `schema.sql` for `Config` table would need to be:
// CREATE TABLE Config (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, info TEXT, description TEXT NOT NULL, isshow BOOLEAN DEFAULT 0, updatetime DATETIME);

interface SystemConfig {
    id: number;
    name: string;
    info?: string;
    description: string;
    isshow?: boolean; // Not in current schema.sql, but in this subtask's schema for Config
}

interface SystemConfigUpdateBody {
    id: number;
    info: string;
}

const configRouter = Router({ base: '/api/v4/system_settings' });

// Apply JWT middleware
configRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) return authResponse;
});

// GET /api/v4/system_settings - Get visible system settings
configRouter.get('/', async (request: IRequest, env: Env) => {
    try {
        // SQL: SELECT id, name, info, description FROM Config WHERE isshow = 1
        // The schema.sql has: key, value, name (for description). No isshow.
        // Proceeding with the schema given in *this specific subtask*:
        // (id, name, info, description, isshow, updatetime)
        const stmt = env.DB.prepare(
            'SELECT id, name, info, description FROM Config WHERE isshow = 1 ORDER BY id'
        );
        const { results } = await stmt.all<SystemConfig>();
        return json(results || []);
    } catch (e: any) {
        console.error('Error fetching system settings:', e);
        return error(500, 'Failed to fetch system settings: ' + e.message);
    }
});

// POST /api/v4/system_settings/update - Update a system setting
configRouter.post('/update', async (request: IRequest, env: Env) => {
    let body: SystemConfigUpdateBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { id, info } = body;
    if (id === undefined || info === undefined) {
        return error(400, 'Missing required fields: id, info.');
    }

    // D1 does not support CURRENT_TIMESTAMP directly in bindings in the same way.
    // Using a JS date for updatetime. Assuming 'updatetime' is a TEXT field storing ISO string or similar.
    // If it's an INTEGER (Unix timestamp), use Math.floor(Date.now() / 1000).
    // The schema for this part says DATETIME. D1 recommends storing dates as ISO 8601 strings or Unix timestamps.
    const updatetime = new Date().toISOString();


    try {
        // SQL: UPDATE Config SET info = ?, updatetime = ? WHERE id = ?
        const stmt = env.DB.prepare(
            'UPDATE Config SET info = ?, updatetime = ? WHERE id = ?'
        );
        const result = await stmt.bind(info, updatetime, id).run();

        if (result.meta.changes === 0) {
            return error(404, `Config setting with ID ${id} not found or no changes made.`);
        }
        return json({ message: 'System setting updated successfully' });
    } catch (e: any) {
        console.error('Error updating system setting:', e);
        // If 'name' (key) were updatable and unique:
        // if (e.message && e.message.includes('UNIQUE constraint failed: Config.name')) {
        //    return error(409, 'Config name must be unique.');
        // }
        return error(500, 'Failed to update system setting: ' + e.message);
    }
});

export default configRouter;
