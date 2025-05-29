-- SQL schema for Cloudflare D1
-- Translated from SQLAlchemy models

-- AdminUser table
CREATE TABLE AdminUser (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    avatar TEXT,
    email TEXT,
    phone TEXT,
    status INTEGER DEFAULT 1, -- 0: inactive, 1: active
    role TEXT,
    login_ip TEXT,
    login_time INTEGER,
    remark TEXT,
    create_time INTEGER NOT NULL,
    update_time INTEGER
);

-- AdminLog table
CREATE TABLE AdminLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    method TEXT,
    url TEXT,
    data TEXT,
    ip TEXT,
    user_agent TEXT,
    create_time INTEGER NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES AdminUser(id)
);

-- Payment table
CREATE TABLE Payment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_no TEXT NOT NULL UNIQUE, -- Business order number
    out_trade_no TEXT NOT NULL UNIQUE, -- Upstream order number
    type TEXT, -- Payment type
    name TEXT, -- Product name
    money REAL NOT NULL, -- Amount in cents
    param TEXT, -- Custom parameters
    status INTEGER DEFAULT 0, -- 0: unpaid, 1: paid
    create_time INTEGER NOT NULL,
    update_time INTEGER,
    pay_id TEXT, -- User ID, can be IP or other
    pay_type INTEGER, -- 1: WeChat, 2: Alipay, 3: QQ Wallet, 4: Manual processing
    pay_url TEXT, -- Payment link
    is_auto INTEGER DEFAULT 1, -- 1: Auto, 0: Manual
    title TEXT, -- Payment page title
    qr_price REAL, -- QR code fixed amount
    close_time INTEGER, -- Order closing time
    ip_address TEXT,
    ip_location TEXT,
    browser TEXT,
    os TEXT,
    user_id INTEGER,
    remark TEXT
);

-- ProdCag table (Product Category)
CREATE TABLE ProdCag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status INTEGER DEFAULT 1, -- 0: inactive, 1: active
    create_time INTEGER NOT NULL,
    update_time INTEGER,
    sort_order INTEGER DEFAULT 0
);

-- ProdInfo table (Product Information)
CREATE TABLE ProdInfo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL, -- Price in cents
    cag_id INTEGER NOT NULL,
    status INTEGER DEFAULT 1, -- 0: inactive, 1: active
    info TEXT, -- Product details
    create_time INTEGER NOT NULL,
    update_time INTEGER,
    inventory INTEGER DEFAULT -1, -- -1 for unlimited
    sales INTEGER DEFAULT 0,
    img TEXT,
    level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (cag_id) REFERENCES ProdCag(id)
);

-- Order table
CREATE TABLE Orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prod_id INTEGER NOT NULL,          -- From existing
    trade_no TEXT NOT NULL UNIQUE,     -- Existing (maps to out_order_id in API responses)
    num INTEGER NOT NULL,              -- Existing
    title TEXT,                        -- Existing (maps to name - product name in API responses)
    contact TEXT,                      -- Was 'email' in existing, now more generic
    contact_txt TEXT,                  -- New field for additional contact info
    unit_price REAL,                   -- New field for unit price at time of order
    money REAL NOT NULL,               -- Existing (maps to total_price in API responses)
    payment TEXT,                      -- New field for payment gateway used
    status INTEGER DEFAULT 0,          -- Existing (0: unpaid, 1: paid, 2: completed, 3: closed)
    card TEXT,                         -- New field for allocated card details
    create_time INTEGER NOT NULL,      -- Existing (Unix timestamp)
    update_time INTEGER,               -- Existing (Unix timestamp)
    pay_id TEXT,                       -- Existing (User ID from payment system, if any)
    remark TEXT,                       -- Existing
    coupon_code TEXT,                  -- Existing
    FOREIGN KEY (prod_id) REFERENCES ProdInfo(id)
);

-- TempOrder table
CREATE TABLE TempOrder (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_no TEXT NOT NULL UNIQUE,
    prod_id INTEGER NOT NULL,
    num INTEGER NOT NULL,
    money REAL NOT NULL, -- Total Amount
    status INTEGER DEFAULT 0, -- 0: unpaid, 1: paid
    create_time INTEGER NOT NULL,
    update_time INTEGER,
    pay_id TEXT, -- User ID
    title TEXT, -- Product Name
    email TEXT, -- For contact
    remark TEXT,
    coupon_code TEXT,
    payment TEXT,      -- Added: Payment method used
    contact TEXT,      -- Added: Primary contact info (e.g. email/phone)
    contact_txt TEXT,  -- Added: Additional contact info (e.g. query password)
    price REAL,        -- Added: Unit price at time of temp order creation
    total_price REAL,  -- Added: Should be same as money, for consistency with Orders table
    auto INTEGER,      -- Added: From ProdInfo.auto, boolean (0 or 1)
    endtime INTEGER,   -- Added: Expiration time for the temp order (Unix timestamp)
    FOREIGN KEY (prod_id) REFERENCES ProdInfo(id)
);

-- Card table (Card/License Information)
CREATE TABLE Card (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prod_id INTEGER NOT NULL,
    content TEXT NOT NULL, -- Card content
    status INTEGER DEFAULT 0, -- 0: unused, 1: used
    create_time INTEGER NOT NULL,
    update_time INTEGER,
    use_time INTEGER,
    order_id INTEGER,
    is_deleted INTEGER DEFAULT 0, -- Soft delete flag
    FOREIGN KEY (prod_id) REFERENCES ProdInfo(id),
    FOREIGN KEY (order_id) REFERENCES Orders(id)
);

-- Config table
CREATE TABLE Config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    name TEXT, -- Description
    create_time INTEGER NOT NULL,
    update_time INTEGER
);

-- Plugin table
CREATE TABLE Plugin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    version TEXT,
    author TEXT,
    description TEXT,
    status INTEGER DEFAULT 0, -- 0: disabled, 1: enabled
    config TEXT, -- JSON configuration for the plugin
    create_time INTEGER NOT NULL,
    update_time INTEGER
);

-- Notice table
CREATE TABLE Notice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    level TEXT DEFAULT 'info', -- e.g., info, warning, danger
    status INTEGER DEFAULT 1, -- 0: inactive, 1: active
    create_time INTEGER NOT NULL,
    update_time INTEGER,
    sort_order INTEGER DEFAULT 0
);
