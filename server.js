import express from "express";
import multer from "multer";
import pg from "pg";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// ====== ESM環境で __dirname を作成 ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

// ====== Middlewares ======
app.use(cors());
app.use(express.json());

// public フォルダをルートで公開
app.use(express.static(path.join(__dirname, "public")));

// 画像アップロードフォルダ
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const upload = multer({ dest: path.join(__dirname, "uploads/icons") });

// ====== 管理パスワードチェック ======
function checkAdmin(req, res, next) {
  if (req.headers["x-admin-pass"] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

// =====================================
// ① ユーザー登録
// =====================================
app.post("/api/users", upload.single("icon"), async (req, res) => {
  try {
    const { name, type } = req.body;
    let icon = null;
    if (req.file) {
      icon = "/uploads/icons/" + req.file.filename;
    }

    await pool.query(
      `INSERT INTO users (name, type, icon_url)
       VALUES ($1, $2, $3)`,
      [name, type, icon]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const { type } = req.query;
    const q = await pool.query(
      `SELECT * FROM users WHERE type=$1 ORDER BY id`,
      [type]
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// =====================================
// ② シフト取得
// =====================================
app.get("/api/shifts", async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// シフト更新（管理専用）
app.post("/api/shifts/update", checkAdmin, async (req, res) => {
  try {
    const {
      user_id,
      date,
      time_slot,
      status,
      reserved_name,
      total_price,
    } = req.body;

    await pool.query(
      `
      INSERT INTO shifts (user_id, date, time_slot, status, reserved_name, total_price)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date, time_slot)
      DO UPDATE SET 
        status=$4,
        reserved_name=$5,
        total_price=$6
    `,
      [user_id, date, time_slot, status, reserved_name, total_price]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// =====================================
// ③ メニュー
// =====================================
app.post("/api/menu", checkAdmin, async (req, res) => {
  try {
    const { user_id, name, price, description } = req.body;

    await pool.query(
      `INSERT INTO menus (user_id, name, price, description)
       VALUES ($1, $2, $3, $4)`,
      [user_id, name, price, description]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.get("/api/menu", async (req, res) => {
  try {
    const { user_id } = req.query;
    const q = await pool.query(
      `SELECT * FROM menus WHERE user_id=$1 ORDER BY id`,
      [user_id]
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// =====================================
// ④ 注文
// =====================================
app.post("/api/orders", async (req, res) => {
  try {
    const { shift_id, menu_id, quantity, price_total } = req.body;

    await pool.query(
      `INSERT INTO orders (shift_id, menu_id, quantity, price_total)
       VALUES ($1, $2, $3, $4)`,
      [shift_id, menu_id, quantity, price_total]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// 注文終了 → JSON + CSV 保存
app.post("/api/orders/finish", async (req, res) => {
  try {
    const { shift_id, userName, customerName, slot, date, orders, sum } =
      req.body;

    const jsonPath = path.join(
      __dirname,
      "orders",
      `${date}_${userName}_${slot}.json`
    );

    const csvPath = path.join(
      __dirname,
      "orders",
      `${date}_${userName}_${slot}.csv`
    );

    // JSON
    fs.writeFileSync(jsonPath, JSON.stringify(orders, null, 2));

    // CSV
    let csv = "name,price,quantity,total\n";
    orders.forEach((o) => {
      csv += `${o.name},${o.price},${o.quantity},${o.total}\n`;
    });
    csv += `合計,,,${sum}`;

    fs.writeFileSync(csvPath, csv);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// =====================================
// ルート（/） → index.html
// =====================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// =====================================
app.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
