/* =========================================================
   基本設定
========================================================= */
const API = "";
let currentShiftType = "host";
let currentShiftId = null;
let currentShiftDate = null;
let currentShiftSlot = null;
let currentShiftUserName = null;

const ADMIN_PASSWORD = "あなたの管理者パスワード";


/* =========================================================
   タブ切り替え
========================================================= */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.panel;

    // タブ切り替え
    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel-" + target).classList.add("active");

    // パネルごとの動作
    if (target === "shift-host") loadShift("host");
    if (target === "shift-maid") loadShift("maid");
    if (target === "users") loadUserList();
    if (target === "menu") loadMenuUsers();
  });
});

// 🔥初期表示はホストシフト
window.addEventListener("load", () => {
  tabs[0].click();
});


/* =========================================================
   管理パスワードチェック
========================================================= */
let adminOK_users = false;
let adminOK_menu = false;

document.getElementById("unlock-users").onclick = () => {
  const pass = document.getElementById("admin-pass-users").value;
  if (pass === ADMIN_PASSWORD) {
    adminOK_users = true;
    document.getElementById("admin-lock-users").classList.add("hidden");
    document.getElementById("users-content").classList.remove("hidden");
    loadUserList();
  } else {
    alert("パスワードが違います");
  }
};

document.getElementById("unlock-menu").onclick = () => {
  const pass = document.getElementById("admin-pass-menu").value;
  if (pass === ADMIN_PASSWORD) {
    adminOK_menu = true;
    document.getElementById("admin-lock-menu").classList.add("hidden");
    document.getElementById("menu-content").classList.remove("hidden");
    loadMenuUsers();
  } else {
    alert("パスワードが違います");
  }
};


/* =========================================================
   ユーザー登録
========================================================= */
document.getElementById("u-save").onclick = async () => {
  if (!adminOK_users) return alert("管理認証が必要です");

  const name = document.getElementById("u-name").value;
  const type = document.getElementById("u-type").value;
  const file = document.getElementById("u-icon").files[0];

  if (!name || !file) return alert("名前とアイコンを入力してください");

  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  fd.append("icon", file);

  const res = await fetch("/api/users", { method:"POST", body:fd });
  const json = await res.json();

  if (json.ok) {
    alert("登録完了しました");
    loadUserList();
  } else {
    alert("登録失敗");
  }
};


/* =========================================================
   ユーザー一覧・削除機能
========================================================= */
async function loadUserList() {
  if (!adminOK_users) return;

  const host = await (await fetch("/api/users?type=host")).json();
  const maid = await (await fetch("/api/users?type=maid")).json();

  const area = document.getElementById("u-list");
  area.innerHTML = `
    <h4>ホスト一覧</h4>
    ${host.map(u => userRow(u)).join("")}
    <h4>メイド一覧</h4>
    ${maid.map(u => userRow(u)).join("")}
  `;
}

function userRow(u) {
  return `
    <div style="display:flex;align-items:center;margin:4px 0;">
      <img src="${u.icon_url}" width="40" style="margin-right:8px;border-radius:4px;">
      <div style="flex:1;">${u.id}. ${u.name}</div>
      <button onclick="deleteUser(${u.id})" style="background:#ff4444;color:white;border:none;padding:4px 8px;border-radius:4px;">
        削除
      </button>
    </div>
  `;
}

window.deleteUser = async (id) => {
  if (!confirm("削除しますか？")) return;

  const res = await fetch("/api/users/delete", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-admin-pass":ADMIN_PASSWORD },
    body: JSON.stringify({ id })
  });

  const json = await res.json();
  if (json.ok) {
    alert("削除しました");
    loadUserList();
  } else {
    alert("削除失敗");
  }
};


/* =========================================================
   シフト読み込み
========================================================= */
async function loadShift(type) {
  currentShiftType = type;

  const date = getToday();
  const res = await fetch(`/api/shifts?type=${type}&date=${date}`);
  const json = await res.json();

  const table = createShiftTable(json.users, json.shifts, date);

  const target = document.getElementById(type === "host" ? "sh-host" : "sh-maid");
  target.innerHTML = "";
  target.appendChild(table);
}

function createShiftTable(users, shifts, date) {
  const times = [
    "20:00-20:30", "20:30-21:00",
    "21:00-21:30", "21:30-22:00",
    "22:00-22:30", "22:30-23:00"
  ];

  const table = document.createElement("table");
  let html = `<tr><th>${date}</th>`;
  users.forEach(u => {
    html += `<th><img src="${u.icon_url}"><br>${u.name}</th>`;
  });
  html += "</tr>";

  times.forEach(slot => {
    html += `<tr><td>${slot}</td>`;

    users.forEach(u => {
      const s = shifts.find(s => s.user_id === u.id && s.time_slot === slot);
      let cls = "empty";
      let text = "";

      if (s) {
        if (s.status === "reserved") {
          cls = "reserved";
          text = s.reserved_name + `<br><span class='order-btn' onclick="openOrder('${u.name}','${slot}','${date}',${s.id})">注文</span>`;
        } else if (s.status === "x") {
          cls = "x";
          text = "X";
        }
      }

      html += `<td class="${cls}" onclick="openEdit(${u.id},'${slot}','${date}')">${text}</td>`;
    });

    html += "</tr>";
  });

  table.innerHTML = html;
  return table;
}


/* =========================================================
   シフト編集ダイアログ
========================================================= */
window.openEdit = (user_id, slot, date) => {
  if (!adminOK_users && !adminOK_menu) {
    return alert("管理者認証が必要です");
  }
  showEditDialog(user_id, slot, date);
};

