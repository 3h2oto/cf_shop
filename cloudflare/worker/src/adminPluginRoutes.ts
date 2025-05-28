import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Interfaces for TG Plugin
// Schema Plugin: (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, config TEXT NOT NULL, about TEXT NOT NULL, switch BOOLEAN DEFAULT 0)
interface TGPluginInfo {
    name: string;
    config: any; // Parsed JSON
    about: string;
    switch: boolean; // D1 stores as 0 or 1
}

interface TGPluginUpdateBody {
    config_obj: any; // JSON object from request
    about: string;
    switch_val: boolean;
}

// Interfaces for Theme (uses Config table)
// Config table schema from Part 3: (id, name, info, description, isshow, updatetime)
// Or from schema.sql: (id, key, value, name, create_time, update_time)
// Assuming 'theme' is stored in Config table where name/key = 'theme' and info/value = theme_name
interface ThemeInfo {
    theme: string;
}

interface ThemeUpdateBody {
    theme: string;
}

const pluginRouter = Router(); // No base path, will be mounted like /api/v4/tg_plugin and /api/v4/theme

// Apply JWT middleware to all routes in this router
pluginRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue
});

// --- Telegram Plugin Routes ---

// GET /api/v4/tg_plugin
pluginRouter.get('/tg_plugin', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare(
            "SELECT name, config, about, switch FROM Plugin WHERE name = 'TG发卡'"
        );
        const rawPlugin = await stmt.first<any>();

        if (!rawPlugin) {
            return error(404, "TG发卡 plugin not found.");
        }

        let parsedConfig = {};
        try {
            if (rawPlugin.config) parsedConfig = JSON.parse(rawPlugin.config);
        } catch (e) {
            console.error("Error parsing TG plugin config:", e);
        }

        const pluginInfo: TGPluginInfo = {
            name: rawPlugin.name,
            config: parsedConfig,
            about: rawPlugin.about,
            switch: Boolean(rawPlugin.switch),
        };
        return json(pluginInfo);
    } catch (e: any) {
        console.error('Error fetching TG plugin:', e);
        return error(500, 'Failed to fetch TG plugin: ' + e.message);
    }
});

// POST /api/v4/tg_plugin/update
pluginRouter.post('/tg_plugin/update', async (request: IRequest, env: Env) => {
    let body: TGPluginUpdateBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { config_obj, about, switch_val } = body;

    if (config_obj === undefined || about === undefined || switch_val === undefined) {
        return error(400, 'Missing required fields: config_obj, about, switch_val.');
    }

    try {
        const stringifiedConfig = JSON.stringify(config_obj);
        const switchInt = switch_val ? 1 : 0;

        const stmt = env.DB.prepare(
            "UPDATE Plugin SET config = ?, about = ?, switch = ? WHERE name = 'TG发卡'"
        );
        const result = await stmt.bind(stringifiedConfig, about, switchInt).run();

        if (result.meta.changes === 0) {
            // This could also mean the values were the same as existing ones
            // Consider fetching first to see if it exists if strict "not found" is needed
            return error(404, "TG发卡 plugin not found or no changes made.");
        }
        return json({ message: 'TG plugin updated successfully' });
    } catch (e: any) {
        console.error('Error updating TG plugin:', e);
        return error(500, 'Failed to update TG plugin: ' + e.message);
    }
});

// --- Theme Routes (using Config table with schema: name, info, description, isshow, updatetime) ---

// GET /api/v4/theme
pluginRouter.get('/theme', async (request: IRequest, env: Env) => {
    try {
        // Target SQL: SELECT info FROM Config WHERE name = 'theme'
        const stmt = env.DB.prepare("SELECT info FROM Config WHERE name = 'theme'");
        const configEntry = await stmt.first<{ info: string }>();

        if (!configEntry) {
            // If 'theme' key doesn't exist, return a default or error.
            // For now, error as it's expected to be seeded.
            return error(404, "Theme configuration (name='theme') not found.");
        }
        return json({ theme: configEntry.info });
    } catch (e: any) {
        console.error('Error fetching theme:', e);
        return error(500, 'Failed to fetch theme: ' + e.message);
    }
});

// POST /api/v4/theme/update
pluginRouter.post('/theme/update', async (request: IRequest, env: Env) => {
    let body: ThemeUpdateBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { theme } = body;
    if (!theme || typeof theme !== 'string') {
        return error(400, 'Missing or invalid "theme" string in request body.');
    }

    const allowedThemes = ["list", "taobao", "gongge"];
    if (!allowedThemes.includes(theme)) {
        return error(400, `Invalid theme name. Allowed themes are: ${allowedThemes.join(', ')}.`);
    }
    
    // Using ISO string for DATETIME field 'updatetime'
    const updatetime = new Date().toISOString();

    try {
        // Target SQL: UPDATE Config SET info = ?, updatetime = ? WHERE name = 'theme'
        const stmt = env.DB.prepare(
            "UPDATE Config SET info = ?, updatetime = ? WHERE name = 'theme'"
        );
        const result = await stmt.bind(theme, updatetime).run();

        if (result.meta.changes === 0) {
            // This means the 'theme' record was not found or the value was already the same.
            // As per instruction, do not create if not found.
            // Check if the record exists to differentiate "not found" from "value unchanged".
            const checkStmt = env.DB.prepare("SELECT 1 FROM Config WHERE name = 'theme'");
            const exists = await checkStmt.first();
            if (!exists) {
                return error(404, "Theme configuration (name='theme') not found. Cannot update.");
            }
            // If it exists but changes is 0, the value was the same.
            return json({ message: 'Theme value is already set to this or record not found.' });
        }
        return json({ message: 'Theme updated successfully' });
    } catch (e: any) {
        console.error('Error updating theme:', e);
        return error(500, 'Failed to update theme: ' + e.message);
    }
});


export default pluginRouter;
