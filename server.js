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

// ▼ 管理パスワードは固定 “yamada”
app.post("/api/admin-check", (req,res)=>{
  const ok = req.body.pass === "yamada";
  res.json({ ok });
});

// ▼ ユーザー
app.post("/api/users", multer({dest:"uploads/"}).single("icon"), async(req,res)=>{
  const { name, type } = req.body;
  const icon = req.file ? "/uploads/" + req.file.filename : null;
  await pool.query(
    `INSERT INTO users (name,type,icon_url) VALUES ($1,$2,$3)`,
    [name,type,icon]
  );
  res.json({ok:true});
});

app.get("/api/users", async(req,res)=>{
  const q = await pool.query(`SELECT * FROM users WHERE type=$1 ORDER BY id`,[req.query.type]);
  res.json(q.rows);
});

app.delete("/api/users/:id", async(req,res)=>{
  await pool.query(`DELETE FROM users WHERE id=$1`,[req.params.id]);
  res.json({ok:true});
});

// ▼ シフト
app.get("/api/shifts", async(req,res)=>{
  const { type, date } = req.query;
  const users = await pool.query(`SELECT * FROM users WHERE type=$1 ORDER BY id`,[type]);
  const shifts = await pool.query(`SELECT * FROM shifts WHERE date=$1`,[date]);
  res.json({ users: users.rows, shifts: shifts.rows });
});

// ▼ メニュー
app.post("/api/menu", async(req,res)=>{
  const { name, price, description, type } = req.body;
  await pool.query(
    `INSERT INTO menus (name,price,description,type) VALUES ($1,$2,$3,$4)`,
    [name,price,description,type]
  );
  res.json({ok:true});
});

app.get("/api/menu", async(req,res)=>{
  const q = await pool.query(`SELECT * FROM menus WHERE type=$1 ORDER BY id`,[req.query.type]);
  res.json(q.rows);
});

// ▼ 注文保存
app.post("/api/orders/finish", async(req,res)=>{
  const { date, type, slot, list, sum } = req.body;
  if (!fs.existsSync("orders")) fs.mkdirSync("orders");

  fs.writeFileSync(`orders/${date}_${type}_${slot}.json`, JSON.stringify(list,null,2));

  let csv = "name,price,qty\n";
  list.forEach(o => csv += `${o.name},${o.price},1\n`);
  csv += `合計,${sum}`;

  fs.writeFileSync(`orders/${date}_${type}_${slot}.csv`, csv);

  res.json({ok:true});
});

// ▼ index.html
app.get("/", (req,res)=>{
  res.sendFile(path.resolve("public/index.html"));
});

app.listen(process.env.PORT || 3000, ()=> console.log("Server Started"));
