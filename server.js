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

/* --------------------------------------
   PostgreSQL 接続
-------------------------------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

/* --------------------------------------
   初回起動時にテーブル自動生成
-------------------------------------- */
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
      reserved_name TEXT,
      amount INTEGER DEFAULT 0
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
    CREATE TABLE IF NOT EXISTS order_logs (
      id SERIAL PRIMARY KEY,
      date TEXT,
      type TEXT,
      slot INTEGER,
      total INTEGER,
      detail_json TEXT
    );
  `);
}

initDB();

/* --------------------------------------
   ユーザー API
-------------------------------------- */
app.post("/api/users", multer({ dest: "uploads/" }).single("icon"), async (req, res) => {
  const { name, type } = req.body;
  const icon = req.file ? "/uploads/" + req.file.filename : null;

  await pool.query(
    `INSERT INTO users (name,type,icon_url) VALUES ($1,$2,$3)`,
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

/* --------------------------------------
   シフト API
-------------------------------------- */
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

  const exists = await pool.query(
    `SELECT * FROM shifts WHERE user_id=$1 AND date=$2 AND time_slot=$3`,
    [user_id, date, time_slot]
  );

  if (exists.rows.length > 0) {
    await pool.query(
      `UPDATE shifts SET status=$1, reserved_name=$2 WHERE user_id=$3 AND date=$4 AND time_slot=$5`,
      [status, reserved_name, user_id, date, time_slot]
    );
  } else {
    await pool.query(
      `INSERT INTO shifts (user_id, date, time_slot, status, reserved_name, amount)
       VALUES ($1,$2,$3,$4,$5,0)`,
      [user_id, date, time_slot, status, reserved_name]
    );
  }

  res.json({ ok: true });
});

/* --------------------------------------
   メニュー API
-------------------------------------- */
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

/* --------------------------------------
   注文保存（対応終了）
-------------------------------------- */
app.post("/api/orders/finish", async (req, res) => {
  const { date, type, slot, list, sum } = req.body;

  // shifts に合計金額を反映
  await pool.query(
    `UPDATE shifts
     SET amount = amount + $1
     WHERE date=$2 AND type=$3 AND time_slot=$4`,
    [sum, date, type, slot]
  );

  // order_logs に保存（端末共通）
  await pool.query(
    `INSERT INTO order_logs (date, type, slot, total, detail_json)
     VALUES ($1,$2,$3,$4,$5)`,
    [date, type, slot, sum, JSON.stringify(list)]
  );

  res.json({ ok: true });
});

/* --------------------------------------
   注文履歴 全件取得・削除
-------------------------------------- */
app.get("/api/orders/all", async (req, res) => {
  const q = await pool.query(
    `SELECT * FROM order_logs ORDER BY id DESC`
  );
  res.json(q.rows);
});

app.delete("/api/orders/:id", async (req, res) => {
  await pool.query(`DELETE FROM order_logs WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

/* --------------------------------------
   index.html 返却
-------------------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