function showEditDialog(user_id, slot, date) {
  const dialog = document.createElement("div");
  dialog.id = "edit-dialog";

  dialog.innerHTML = `
    <div class="dialog-bg"></div>
    <div class="dialog-box">
      <h3>枠の編集</h3>
      <label>状態</label><br>
      <select id="ed-status">
        <option value="empty">空き</option>
        <option value="reserved">予約</option>
        <option value="x">X</option>
      </select><br><br>

      <label>予約者名</label><br>
      <input id="ed-name"><br><br>

      <label>管理パスワード</label><br>
      <input id="ed-pass" type="password"><br><br>

      <button id="ed-save">保存</button>
      <button id="ed-cancel">キャンセル</button>
    </div>
  `;

  document.body.appendChild(dialog);
  dialog.style.display = "flex";

  document.getElementById("ed-cancel").onclick = () => dialog.remove();

  document.getElementById("ed-save").onclick = async () => {
    const pass = document.getElementById("ed-pass").value;
    if (pass !== ADMIN_PASSWORD) return alert("パスワード違うよ");

    const body = {
      user_id,
      date,
      time_slot: slot,
      status: document.getElementById("ed-status").value,
      reserved_name: document.getElementById("ed-name").value,
      total_price: 0
    };

    await fetch("/api/shifts/update", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-admin-pass":ADMIN_PASSWORD },
      body: JSON.stringify(body)
    });

    dialog.remove();
    loadShift(currentShiftType);
  };
};


/* =========================================================
   注文機能
========================================================= */
let orderLog = [];

window.openOrder = async (userName, slot, date, shift_id) => {
  currentShiftUserName = userName;
  currentShiftSlot = slot;
  currentShiftDate = date;
  currentShiftId = shift_id;

  orderLog = [];

  // 注文タブへ移動
  document.querySelector('.tab[data-panel="order"]').click();

  loadOrderMenus();
  loadOrderLog();
};

async function loadOrderMenus() {
  const res = await fetch("/api/users?type=" + currentShiftType);
  const users = await res.json();
  const target = users.find(u => u.name === currentShiftUserName);

  const res2 = await fetch(`/api/menu?user_id=${target.id}`);
  const menus = await res2.json();

  const area = document.getElementById("order-menu-list");
  area.innerHTML = menus.map(m => `
    <div>
      ${m.name}（${m.price}rrc）
      <button onclick="addOrder(${m.id}, '${m.name}', ${m.price})">追加</button>
    </div>
  `).join("");
}

function addOrder(id, name, price) {
  const q = Number(prompt("個数？", "1"));
  if (!q) return;
  orderLog.push({ menu_id:id, name, price, quantity:q, total:price*q });
  loadOrderLog();
}

function loadOrderLog() {
  const area = document.getElementById("order-log");
  area.innerHTML = orderLog.map(o => `
    <div>${o.name} × ${o.quantity} = ${o.total}</div>
  `).join("");

  const sum = orderLog.reduce((a,b)=>a+b.total,0);
  area.innerHTML += `<hr>合計：${sum} rrc`;
}


/* =========================================================
   対応終了（CSV/JSON保存 & シフト金額反映）
========================================================= */
document.getElementById("order-finish").onclick = async () => {
  const sum = orderLog.reduce((a,b)=>a+b.total,0);

  await fetch("/api/orders/finish", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      shift_id: currentShiftId,
      userName: currentShiftUserName,
      customerName: "予約者",
      slot: currentShiftSlot,
      date: currentShiftDate,
      orders: orderLog,
      sum
    })
  });

  alert("対応終了しました");

  // シフト金額更新
  await fetch("/api/shifts/update", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-admin-pass":ADMIN_PASSWORD },
    body: JSON.stringify({
      user_id: null,
      date: currentShiftDate,
      time_slot: currentShiftSlot,
      status: "reserved",
      reserved_name: "予約済",
      total_price: sum
    })
  });

  document.querySelector(`.tab[data-panel="shift-${currentShiftType}"]`).click();
};


/* =========================================================
   メニュー登録
========================================================= */
document.getElementById("menu-type-select").onchange = loadMenuUsers;

async function loadMenuUsers() {
  if (!adminOK_menu) return;

  const type = document.getElementById("menu-type-select").value;
  const users = await (await fetch(`/api/users?type=${type}`)).json();

  const sel = document.getElementById("menu-user-select");
  sel.innerHTML = users.map(u => `<option value="${u.id}">${u.name}</option>`).join("");

  loadMenuList();
}

document.getElementById("m-save").onclick = async () => {
  if (!adminOK_menu) return alert("管理認証が必要です");

  const user_id = document.getElementById("menu-user-select").value;
  const name = document.getElementById("m-name").value;
  const price = document.getElementById("m-price").value;
  const desc = document.getElementById("m-desc").value;

  const res = await fetch("/api/menu", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-admin-pass":ADMIN_PASSWORD },
    body: JSON.stringify({ user_id, name, price, description:desc })
  });

  const json = await res.json();
  if (json.ok) {
    alert("登録完了");
    loadMenuList();
  }
};

async function loadMenuList() {
  const user_id = document.getElementById("menu-user-select").value;
  const menus = await (await fetch(`/api/menu?user_id=${user_id}`)).json();

  document.getElementById("m-list").innerHTML =
    menus.map(m => `<div>${m.name}：${m.price}rrc</div>`).join("");
}


/* =========================================================
   今日の日付
========================================================= */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
