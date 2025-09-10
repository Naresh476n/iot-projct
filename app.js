// ===============================
// ESP32 Power Tracker Frontend
// ===============================

// Connect WebSocket to ESP32
const WS_PORT = 81;
const ws = new WebSocket("ws://" + location.hostname + ":" + WS_PORT);

// Show device IP
document.getElementById('ip').innerText = location.hostname;

// -------------------------------
// Show live date & time
// -------------------------------
function updateDateTime() {
  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const day = days[now.getDay()];

  let hours = now.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 -> 12
  const minutes = String(now.getMinutes()).padStart(2,"0");
  const seconds = String(now.getSeconds()).padStart(2,"0");

  const time = `${hours}:${minutes}:${seconds} ${ampm}`;
  const date = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;

  document.getElementById("datetime").innerText = `${day}, ${date}, ${time}`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

// -------------------------------
// Build live monitoring tiles
// -------------------------------
const liveDiv = document.getElementById("live");
for (let i = 1; i <= 4; i++) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.id = "tile"+i;
  tile.innerHTML = `
    <h4>Load ${i}</h4>
    <div class="kv"><span>Voltage:</span><span id="v${i}">0 V</span></div>
    <div class="kv"><span>Current:</span><span id="c${i}">0 A</span></div>
    <div class="kv"><span>Power:</span><span id="p${i}">0 W</span></div>
    <div class="kv"><span>Energy:</span><span id="e${i}">0 Wh</span></div>
    <div class="kv"><span>State:</span><span id="s${i}">OFF</span></div>
  `;
  liveDiv.appendChild(tile);
}

// -------------------------------
// Relay Switch Handlers
// -------------------------------
for (let i=1;i<=4;i++){
  const el = document.getElementById("relay"+i);
  el.addEventListener("change", e=>{
    ws.send(JSON.stringify({cmd:"relay", id:i, state:e.target.checked}));
  });
}

// -------------------------------
// Timer Controls
// -------------------------------
document.querySelectorAll(".preset").forEach(btn=>{
  btn.addEventListener("click", ()=> document.getElementById("customMin").value = btn.dataset.min);
});
document.getElementById("applyTimer").addEventListener("click", ()=>{
  const sel = parseInt(document.getElementById("loadSelect").value);
  const val = parseInt(document.getElementById("customMin").value || "0", 10);
  ws.send(JSON.stringify({cmd:"setTimer", id:sel, minutes: val>0?val:0}));
});

// -------------------------------
// Usage Limit Controls
// -------------------------------
document.getElementById("saveLimits").addEventListener("click", ()=>{
  const vals = [
    parseFloat(document.getElementById("limit1").value||"12"),
    parseFloat(document.getElementById("limit2").value||"12"),
    parseFloat(document.getElementById("limit3").value||"12"),
    parseFloat(document.getElementById("limit4").value||"12"),
  ];
  vals.forEach((h,i)=>{
    const sec = Math.max(1, Math.round(h*3600));
    ws.send(JSON.stringify({cmd:"setLimit", id:i+1, seconds:sec}));
  });
});

// -------------------------------
// Price Setting
// -------------------------------
document.getElementById("savePrice").addEventListener("click", ()=>{
  const p = parseFloat(document.getElementById("price").value||"8");
  ws.send(JSON.stringify({cmd:"setPrice", price:p}));
});

// -------------------------------
// Notifications
// -------------------------------
document.getElementById("refreshNotifs").addEventListener("click", async ()=>{
  const r = await fetch("/notifs.json");
  const j = await r.json();
  showNotifs(j.notifs || []);
});
document.getElementById("clearNotifs").addEventListener("click", ()=>{
  ws.send(JSON.stringify({cmd:"clearNotifs"}));
  document.getElementById("notifs").innerHTML = "";
});

// -------------------------------
// Charts & PDF Export
// -------------------------------
const chartCtx = document.getElementById("chart").getContext("2d");
const chart = new Chart(chartCtx, {
  type: "line",
  data: { labels: [], datasets: [
    { label: "Load1", data: [] },
    { label: "Load2", data: [] },
    { label: "Load3", data: [] },
    { label: "Load4", data: [] }
  ]},
  options: { responsive:true, plugins:{legend:{display:true}} }
});
document.getElementById("downloadPdf").addEventListener("click", async ()=>{
  const r = await fetch("/logs.json");
  const j = await r.json();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("ESP32 Power Tracker - Logs snapshot", 10, 10);
  doc.text(JSON.stringify(j).slice(0, 1500), 10, 20);
  doc.save("logs.pdf");
});

// -------------------------------
// WebSocket Message Handler
// -------------------------------
ws.onopen = ()=> console.log("WS open");
ws.onclose = ()=> console.log("WS closed");
ws.onerror = e=> console.error("WS err", e);

ws.onmessage = (evt)=>{
  try {
    const data = JSON.parse(evt.data);

    // When ESP32 sends state updates
    if(data.type === "state" && data.loads){
      let totalV = 0, totalC = 0, totalP = 0, totalE = 0;

      data.loads.forEach((L)=>{
        const i = L.id;
        document.getElementById("v"+i).innerText = Number(L.voltage||0).toFixed(2)+" V";
        document.getElementById("c"+i).innerText = Number(L.current||0).toFixed(3)+" A";
        document.getElementById("p"+i).innerText = Number(L.power||0).toFixed(2)+" W";
        document.getElementById("e"+i).innerText = Number(L.energy||0).toFixed(2)+" Wh";
        document.getElementById("s"+i).innerText = L.relay ? "ON" : "OFF";
        document.getElementById("relay"+i).checked = !!L.relay;

        // accumulate totals
        totalV += Number(L.voltage||0);
        totalC += Number(L.current||0);
        totalP += Number(L.power||0);
        totalE += Number(L.energy||0);
      });

      // ✅ Update Total Usage card
      document.getElementById("vTotal").innerText = (totalV/data.loads.length).toFixed(2)+" V"; // avg voltage
      document.getElementById("cTotal").innerText = totalC.toFixed(3)+" A";
      document.getElementById("pTotal").innerText = totalP.toFixed(2)+" W";
      document.getElementById("eTotal").innerText = totalE.toFixed(2)+" Wh";

      if(data.unitPrice) document.getElementById("price").value = data.unitPrice;
    }

    // When a new notification arrives
    else if(data.type === "notification"){
      prependNotif({ts: Date.now()/1000, text: data.text});
    }

  } catch(e){
    console.error("WS parse error", e);
  }
};

// -------------------------------
// Helper Functions
// -------------------------------
function showNotifs(arr){
  const ul = document.getElementById("notifs");
  ul.innerHTML = "";
  arr.reverse().forEach(n=>{
    const li = document.createElement("li");
    const dt = new Date((n.ts||0)*1000).toLocaleString();
    li.textContent = dt + " — " + (n.text||n);
    ul.appendChild(li);
  });
}
function prependNotif(n){
  const ul = document.getElementById("notifs");
  const li = document.createElement("li");
  const dt = new Date((n.ts||0)*1000).toLocaleString();
  li.textContent = dt + " — " + (n.text||n);
  ul.insertBefore(li, ul.firstChild);
}

// -------------------------------
// Init: Load notifications + settings
// -------------------------------
(async function init(){
  try {
    const r = await fetch("/notifs.json");
    if(r.ok){ const j = await r.json(); showNotifs(j.notifs || []); }

    const s = await fetch("/settings.json");
    if(s.ok){ const js = await s.json(); document.getElementById("price").value = js.unitPrice || 8; }
  } catch(e){
    console.warn("Init fetch failed", e);
  }
})();
