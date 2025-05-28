import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Define the structure for a Card (CardInfo to avoid potential D1 type conflicts)
interface CardInfo {
    id: number;
    prod_name: string;
    card: string;
    reuse: boolean;  // D1 stores as 0 or 1
    isused: boolean; // D1 stores as 0 or 1
}

// Define the structure for the POST request body
interface CardRequestBody {
    method: 'add' | 'update' | 'delete' | 'delete_used' | 'bulk_delete';
    id?: number;          // For 'update', 'delete'
    prod_name?: string;   // For 'add', 'update'
    card?: string;        // For 'add' (can be single or newline-separated for bulk), 'update'
    isused?: boolean;     // For 'update'
    reuse?: boolean;      // For 'add', 'update'
    ids?: number[];       // For 'bulk_delete'
}

// Request body for listing cards
interface ListCardsRequestBody {
    page: number;
}

const cardRouter = Router({ base: '/api/v4/cards' });

// Apply JWT middleware to all routes in this router
cardRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue
});

// POST /api/v4/cards/list - List cards with pagination
cardRouter.post('/list', async (request: IRequest, env: Env) => {
    let body: ListCardsRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const page = body.page && Number(body.page) > 0 ? Number(body.page) : 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
        const stmt = env.DB.prepare(
            'SELECT id, prod_name, card, reuse, isused FROM Card ORDER BY id DESC LIMIT ? OFFSET ?'
        );
        const { results } = await stmt.bind(limit, offset).all<CardInfo>();
        
        // Convert 0/1 from D1 to boolean for the response
        const formattedResults = results ? results.map(card => ({
            ...card,
            reuse: Boolean(card.reuse),
            isused: Boolean(card.isused),
        })) : [];

        return json(formattedResults);
    } catch (e: any) {
        console.error('Error fetching cards:', e);
        return error(500, 'Failed to fetch cards: ' + e.message);
    }
});

// GET /api/v4/cards/pages - Get total number of card pages
cardRouter.get('/pages', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare('SELECT COUNT(*) as count FROM Card');
        const result = await stmt.first<{ count: number }>();
        const count = result ? result.count : 0;
        const pages = Math.ceil(count / 20);
        return json({ pages });
    } catch (e: any) {
        console.error('Error fetching card pages:', e);
        return error(500, 'Failed to fetch card pages: ' + e.message);
    }
});

// POST /api/v4/cards - Add, Update, or Delete cards
cardRouter.post('/', async (request: IRequest, env: Env) => {
    let body: CardRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { method, id, ids } = body;

    try {
        switch (method) {
            case 'add': {
                const { prod_name, card, reuse } = body;
                if (!prod_name || !card) {
                    return error(400, 'Missing required fields for add: prod_name, card.');
                }

                const cardEntries = card.split('\n').map(c => c.trim()).filter(c => c.length > 0);
                if (cardEntries.length === 0) {
                    return error(400, 'No valid card data provided.');
                }

                const effectiveReuse = reuse === undefined ? false : reuse; // Default reuse to false
                const isusedDefault = false; // Always false for new cards

                // Use a transaction for bulk inserts
                const statements = cardEntries.map(singleCard => 
                    env.DB.prepare('INSERT INTO Card (prod_name, card, reuse, isused) VALUES (?, ?, ?, ?)')
                          .bind(prod_name, singleCard, effectiveReuse ? 1 : 0, isusedDefault ? 1 : 0)
                );
                
                await env.DB.batch(statements);
                return json({ message: `${cardEntries.length} card(s) added successfully` });
            }

            case 'update': {
                if (!id) {
                    return error(400, 'Missing ID for update operation.');
                }
                
                const fieldsToUpdate: string[] = [];
                const valuesToBind: (string | number | null)[] = [];

                const addField = (fieldName: keyof CardRequestBody, dbFieldName: string = fieldName) => {
                    if (body[fieldName] !== undefined) {
                        fieldsToUpdate.push(`${dbFieldName} = ?`);
                        let value = body[fieldName];
                        if (typeof value === 'boolean') {
                            valuesToBind.push(value ? 1 : 0); // Convert boolean to integer
                        } else {
                            valuesToBind.push(value as string | number);
                        }
                    }
                };

                addField('prod_name');
                addField('card');
                addField('reuse');
                addField('isused');
                
                if (fieldsToUpdate.length === 0) {
                    return error(400, 'No fields provided for update.');
                }

                valuesToBind.push(id); // For WHERE id = ?

                const updateQuery = `UPDATE Card SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
                const updateStmt = env.DB.prepare(updateQuery);
                const updateResult = await updateStmt.bind(...valuesToBind).run();

                if (updateResult.meta.changes === 0) {
                    return error(404, `Card with ID ${id} not found or no changes made.`);
                }
                return json({ message: 'Card updated successfully' });
            }

            case 'delete':
                if (!id) {
                    return error(400, 'Missing ID for delete operation.');
                }
                const deleteStmt = env.DB.prepare('DELETE FROM Card WHERE id = ?');
                const deleteResult = await deleteStmt.bind(id).run();
                if (deleteResult.meta.changes === 0) {
                    return error(404, `Card with ID ${id} not found.`);
                }
                return json({ message: 'Card deleted successfully' });

            case 'delete_used':
                const deleteUsedStmt = env.DB.prepare('DELETE FROM Card WHERE isused = 1'); // isused = true
                const deleteUsedResult = await deleteUsedStmt.run();
                return json({ message: `${deleteUsedResult.meta.changes} used card(s) deleted successfully` });
            
            case 'bulk_delete':
                if (!ids || !Array.isArray(ids) || ids.length === 0) {
                    return error(400, 'Missing or invalid "ids" array for bulk_delete operation.');
                }
                // Ensure all IDs are numbers
                if (!ids.every(i => typeof i === 'number')) {
                     return error(400, 'All IDs in "ids" array must be numbers.');
                }

                const placeholders = ids.map(() => '?').join(',');
                const bulkDeleteQuery = `DELETE FROM Card WHERE id IN (${placeholders})`;
                const bulkDeleteStmt = env.DB.prepare(bulkDeleteQuery);
                const bulkDeleteResult = await bulkDeleteStmt.bind(...ids).run();
                
                return json({ message: `${bulkDeleteResult.meta.changes} card(s) deleted successfully` });

            default:
                return error(400, 'Invalid method. Must be "add", "update", "delete", "delete_used", or "bulk_delete".');
        }
    } catch (e: any) {
        console.error(`Error processing card (method: ${method}):`, e);
        // Specific error for UNIQUE constraint if card content needs to be unique (not specified in schema)
        // if (e.message && e.message.includes('UNIQUE constraint failed: Card.card')) {
        //     return error(409, 'Card content must be unique.');
        // }
        return error(500, `Failed to ${method} card operation: ${e.message}`);
    }
});

export default cardRouter;
