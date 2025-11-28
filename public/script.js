/* =========================================================
   基本設定
========================================================= */
const ADMIN_PASSWORD = ""; // ← server.js で埋め込む or 手動入力

let currentShiftType = "host";
let currentShiftDate = null;
let currentShiftSlot = null;
let currentShiftUserName = null;


/* =========================================================
   タブ切替
========================================================= */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.panel;

    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    tab.classList.add("active");
    document.getElementById("panel-" + target).classList.add("active");

    if (target === "shift-host") loadShift("host");
    if (target === "shift-maid") loadShift("maid");
    if (target === "users") loadUserList();
    if (target === "menu") loadMenuList();
  });
});

// 初期表示
window.addEventListener("load", () => tabs[0].click());


/* =========================================================
   メニュー登録（ユーザー選択なし）
========================================================= */
document.getElementById("m-save").onclick = async () => {
  const type = document.getElementById("menu-type-select").value;
  const name = document.getElementById("m-name").value;
  const price = document.getElementById("m-price").value;
  const desc = document.getElementById("m-desc").value;

  const res = await fetch("/api/menu", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-admin-pass":ADMIN_PASSWORD },
    body: JSON.stringify({ type, name, price, description:desc })
  });

  const json = await res.json();
  if (json.ok) {
    alert("メニュー登録完了");
    loadMenuList();
  }
};

async function loadMenuList() {
  const type = document.getElementById("menu-type-select").value;
  const menus = await (await fetch(`/api/menu?type=${type}`)).json();

  document.getElementById("m-list").innerHTML =
    menus.map(m => `<div>${m.name}：${m.price} rrc</div>`).join("");
}


/* =========================================================
   ユーザー削除
========================================================= */
window.deleteUser = async (id) => {
  if (!confirm("本当に削除しますか？")) return;

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
    alert("削除失敗しました");
  }
};


/* =========================================================
   注文ボタンクリック時のダイアログ誤発動バグ修正
========================================================= */
window.openOrder = (userName, slot, date, shift_id, event) => {
  if (event) event.stopPropagation();  // ← これが重要！クリック波及を防ぐ

  currentShiftUserName = userName;
  currentShiftSlot = slot;
  currentShiftDate = date;

  document.querySelector('.tab[data-panel="order"]').click();
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
  document.getElementById(type === "host" ? "sh-host" : "sh-maid").innerHTML = "";
  document.getElementById(type === "host" ? "sh-host" : "sh-maid").appendChild(table);
}

function createShiftTable(users, shifts, date) {
  const times = [
    "20:00-20:30","20:30-21:00",
    "21:00-21:30","21:30-22:00",
    "22:00-22:30","22:30-23:00"
  ];

  const table = document.createElement("table");
  let html = `<tr><th>${date}</th>`;

  users.forEach(u => {
    html += `<th><img src="${u.icon_url}" width="40"><br>${u.name}</th>`;
  });
  html += "</tr>";

  times.forEach(slot => {
    html += `<tr><td>${slot}</td>`;

    users.forEach(u => {
      const s = shifts.find(x => x.user_id === u.id && x.time_slot === slot);

      let cls = "empty";
      let text = "";

      if (s) {
        if (s.status === "reserved") {
          cls = "reserved";
          text = s.reserved_name +
            `<br><span class='order-btn' onclick="openOrder('${u.name}','${slot}','${date}',${s.id}, event)">注文</span>`;
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
   今日の日付
========================================================= */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
