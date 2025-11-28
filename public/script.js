let adminOK = false;
let currentTab = "shift-host";  // 初期タブはホスト

window.onload = () => {
  // 初期表示は必ず shift-host
  switchTab("shift-host");

  // パスワードパネルは絶対に初期表示しない
  document.getElementById("authPanel").classList.add("hidden");
};
let editingShift = null;
let orderLog = [];

// ▼ タブクリック
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    const require = btn.dataset.requireAdmin === "true";

    // 認証必要なタブ
    if (require && !adminOK) {
      currentTab = tab;
      showAuth();
      return;
    }

    switchTab(tab);
  });
});

function switchTab(name) {
  currentTab = name;
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");

  if (name === "shift-host") loadShift("host");
  if (name === "shift-maid") loadShift("maid");
  if (name === "users") loadUserList();
  if (name === "menu") loadMenuList();
}

// ▼ 認証表示
function showAuth() {
  document.getElementById("authPanel").classList.remove("hidden");
}

// ▼ パスワードチェック（固定：yamada）
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

// ▼ シフト読み込み
function loadShift(type) {
  const date = new Date().toISOString().slice(0,10);

  fetch(`/api/shifts?type=${type}&date=${date}`)
    .then(r=>r.json())
    .then(data => renderShift(type, data));
}

function renderShift(type, data) {
  const target = (type === "host")
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
    data.users.forEach(u=>{
      const cell = data.shifts.find(s=>s.user_id===u.id && s.time_slot===i);
      let bg="#d8f5d0", text="";

      if(cell){
        if(cell.status==="reserved"){
          bg="#fff6a8";
          text = `${cell.reserved_name}<br><button class="orderBtn" data-type="${type}" data-user="${u.id}" data-slot="${i}">注文</button>`;
        } else if(cell.status==="busy"){
          bg="#f6b0b0";
          text="X";
        }
      }

      html += `<td style="background:${bg}">${text}</td>`;
    });
    html+="</tr>";
  });

  html+="</table>";
  target.innerHTML = html;

  document.querySelectorAll(".orderBtn").forEach(btn=>{
    btn.onclick = () => {
      if(!adminOK){
        currentTab="orders";
        editingShift = btn.dataset;
        showAuth();
        return;
      }
      editingShift = btn.dataset;
      switchTab("orders");
      loadOrderMenu();
    };
  });
}

// ▼ 注文用メニュー
function loadOrderMenu() {
  fetch(`/api/menu?type=${editingShift.type}`)
    .then(r=>r.json())
    .then(list=>{
      let html="";
      list.forEach(m=>{
        html += `
          <div>
            ${m.name} (${m.price})
            <button data-id="${m.id}" data-name="${m.name}" data-price="${m.price}" class="addOrder">追加</button>
          </div>`;
      });

      document.getElementById("orderMenu").innerHTML=html;

      document.querySelectorAll(".addOrder").forEach(btn=>{
        btn.onclick=()=>addOrder(btn.dataset);
      });
    });
}

function addOrder(d){
  orderLog.push({name:d.name,price:Number(d.price),qty:1});
  renderOrderLog();
}

function renderOrderLog(){
  let html="", sum=0;
  orderLog.forEach(o=>{
    html+=`${o.name} x1 = ${o.price}<br>`;
    sum+=o.price;
  });

  document.getElementById("orderLog").innerHTML=html;
  document.getElementById("orderSum").innerHTML=`<b>${sum} rrc</b>`;
}

// ▼ 注文完了
document.getElementById("finishOrder").onclick=()=>{
  if(!editingShift) return;
  const date=new Date().toISOString().slice(0,10);
  const sum=orderLog.reduce((a,b)=>a+b.price*b.qty,0);

  fetch("/api/orders/finish",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      date,
      type:editingShift.type,
      slot:editingShift.slot,
      list:orderLog,
      sum
    })
  });

  alert("保存しました！");
  orderLog=[];
  switchTab(editingShift.type==="host"?"shift-host":"shift-maid");
};

// ▼ ユーザー登録
document.getElementById("userRegister").onclick=()=>{
  const name=document.getElementById("userName").value;
  const type=document.getElementById("userType").value;
  const icon=document.getElementById("userIcon").files[0];
  if(!name||!icon) return alert("入力不足");

  const fd=new FormData();
  fd.append("name",name);
  fd.append("type",type);
  fd.append("icon",icon);

  fetch("/api/users",{method:"POST",body:fd})
    .then(()=>loadUserList());
};

// ▼ ユーザー一覧
function loadUserList(){
  Promise.all([
    fetch("/api/users?type=host").then(r=>r.json()),
    fetch("/api/users?type=maid").then(r=>r.json())
  ]).then(([hosts,maids])=>{
    let html="<h3>ホスト</h3>";
    hosts.forEach(u=>{
      html+=`${u.name}<button onclick="deleteUser(${u.id})">削除</button><br>`;
    })
    html+="<h3>メイド</h3>";
    maids.forEach(u=>{
      html+=`${u.name}<button onclick="deleteUser(${u.id})">削除</button><br>`;
    })
    document.getElementById("userList").innerHTML=html;
  });
}

function deleteUser(id){
  fetch(`/api/users/${id}`,{method:"DELETE"})
    .then(()=>loadUserList());
}

// ▼ メニュー登録
document.getElementById("menuRegister").onclick=()=>{
  const name=document.getElementById("menuName").value;
  const price=document.getElementById("menuPrice").value;
  const desc=document.getElementById("menuDesc").value;
  const type=document.getElementById("menuType").value;

  fetch("/api/menu",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,price,description:desc,type})
  }).then(()=>loadMenuList());
};

// ▼ メニュー一覧
function loadMenuList(){
  Promise.all([
    fetch("/api/menu?type=host").then(r=>r.json()),
    fetch("/api/menu?type=maid").then(r=>r.json())
  ]).then(([hosts,maids])=>{
    let html="<h3>ホスト</h3>";
    hosts.forEach(m=> html+=`${m.name} (${m.price})<br>`);
    html+="<h3>メイド</h3>";
    maids.forEach(m=> html+=`${m.name} (${m.price})<br>`);
    document.getElementById("menuList").innerHTML=html;
  });
}

// 初期表示
switchTab("shift-host");
