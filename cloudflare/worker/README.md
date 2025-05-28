# Kamifaka Worker

This is a Cloudflare Workers project for the Kamifaka backend.

## Database Seeding Strategy

The D1 database needs to be seeded with initial data, primarily for the `Config` table, as derived from the `init_db()` function in the original `service/config/config.py`.

The following strategies can be considered for seeding:

1.  **Wrangler D1 execute with `--file`:**
    *   Create a `.sql` file (e.g., `seed.sql`) containing `INSERT` statements for the initial configuration data.
    *   Example `seed.sql` content:
        ```sql
        -- Insert initial configuration data
        INSERT INTO Config (key, value, name, create_time, update_time) VALUES 
        ('site_name', 'Kamifaka', 'Site Name', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_url', 'http://localhost:8787', 'Site URL', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_logo', '/static/logo.png', 'Site Logo', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_favicon', '/static/favicon.ico', 'Site Favicon', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_seo_title', 'Kamifaka - Automatic Vending Platform', 'SEO Title', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_seo_keywords', 'kamifaka, vending, automatic', 'SEO Keywords', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_seo_description', 'A powerful and easy-to-use automatic vending platform.', 'SEO Description', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_record_number', '', 'ICP Record Number', strftime('%s', 'now'), strftime('%s', 'now')),
        ('site_copyright', 'Powered by Kamifaka', 'Copyright Information', strftime('%s', 'now'), strftime('%s', 'now')),
        ('admin_default_username', 'admin', 'Default Admin Username', strftime('%s', 'now'), strftime('%s', 'now')),
        ('admin_default_password', 'admin123', 'Default Admin Password (plaintext, to be hashed on first login or via a setup script)', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_alipay_enable', '0', 'Enable Alipay', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_wechat_enable', '0', 'Enable WeChat Pay', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_qq_enable', '0', 'Enable QQ Wallet', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_epay_url', '', 'EPay API URL', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_epay_pid', '', 'EPay PID', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_epay_key', '', 'EPay Key', strftime('%s', 'now'), strftime('%s', 'now')),
        ('pay_min_payment', '1', 'Minimum Payment Amount (in cents or smallest unit)', strftime('%s', 'now'), strftime('%s', 'now')),
        ('mail_smtp_server', '', 'SMTP Server', strftime('%s', 'now'), strftime('%s', 'now')),
        ('mail_smtp_port', '465', 'SMTP Port', strftime('%s', 'now'), strftime('%s', 'now')),
        ('mail_smtp_user', '', 'SMTP Username', strftime('%s', 'now'), strftime('%s', 'now')),
        ('mail_smtp_password', '', 'SMTP Password', strftime('%s', 'now'), strftime('%s', 'now')),
        ('mail_sender_address', '', 'Sender Email Address', strftime('%s', 'now'), strftime('%s', 'now')),
        ('sms_aliyun_access_key_id', '', 'Aliyun SMS Access Key ID', strftime('%s', 'now'), strftime('%s', 'now')),
        ('sms_aliyun_access_key_secret', '', 'Aliyun SMS Access Key Secret', strftime('%s', 'now'), strftime('%s', 'now')),
        ('sms_aliyun_sign_name', '', 'Aliyun SMS Sign Name', strftime('%s', 'now'), strftime('%s', 'now')),
        ('sms_aliyun_template_code', '', 'Aliyun SMS Template Code', strftime('%s', 'now'), strftime('%s', 'now')),
        ('captcha_type', 'default', 'Captcha Type (default, recaptcha, hcaptcha)', strftime('%s', 'now'), strftime('%s', 'now')),
        ('captcha_recaptcha_site_key', '', 'reCAPTCHA Site Key', strftime('%s', 'now'), strftime('%s', 'now')),
        ('captcha_recaptcha_secret_key', '', 'reCAPTCHA Secret Key', strftime('%s', 'now'), strftime('%s', 'now')),
        ('captcha_hcaptcha_site_key', '', 'hCaptcha Site Key', strftime('%s', 'now'), strftime('%s', 'now')),
        ('captcha_hcaptcha_secret_key', '', 'hCaptcha Secret Key', strftime('%s', 'now'), strftime('%s', 'now')),
        ('theme_default', 'default', 'Default Theme', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_type', 'local', 'Storage Type (local, s3, r2)', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_s3_access_key_id', '', 'S3 Access Key ID', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_s3_secret_access_key', '', 'S3 Secret Access Key', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_s3_bucket_name', '', 'S3 Bucket Name', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_s3_region', '', 'S3 Region', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_r2_access_key_id', '', 'R2 Access Key ID', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_r2_secret_access_key', '', 'R2 Secret Access Key', strftime('%s', 'now'), strftimeggak_config.py
        ('storage_r2_account_id', '', 'R2 Account ID', strftime('%s', 'now'), strftime('%s', 'now')),
        ('storage_r2_bucket_name', '', 'R2 Bucket Name', strftime('%s', 'now'), strftime('%s', 'now')),
        -- Add other necessary initial configurations like default admin user (password should be handled securely)
        -- and product categories if they are static.
        -- For the admin user, the password needs to be hashed. This might require a setup step within the worker
        -- or a separate script that can invoke hashing logic.
        -- Example for AdminUser (requires password to be pre-hashed, or a setup endpoint):
        -- INSERT INTO AdminUser (username, password_hash, nickname, email, status, role, create_time) VALUES
        -- ('admin', 'hashed_password_here', 'Administrator', 'admin@example.com', 1, 'superadmin', strftime('%s', 'now'));
        ('webhook_url_global', '', 'Global Webhook URL', strftime('%s', 'now'), strftime('%s', 'now')),
        ('order_auto_close_minutes', '30', 'Auto Close Unpaid Orders (minutes)', strftime('%s', 'now'), strftime('%s', 'now')),
        ('custom_css', '', 'Custom CSS', strftime('%s', 'now'), strftime('%s', 'now')),
        ('custom_js', '', 'Custom JavaScript', strftime('%s', 'now'), strftime('%s', 'now')),
        ('tos_url', '', 'Terms of Service URL', strftime('%s', 'now'), strftime('%s', 'now')),
        ('privacy_policy_url', '', 'Privacy Policy URL', strftime('%s', 'now'), strftime('%s', 'now'));
        ```
    *   Run `wrangler d1 execute <YOUR_DB_NAME> --file=seed.sql --local` (for local testing) or without `--local` for production.
    *   **Pros:** Simple for static data.
    *   **Cons:** Less flexible for dynamic data or data requiring logic (like password hashing). `strftime('%s', 'now')` can be used for timestamps.

