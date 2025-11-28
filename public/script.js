/* ------------------------------------
   初期設定
------------------------------------ */
let adminOK = false;
let currentTab = "shift-host";
let editingShift = null;
let orderLog = [];

/* ------------------------------------
   ページロード時
------------------------------------ */
window.onload = () => {
  switchTab("shift-host");
  document.getElementById("authPanel").classList.add("hidden");
};

/* ------------------------------------
   タブクリック
------------------------------------ */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    const require = btn.dataset.requireAdmin === "true";

    if (require && !adminOK) {
      currentTab = tab;
      showAuth();
      return;
    }

    switchTab(tab);
  });
});

/* ------------------------------------
   タブ切替
------------------------------------ */
function switchTab(name) {
  currentTab = name;

  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");

  if (name === "shift-host") loadShift("host", false);
  if (name === "shift-maid") loadShift("maid", false);

  if (name === "admin-shift-host") loadShift("host", true);
  if (name === "admin-shift-maid") loadShift("maid", true);

  if (name === "users") loadUserList();
  if (name === "menu") loadMenuList();
}

/* ------------------------------------
   パスワード認証
------------------------------------ */
function showAuth() {
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

/* ------------------------------------
   シフト読込
------------------------------------ */
function loadShift(type, adminMode) {
  const date = new Date().toISOString().slice(0, 10);

  fetch(`/api/shifts?type=${type}&date=${date}`)
    .then(r => r.json())
    .then(data => renderShift(type, data, adminMode));
}

/* ------------------------------------
   シフト表示
------------------------------------ */
function renderShift(type, data, adminMode) {
  const target =
    adminMode
      ? (type === "host"
          ? document.getElementById("adminShiftHostTable")
          : document.getElementById("adminShiftMaidTable"))
      : (type === "host"
          ? document.getElementById("shiftHostTable")
          : document.getElementById("shiftMaidTable"));

  const times = [
    "20:30-20:50","20:50-21:10","21:10-21:30",
    "21:30-21:50","21:50-22:10","22:10-22:30"
  ];

  let html = `<table class="shiftTable"><tr><th>${new Date().toLocaleDateString()}</th>`;
  data.users.forEach(u => {
    const icon = u.icon_url || "/default.png";
    html += `<th><img src="${icon}" class="icon"><br>${u.name}</th>`;
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
          text = `${cell.reserved_name}`;

          if (adminMode) {
            text += `<br><button class="orderBtn" data-type="${type}" data-user="${u.id}" data-slot="${i}">注文</button>`;
          }
        } else if (cell.status === "busy") {
          bg = "#f6b0b0";
          text = "X";
        }
      }

      html += `<td class="cell" style="background:${bg}" data-user="${u.id}" data-slot="${i}">${text}</td>`;
    });

    html += "</tr>";
  });

  html += "</table>";
  target.innerHTML = html;

  if (!adminMode) {
    document.querySelectorAll(".cell").forEach(cell => {
      cell.onclick = () => editShift(type, cell);
    });
  }

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

/* ------------------------------------
   シフト編集（一般）
------------------------------------ */
function editShift(type, cell) {
  const user = cell.dataset.user;
  const slot = cell.dataset.slot;
  const bg = cell.style.background;

  let status = "empty";
  let reservedName = "";

  if (bg === "rgb(216, 245, 208)") {
    status = "reserved";
    reservedName = prompt("予約者名を入力");
    if (!reservedName) return;
  } else if (bg === "rgb(255, 246, 168)") {
    status = "busy";
  }

  updateShift(user, type, slot, status, reservedName);
}

function updateShift(user_id, type, slot, status, name) {
  const date = new Date().toISOString().slice(0, 10);

  fetch("/api/shifts/update", {
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

/* ------------------------------------
   注文（共通ログ）
------------------------------------ */
function loadOrderMenu() {
  const date = new Date().toISOString().slice(0, 10);

  // ▼ DBから最新注文一覧を取得
  fetch(`/api/order/list?date=${date}&type=${editingShift.type}&slot=${editingShift.slot}`)
    .then(r => r.json())
    .then(list => {
      orderLog = list.map(o => ({
        id: o.id,
        name: o.name,
        price: o.price
      }));
      renderOrderLog();
    });

  // ▼ メニュー読み込み
  fetch(`/api/menu?type=${editingShift.type}`)
    .then(r => r.json())
    .then(list => {
      let html = "";
      list.forEach(m => {
        html += `
          <div>${m.name} (${m.price} rrc)
            <button class="addOrder" data-name="${m.name}" data-price="${m.price}">
              追加
            </button>
          </div>`;
      });

      document.getElementById("orderMenu").innerHTML = html;

      document.querySelectorAll(".addOrder").forEach(btn => {
        btn.onclick = () => addOrder(btn.dataset);
      });
    });
}

function addOrder(d) {
  const date = new Date().toISOString().slice(0, 10);

  fetch("/api/order/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      type: editingShift.type,
      slot: editingShift.slot,
      name: d.name,
      price: Number(d.price)
    })
  })
    .then(() => loadOrderMenu());
}

/* ------------------------------------
   注文ログ表示
------------------------------------ */
function renderOrderLog() {
  let html = "";
  let sum = 0;

  orderLog.forEach(o => {
    html += `${o.name} = ${o.price}<br>`;
    sum += o.price;
  });

  document.getElementById("orderLog").innerHTML = html;
  document.getElementById("orderSum").innerHTML = `<b>${sum} rrc</b>`;
}

/* ------------------------------------
   finish（CSV保存なし）
------------------------------------ */
document.getElementById("finishOrder").onclick = () => {
  alert("対応終了しました（DBには履歴が残り続けます）");
  switchTab(editingShift.type === "host" ? "admin-shift-host" : "admin-shift-maid");
};

/* ------------------------------------
   ユーザー管理
------------------------------------ */
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

/* ------------------------------------
   メニュー管理
------------------------------------ */
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
    hosts.forEach(m => {
      html += `
        ${m.name} (${m.price} rrc)
        <button class="delMenu" data-id="${m.id}">削除</button><br>
      `;
    });

    html += "<h3>メイド</h3>";
    maids.forEach(m => {
      html += `
        ${m.name} (${m.price} rrc)
        <button class="delMenu" data-id="${m.id}">削除</button><br>
      `;
    });

    document.getElementById("menuList").innerHTML = html;

    // ▼ 削除イベント
    document.querySelectorAll(".delMenu").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (!confirm("削除しますか？")) return;

        fetch(`/api/menu/${id}`, { method: "DELETE" })
          .then(() => loadMenuList());
      };
    });
  });
}

