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

interface HistoryOrder {
    updatetime: string; // Assuming DATETIME is stored as ISO 8601 string or similar text format
    total_price: number;
}

const dashboardRouter = Router({ base: '/api/v4' }); // Changed base to /api/v4

// Apply JWT middleware
dashboardRouter.all('*', async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const authResponse = await jwtMiddleware(request as unknown as Request, env);
    if (authResponse) return authResponse;
});

// This is now /api/v4/dashboard
dashboardRouter.get('/dashboard', async (request: IRequest, env: Env) => {
    try {
        // Prepare all count statements
        const cagNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM ProdCag');
        const shopNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM ProdInfo');
        const cardNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM Card');
        const orderNumStmt = env.DB.prepare('SELECT COUNT(*) as count FROM "Order"');
        
        // Prepare all sum statements
        // Using COALESCE directly in SQL for D1 to handle NULL sum on empty tables
        const totalIncomeStmt = env.DB.prepare('SELECT COALESCE(SUM(total_price), 0) as total FROM "Order"');
        const totalNumStmt = env.DB.prepare('SELECT COALESCE(SUM(num), 0) as total FROM "Order"');

        // Prepare history statement
        // D1 uses SQLite date functions. 'now' gives UTC. updatetime is assumed to be stored in a compatible format.
        // We need to get orders from the last 7 days, grouped by date.
        // D1's strftime/date functions can be used.
        // Example: date(updatetime) will give 'YYYY-MM-DD'
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        // Format to YYYY-MM-DD HH:MM:SS for comparison if updatetime includes time.
        // However, for grouping by date, using date(updatetime) in SQL is better.
        // D1 stores DATETIME typically as ISO8601 strings or Unix timestamps. Assuming ISO8601 for now.
        // The original Python code used: datetime.datetime.now() - datetime.timedelta(days=7)
        // SQL for history:
        const historyStmt = env.DB.prepare(
            "SELECT date(updatetime) as order_date, SUM(total_price) as daily_total " +
            "FROM \"Order\" " +
            "WHERE date(updatetime) >= date('now', '-7 days') " + // Orders from the last 7 full days + today
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
            total_income: totalIncomeResult?.total ?? 0, // COALESCE handles null, but JS check is fine
            total_num: totalNumResult?.total ?? 0,     // COALESCE handles null
            history_date: [],
            history_price: []
        };

        // Process history results
        if (historyResults?.results) {
            const historyMap = new Map<string, number>();
            // Populate map with fetched daily totals
            for (const row of historyResults.results) {
                historyMap.set(row.order_date, row.daily_total);
            }

            // Generate dates for the last 7 days to ensure all days are present
            for (let i = 6; i >= 0; i--) { // Iterate from 6 days ago up to today
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
    
    // Using parameters for date values where possible
    let dateFilterParam: string | null = null; 

    // Determine SQL date formats and filters based on period_id
    // D1 uses SQLite syntax for date functions.
    switch (periodId) {
        case 1: // Day - group by hour, filter by today
            dateFormatSql = '%H'; 
            dateFilterSql = "date(updatetime) = date('now')";
            break;
        case 2: // Week - group by day, filter by last 7 days
            dateFormatSql = '%Y-%m-%d'; 
            dateFilterSql = "date(updatetime) >= date('now', '-7 days')";
            break;
        case 3: // Month - group by day, filter by current month
            dateFormatSql = '%Y-%m-%d'; 
            dateFilterSql = "strftime('%Y-%m', updatetime) = strftime('%Y-%m', 'now')";
            break;
        case 4: // Year - group by month number, filter by current year
            dateFormatSql = '%m'; 
            dateFilterSql = "strftime('%Y', updatetime) = strftime('%Y', 'now')";
            break;
        case 5: // All - group by day
            dateFormatSql = '%Y-%m-%d'; 
            dateFilterSql = "1=1"; // No date filter
            break;
        default: 
            return error(400, 'Invalid period_id.'); // Should be caught by earlier validation
    }

    try {
        const query = `
            SELECT 
                strftime(?, updatetime) as period_label, 
                COALESCE(SUM(total_price), 0) as period_total
            FROM "Order"
            WHERE ${dateFilterSql} 
            GROUP BY period_label
            ORDER BY period_label ASC
        `;
        
        // Bind the dateFormatSql to the first placeholder
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
