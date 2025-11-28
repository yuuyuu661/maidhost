document.querySelectorAll('.tab').forEach(btn=>{
 btn.onclick=()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-'+btn.dataset.panel).classList.add('active');
 };
});

// Time slots
const timeSlots=[
 "20:00-20:30","20:30-21:00","21:00-21:30",
 "21:30-22:00","22:00-22:30","22:30-23:00"
];

// Load shifts
async function loadShift(type){
 let userRes=await fetch(`/api/users?type=${type}`);
 let users=await userRes.json();

 let date=new Date().toISOString().slice(0,10);
 let shiftRes=await fetch(`/api/shifts?type=${type}&date=${date}`);
 let data=await shiftRes.json();
 let shifts=data.shifts;

 let el= document.getElementById(type==="host"?"sh-host":"sh-maid");
 el.innerHTML="";
 let table=document.createElement("table");

 let thead=document.createElement("thead");
 let tr=document.createElement("tr");
 tr.innerHTML="<th></th>";
 users.forEach(u=>{
  tr.innerHTML+=`<th><img src="${u.icon_url}" width="80"><br>${u.name}</th>`;
 });
 thead.appendChild(tr); table.appendChild(thead);

 let tbody=document.createElement("tbody");
 timeSlots.forEach(slot=>{
  let tr=document.createElement("tr");
  tr.innerHTML=`<th>${slot}</th>`;
  users.forEach(u=>{
    let s=shifts.find(x=>x.user_id===u.id && x.time_slot===slot);
    let status=s?s.status:"empty";
    let td=document.createElement("td");
    td.className=status;
    td.textContent= status==="reserved"?(s.reserved_name||"予約"): (status==="x"?"X":"空");
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
 });
 table.appendChild(tbody);
 el.appendChild(table);
}

loadShift("host");
loadShift("maid");
