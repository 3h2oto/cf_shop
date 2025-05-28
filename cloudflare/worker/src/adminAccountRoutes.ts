import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware, hashPassword } from './auth'; // Import JWT middleware and hashPassword

// Interfaces for Admin Account Management
// Schema: (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, hash TEXT NOT NULL, updatetime DATETIME)
// The original schema.sql uses 'password_hash' not 'hash'. And 'username' not 'email'.
// Assuming schema is AdminUser(id, username, password_hash, nickname, avatar, email, phone, status, role, login_ip, login_time, remark, create_time, update_time)
// The request is to use email and hash (password_hash). For now, let's assume email is the primary identifier used for login.
// And admin ID 1 is the target.

interface AdminAccountInfo {
    email: string;
}

interface AdminAccountUpdateBody {
    email: string;
    password?: string; // Password is optional, only update if provided
}

const adminAccountRouter = Router({ base: '/api/v4/admin_account' });

// Apply JWT middleware to all routes in this router
adminAccountRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue
});

// GET /api/v4/admin_account - Get admin email
adminAccountRouter.get('/', async (request: IRequest, env: Env) => {
    // Assuming admin ID is 1, and we are fetching the email field.
    // The schema has 'email' and 'username'. 'email' seems more appropriate for "account".
    try {
        const stmt = env.DB.prepare('SELECT email FROM AdminUser WHERE id = 1');
        const admin = await stmt.first<AdminAccountInfo>();

        if (!admin) {
            return error(404, 'Admin account (ID 1) not found.');
        }
        return json(admin);
    } catch (e: any) {
        console.error('Error fetching admin account:', e);
        return error(500, 'Failed to fetch admin account: ' + e.message);
    }
});

// POST /api/v4/admin_account/update - Update admin email/password
adminAccountRouter.post('/update', async (request: IRequest, env: Env) => {
    let body: AdminAccountUpdateBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { email, password } = body;

    if (!email && !password) {
        return error(400, 'Nothing to update. Provide email or password.');
    }
    
    // For D1, CURRENT_TIMESTAMP is not directly supported in D1 prepare.
    // We'll use JavaScript's Date.now() for timestamps if needed.
    // The AdminUser schema has create_time and update_time as INTEGER (Unix timestamps).
    const now = Math.floor(Date.now() / 1000);

    try {
        if (password && email) {
            const hashedPassword = await hashPassword(password);
            // Schema uses password_hash
            const stmt = env.DB.prepare('UPDATE AdminUser SET email = ?, password_hash = ?, update_time = ? WHERE id = 1');
            await stmt.bind(email, hashedPassword, now).run();
        } else if (email) {
            const stmt = env.DB.prepare('UPDATE AdminUser SET email = ?, update_time = ? WHERE id = 1');
            await stmt.bind(email, now).run();
        } else if (password) {
            const hashedPassword = await hashPassword(password);
            const stmt = env.DB.prepare('UPDATE AdminUser SET password_hash = ?, update_time = ? WHERE id = 1');
            await stmt.bind(hashedPassword, now).run();
        }
        
        // Check if the update actually happened (optional, as wrangler d1 execute doesn't return changes for UPDATE if no row matched)
        // For simplicity, we assume ID 1 always exists as per problem description.

        return json({ message: 'Admin account updated successfully' });
    } catch (e: any) {
        console.error('Error updating admin account:', e);
        // Check for specific errors like UNIQUE constraint on email if it's unique and different from username
        if (e.message && e.message.includes('UNIQUE constraint failed: AdminUser.email')) {
            return error(409, 'Email must be unique.');
        }
        return error(500, 'Failed to update admin account: ' + e.message);
    }
});

export default adminAccountRouter;