2.  **Worker Endpoint for Seeding:**
    *   Create a special (possibly protected or temporary) endpoint in `index.ts` (e.g., `/setup` or `/seed-database`).
    *   When this endpoint is called, the worker code would execute D1 `INSERT` queries using the `env.DB` binding.
    *   This allows for more complex logic, such as hashing the default admin password.
    *   Example snippet in `index.ts`:
        ```typescript
        // ... other imports
        // import { hashPassword } from './auth'; // Assuming an auth utility

        export default {
          async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
            const url = new URL(request.url);
            if (request.method === 'POST' && url.pathname === '/seed-database') {
              // Optional: Add authentication/authorization for this endpoint
              try {
                // const hashedPassword = await hashPassword('admin123'); // Implement hashing
                const db = env.DB;

                // Seed Config table
                const configData = [
                  { key: 'site_name', value: 'Kamifaka', name: 'Site Name' },
                  // ... more config items
                  { key: 'admin_default_username', value: 'admin', name: 'Default Admin Username'},
                  // Password needs to be handled carefully, ideally pre-hashed or set via a secure first-time setup
                ];
                const now = Math.floor(Date.now() / 1000);
                for (const item of configData) {
                  await db.prepare("INSERT INTO Config (key, value, name, create_time, update_time) VALUES (?, ?, ?, ?, ?)")
                          .bind(item.key, item.value, item.name, now, now)
                          .run();
                }
                
                // Seed AdminUser (example, ensure password is properly handled)
                // const defaultAdminPassword = 'admin_password_to_be_hashed'; // Hash this
                // await db.prepare("INSERT INTO AdminUser (username, password_hash, nickname, status, role, create_time) VALUES (?, ?, ?, ?, ?, ?)")
                // .bind('admin', hashedPassword, 'Admin', 1, 'superadmin', now).run();

                return new Response("Database seeded successfully!", { status: 200 });
              } catch (e: any) {
                return new Response(`Error seeding database: ${e.message}`, { status: 500 });
              }
            }
            // ... your regular worker logic
            return new Response("Hello World!");
          },
        };
        ```
    *   **Pros:** More flexible, can include logic like password hashing. Can be triggered manually.
    *   **Cons:** Requires a running worker, endpoint needs to be secured or removed after use.

