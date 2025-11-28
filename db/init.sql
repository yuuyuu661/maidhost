
CREATE TABLE IF NOT EXISTS users(
 id SERIAL PRIMARY KEY,
 name TEXT,
 type TEXT,
 icon_url TEXT,
 created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts(
 id SERIAL PRIMARY KEY,
 user_id INT REFERENCES users(id),
 date DATE,
 time_slot TEXT,
 status TEXT,
 reserved_name TEXT,
 total_price INT DEFAULT 0,
 updated_at TIMESTAMP DEFAULT NOW(),
 UNIQUE(user_id,date,time_slot)
);

CREATE TABLE IF NOT EXISTS menus(
 id SERIAL PRIMARY KEY,
 user_id INT REFERENCES users(id),
 name TEXT,
 price INT,
 description TEXT,
 created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders(
 id SERIAL PRIMARY KEY,
 shift_id INT REFERENCES shifts(id),
 menu_id INT REFERENCES menus(id),
 quantity INT,
 price_total INT,
 created_at TIMESTAMP DEFAULT NOW()
);
