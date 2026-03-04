const $ = (id) => document.getElementById(id);

let keyerId = "";
let items = [];
let lastDraftSavedAt = "";

const DRAFT_INTERVAL_MS = 60_000;
const LS_KEY = "keypad_web_v1";

function nowIso(){ return new Date().toISOString(); }
function fmtMoney(n){ return (Number(n)||0).toLocaleString("th-TH"); }
function fmtTime(iso){
  try{
    const d=new Date(iso);
    const pad=(n)=>String(n).padStart(2,"0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }catch{return "";}
}
function toast(title,msg){
  const el=$("toast");
  el.innerHTML=`<div class="t">${title}</div><div class="m">${msg||""}</div>`;
  el.classList.remove("hidden");
  setTimeout(()=>el.classList.add("hidden"),2400);
}
function setStatus(msg){ $("status").textContent = msg; }

function makeId(){
  return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}
function validateKeyerId(v){
  const s=String(v||"").trim();
  if(!/^\d{6}$/.test(s)) return {ok:false,error:"Keyer ID ต้องเป็นตัวเลข 6 หลัก"};
  return {ok:true,value:s};
}
function padNumber(raw,len){
  const s=String(raw||"").trim();
  if(!/^\d+$/.test(s)) return null;
  if(s.length>len) return null;
  return s.padStart(len,"0");
}
function normalizeAmountAllowBlank(v){
  const s0=String(v??"").trim();
  if(s0==="") return {ok:true,value:0};
  const s=s0.replace(/,/g,"");
  if(!/^\d+$/.test(s)) return {ok:false,error:"ยอดต้องเป็นจำนวนเต็ม"};
  const n=Number(s);
  if(n<0) return {ok:false,error:"ยอดต้องไม่ติดลบ"};
  return {ok:true,value:n};
}
function itemTotal(it){
  if(it.type==="2d") return (Number(it.top)||0)+(Number(it.bottom)||0);
  if(it.type==="3d") return (Number(it.straight)||0)+(Number(it.tod)||0);
  return 0;
}

function computeStats(){
  const total=items.reduce((s,it)=>s+itemTotal(it),0);
  $("statItems").textContent=String(items.length);
  $("statTotal").textContent=fmtMoney(total);
  $("statDraft").textContent = lastDraftSavedAt ? `บันทึก ${fmtTime(lastDraftSavedAt)}` : "ยังไม่บันทึก";
}

function renderList(){
  const list=$("list");
  if(!items.length){
    list.innerHTML=`<div class="hint" style="padding:10px">ยังไม่มีรายการ</div>`;
    return;
  }
  list.innerHTML = items.slice(0,800).map((it)=>{
    const badge = it.type==="2d" ? "2ตัว" : "3ตัว";
    const fields = it.type==="2d"
      ? `บน ${fmtMoney(it.top)} • ล่าง ${fmtMoney(it.bottom)}`
      : `ตรง ${fmtMoney(it.straight)} • โต๊ด ${fmtMoney(it.tod)}`;
    const total = fmtMoney(itemTotal(it));
    return `
      <div class="item" data-id="${it.id}">
        <div class="badge">${badge}</div>
        <div class="num">${it.number}</div>
        <div class="fields">${fields}</div>
        <div class="total">${total}</div>
        <div class="time">${fmtTime(it.createdAt)}</div>
        <div><button class="btn small ghost del btn-del" data-id="${it.id}">ลบ</button></div>
      </div>
    `;
  }).join("");
  list.scrollTop = 0;
}

function saveLocal(reason){
  if(!keyerId) return;
  try{
    const payload={ keyerId, items, lastDraftSavedAt: nowIso() };
    localStorage.setItem(`${LS_KEY}_${keyerId}`, JSON.stringify(payload));
    lastDraftSavedAt = payload.lastDraftSavedAt;
    computeStats();
    if(reason) setStatus(`Draft saved (${reason}) • ${fmtTime(lastDraftSavedAt)}`);
  }catch{}
}
function loadLocal(){
  if(!keyerId) return;
  try{
    const raw = localStorage.getItem(`${LS_KEY}_${keyerId}`);
    if(!raw){ items=[]; lastDraftSavedAt=""; return; }
    const payload = JSON.parse(raw);
    items = Array.isArray(payload.items)?payload.items:[];
    lastDraftSavedAt = payload.lastDraftSavedAt || "";
    let changed=false;
    items = items.map(it => (it && it.id) ? it : (changed=true, {...it, id: makeId()}));
    if(changed) saveLocal("backfill-id");
  }catch{
    items=[]; lastDraftSavedAt="";
  }
}

function add2D(){
  if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
  const num = padNumber($("twoNum").value,2);
  if(!num) return toast("เลขไม่ถูกต้อง","เลข 2 ตัวต้องเป็น 00-99 (พิมพ์ 7 ได้ = 07)");
  const top1=normalizeAmountAllowBlank($("twoTop").value); if(!top1.ok) return toast("ยอดไม่ถูกต้อง",top1.error);
  const bottom1=normalizeAmountAllowBlank($("twoBottom").value); if(!bottom1.ok) return toast("ยอดไม่ถูกต้อง",bottom1.error);

  items.unshift({ id:makeId(), type:"2d", number:num, top:top1.value, bottom:bottom1.value, createdAt:nowIso() });
  $("twoNum").value=""; $("twoTop").value=""; $("twoBottom").value="";
  renderList(); computeStats(); saveLocal("2ตัว");
  $("twoNum").focus();
}
function add3D(){
  if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
  const num = padNumber($("threeNum").value,3);
  if(!num || num.length!==3) return toast("เลขไม่ถูกต้อง","เลข 3 ตัวต้องครบ 3 หลัก (เช่น 001)");
  const st1=normalizeAmountAllowBlank($("threeStraight").value); if(!st1.ok) return toast("ยอดไม่ถูกต้อง",st1.error);
  const tod1=normalizeAmountAllowBlank($("threeTod").value); if(!tod1.ok) return toast("ยอดไม่ถูกต้อง",tod1.error);

  items.unshift({ id:makeId(), type:"3d", number:num, straight:st1.value, tod:tod1.value, createdAt:nowIso() });
  $("threeNum").value=""; $("threeStraight").value=""; $("threeTod").value="";
  renderList(); computeStats(); saveLocal("3ตัว");
  $("threeNum").focus();
}

function parsePasteBlock(text){
  const lines=String(text||"").split(/\r?\n/);
  let okCount=0,badCount=0;
  const toAdd=[];
  for(const line of lines){
    const s=line.trim(); if(!s) continue;
    const parts=s.split(/\s+/);
    if(parts.length<2){ badCount++; continue; }
    const numStr=parts[0], a1=parts[1], a2=parts[2] ?? "";
    if(/^\d{1,2}$/.test(numStr)){
      const num=padNumber(numStr,2);
      const top1=normalizeAmountAllowBlank(a1);
      const bottom1=normalizeAmountAllowBlank(a2);
      if(!num || !top1.ok || !bottom1.ok){ badCount++; continue; }
      toAdd.push({ id:makeId(), type:"2d", number:num, top:top1.value, bottom:bottom1.value, createdAt:nowIso() });
      okCount++; continue;
    }
    if(/^\d{1,3}$/.test(numStr)){
      const num=padNumber(numStr,3);
      const st1=normalizeAmountAllowBlank(a1);
      const tod1=normalizeAmountAllowBlank(a2);
      if(!num || num.length!==3 || !st1.ok || !tod1.ok){ badCount++; continue; }
      toAdd.push({ id:makeId(), type:"3d", number:num, straight:st1.value, tod:tod1.value, createdAt:nowIso() });
      okCount++; continue;
    }
    badCount++;
  }
  return {okCount,badCount,toAdd};
}

/** ZIP (single file, store method 0) **/
function crc32(buf){
  if(!crc32.table){
    const table=new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      table[i]=c>>>0;
    }
    crc32.table=table;
  }
  let c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++){
    c = crc32.table[(c ^ buf[i]) & 0xFF] ^ (c>>>8);
  }
  return (c ^ 0xFFFFFFFF)>>>0;
}
function dosDateTime(d){
  const year = Math.max(1980, d.getFullYear());
  const month = d.getMonth()+1;
  const day = d.getDate();
  const hours = d.getHours();
  const mins = d.getMinutes();
  const secs = Math.floor(d.getSeconds()/2);
  const dostime = (hours<<11) | (mins<<5) | secs;
  const dosdate = ((year-1980)<<9) | (month<<5) | day;
  return {dostime, dosdate};
}
function u16(n){ return new Uint8Array([n & 255, (n>>>8) & 255]); }
function u32(n){ return new Uint8Array([n & 255, (n>>>8) & 255, (n>>>16) & 255, (n>>>24) & 255]); }
function concat(...arrs){
  let len=0; for(const a of arrs) len+=a.length;
  const out=new Uint8Array(len);
  let off=0;
  for(const a of arrs){ out.set(a,off); off+=a.length; }
  return out;
}
function buildZipSingle(filename, fileBytes){
  const dt = dosDateTime(new Date());
  const nameBytes = new TextEncoder().encode(filename);
  const crc = crc32(fileBytes);
  const size = fileBytes.length;
  const method = 0;

  const localHeader = concat(
    u32(0x04034b50),
    u16(20), u16(0), u16(method),
    u16(dt.dostime), u16(dt.dosdate),
    u32(crc), u32(size), u32(size),
    u16(nameBytes.length), u16(0)
  );
  const localPart = concat(localHeader, nameBytes, fileBytes);

  const centralHeader = concat(
    u32(0x02014b50),
    u16(20), u16(20),
    u16(0), u16(method),
    u16(dt.dostime), u16(dt.dosdate),
    u32(crc), u32(size), u32(size),
    u16(nameBytes.length),
    u16(0), u16(0),
    u16(0), u16(0),
    u32(0),
    u32(0) // local header offset = 0
  );
  const centralPart = concat(centralHeader, nameBytes);

  const end = concat(
    u32(0x06054b50),
    u16(0), u16(0),
    u16(1), u16(1),
    u32(centralPart.length),
    u32(localPart.length),
    u16(0)
  );

  return new Blob([localPart, centralPart, end], {type:"application/zip"});
}
function downloadBlob(blob, filename){
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function buildBatch(){
  const batchId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const createdAt = nowIso();
  const totalAmount = items.reduce((s,it)=>s+itemTotal(it),0);
  return { keyerId, batchId, createdAt, items, totalAmount, totalItems: items.length };
}
function formatFilename(){
  const d=new Date();
  const pad=(n)=>String(n).padStart(2,"0");
  return `batch-${keyerId}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function setMobileView(which){
  const keyView=$("viewKey");
  const listView=$("viewList");
  const tk=$("tabKey");
  const tl=$("tabList");
  const isMobile = window.matchMedia("(max-width: 980px)").matches;
  if(!isMobile){
    keyView.classList.remove("hidden");
    listView.classList.remove("hidden");
    tk.classList.add("active");
    tl.classList.remove("active");
    return;
  }
  if(which==="key"){
    keyView.classList.remove("hidden");
    listView.classList.add("hidden");
    tk.classList.add("active"); tl.classList.remove("active");
  }else{
    keyView.classList.add("hidden");
    listView.classList.remove("hidden");
    tl.classList.add("active"); tk.classList.remove("active");
  }
}

function bindEvents(){
  $("tabKey").addEventListener("click", ()=>setMobileView("key"));
  $("tabList").addEventListener("click", ()=>setMobileView("list"));
  window.addEventListener("resize", ()=>setMobileView("key"));

  $("btnSetKeyerId").addEventListener("click", ()=>{
    const v=$("keyerIdInput").value;
    const v1=validateKeyerId(v);
    if(!v1.ok) return toast("ตั้งค่าไม่ได้", v1.error);
    keyerId=v1.value;
    localStorage.setItem(`${LS_KEY}_activeKeyerId`, keyerId);
    $("keyerHint").textContent=`ปัจจุบัน: ${keyerId} (เปลี่ยนได้)`;
    loadLocal();
    renderList(); computeStats();
    toast("ตั้งค่า Keyer ID", `บันทึกเป็น ${keyerId}`);
    $("twoNum").focus();
  });

  $("btnAdd2D").addEventListener("click", add2D);
  $("btnAdd3D").addEventListener("click", add3D);

  // Enter flow 2ตัว
  $("twoNum").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); $("twoTop").focus(); } });
  $("twoTop").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); $("twoBottom").focus(); } });
  $("twoBottom").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); add2D(); } });

  // Enter flow 3ตัว
  $("threeNum").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); $("threeStraight").focus(); } });
  $("threeStraight").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); $("threeTod").focus(); } });
  $("threeTod").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); add3D(); } });

  $("btnPasteAdd").addEventListener("click", ()=>{
    if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
    const parsed=parsePasteBlock($("pasteArea").value);
    if(parsed.okCount===0) return toast("ไม่มีรายการถูกต้อง", `ข้าม ${parsed.badCount} รายการ`);
    for(const it of parsed.toAdd.reverse()) items.unshift(it);
    $("pasteArea").value="";
    renderList(); computeStats(); saveLocal("paste");
    toast("เพิ่มจาก Paste", `เพิ่มสำเร็จ ${parsed.okCount} • ข้าม ${parsed.badCount}`);
    setMobileView("list");
  });

  $("list").addEventListener("click",(e)=>{
    const btn=e.target.closest(".btn-del");
    if(!btn) return;
    const id=btn.dataset.id;
    items = items.filter(it=>it.id!==id);
    renderList(); computeStats(); saveLocal("del");
  });

  $("btnClear").addEventListener("click", ()=>{
    if(!keyerId) return;
    const ok=confirm("ยืนยันล้างรายการทั้งหมด?");
    if(!ok) return;
    items=[]; lastDraftSavedAt="";
    renderList(); computeStats();
    localStorage.removeItem(`${LS_KEY}_${keyerId}`);
    toast("ล้างแล้ว","Draft ถูกเคลียร์แล้ว");
    setStatus("ล้างรายการแล้ว");
  });

  $("btnExport").addEventListener("click", ()=>{
    if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
    if(!items.length) return toast("Export ไม่ได้","ยังไม่มีรายการ");
    const batch=buildBatch();
    const jsonText=JSON.stringify(batch, null, 2);
    const jsonBytes=new TextEncoder().encode(jsonText);

    const baseName=formatFilename();
    const jsonName=`${baseName}.json`;
    const zipName=`${baseName}.zip`;

    const zipBlob=buildZipSingle(jsonName, jsonBytes);
    downloadBlob(zipBlob, zipName);

    items=[]; lastDraftSavedAt="";
    renderList(); computeStats();
    localStorage.removeItem(`${LS_KEY}_${keyerId}`);
    toast("Export สำเร็จ", `ZIP: ${zipName}`);
    setStatus("Export สำเร็จ • เคลียร์รายการแล้ว");
    setMobileView("key");
  });

  setInterval(()=>saveLocal("auto"), DRAFT_INTERVAL_MS);
  window.addEventListener("beforeunload", ()=>{ try{ saveLocal("unload"); }catch{} });
}

function boot(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  const active = localStorage.getItem(`${LS_KEY}_activeKeyerId`);
  if (active && /^\d{6}$/.test(active)) {
    keyerId = active;
    $("keyerIdInput").value = keyerId;
    $("keyerHint").textContent = `ปัจจุบัน: ${keyerId} (เปลี่ยนได้)`;
    loadLocal();
  } else {
    $("keyerHint").textContent = "ยังไม่ได้ตั้งค่า • ต้องตั้ง Keyer ID ก่อนเริ่มคีย์";
  }

  bindEvents();
  renderList();
  computeStats();
  setStatus("พร้อมทำงาน");
  setMobileView("key");
  setTimeout(()=>{ if(keyerId) $("twoNum").focus(); }, 200);
}

boot();
