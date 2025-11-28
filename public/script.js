/*************************************************
 * タブ切り替え
 *************************************************/
document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
  };
});

/*************************************************
 * 定数
 *************************************************/
const timeSlots = [
  "20:00-20:30",
  "20:30-21:00",
  "21:00-21:30",
  "21:30-22:00",
  "22:00-22:30",
  "22:30-23:00"
];
const today = new Date().toISOString().slice(0, 10);

/*************************************************
 * ダイアログ（中央ポップアップ）
 *************************************************/
function createDialog() {
  const dlg = document.createElement("div");
  dlg.id = "edit-dialog";
  dlg.innerHTML = `
    <div class="dialog-bg"></div>
    <div class="dialog-box">
      <h3>枠の編集</h3>

      <label>状態</label><br>
      <select id="dlg-status">
        <option value="empty">空き</option>
        <option value="reserved">予約</option>
        <option value="x">X（不在）</option>
      </select>
      <br><br>

      <label>予約者名（予約の場合）</label><br>
      <input id="dlg-name" placeholder="名前を入力">
      <br><br>

      <label>管理パスワード</label><br>
      <input id="dlg-pass" type="password" placeholder="password">
      <br><br>

      <button id="dlg-save">保存</button>
      <button id="dlg-cancel">キャンセル</button>
    </div>
  `;
  document.body.appendChild(dlg);
}

createDialog();

/*************************************************
 * ダイアログ制御
 *************************************************/
function openDialog(initial, callback) {
  const dlg = document.getElementById("edit-dialog");
  dlg.style.display = "block";

  const status = document.getElementById("dlg-status");
  const name = document.getElementById("dlg-name");
  const pass = document.getElementById("dlg-pass");

  // 初期値
  status.value = initial.status;
  name.value = initial.reserved_name || "";
  pass.value = "";

  // 保存時
  document.getElementById("dlg-save").onclick = () => {
    callback({
      status: status.value,
      reserved_name: name.value,
      password: pass.value,
    });
    dlg.style.display = "none";
  };

  // キャンセル
  document.getElementById("dlg-cancel").onclick = () => {
    dlg.style.display = "none";
  };
}

/*************************************************
 * シフト読み込み（ホスト or メイド）
 *************************************************/
async function loadShift(type) {
  const el = document.getElementById(type === "host" ? "sh-host" : "sh-maid");
  el.innerHTML = "<p>読み込み中...</p>";

  // ユーザー取得
  const users = await fetch(`/api/users?type=${type}`).then(r => r.json());

  // シフト取得
  const shiftData = await fetch(`/api/shifts?type=${type}&date=${today}`).then(r => r.json());
  const shifts = shiftData.shifts || [];

  // テーブル作成
  const table = document.createElement("table");

  // ヘッダー
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.innerHTML = `<th>${today}</th>`;
  users.forEach(u => {
    trh.innerHTML += `
      <th>
        <div class="user-header">
          <img src="${u.icon_url}" width="80">
          <br>${u.name}
        </div>
      </th>`;
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  // 本体
  const tbody = document.createElement("tbody");

  timeSlots.forEach(slot => {
    const tr = document.createElement("tr");

    // 左側の時間枠
    tr.innerHTML = `<th>${slot}</th>`;

    // 各ユーザーの枠
    users.forEach(u => {
      const found = shifts.find(s => s.user_id === u.id && s.time_slot === slot);
      const status = found ? found.status : "empty";
      const reserved_name = found ? found.reserved_name : "";

      const td = document.createElement("td");
      td.classList.add(status);
      if (status === "empty") td.textContent = "空";
      if (status === "reserved") td.textContent = reserved_name || "予約";
      if (status === "x") td.textContent = "X";

      // クリック編集
      td.onclick = () => {
        openDialog(
          { status, reserved_name },
          async (res) => {
            if (!res.password) {
              alert("管理パスワードが必要です");
              return;
            }

            // シフト更新API
            const update = await fetch("/api/shifts/update", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-admin-pass": res.password
              },
              body: JSON.stringify({
                user_id: u.id,
                date: today,
                time_slot: slot,
                status: res.status,
                reserved_name: res.status === "reserved" ? res.reserved_name : "",
                total_price: 0
              })
            }).then(r => r.json());

            if (!update.ok) {
              alert("保存に失敗しました");
              return;
            }

            // 再読み込み
            loadShift(type);
          }
        );
      };

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  el.innerHTML = "";
  el.appendChild(table);
}

/*************************************************
 * 初期ロード
 *************************************************/
loadShift("host");
loadShift("maid");
