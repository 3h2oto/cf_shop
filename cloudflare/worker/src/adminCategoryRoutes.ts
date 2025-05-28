import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Define the structure for a Product Category according to the target schema
interface ProductCategory {
    id: number;
    name: string;
    info: string;
    sort: number;
}

// Define the structure for the POST request body
interface CategoryRequestBody {
    method: 'add' | 'update' | 'delete';
    id?: number;    // Required for 'update' and 'delete'
    name?: string;  // Required for 'add' and 'update' (for 'update', can be optional if only changing info/sort)
    info?: string;  // Required for 'add' (for 'update', can be optional if only changing name/sort)
    sort?: number;  // Optional for 'add' (defaults to 1000 in schema), optional for 'update'
}

const categoryRouter = Router({ base: '/api/v4/categories' }); // Base path for these routes

// Apply JWT middleware to all routes in this router
categoryRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed, return the response from middleware
    }
    // If auth passed, continue to the actual route handler
});

// GET /api/v4/categories - Fetch all product categories
categoryRouter.get('/', async (request: IRequest, env: Env) => {
    try {
        // Original SQL: SELECT id, name, info, sort FROM ProdCag ORDER BY sort
        // Schema has: id, name, status, create_time, update_time, sort_order
        // Assuming 'info' field needs to be added to ProdCag or it's a misunderstanding.
        // For now, let's assume 'info' is a field and 'sort' maps to 'sort_order'.
        // If 'info' is not in ProdCag, we should select existing fields.
        // Based on Python models: name, info, sort. So ProdCag needs 'info' TEXT and 'sort' INTEGER.
        // Let's assume schema.sql will be updated to:
        // CREATE TABLE ProdCag (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, info TEXT, sort INTEGER DEFAULT 0, status INTEGER DEFAULT 1, create_time INTEGER, update_time INTEGER);
        // Target SQL: SELECT id, name, info, sort FROM ProdCag ORDER BY sort
        const stmt = env.DB.prepare('SELECT id, name, info, sort FROM ProdCag ORDER BY sort');
        const { results } = await stmt.all<ProductCategory>();

        if (!results || results.length === 0) { // Check if results array is empty
            return json([]); // Return empty array if no categories found, not an error
        }
        return json(results);
    } catch (e: any) {
        console.error('Error fetching categories:', e);
        return error(500, 'Failed to fetch categories: ' + e.message);
    }
});

// POST /api/v4/categories - Add, Update, or Delete a category
categoryRouter.post('/', async (request: IRequest, env: Env) => {
    let body: CategoryRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { method, id, name, info } = body;
    // 'sort' is optional for add/update, schema default is 1000.
    // If sort is not provided in the body for 'add', D1 will use the schema default.
    // If sort is not provided for 'update', it means we don't change it.
    const sort = body.sort === undefined ? null : body.sort; // Use null if not provided, to distinguish from 0

    try {
        switch (method) {
            case 'add':
                if (!name || info === undefined ) { // info can be empty string, name must be present
                    return error(400, 'Missing required fields for add: name, info.');
                }
                // Target SQL: INSERT INTO ProdCag (name, info, sort) VALUES (?, ?, ?)
                // If sort is null, D1 will use the default schema value (1000)
                // Or we can explicitly bind the default if null
                const effectiveSortAdd = sort === null ? 1000 : sort;
                const addStmt = env.DB.prepare(
                    'INSERT INTO ProdCag (name, info, sort) VALUES (?, ?, ?)'
                );
                await addStmt.bind(name, info, effectiveSortAdd).run();
                return json({ message: 'Category added successfully' });

            case 'update':
                if (!id) {
                    return error(400, 'Missing required field for update: id.');
                }
                if (name === undefined && info === undefined && sort === null) {
                    return error(400, 'No fields to update. Provide at least one of name, info, or sort.');
                }

                // Dynamically build the SET part of the query
                const fieldsToUpdate: string[] = [];
                const valuesToBind: (string | number)[] = [];

                if (name !== undefined) {
                    fieldsToUpdate.push('name = ?');
                    valuesToBind.push(name);
                }
                if (info !== undefined) {
                    fieldsToUpdate.push('info = ?');
                    valuesToBind.push(info);
                }
                if (sort !== null) { // Only include sort if it was explicitly provided
                    fieldsToUpdate.push('sort = ?');
                    valuesToBind.push(sort);
                }

                if (fieldsToUpdate.length === 0) {
                     return error(400, 'No updatable fields provided.');
                }

                valuesToBind.push(id); // For the WHERE clause

                const updateQuery = `UPDATE ProdCag SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
                const updateStmt = env.DB.prepare(updateQuery);
                const updateResult = await updateStmt.bind(...valuesToBind).run();
                
                if (updateResult.meta.changes === 0) {
                    return error(404, `Category with ID ${id} not found or no changes made.`);
                }
                return json({ message: 'Category updated successfully' });

            case 'delete':
                if (!id) {
                    return error(400, 'Missing required field for delete: id.');
                }
                const deleteStmt = env.DB.prepare('DELETE FROM ProdCag WHERE id = ?');
                const deleteResult = await deleteStmt.bind(id).run();
                if (deleteResult.meta.changes === 0) {
                    return error(404, `Category with ID ${id} not found.`);
                }
                return json({ message: 'Category deleted successfully' });

            default:
                return error(400, 'Invalid method. Must be "add", "update", or "delete".');
        }
    } catch (e: any) {
        console.error(`Error processing category with method "${method}":`, e);
        if (e.message && e.message.includes('UNIQUE constraint failed: ProdCag.name')) {
            return error(409, 'Category name must be unique.');
        }
        return error(500, `Failed to ${method} category: ${e.message}`);
    }
});

export default categoryRouter;
