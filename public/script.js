/* -----------------------------
   初期設定
----------------------------- */
let adminOK = false;
let currentTab = "shift-host";
let editingShift = null;
let orderLog = [];
window.__initialized = false; // 初期化ガード追加

/* -----------------------------
   読み込み後 初期タブ表示
----------------------------- */
window.onload = () => {
  switchTab("shift-host");

  // 初回ロードでは絶対にパスワードパネルを出さない
  document.getElementById("authPanel").classList.add("hidden");

  // 初期化完了フラグ
  window.__initialized = true;
};

/* -----------------------------
   タブクリック処理
----------------------------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    const require = btn.dataset.requireAdmin === "true";

    // 管理者専用タブ
    if (require && !adminOK) {
      currentTab = tab;
      showAuth();
      return;
    }

    switchTab(tab);
  });
});

/* -----------------------------
   タブ切り替え
----------------------------- */
function switchTab(name) {
  if (!name) return; // 不正発火防止

  currentTab = name;

  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  const panel = document.getElementById(name);
  if (panel) panel.classList.remove("hidden");

  // ▼ 一般モード
  if (name === "shift-host") return loadShift("host", false);
  if (name === "shift-maid") return loadShift("maid", false);

  // ▼ 管理モード（adminOKチェックをここでやる）
  if (name.startsWith("admin-")) {
    if (!adminOK) {
      showAuth();
      return;
    }

    if (name === "admin-shift-host") return loadShift("host", true);
    if (name === "admin-shift-maid") return loadShift("maid", true);
  }

  // ▼ メニュー・ユーザー
  if (name === "users") return loadUserList();
  if (name === "menu") return loadMenuList();
  if (name === "orders") return;
}

/* -----------------------------
   認証ポップアップ
----------------------------- */
function showAuth() {
  // 初期ロード中は絶対に出さない
  if (!window.__initialized) return;

  document.getElementById("authPanel").classList.remove("hidden");
}

document.getElementById("adminPassCheck").onclick = () => {
  const pass = document.getElementById("adminPassInput").value;

  if (pass === "yamada") {
    adminOK = true;
    document.getElementById("authPanel").classList.add("hidden");
    switchTab(currentTab);
  } else {
    alert("パスワードが違います");
  }
};

/* -----------------------------
   シフト読み込み
----------------------------- */
function loadShift(type, admin) {
  const date = new Date().toISOString().slice(0, 10);

  fetch(`/api/shifts?type=${type}&date=${date}`)
    .then(r => r.json())
    .then(data => renderShift(type, data, admin));
}

/* -----------------------------
   シフト描画
----------------------------- */
function renderShift(type, data, adminMode) {
  const target = adminMode
    ? (type === "host"
      ? document.getElementById("adminShiftHostTable")
      : document.getElementById("adminShiftMaidTable"))
    : (type === "host"
      ? document.getElementById("shiftHostTable")
      : document.getElementById("shiftMaidTable"));

  const times = [
    "20:00-20:30", "20:30-21:00", "21:00-21:30",
    "21:30-22:00", "22:00-22:30", "22:30-23:00"
  ];

  let html = `<table class="shiftTable"><tr><th>${new Date().toLocaleDateString()}</th>`;
  data.users.forEach(u => {
    const icon = u.icon_url || "/default.png";
    html += `
      <th>
        <img src="${icon}" class="icon" onerror="this.src='/default.png'">
        <br>${u.name}
      </th>`;
  });
  html += "</tr>";

  times.forEach((slot, i) => {
    html += `<tr><td>${slot}</td>`;

    data.users.forEach(u => {
      const cell = data.shifts.find(s => s.user_id === u.id && s.time_slot === i);
      let bg = "#d8f5d0", text = "";

      if (cell) {
        if (cell.status === "reserved") {
          bg = "#fff6a8";
          text = `${cell.reserved_name}`;

          if (adminMode) {
            text += `<br><button class="orderBtn" data-type="${type}" data-user="${u.id}" data-slot="${i}">注文</button>`;
          }

        } else if (cell.status === "busy") {
          bg = "#f6b0b0";
          text = "X";
        }
      }

      html += `<td style="background:${bg}" class="cell" data-user="${u.id}" data-slot="${i}">${text}</td>`;
    });

    html += "</tr>";
  });

  html += "</table>";
  target.innerHTML = html;

  /* -----------------------------
     一般モード：セルクリック編集
  ----------------------------- */
  if (!adminMode) {
    document.querySelectorAll(".cell").forEach(cell => {
      cell.onclick = () => editShift(type, cell);
    });
  }

  /* -----------------------------
     管理モード：注文ボタン
  ----------------------------- */
  if (adminMode) {
    document.querySelectorAll(".orderBtn").forEach(btn => {
      btn.onclick = () => {
        editingShift = btn.dataset;
        switchTab("orders");
        loadOrderMenu();
      };
    });
  }
}

