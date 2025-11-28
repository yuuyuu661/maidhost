import express from "express";
import multer from "multer";
import pg from "pg";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

/* ------------------------------------------
   DB初期化：テーブル自動作成
------------------------------------------ */
async function initDB() {
  console.log("Initializing database...");

  // users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon_url TEXT
    );
  `);

  // shifts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      time_slot INTEGER NOT NULL,
      status TEXT NOT NULL,
      reserved_name TEXT DEFAULT '',
      UNIQUE (user_id, date, time_slot)
    );
  `);

  // menus
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      type TEXT NOT NULL
    );
  `);

  // orders（必要なら増やす用）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_logs (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      type TEXT NOT NULL,
      slot INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("Database OK 🎉");
}

/* ------------------------------------------
   API：ユーザー
------------------------------------------ */
app.post("/api/users", multer({ dest: "uploads/" }).single("icon"), async (req, res) => {
  const { name, type } = req.body;
  const icon = req.file ? "/uploads/" + req.file.filename : null;

  await pool.query(
    `INSERT INTO users (name, type, icon_url) VALUES ($1, $2, $3)`,
    [name, type, icon]
  );

  res.json({ ok: true });
});

app.get("/api/users", async (req, res) => {
  const q = await pool.query(
    `SELECT * FROM users WHERE type=$1 ORDER BY id`,
    [req.query.type]
  );
  res.json(q.rows);
});

app.delete("/api/users/:id", async (req, res) => {
  await pool.query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

/* ------------------------------------------
   API：シフト
------------------------------------------ */
app.get("/api/shifts", async (req, res) => {
  const { type, date } = req.query;

  const users = await pool.query(
    `SELECT * FROM users WHERE type=$1 ORDER BY id`,
    [type]
  );

  const shifts = await pool.query(
    `SELECT * FROM shifts WHERE date=$1`,
    [date]
  );

  res.json({ users: users.rows, shifts: shifts.rows });
});

app.post("/api/shifts/update", async (req, res) => {
  const { user_id, date, time_slot, status, reserved_name } = req.body;

  await pool.query(
    `
      INSERT INTO shifts (user_id, date, time_slot, status, reserved_name)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id, date, time_slot)
      DO UPDATE SET status=$4, reserved_name=$5
    `,
    [user_id, date, time_slot, status, reserved_name]
  );

  res.json({ ok: true });
});

/* ------------------------------------------
   API：メニュー
------------------------------------------ */
app.post("/api/menu", async (req, res) => {
  const { name, price, description, type } = req.body;

  await pool.query(
    `INSERT INTO menus (name, price, description, type)
     VALUES ($1,$2,$3,$4)`,
    [name, price, description, type]
  );

  res.json({ ok: true });
});

app.get("/api/menu", async (req, res) => {
  const q = await pool.query(
    `SELECT * FROM menus WHERE type=$1 ORDER BY id`,
    [req.query.type]
  );
  res.json(q.rows);
});

/* ------------------------------------------
   API：注文保存（JSON + CSV）
------------------------------------------ */
app.post("/api/orders/finish", async (req, res) => {
  const { date, type, slot, list, sum } = req.body;

  if (!fs.existsSync("orders")) fs.mkdirSync("orders");

  fs.writeFileSync(
    `orders/${date}_${type}_${slot}.json`,
    JSON.stringify(list, null, 2)
  );

  let csv = "name,price,qty\n";
  list.forEach(o => (csv += `${o.name},${o.price},1\n`));
  csv += `合計,${sum}`;

  fs.writeFileSync(`orders/${date}_${type}_${slot}.csv`, csv);

  res.json({ ok: true });
});

/* ------------------------------------------
   index.html
------------------------------------------ */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ------------------------------------------
   サーバー起動（テーブル自動作成）
------------------------------------------ */
async function startServer() {
  await initDB();  // ← 毎回必ずテーブル確認＆自動作成
  app.listen(process.env.PORT || 3000, () =>
    console.log("Server Started")
  );
}

startServer();
