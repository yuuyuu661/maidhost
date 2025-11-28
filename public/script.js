/* -----------------------------
   初期設定
----------------------------- */
let currentTab = "shift-host";
let editingShift = null;

/* -----------------------------
   タブ切り替え
----------------------------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

function switchTab(name) {
  currentTab = name;

  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");

  if (name === "shift-host") loadShift("host", false);
  if (name === "shift-maid") loadShift("maid", false);
  if (name === "admin-host") loadShift("host", true);
  if (name === "admin-maid") loadShift("maid", true);

  if (name === "users") loadUsers();
  if (name === "menu") loadMenu();
  if (name === "orders") renderOrder();
}

/* -----------------------------
   シフトの読み込み
----------------------------- */
function loadShift(type, adminMode) {
  const date = new Date().toISOString().slice(0, 10);

  fetch(`/api/shifts?type=${type}&date=${date}`)
    .then(r => r.json())
    .then(data => renderShift(type, data, adminMode));
}

function renderShift(type, data, adminMode) {
  const target = adminMode
    ? document.getElementById(type === "host" ? "adminHostTable" : "adminMaidTable")
    : document.getElementById(type === "host" ? "shiftHostTable" : "shiftMaidTable");

  const times = [
    "20:00-20:30","20:30-21:00","21:00-21:30",
    "21:30-22:00","22:00-22:30","22:30-23:00"
  ];

  let html = `<table class="shiftTable">`;

  html += `<tr><th>${new Date().toLocaleDateString()}</th>`;
  data.users.forEach(u => {
    html += `<th><img src="${u.icon_url || '/default.png'}" class="icon"><br>${u.name}</th>`;
  });
  html += `</tr>`;

  times.forEach((slot, i) => {
    html += `<tr><td>${slot}</td>`;

    data.users.forEach(u => {
      const cell = data.shifts.find(s => s.user_id === u.id && s.time_slot === i);
      const sum = data.orders
        .filter(o => o.type === type && o.slot === i)
        .reduce((a, b) => a + b.price, 0);

      let cls = "freeCell";
      let text = "";

      if (cell) {
        if (cell.status === "reserved") {
          cls = "reservedCell";
          text = cell.reserved_name;
          if (sum > 0) text += `<br><b>${sum} rrc</b>`;
          if (adminMode) {
            text += `<br><button class="orderBtn" data-type="${type}" data-slot="${i}">注文</button>`;
          }
        } else if (cell.status === "busy") {
          cls = "busyCell";
          text = "X";
        }
      }

      html += `<td class="${cls}" data-user="${u.id}" data-slot="${i}">${text}</td>`;
    });

    html += `</tr>`;
  });

  html += `</table>`;
  target.innerHTML = html;

  if (!adminMode) {
    document.querySelectorAll(`#${currentTab} .shiftTable td`).forEach(cell => {
      if (cell.dataset.user) cell.onclick = () => editShift(type, cell);
    });
  }

  if (adminMode) {
    document.querySelectorAll(".orderBtn").forEach(btn => {
      btn.onclick = () => {
        editingShift = btn.dataset;
        loadOrderMenu();
        switchTab("orders");
      };
    });
  }
}

/* -----------------------------
   一般モード：ステータス変更
----------------------------- */
function editShift(type, cell) {
  const user = cell.dataset.user;
  const slot = cell.dataset.slot;
  const cls = cell.className;

  let status = "empty";
  let name = "";

  if (cls.includes("freeCell")) {
    status = "reserved";
    name = prompt("予約者名を入力してください");
    if (!name) return;
  } else if (cls.includes("reservedCell")) {
    status = "busy";
  } else {
    status = "empty";
  }

  const date = new Date().toISOString().slice(0, 10);

  fetch("/api/shifts/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user,
      date,
      time_slot: Number(slot),
      status,
      reserved_name: name
    })
  })
  .then(() => loadShift(type, false));
}

