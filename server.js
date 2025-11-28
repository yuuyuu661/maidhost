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

/* -------------------------------
   DB自動生成（users / shifts / menus / orders）
-------------------------------- */
const initSQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  type TEXT,
  icon_url TEXT
);
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  date TEXT,
  time_slot INTEGER,
  status TEXT,
  reserved_name TEXT
);
CREATE TABLE IF NOT EXISTS menus (
  id SERIAL PRIMARY KEY,
  name TEXT,
  price INTEGER,
  description TEXT,
  type TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  date TEXT,
  shift_type TEXT,
  slot INTEGER,
  item_name TEXT,
  price INTEGER
);
`;

(async () => {
  try {
    await pool.query(initSQL);
    console.log("Tables OK");
  } catch (e) {
    console.error("Init error:", e);
  }
})();

/* -------------------------------
   ユーザー管理
-------------------------------- */
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

/* -------------------------------
   シフト読み込み
-------------------------------- */
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

/* -------------------------------
   シフト更新 API（今回の本命）
-------------------------------- */
app.post("/api/shifts/update", async (req, res) => {
  const { user_id, date, time_slot, status, reserved_name } = req.body;

  // 既存レコードあるか？
  const q = await pool.query(
    `SELECT * FROM shifts WHERE user_id=$1 AND date=$2 AND time_slot=$3`,
    [user_id, date, time_slot]
  );

  if (q.rows.length === 0) {
    // 新規作成
    await pool.query(
      `INSERT INTO shifts (user_id,date,time_slot,status,reserved_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [user_id, date, time_slot, status, reserved_name]
    );
  } else {
    // 更新
    await pool.query(
      `UPDATE shifts SET status=$1,reserved_name=$2
       WHERE user_id=$3 AND date=$4 AND time_slot=$5`,
      [status, reserved_name, user_id, date, time_slot]
    );
  }

  res.json({ ok: true });
});

/* -------------------------------
   メニュー
-------------------------------- */
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

/* ---- メニュー削除API（新規追加） ---- */
app.delete("/api/menu/:id", async (req, res) => {
  await pool.query(`DELETE FROM menus WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

/* -------------------------------
   注文（履歴はDBへ保存）
-------------------------------- */
app.post("/api/orders/add", async (req, res) => {
  const { date, shift_type, slot, name, price } = req.body;

  await pool.query(
    `INSERT INTO orders (date,shift_type,slot,item_name,price)
     VALUES ($1,$2,$3,$4,$5)`,
    [date, shift_type, slot, name, price]
  );

  res.json({ ok: true });
});

app.get("/api/orders", async (req, res) => {
  const { date, shift_type, slot } = req.query;

  const q = await pool.query(
    `SELECT * FROM orders 
     WHERE date=$1 AND shift_type=$2 AND slot=$3
     ORDER BY id`,
    [date, shift_type, slot]
  );
  res.json(q.rows);
});

app.delete("/api/orders/clear", async (req, res) => {
  const { date, shift_type, slot } = req.query;

  await pool.query(
    `DELETE FROM orders WHERE date=$1 AND shift_type=$2 AND slot=$3`,
    [date, shift_type, slot]
  );

  res.json({ ok: true });
});

/* -------------------------------
   index
-------------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
