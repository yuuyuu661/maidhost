import express from "express";
import multer from "multer";
import pg from "pg";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();

/* ----------------------------------------------
  ミドルウェア
---------------------------------------------- */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* ----------------------------------------------
  DB 接続
---------------------------------------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

/* ----------------------------------------------
  管理パスワード（固定：yamada）
---------------------------------------------- */
app.post("/api/admin-check", (req, res) => {
  const ok = req.body.pass === "yamada";
  res.json({ ok });
});

/* ----------------------------------------------
  ユーザー登録（ホスト or メイド）
---------------------------------------------- */
const upload = multer({ dest: "uploads/" });

app.post("/api/users", upload.single("icon"), async (req, res) => {
  const { name, type } = req.body;
  const icon = req.file ? "/uploads/" + req.file.filename : null;

  await pool.query(
    `INSERT INTO users (name, type, icon_url) VALUES ($1, $2, $3)`,
    [name, type, icon]
  );

  res.json({ ok: true });
});

/* ----------------------------------------------
  ユーザー一覧取得
---------------------------------------------- */
app.get("/api/users", async (req, res) => {
  const type = req.query.type;
  const q = await pool.query(
    `SELECT * FROM users WHERE type=$1 ORDER BY id`,
    [type]
  );
  res.json(q.rows);
});

/* ----------------------------------------------
  ユーザー削除
---------------------------------------------- */
app.delete("/api/users/:id", async (req, res) => {
  const id = req.params.id;
  await pool.query(`DELETE FROM users WHERE id=$1`, [id]);
  res.json({ ok: true });
});

/* ----------------------------------------------
  シフト取得（通常 & 管理者用 両方共通）
---------------------------------------------- */
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

  res.json({
    users: users.rows,
    shifts: shifts.rows
  });
});

/* ----------------------------------------------
  シフト更新（一般モード：セルクリック編集）
---------------------------------------------- */
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

/* ----------------------------------------------
  メニュー登録（ホスト / メイド）
---------------------------------------------- */
app.post("/api/menu", async (req, res) => {
  const { name, price, description, type } = req.body;

  await pool.query(
    `INSERT INTO menus (name, price, description, type)
     VALUES ($1, $2, $3, $4)`,
    [name, price, description, type]
  );

  res.json({ ok: true });
});

/* ----------------------------------------------
  メニュー一覧取得
---------------------------------------------- */
app.get("/api/menu", async (req, res) => {
  const type = req.query.type;

  const q = await pool.query(
    `SELECT * FROM menus WHERE type=$1 ORDER BY id`,
    [type]
  );

  res.json(q.rows);
});

/* ----------------------------------------------
  注文完了 → JSON + CSV 保存
---------------------------------------------- */
app.post("/api/orders/finish", async (req, res) => {
  const { date, type, slot, list, sum } = req.body;

  if (!fs.existsSync("orders")) fs.mkdirSync("orders");

  const jsonPath = `orders/${date}_${type}_${slot}.json`;
  const csvPath  = `orders/${date}_${type}_${slot}.csv`;

  /* JSON 保存 */
  fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2));

  /* CSV 保存 */
  let csv = "name,price,qty\n";
  list.forEach(item => {
    csv += `${item.name},${item.price},1\n`;
  });
  csv += `合計,${sum}`;

  fs.writeFileSync(csvPath, csv);

  res.json({ ok: true });
});

/* ----------------------------------------------
  index.html（SPA用）
---------------------------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

/* ----------------------------------------------
  サーバー起動
---------------------------------------------- */
app.listen(process.env.PORT || 3000, () =>
  console.log("Server Started")
);
