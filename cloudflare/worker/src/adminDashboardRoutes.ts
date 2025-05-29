import { IRequest, Router, error, json } from 'itty-router';
import { Env } from './index'; // Import Env type from main index.ts
import { jwtMiddleware } from './auth'; // Import JWT middleware

interface AdminDashboardData {
    cag_num: number;
    shop_num: number;
    card_num: number;
    order_num: number;
    total_income: number;
    total_num: number;
    history_date: string[];
    history_price: number[];
}

interface IncomeCountResponse {
    history_date: string[];
    history_price: number[];
}

interface CountResult {
    count: number;
}

interface SumResult {
    total: number | null; // SUM can return null
}

// Interface HistoryOrder was not strictly needed as results are processed directly.
// interface HistoryOrder {
//     updatetime: string; 
//     total_price: number;
// }

const dashboardRouter = Router({ base: '/api/v4' }); // Base path for dashboard and income_count

// Apply JWT middleware
dashboardRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) return authResponse;
});

// GET /api/v4/dashboard
dashboardRouter.get('/dashboard', async (request: IRequest, env: Env) => {
    try {
        // Prepare all count statements
        const cagNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM ProdCag');
        const shopNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM ProdInfo');
        const cardNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM Card');
        const orderNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM Orders'); // Use Orders table
        
        // Prepare all sum statements
        const totalIncomeStmt = env.DB.prepare('SELECT COALESCE(SUM(money), 0) as total FROM Orders'); // Use Orders table and money field
        const totalNumStmt = env.DB.prepare('SELECT COALESCE(SUM(num), 0) as total FROM Orders');    // Use Orders table

        // Prepare history statement for the last 7 days
        // Orders.create_time is a Unix timestamp.
        const historyStmt = env.DB.prepare(
            "SELECT date(create_time, 'unixepoch') as order_date, SUM(money) as daily_total " + // Use create_time, 'unixepoch', and money
            "FROM Orders " + // Use Orders table
            "WHERE date(create_time, 'unixepoch') >= date('now', '-7 days') " +
            "GROUP BY order_date " +
            "ORDER BY order_date ASC"
        );
        
        // Execute all queries concurrently
        const [
            cagNumResult,
            shopNumResult,
            cardNumResult,
            orderNumResult,
            totalIncomeResult,
            totalNumResult,
            historyResults
        ] = await Promise.all([
            cagNumStmt.first<CountResult>(),
            shopNumStmt.first<CountResult>(),
            cardNumStmt.first<CountResult>(),
            orderNumStmt.first<CountResult>(),
            totalIncomeStmt.first<SumResult>(),
            totalNumStmt.first<SumResult>(),
            historyStmt.all<{ order_date: string; daily_total: number }>()
        ]);

        const dashboardData: AdminDashboardData = {
            cag_num: cagNumResult?.count ?? 0,
            shop_num: shopNumResult?.count ?? 0,
            card_num: cardNumResult?.count ?? 0,
            order_num: orderNumResult?.count ?? 0,
            total_income: totalIncomeResult?.total ?? 0,
            total_num: totalNumResult?.total ?? 0,
            history_date: [],
            history_price: []
        };

        // Process history results
        if (historyResults?.results) {
            const historyMap = new Map<string, number>();
            for (const row of historyResults.results) {
                historyMap.set(row.order_date, row.daily_total);
            }

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateString = d.toISOString().split('T')[0]; // Format as YYYY-MM-DD

                dashboardData.history_date.push(dateString);
                dashboardData.history_price.push(historyMap.get(dateString) || 0);
            }
        }
        
        return json(dashboardData);

    } catch (e: any) {
        console.error('Error fetching dashboard data:', e);
        return error(500, 'Failed to fetch dashboard data: ' + e.message);
    }
});


// GET /api/v4/income_count - Income statistics based on period
dashboardRouter.get('/income_count', async (request: IRequest, env: Env) => {
    const periodIdParam = request.query?.period_id as string;
    if (!periodIdParam) {
        return error(400, 'Missing period_id query parameter.');
    }

    const periodId = parseInt(periodIdParam, 10);
    if (isNaN(periodId) || periodId < 1 || periodId > 5) {
        return error(400, 'Invalid period_id. Must be an integer between 1 and 5.');
    }

    let dateFormatSql: string;
    let dateFilterSql: string;
    
    switch (periodId) {
        case 1: // Day - group by hour, filter by today
            dateFormatSql = '%H'; 
            dateFilterSql = "date(create_time, 'unixepoch') = date('now')"; // Use create_time, 'unixepoch'
            break;
        case 2: // Week - group by day, filter by last 7 days
            dateFormatSql = '%Y-%m-%d'; 
            dateFilterSql = "date(create_time, 'unixepoch') >= date('now', '-7 days')"; // Use create_time, 'unixepoch'
            break;
        case 3: // Month - group by day, filter by current month
            dateFormatSql = '%Y-%m-%d'; 
            dateFilterSql = "strftime('%Y-%m', create_time, 'unixepoch') = strftime('%Y-%m', 'now')"; // Use create_time, 'unixepoch'
            break;
        case 4: // Year - group by month number, filter by current year
            dateFormatSql = '%m'; 
            dateFilterSql = "strftime('%Y', create_time, 'unixepoch') = strftime('%Y', 'now')"; // Use create_time, 'unixepoch'
            break;
        case 5: // All - group by day
            dateFormatSql = '%Y-%m-%d'; 
            dateFilterSql = "1=1"; // No date filter, create_time will be used in strftime for grouping
            break;
        default: 
            return error(400, 'Invalid period_id.');
    }

    try {
        const query = `
            SELECT 
                strftime(?, create_time, 'unixepoch') as period_label, 
                COALESCE(SUM(money), 0) as period_total
            FROM Orders  -- Use Orders table and money field
            WHERE ${dateFilterSql} 
            GROUP BY period_label
            ORDER BY period_label ASC
        `;
        
        const stmt = env.DB.prepare(query).bind(dateFormatSql);

        const { results } = await stmt.all<{ period_label: string; period_total: number }>();

        const response: IncomeCountResponse = {
            history_date: [],
            history_price: []
        };

        if (results) {
            results.forEach(row => {
                response.history_date.push(row.period_label);
                response.history_price.push(row.period_total);
            });
        }

        return json(response);

    } catch (e: any) {
        console.error(`Error fetching income count for period_id ${periodId}:`, e);
        return error(500, 'Failed to fetch income count: ' + e.message);
    }
});


export default dashboardRouter;
