let adminOK = false;       // 認証済みか？
let currentTab = "shift-host";
let editingShift = null;   // 注文用

// ▼ タブ切替
const tabs = document.querySelectorAll(".tab");
tabs.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  currentTab = name;

  // 未認証 → 認証パネル表示
  if (!adminOK && name !== "shift-host" && name !== "shift-maid" && name !== "orders") {
    showAuth();
    return;
  }

  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");

  if (name === "shift-host") loadShift("host");
  if (name === "shift-maid") loadShift("maid");
  if (name === "users") loadUserList();
  if (name === "menu") loadMenuList();
}

// ▼ 認証
function showAuth() {
  document.getElementById("authPanel").classList.remove("hidden");
}

document.getElementById("adminPassCheck").onclick = () => {
  const pass = document.getElementById("adminPassInput").value;

  fetch("/api/admin-check", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ pass })
  })
  .then(r => r.json())
  .then(d => {
    if (d.ok) {
      adminOK = true;
      document.getElementById("authPanel").classList.add("hidden");
      switchTab(currentTab);
    } else {
      alert("パスワードが違います");
    }
  });
};

// ▼ シフト読込
function loadShift(type) {
  const today = new Date().toISOString().slice(0,10);

  fetch(`/api/shifts?type=${type}&date=${today}`)
    .then(r => r.json())
    .then(data => renderShiftTable(type, data));
}

function renderShiftTable(type, data) {
  const container = (type === "host")
    ? document.getElementById("shiftHostTable")
    : document.getElementById("shiftMaidTable");

  const times = [
    "20:00-20:30","20:30-21:00","21:00-21:30",
    "21:30-22:00","22:00-22:30","22:30-23:00"
  ];

  let html = `<table class="shiftTable"><tr><th>${new Date().toLocaleDateString()}</th>`;
  data.users.forEach(u => {
    html += `<th><img src="${u.icon_url}" class="icon"><br>${u.name}</th>`;
  });
  html += "</tr>";

  times.forEach((slot, i) => {
    html += `<tr><td>${slot}</td>`;
    data.users.forEach(u => {
      const cell = data.shifts.find(s => s.user_id === u.id && s.time_slot === i);
      let bg = "#d8f5d0";
      let text = "";

      if (cell) {
        if (cell.status === "reserved") {
          bg = "#fff6a8";
          text = `${cell.reserved_name}<br><button class="orderBtn" data-user="${u.id}" data-slot="${i}" data-type="${type}">注文</button>`;
        } else if (cell.status === "busy") {
          bg = "#f6b0b0";
          text = "X";
        }
      }

      html += `<td style="background:${bg}">${text}</td>`;
    });
    html += "</tr>";
  });

  html += "</table>";
  container.innerHTML = html;

  document.querySelectorAll(".orderBtn").forEach(btn => {
    btn.onclick = () => openOrder(btn.dataset);
  });
}

// ▼ 注文画面表示
function openOrder(info) {
  if (!adminOK) {
    showAuth();
    return;
  }
  editingShift = info;
  switchTab("orders");
  loadOrderMenu();
}

// ▼ 注文用メニュー取得（ホスト/メイド切替）
function loadOrderMenu() {
  fetch(`/api/menu?type=${editingShift.type}`)
    .then(r => r.json())
    .then(list => {
      let html = "";
      list.forEach(m => {
        html += `
        <div class="menuItem">
          ${m.name} (${m.price} rrc)
          <button data-id="${m.id}" data-name="${m.name}" data-price="${m.price}" class="addOrder">追加</button>
        </div>`;
      });
      document.getElementById("orderMenu").innerHTML = html;

      document.querySelectorAll(".addOrder").forEach(btn => {
        btn.onclick = () => addOrder(btn.dataset);
      });
    });
}

let orderLog = [];
function addOrder(m) {
  orderLog.push({
    name: m.name,
    price: Number(m.price),
    qty: 1
  });

  renderOrderLog();
}

function renderOrderLog() {
  let html = "";
  let sum = 0;

  orderLog.forEach(o => {
    sum += o.price * o.qty;
    html += `${o.name} x1 = ${o.price}<br>`;
  });

  document.getElementById("orderLog").innerHTML = html;
  document.getElementById("orderSum").innerHTML = `<b>合計：${sum} rrc</b>`;
}

// ▼ 注文終了（保存）
document.getElementById("finishOrder").onclick = () => {
  if (!editingShift) return;

  const today = new Date().toISOString().slice(0,10);
  const sum = orderLog.reduce((a,b) => a + b.price*b.qty, 0);

  fetch("/api/orders/finish", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      type: editingShift.type,
      slot: editingShift.slot,
      date: today,
      list: orderLog,
      sum: sum
    })
  });

  alert("保存しました！");
  orderLog = [];
  switchTab(editingShift.type === "host" ? "shift-host" : "shift-maid");
};

// ▼ ユーザー登録
document.getElementById("userRegister").onclick = () => {
  const name = document.getElementById("userName").value;
  const type = document.getElementById("userType").value;
  const icon = document.getElementById("userIcon").files[0];

  if (!name || !icon) return alert("入力不足");

  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  fd.append("icon", icon);

  fetch("/api/users", { method:"POST", body: fd })
    .then(r => r.json())
    .then(() => loadUserList());
};

// ▼ ユーザー一覧
function loadUserList() {
  Promise.all([
    fetch("/api/users?type=host").then(r=>r.json()),
    fetch("/api/users?type=maid").then(r=>r.json())
  ]).then(([hosts, maids]) => {
    let html = "<h3>ホスト</h3>";
    hosts.forEach(u=>{
      html += `<div>${u.name}<button onclick="deleteUser(${u.id})">削除</button></div>`;
    });
    html += "<h3>メイド</h3>";
    maids.forEach(u=>{
      html += `<div>${u.name}<button onclick="deleteUser(${u.id})">削除</button></div>`;
    });
    document.getElementById("userList").innerHTML = html;
  });
}

function deleteUser(id) {
  fetch(`/api/users/${id}`, { method:"DELETE" })
    .then(()=> loadUserList());
}

// ▼ メニュー登録
document.getElementById("menuRegister").onclick = () => {
  const name = document.getElementById("menuName").value;
  const price = Number(document.getElementById("menuPrice").value);
  const desc = document.getElementById("menuDesc").value;
  const type = document.getElementById("menuType").value;

  fetch("/api/menu", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ name, price, description: desc, type })
  }).then(()=> loadMenuList());
};

// ▼ メニュー一覧
function loadMenuList() {
  Promise.all([
    fetch("/api/menu?type=host").then(r=>r.json()),
    fetch("/api/menu?type=maid").then(r=>r.json())
  ]).then(([hosts, maids])=>{
    let html="<h3>ホスト</h3>";
    hosts.forEach(m=> html+=`${m.name} (${m.price})<br>`);
    html+="<h3>メイド</h3>";
    maids.forEach(m=> html+=`${m.name} (${m.price})<br>`);
    document.getElementById("menuList").innerHTML = html;
  });
}

// 初期表示（ホストのシフト）
switchTab("shift-host");
