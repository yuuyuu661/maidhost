/* -----------------------------
   初期設定
----------------------------- */
let currentTab = "shift-host";
let currentOrderShift = null;   // 現在操作中のシフト
let orderLog = [];              // 現在の注文内容（クリアしない仕組み）
let lastLoadedShift = null;     // orders タブ用：どのシフトか記録

/* -----------------------------
   初期表示
----------------------------- */
window.onload = () => {
  switchTab("shift-host");
};

/* -----------------------------
   タブ切り替え
----------------------------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
  });
});

function switchTab(name) {
  currentTab = name;

  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");

  if (name === "shift-host") loadShift("host");
  if (name === "shift-maid") loadShift("maid");

  if (name === "menu") loadMenuList();
  if (name === "users") loadUserList();

  if (name === "orders") {
    loadOrderHistory();
    loadOrderMenu();
    renderOrderLog();
  }
}

/* -----------------------------
   シフト読み込み
----------------------------- */
function loadShift(type) {
  const date = new Date().toISOString().slice(0, 10);

  fetch(`/api/shifts?type=${type}&date=${date}`)
    .then(r => r.json())
    .then(data => renderShift(type, data));
}

function renderShift(type, data) {
  const target =
    type === "host"
      ? document.getElementById("shiftHostTable")
      : document.getElementById("shiftMaidTable");

  const times = [
    "20:00-20:30", "20:30-21:00", "21:00-21:30",
    "21:30-22:00", "22:00-22:30", "22:30-23:00"
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

          // 金額があるならここに表示
          if (cell.amount && cell.amount > 0) {
            text += `<br><b>${cell.amount} rrc</b>`;
          }

          // 予約済みなら注文ボタン表示
          text += `<br><button class="orderBtn" data-type="${type}" data-slot="${i}" data-user="${u.id}">
                      注文
                   </button>`;
        } else if (cell.status === "busy") {
          bg = "#f6b0b0";
          text = "X";
        }
      }

      html += `<td class="cell" style="background:${bg}"
               data-user="${u.id}"
               data-slot="${i}"
               data-type="${type}">
               ${text}
               </td>`;
    });

    html += "</tr>";
  });

  html += "</table>";
  target.innerHTML = html;

  // セル編集（状態変更）
  document.querySelectorAll(".cell").forEach(cell => {
    cell.onclick = () => editShift(cell);
  });

  // 注文ボタン
  document.querySelectorAll(".orderBtn").forEach(btn => {
    btn.onclick = () => {
      currentOrderShift = {
        type: btn.dataset.type,
        slot: Number(btn.dataset.slot),
        user: Number(btn.dataset.user)
      };
      lastLoadedShift = currentOrderShift;
      switchTab("orders");
    };
  });
}

/* -----------------------------
   シフト編集
----------------------------- */
function editShift(cell) {
  const user = cell.dataset.user;
  const slot = Number(cell.dataset.slot);
  const type = cell.dataset.type;
  const date = new Date().toISOString().slice(0, 10);

  const bg = cell.style.background;

  let newStatus = "";
  let reserved = "";

  // 状態切替：空 → 予約 → X → 空
  if (bg === "rgb(216, 245, 208)") {
    newStatus = "reserved";
    reserved = prompt("予約者名を入力してください");
    if (!reserved) return;
  } else if (bg === "rgb(255, 246, 168)") {
    newStatus = "busy";
  } else {
    newStatus = "empty";
  }

  fetch("/api/shifts/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user,
      date,
      time_slot: slot,
      status: newStatus,
      reserved_name: reserved
    })
  }).then(() => loadShift(type));
}

/* -----------------------------
   メニュー読み込み
----------------------------- */
function loadOrderMenu() {
  if (!lastLoadedShift) return;

  fetch(`/api/menu?type=${lastLoadedShift.type}`)
    .then(r => r.json())
    .then(list => {
      let html = "";
      list.forEach(m => {
        html += `
          <div class="menuItem">
            ${m.name}（${m.price}）
            <button class="addOrder" data-name="${m.name}" data-price="${m.price}">
              追加
            </button>
          </div>
        `;
      });

      document.getElementById("orderMenu").innerHTML = html;

      document.querySelectorAll(".addOrder").forEach(btn => {
        btn.onclick = () => addOrder(btn.dataset);
      });
    });
}

/* -----------------------------
   注文追加
----------------------------- */
function addOrder(d) {
  orderLog.push({
    name: d.name,
    price: Number(d.price)
  });
  renderOrderLog();
}

/* -----------------------------
   注文リスト表示
----------------------------- */
function renderOrderLog() {
  let html = "";
  let sum = 0;

  orderLog.forEach(o => {
    html += `${o.name} ＝ ${o.price} rrc<br>`;
    sum += o.price;
  });

  document.getElementById("orderLog").innerHTML = html;
  document.getElementById("orderSum").innerHTML = `<b>${sum} rrc</b>`;
}

/* -----------------------------
   対応終了（注文保存）
   → 注文ログはクリアしない！！
----------------------------- */
document.getElementById("finishOrder").onclick = () => {
  if (!lastLoadedShift || orderLog.length === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const sum = orderLog.reduce((a, b) => a + b.price, 0);

  fetch("/api/orders/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      type: lastLoadedShift.type,
      slot: lastLoadedShift.slot,
      list: orderLog,
      sum
    })
  }).then(() => {
    alert("保存しました！");
    loadOrderHistory();  // 共通履歴リロード
    loadShift(lastLoadedShift.type); // 予定表に金額表示
  });
};

/* -----------------------------
   注文履歴（共通）
----------------------------- */
function loadOrderHistory() {
  fetch("/api/orders/all")
    .then(r => r.json())
    .then(list => {
      let html = "";
      list.forEach(o => {
        html += `
          <div class="historyRow">
            ${o.date} / ${o.type} / ${o.slot} コマ
            <b>${o.total} rrc</b>
            <button class="delOrder" data-id="${o.id}">削除</button>
          </div>
        `;
      });

      document.getElementById("orderHistory").innerHTML = html;

      document.querySelectorAll(".delOrder").forEach(btn => {
        btn.onclick = () => deleteOrder(btn.dataset.id);
      });
    });
}

function deleteOrder(id) {
  if (!confirm("削除しますか？")) return;

  fetch(`/api/orders/${id}`, { method: "DELETE" })
    .then(() => loadOrderHistory());
}

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
    hosts.forEach(m =>
      html += `
      <div class="menuItem">
        ${m.name} (${m.price})
        <button class="delMenu" data-id="${m.id}">削除</button>
      </div>`
    );

    html += "<h3>メイド</h3>";
    maids.forEach(m =>
      html += `
      <div class="menuItem">
        ${m.name} (${m.price})
        <button class="delMenu" data-id="${m.id}">削除</button>
      </div>`
    );

    document.getElementById("menuList").innerHTML = html;

    document.querySelectorAll(".delMenu").forEach(btn => {
      btn.onclick = () => {
        fetch(`/api/menu/${btn.dataset.id}`, { method: "DELETE" })
          .then(() => loadMenuList());
      };
    });
  });
}