3.  **Separate Seeding Script (`seeding.ts`):**
    *   Create a `seeding.ts` file that uses `wrangler`'s D1 client API (or a library like `better-sqlite3` if running locally against a local replica of the D1 schema, though direct D1 client is better for consistency).
    *   This script would be run locally using Node.js.
    *   It would connect to the D1 database (either local replica or remote) and execute `INSERT` statements.
    *   This is similar to option 2 but executed as a CLI script rather than a worker endpoint.
    *   **Pros:** Good separation of concerns. Can be version controlled.
    *   **Cons:** Requires setting up D1 client access from a local script.

**Recommended Initial Approach:**

For simplicity and to match the structure of `init_db()` from the original project, **Option 1 (Wrangler D1 execute with `--file`)** is a good starting point for the `Config` table data that is mostly static strings.

For the default admin user, the password needs to be hashed. This part might be better handled by:
*   A manual `INSERT` with a pre-hashed password (less ideal for initial setup).
*   A simple setup step in the worker application itself upon first run or via a dedicated setup endpoint (Option 2), which prompts for admin details and creates the user. This is more secure and user-friendly.

**Initial Data from `config.py` to Seed into `Config` table:**
(Refer to the `seed.sql` example above for a more complete list based on `CONFIG_INIT_TABLE` and `ADMIN_CONFIG`)

*   `site_name`, `site_url`, `site_logo`, `site_favicon`, `site_seo_title`, `site_seo_keywords`, `site_seo_description`, `site_record_number`, `site_copyright`
*   `admin_default_username`, `admin_default_password` (handle password hashing separately)
*   Payment provider enable flags and credentials (e.g., `pay_alipay_enable`, `pay_epay_url`, etc.) - ensure sensitive keys are handled securely, possibly through secrets rather than direct DB seeding for production.
*   Email/SMS configurations (e.g., `mail_smtp_server`, `sms_aliyun_access_key_id`) - also sensitive, consider secrets.
*   Captcha configurations.
*   Theme and storage settings.
*   Other miscellaneous settings like `webhook_url_global`, `order_auto_close_minutes`.

The `AdminUser` table should be seeded with a default admin account. The password for this account should be set during a setup process or pre-hashed if using a SQL seed script. The original `init_db` hashed the password `admin_default_password` using `generate_password_hash`. A similar mechanism will be needed in the Worker or a setup script.

No other tables seem to require initial data based on the `init_db` function.
`ProdCag` might have default categories, but these are not explicitly in `init_db`.
The `Plugin` table might have default plugins listed, but `init_db` doesn't show this.
`Notice` table is also not initialized in `init_db`.

This project uses `wrangler.toml` for configuration, including D1 database bindings.

```toml
name = "kamifaka-worker"
main = "src/index.ts"
compatibility_date = "2024-03-18" # Or your desired date

# D1 database binding
[[d1_databases]]
binding = "DB" # How you'll access it in your Worker (e.g., env.DB)
database_name = "kamifaka-db" # Give your D1 database a name
database_id = "<your_database_id>" # This will be filled in after `wrangler d1 create kamifaka-db`
preview_database_id = "<your_preview_database_id>" # For wrangler dev --remote

# You might also want to add [vars] for configuration not suitable for DB Config table initially
# [vars]
# ADMIN_DEFAULT_PASSWORD_PLAIN = "admin123" # For initial setup, then remove
```

**Next Steps for Seeding:**
1. Create the D1 database using `wrangler d1 create kamifaka-db`.
2. Update `wrangler.toml` with the `database_id`.
3. Prepare `seed.sql` with `INSERT` statements for the `Config` table.
4. For the admin user, decide on the hashing strategy (e.g., a setup endpoint in the worker).
5. Run `wrangler d1 execute kamifaka-db --file=seed.sql --local` (and later for remote).
