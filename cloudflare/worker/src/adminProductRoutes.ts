import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

// Define the structure for a Product (ProdInfo)
interface ProductInfo {
    id: number;
    cag_name: string; // Category name
    name: string;
    info?: string; // Optional based on schema, can be TEXT
    img_url?: string; // Optional
    sort: number; // Default 1000 in schema
    discription?: string; // "discription" as per schema, likely "description"
    price: number;
    price_wholesale?: string; // Optional
    auto: boolean; // Default 0 (false) in schema
    sales: number; // Default 0 in schema
    tag?: string; // Optional
    isactive: boolean; // Default 0 (false) in schema
}

// Define the structure for the POST request body for add/update
interface ProductRequestBody {
    method: 'add' | 'update' | 'delete';
    id?: number; // Required for 'update' and 'delete'
    cag_name?: string;
    name?: string;
    info?: string;
    img_url?: string;
    sort?: number;
    discription?: string;
    price?: number;
    price_wholesale?: string;
    auto?: boolean;
    sales?: number;
    tag?: string;
    isactive?: boolean;
}

// Define the structure for the edit-info request body
interface ProductEditInfoRequestBody {
    id: number;
}

const productRouter = Router({ base: '/api/v4/products' });

// Apply JWT middleware to all routes in this router
productRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) {
        return authResponse; // Auth failed
    }
    // Auth passed, continue to the actual route handler
});

// GET /api/v4/products - List all products
productRouter.get('/', async (request: IRequest, env: Env) => {
    try {
        const stmt = env.DB.prepare(
            'SELECT id, cag_name, name, info, img_url, sort, discription, price, price_wholesale, auto, sales, tag, isactive FROM ProdInfo ORDER BY sort'
        );
        const { results } = await stmt.all<ProductInfo>();
        return json(results || []); // Return empty array if no products
    } catch (e: any) {
        console.error('Error fetching products:', e);
        return error(500, 'Failed to fetch products: ' + e.message);
    }
});

// POST /api/v4/products/edit-info - Get product details for editing
productRouter.post('/edit-info', async (request: IRequest, env: Env) => {
    let body: ProductEditInfoRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { id } = body;
    if (!id) {
        return error(400, 'Product ID is required.');
    }

    try {
        const productStmt = env.DB.prepare(
            'SELECT id, cag_name, name, info, img_url, sort, discription, price, price_wholesale, auto, sales, tag, isactive FROM ProdInfo WHERE id = ?'
        );
        const product = await productStmt.bind(id).first<ProductInfo>();

        if (!product) {
            return error(404, `Product with ID ${id} not found.`);
        }

        const categoryStmt = env.DB.prepare('SELECT name FROM ProdCag ORDER BY name');
        const { results: categoriesResult } = await categoryStmt.all<{ name: string }>();
        const categories = categoriesResult ? categoriesResult.map(c => c.name) : [];

        return json({
            product: product,
            categories: categories,
        });
    } catch (e: any) {
        console.error('Error fetching product edit info:', e);
        return error(500, 'Failed to fetch product details: ' + e.message);
    }
});

// POST /api/v4/products - Add, Update, or Delete a product
productRouter.post('/', async (request: IRequest, env: Env) => {
    let body: ProductRequestBody;
    try {
        body = await request.json();
    } catch (e) {
        return error(400, 'Invalid JSON in request body.');
    }

    const { method, id } = body;

    try {
        switch (method) {
            case 'add': {
                const { cag_name, name, info, img_url, sort, discription, price, price_wholesale, auto, sales, tag, isactive } = body;
                if (!name || price === undefined || cag_name === undefined) { // name, price, cag_name are essential
                    return error(400, 'Missing required fields for add: name, price, cag_name.');
                }

                // Use schema defaults if not provided
                const effectiveSort = sort === undefined ? 1000 : sort;
                const effectiveAuto = auto === undefined ? false : auto;
                const effectiveSales = sales === undefined ? 0 : sales;
                const effectiveIsActive = isactive === undefined ? false : isactive;

                const addStmt = env.DB.prepare(
                    `INSERT INTO ProdInfo (cag_name, name, info, img_url, sort, discription, price, price_wholesale, auto, sales, tag, isactive) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                );
                await addStmt.bind(
                    cag_name, name, info, img_url, effectiveSort, discription, price, price_wholesale,
                    effectiveAuto ? 1 : 0, // Convert boolean to integer for D1
                    effectiveSales, tag,
                    effectiveIsActive ? 1 : 0 // Convert boolean to integer for D1
                ).run();
                return json({ message: 'Product added successfully' });
            }

            case 'update': {
                if (!id) {
                    return error(400, 'Missing ID for update operation.');
                }

                const fieldsToUpdate: string[] = [];
                const valuesToBind: (string | number | null)[] = []; // Allow null for optional fields

                // Helper to add field to update if present in body
                const addField = (fieldName: keyof ProductRequestBody, dbFieldName: string = fieldName) => {
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

                addField('cag_name');
                addField('name');
                addField('info');
                addField('img_url');
                addField('sort');
                addField('discription');
                addField('price');
                addField('price_wholesale');
                addField('auto');
                addField('sales');
                addField('tag');
                addField('isactive');
                
                if (fieldsToUpdate.length === 0) {
                    return error(400, 'No fields provided for update.');
                }

                valuesToBind.push(id); // For the WHERE id = ?

                const updateQuery = `UPDATE ProdInfo SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
                const updateStmt = env.DB.prepare(updateQuery);
                const updateResult = await updateStmt.bind(...valuesToBind).run();

                if (updateResult.meta.changes === 0) {
                    return error(404, `Product with ID ${id} not found or no changes made.`);
                }
                return json({ message: 'Product updated successfully' });
            }

            case 'delete':
                if (!id) {
                    return error(400, 'Missing ID for delete operation.');
                }
                const deleteStmt = env.DB.prepare('DELETE FROM ProdInfo WHERE id = ?');
                const deleteResult = await deleteStmt.bind(id).run();
                if (deleteResult.meta.changes === 0) {
                    return error(404, `Product with ID ${id} not found.`);
                }
                return json({ message: 'Product deleted successfully' });

            default:
                return error(400, 'Invalid method. Must be "add", "update", or "delete".');
        }
    } catch (e: any) {
        console.error(`Error processing product (method: ${method}):`, e);
        if (e.message && e.message.includes('UNIQUE constraint failed: ProdInfo.name')) {
            return error(409, 'Product name must be unique.');
        }
        return error(500, `Failed to ${method} product: ${e.message}`);
    }
});

export default productRouter;
