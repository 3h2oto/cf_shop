import bcrypt from 'bcryptjs';
import jwt from '@tsndr/cloudflare-worker-jwt';
import { Env } from './index'; // Assuming index.ts exports Env

// Interfaces for JWT payload
interface AdminJWTPayload {
    email: string;
    // Add other claims like user ID if needed
    // id: number; 
}

/**
 * Verifies a plain password against a hashed password.
 * @param plainPassword The plain text password.
 * @param hashedPassword The hashed password from the database.
 * @returns True if the password matches, false otherwise.
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
        console.error("Error verifying password:", error);
        return false;
    }
}

/**
 * (Optional for now, but good for future: Implement hashPassword(plainPassword: string): Promise<string> 
 * using bcryptjs.hash if we need to create/update admin users later).
 * Hashes a plain password.
 * @param plainPassword The plain text password.
 * @returns The hashed password.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
    const saltRounds = 10; // Or your preferred number of salt rounds
    try {
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Could not hash password.");
    }
}


/**
 * Generates a JWT for an admin user.
 * @param email The admin user's email.
 * @param env The Cloudflare Worker environment containing JWT_SECRET.
 * @returns A JWT string.
 */
export async function generateAdminToken(email: string, env: Env): Promise<string> {
    const payload: AdminJWTPayload = {
        email: email,
    };
    const secret = env.JWT_SECRET;
    if (!secret) {
        console.error("JWT_SECRET is not defined in environment variables.");
        throw new Error("JWT_SECRET is not configured.");
    }

    try {
        const token = await jwt.sign({
            ...payload,
            exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
        }, secret);
        return token;
    } catch (error) {
        console.error("Error generating JWT:", error);
        throw new Error("Could not generate admin token.");
    }
}

// Extend itty-router's IRequest interface to include the admin property
declare module 'itty-router' {
    interface IRequest {
        admin?: AdminJWTPayload; // Add the admin property
    }
}

/**
 * JWT Middleware for protected routes.
 * Verifies the JWT token from the Authorization header.
 * If valid, adds admin info to request.admin.
 * If invalid, returns a 401 Response.
 * @param request The incoming Request object.
 * @param env The Cloudflare Worker environment.
 * @returns A Response object if authentication fails, otherwise undefined.
 */
export async function jwtMiddleware(request: Request, env: Env): Promise<Response | undefined> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response('Missing or invalid Authorization header', { status: 401 });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
        const isValid = await jwt.verify(token, env.JWT_SECRET);
        if (!isValid) {
            return new Response('Invalid token', { status: 401 });
        }

        const { payload } = jwt.decode(token) as { payload: AdminJWTPayload & { exp: number } };
        
        // Check expiration, though jwt.verify should handle it.
        // This is an explicit check for robustness.
        if (payload.exp && Date.now() >= payload.exp * 1000) {
             return new Response('Token expired', { status: 401 });
        }

        // Add admin info to the request object for subsequent handlers
        // This is a common pattern, but itty-router might require specific handling
        // to modify the request object pass along. For itty-router, we'll
        // rely on its own request object augmentation if available, or pass data via context.
        // For now, we'll assume direct modification for simplicity, which might need adjustment.
        (request as any).admin = { email: payload.email }; // Cast to any to add property dynamically

        return undefined; // Token is valid, proceed to the next handler
    } catch (error) {
        console.error('JWT verification error:', error);
        return new Response('Invalid token or authentication error', { status: 401 });
    }
}