/* -----------------------------
   一般モード：シフト編集
----------------------------- */
function editShift(type, cell) {
  const user = cell.dataset.user;
  const slot = cell.dataset.slot;

  let newStatus;
  const bg = cell.style.background;

  if (bg === "rgb(216, 245, 208)") newStatus = "reserved";
  else if (bg === "rgb(255, 246, 168)") newStatus = "busy";
  else newStatus = "empty";

  let reservedName = "";

  if (newStatus === "reserved") {
    reservedName = prompt("予約者名を入力してください");
    if (!reservedName) return;
  }

  updateShift(user, type, slot, newStatus, reservedName);
}

function updateShift(user_id, type, slot, status, name) {
  const date = new Date().toISOString().slice(0, 10);

  fetch(`/api/shifts/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      date,
      time_slot: Number(slot),
      status,
      reserved_name: name || ""
    })
  }).then(() => loadShift(type, false));
}

/* -----------------------------
   注文読み込み
----------------------------- */
function loadOrderMenu() {
  fetch(`/api/menu?type=${editingShift.type}`)
    .then(r => r.json())
    .then(list => {
      let html = "";
      list.forEach(m => {
        html += `
          <div>
            ${m.name} (${m.price} rrc)
            <button class="addOrder" data-name="${m.name}" data-price="${m.price}">追加</button>
          </div>`;
      });

      document.getElementById("orderMenu").innerHTML = html;

      document.querySelectorAll(".addOrder").forEach(btn => {
        btn.onclick = () => addOrder(btn.dataset);
      });
    });
}

function addOrder(d) {
  orderLog.push({
    name: d.name,
    price: Number(d.price),
    qty: 1
  });
  renderOrderLog();
}

function renderOrderLog() {
  let html = "", sum = 0;

  orderLog.forEach(o => {
    html += `${o.name} x1 = ${o.price}<br>`;
    sum += o.price;
  });

  document.getElementById("orderLog").innerHTML = html;
  document.getElementById("orderSum").innerHTML = `<b>${sum} rrc</b>`;
}

/* -----------------------------
   注文保存
----------------------------- */
document.getElementById("finishOrder").onclick = () => {
  if (!editingShift) return;

  const date = new Date().toISOString().slice(0, 10);
  const sum = orderLog.reduce((a, b) => a + b.price, 0);

  fetch("/api/orders/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      type: editingShift.type,
      slot: editingShift.slot,
      list: orderLog,
      sum
    })
  });

  alert("保存しました！");
  orderLog = [];
  switchTab(editingShift.type === "host" ? "admin-shift-host" : "admin-shift-maid");
};

/* -----------------------------
   ユーザー管理
----------------------------- */
document.getElementById("userRegister").onclick = () => {
  const name = document.getElementById("userName").value;
  const type = document.getElementById("userType").value;
  const icon = document.getElementById("userIcon").files[0];

  if (!name || !icon) return alert("入力不足");

  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  fd.append("icon", icon);

  fetch("/api/users", { method: "POST", body: fd })
    .then(() => loadUserList());
};

function loadUserList() {
  Promise.all([
    fetch("/api/users?type=host").then(r => r.json()),
    fetch("/api/users?type=maid").then(r => r.json())
  ]).then(([hosts, maids]) => {
    let html = "<h3>ホスト</h3>";
    hosts.forEach(u => {
      html += `${u.name} <button onclick="deleteUser(${u.id})">削除</button><br>`;
    });

    html += "<h3>メイド</h3>";
    maids.forEach(u => {
      html += `${u.name} <button onclick="deleteUser(${u.id})">削除</button><br>`;
    });

    document.getElementById("userList").innerHTML = html;
  });
}

function deleteUser(id) {
  fetch(`/api/users/${id}`, { method: "DELETE" })
    .then(() => loadUserList());
}

/* -----------------------------
   メニュー管理
----------------------------- */
document.getElementById("menuRegister").onclick = () => {
  const name = document.getElementById("menuName").value;
  const price = document.getElementById("menuPrice").value;
  const desc = document.getElementById("menuDesc").value;
  const type = document.getElementById("menuType").value;

  fetch("/api/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, description: desc, type })
  }).then(() => loadMenuList());
};

function loadMenuList() {
  Promise.all([
    fetch("/api/menu?type=host").then(r => r.json()),
    fetch("/api/menu?type=maid").then(r => r.json())
  ]).then(([hosts, maids]) => {
    let html = "<h3>ホスト</h3>";
    hosts.forEach(m => html += `${m.name} (${m.price})<br>`);

    html += "<h3>メイド</h3>";
    maids.forEach(m => html += `${m.name} (${m.price})<br>`);

    document.getElementById("menuList").innerHTML = html;
  });
}