/* -----------------------------
   注文処理
----------------------------- */
function loadOrderMenu() {
  fetch(`/api/menu?type=${editingShift.type}`)
    .then(r => r.json())
    .then(list => {
      let html = "";
      list.forEach(m => {
        html += `
          <div>${m.name} (${m.price} rrc)
            <button class="addOrder" data-name="${m.name}" data-price="${m.price}">追加</button>
          </div>`;
      });

      document.getElementById("orderMenu").innerHTML = html;

      document.querySelectorAll(".addOrder").forEach(btn => {
        btn.onclick = () => addOrder(btn.dataset);
      });
    });

  renderOrder();
}

function addOrder(d) {
  const date = new Date().toISOString().slice(0, 10);

  fetch("/api/order/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      type: editingShift.type,
      slot: Number(editingShift.slot),
      name: d.name,
      price: Number(d.price)
    })
  })
  .then(() => loadOrderMenu());
}

function renderOrder() {
  if (!editingShift) return;

  const date = new Date().toISOString().slice(0, 10);

  fetch(`/api/shifts?type=${editingShift.type}&date=${date}`)
    .then(r => r.json())
    .then(data => {
      const list = data.orders.filter(
        o => o.type === editingShift.type && o.slot == editingShift.slot
      );

      let html = "";
      let sum = 0;

      list.forEach(o => {
        sum += o.price;
        html += `${o.name} - ${o.price} rrc 
                 <button class="delBtn" data-id="${o.id}">削除</button><br>`;
      });

      document.getElementById("orderLog").innerHTML = html;
      document.getElementById("orderSum").innerHTML = `<b>${sum} rrc</b>`;

      document.querySelectorAll(".delBtn").forEach(btn => {
        btn.onclick = () => deleteOrder(btn.dataset.id);
      });
    });
}

function deleteOrder(id) {
  fetch(`/api/order/${id}`, { method: "DELETE" })
    .then(() => loadOrderMenu());
}

/* -----------------------------
   メニュー管理
----------------------------- */
function loadMenu() {
  Promise.all([
    fetch("/api/menu?type=host").then(r=>r.json()),
    fetch("/api/menu?type=maid").then(r=>r.json())
  ]).then(([hosts, maids]) => {
    let html = "<h3>ホスト</h3>";
    hosts.forEach(m => {
      html += `${m.name} (${m.price}) 
        <button class="delBtn" onclick="deleteMenu(${m.id})">削除</button><br>`;
    });

    html += "<h3>メイド</h3>";
    maids.forEach(m => {
      html += `${m.name} (${m.price}) 
        <button class="delBtn" onclick="deleteMenu(${m.id})">削除</button><br>`;
    });

    document.getElementById("menuList").innerHTML = html;
  });
}

document.getElementById("menuRegister").onclick = () => {
  const name = document.getElementById("menuName").value;
  const price = document.getElementById("menuPrice").value;
  const desc = document.getElementById("menuDesc").value;
  const type = document.getElementById("menuType").value;

  fetch("/api/menu", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, price, description: desc, type })
  })
  .then(() => loadMenu());
};

function deleteMenu(id) {
  fetch(`/api/menu/${id}`, { method: "DELETE" })
    .then(() => loadMenu());
}

/* -----------------------------
   ユーザー管理
----------------------------- */
function loadUsers() {
  Promise.all([
    fetch("/api/users?type=host").then(r=>r.json()),
    fetch("/api/users?type=maid").then(r=>r.json())
  ]).then(([hosts, maids]) => {
    let html = "<h3>ホスト</h3>";
    hosts.forEach(u => {
      html += `${u.name} <button class="delBtn" onclick="deleteUser(${u.id})">削除</button><br>`;
    });

    html += "<h3>メイド</h3>";
    maids.forEach(u => {
      html += `${u.name} <button class="delBtn" onclick="deleteUser(${u.id})">削除</button><br>`;
    });

    document.getElementById("userList").innerHTML = html;
  });
}

document.getElementById("userRegister").onclick = () => {
  const name = document.getElementById("userName").value;
  const type = document.getElementById("userType").value;
  const icon = document.getElementById("userIcon").files[0];

  if (!name) return alert("名前を入力してください");

  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  if (icon) fd.append("icon", icon);

  fetch("/api/users", { method: "POST", body: fd })
    .then(() => loadUsers());
};

function deleteUser(id) {
  fetch(`/api/users/${id}`, { method: "DELETE" })
    .then(() => loadUsers());
}

/* 初期表示 */
switchTab("shift-host");
