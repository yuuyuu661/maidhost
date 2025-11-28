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

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* -------------------------------------
   DB 初期化（手動 SQL 不要）
------------------------------------- */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon_url TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      date TEXT,
      time_slot INTEGER,
      status TEXT,
      reserved_name TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      name TEXT,
      price INTEGER,
      description TEXT,
      type TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      date TEXT,
      type TEXT,
      slot INTEGER,
      name TEXT,
      price INTEGER
    );
  `);

  // 透明PNG作成（default.png）
  if (!fs.existsSync("public/default.png")) {
    fs.writeFileSync("public/default.png", Buffer.from([137,80,78,71]));
  }
}
initDB();

/* -------------------------------------
   ユーザー CRUD
------------------------------------- */
const upload = multer({ dest: "uploads/" });

app.post("/api/users", upload.single("icon"), async (req, res) => {
  const { name, type } = req.body;
  const icon = req.file ? "/uploads/" + req.file.filename : "/default.png";

  await pool.query(
    `INSERT INTO users (name, type, icon_url) VALUES ($1,$2,$3)`,
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

/* -------------------------------------
   シフト読み込み
------------------------------------- */
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

  const orders = await pool.query(
    `SELECT * FROM orders WHERE date=$1`,
    [date]
  );

  res.json({
    users: users.rows,
    shifts: shifts.rows,
    orders: orders.rows
  });
});

/* -------------------------------------
   シフト更新
------------------------------------- */
app.post("/api/shifts/update", async (req, res) => {
  const { user_id, date, time_slot, status, reserved_name } = req.body;

  await pool.query(
    `DELETE FROM shifts WHERE user_id=$1 AND date=$2 AND time_slot=$3`,
    [user_id, date, time_slot]
  );

  if (status !== "empty") {
    await pool.query(
      `INSERT INTO shifts (user_id,date,time_slot,status,reserved_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [user_id, date, time_slot, status, reserved_name]
    );
  }

  res.json({ ok: true });
});

/* -------------------------------------
   メニュー管理（追加 / 削除 / 読込）
------------------------------------- */
app.post("/api/menu", async (req, res) => {
  const { name, price, description, type } = req.body;

  await pool.query(
    `INSERT INTO menus (name,price,description,type)
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

app.delete("/api/menu/:id", async (req, res) => {
  await pool.query(`DELETE FROM menus WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

/* -------------------------------------
   注文（共有履歴）
------------------------------------- */
app.post("/api/order/add", async (req, res) => {
  const { date, type, slot, name, price } = req.body;

  await pool.query(
    `INSERT INTO orders (date,type,slot,name,price)
     VALUES ($1,$2,$3,$4,$5)`,
    [date, type, slot, name, price]
  );

  res.json({ ok: true });
});

app.delete("/api/order/:id", async (req, res) => {
  await pool.query(`DELETE FROM orders WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

/* -------------------------------------
   index.html
------------------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server Started")
);
