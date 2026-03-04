const $=(id)=>document.getElementById(id);

let keyerId="";
let items=[];
let lastDraftSavedAt="";

const DRAFT_INTERVAL_MS=60000;
const LS_KEY="keypad_web_v3";

const nowIso=()=>new Date().toISOString();
const fmtMoney=(n)=>(Number(n)||0).toLocaleString("th-TH");

function fmtTime(iso){
  try{
    const d=new Date(iso);
    const p=(n)=>String(n).padStart(2,"0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }catch{return "";}
}
function toast(title,msg){
  const el=$("toast");
  el.innerHTML=`<div class="t">${title}</div><div class="m">${msg||""}</div>`;
  el.classList.remove("hidden");
  setTimeout(()=>el.classList.add("hidden"),2400);
}
function setStatus(msg){ $("status").textContent=msg; }

function makeId(){ return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

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
function computeSummary(){
  const c2=items.filter(i=>i.type==="2d").length;
  const c3=items.filter(i=>i.type==="3d").length;
  const total=items.reduce((s,it)=>s+itemTotal(it),0);
  return {c2,c3,total,all:items.length};
}
function computeStats(){
  const s=computeSummary();
  $("statItems").textContent=String(s.all);
  $("statTotal").textContent=fmtMoney(s.total);
  $("statDraft").textContent= lastDraftSavedAt ? `บันทึก ${fmtTime(lastDraftSavedAt)}` : "ยังไม่บันทึก";
}
function renderList(){
  const list=$("list");
  if(!items.length){
    list.innerHTML=`<div class="hint" style="padding:10px">ยังไม่มีรายการ</div>`;
    return;
  }
  list.innerHTML=items.slice(0,800).map(it=>{
    const badge=it.type==="2d"?"2ตัว":"3ตัว";
    const fields=it.type==="2d"
      ? `บน ${fmtMoney(it.top)} • ล่าง ${fmtMoney(it.bottom)}`
      : `ตรง ${fmtMoney(it.straight)} • โต๊ด ${fmtMoney(it.tod)}`;
    const total=fmtMoney(itemTotal(it));
    return `<div class="item" data-id="${it.id}">
      <div class="badge">${badge}</div>
      <div class="num">${it.number}</div>
      <div class="fields">${fields}</div>
      <div class="total">${total}</div>
      <div class="time">${fmtTime(it.createdAt)}</div>
      <div><button class="btn small ghost del btn-del" data-id="${it.id}">ลบ</button></div>
    </div>`;
  }).join("");
  list.scrollTop=0;
}

function saveLocal(reason){
  if(!keyerId) return;
  try{
    const payload={keyerId,items,lastDraftSavedAt:nowIso()};
    localStorage.setItem(`${LS_KEY}_${keyerId}`,JSON.stringify(payload));
    lastDraftSavedAt=payload.lastDraftSavedAt;
    computeStats();
    if(reason) setStatus(`Draft saved (${reason}) • ${fmtTime(lastDraftSavedAt)}`);
  }catch{}
}
function clearDraft(){
  if(!keyerId) return;
  items=[]; lastDraftSavedAt="";
  try{ localStorage.removeItem(`${LS_KEY}_${keyerId}`); }catch{}
  renderList(); computeStats();
}
function loadLocal(){
  if(!keyerId) return;
  try{
    const raw=localStorage.getItem(`${LS_KEY}_${keyerId}`);
    if(!raw){ items=[]; lastDraftSavedAt=""; return; }
    const payload=JSON.parse(raw);
    const loadedItems=Array.isArray(payload.items)?payload.items:[];
    const loadedAt=payload.lastDraftSavedAt||"";
    if(loadedItems.length){
      const ok=confirm(`พบ Draft ก่อนหน้า (${loadedItems.length} รายการ)\nบันทึกล่าสุด: ${loadedAt?fmtTime(loadedAt):"-"}\n\nต้องการกู้คืนหรือไม่?`);
      if(!ok){
        items=[]; lastDraftSavedAt="";
        try{ localStorage.removeItem(`${LS_KEY}_${keyerId}`);}catch{}
        return;
      }
    }
    items=loadedItems;
    lastDraftSavedAt=loadedAt;
    let changed=false;
    items=items.map(it=>(it&&it.id)?it:(changed=true,{...it,id:makeId()}));
    if(changed) saveLocal("backfill-id");
  }catch{ items=[]; lastDraftSavedAt=""; }
}

function add2D(){
  if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
  const num=padNumber($("twoNum").value,2);
  if(!num) return toast("เลขไม่ถูกต้อง","เลข 2 ตัวต้องเป็น 00-99 (พิมพ์ 7 ได้ = 07)");
  const top1=normalizeAmountAllowBlank($("twoTop").value); if(!top1.ok) return toast("ยอดไม่ถูกต้อง",top1.error);
  const bottom1=normalizeAmountAllowBlank($("twoBottom").value); if(!bottom1.ok) return toast("ยอดไม่ถูกต้อง",bottom1.error);

  items.unshift({id:makeId(),type:"2d",number:num,top:top1.value,bottom:bottom1.value,createdAt:nowIso()});
  $("twoNum").value=""; $("twoTop").value=""; $("twoBottom").value="";
  renderList(); computeStats(); saveLocal("2ตัว");
  $("twoNum").focus();
}
function add3D(){
  if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
  const num=padNumber($("threeNum").value,3);
  if(!num||num.length!==3) return toast("เลขไม่ถูกต้อง","เลข 3 ตัวต้องครบ 3 หลัก (เช่น 001)");
  const st1=normalizeAmountAllowBlank($("threeStraight").value); if(!st1.ok) return toast("ยอดไม่ถูกต้อง",st1.error);
  const tod1=normalizeAmountAllowBlank($("threeTod").value); if(!tod1.ok) return toast("ยอดไม่ถูกต้อง",tod1.error);

  items.unshift({id:makeId(),type:"3d",number:num,straight:st1.value,tod:tod1.value,createdAt:nowIso()});
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
    const numStr=parts[0], a1=parts[1], a2=parts[2]??"";
    if(/^\d{1,2}$/.test(numStr)){
      const num=padNumber(numStr,2);
      const top1=normalizeAmountAllowBlank(a1);
      const bottom1=normalizeAmountAllowBlank(a2);
      if(!num||!top1.ok||!bottom1.ok){ badCount++; continue; }
      toAdd.push({id:makeId(),type:"2d",number:num,top:top1.value,bottom:bottom1.value,createdAt:nowIso()});
      okCount++; continue;
    }
    if(/^\d{1,3}$/.test(numStr)){
      const num=padNumber(numStr,3);
      const st1=normalizeAmountAllowBlank(a1);
      const tod1=normalizeAmountAllowBlank(a2);
      if(!num||num.length!==3||!st1.ok||!tod1.ok){ badCount++; continue; }
      toAdd.push({id:makeId(),type:"3d",number:num,straight:st1.value,tod:tod1.value,createdAt:nowIso()});
      okCount++; continue;
    }
    badCount++;
  }
  return {okCount,badCount,toAdd};
}

/* ZIP single-file (store) */
function crc32(buf){
  if(!crc32.table){
    const t=new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      t[i]=c>>>0;
    }
    crc32.table=t;
  }
  let c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c=crc32.table[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function dosDateTime(d){
  const y=Math.max(1980,d.getFullYear());
  const m=d.getMonth()+1, day=d.getDate();
  const h=d.getHours(), min=d.getMinutes(), sec=Math.floor(d.getSeconds()/2);
  return {dostime:(h<<11)|(min<<5)|sec, dosdate:((y-1980)<<9)|(m<<5)|day};
}
const u16=(n)=>new Uint8Array([n&255,(n>>>8)&255]);
const u32=(n)=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
function cat(...arrs){
  let len=0; for(const a of arrs) len+=a.length;
  const out=new Uint8Array(len); let off=0;
  for(const a of arrs){ out.set(a,off); off+=a.length; }
  return out;
}
function buildZipSingle(filename,fileBytes){
  const dt=dosDateTime(new Date());
  const nameBytes=new TextEncoder().encode(filename);
  const crc=crc32(fileBytes);
  const size=fileBytes.length;
  const method=0;

  const localHdr=cat(u32(0x04034b50),u16(20),u16(0),u16(method),u16(dt.dostime),u16(dt.dosdate),u32(crc),u32(size),u32(size),u16(nameBytes.length),u16(0));
  const localPart=cat(localHdr,nameBytes,fileBytes);

  const centralHdr=cat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(method),u16(dt.dostime),u16(dt.dosdate),u32(crc),u32(size),u32(size),u16(nameBytes.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(0));
  const centralPart=cat(centralHdr,nameBytes);

  const end=cat(u32(0x06054b50),u16(0),u16(0),u16(1),u16(1),u32(centralPart.length),u32(localPart.length),u16(0));
  return new Blob([localPart,centralPart,end],{type:"application/zip"});
}
function downloadBlob(blob,filename){
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

function buildBatch(){
  const batchId=crypto.randomUUID?crypto.randomUUID():`${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const createdAt=nowIso();
  const totalAmount=items.reduce((s,it)=>s+itemTotal(it),0);
  return {keyerId,batchId,createdAt,items,totalAmount,totalItems:items.length};
}
function formatFilename(){
  const d=new Date(); const p=(n)=>String(n).padStart(2,"0");
  return `batch-${keyerId}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function buildExportArtifacts(){
  const batch=buildBatch();
  const jsonText=JSON.stringify(batch,null,2);
  const jsonBytes=new TextEncoder().encode(jsonText);

  const baseName=formatFilename();
  const jsonName=`${baseName}.json`;
  const zipName=`${baseName}.zip`;

  const zipBlob=buildZipSingle(jsonName,jsonBytes);
  const zipFile=new File([zipBlob],zipName,{type:"application/zip"});
  return {batch,zipBlob,zipFile,zipName};
}

async function shareFileOrFallback(file,fallbackBlob,fallbackName){
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file],title:file.name}); return {shared:true}; }
    catch(e){}
  }
  downloadBlob(fallbackBlob,fallbackName);
  return {shared:false};
}

function askExportConfirm(){
  const s=computeSummary();
  return confirm(`ยืนยัน Export ?\n\n2ตัว: ${s.c2} รายการ\n3ตัว: ${s.c3} รายการ\nรวม: ${s.all} รายการ\nยอดรวม: ${fmtMoney(s.total)} บาท`);
}
function afterSuccessfulExport(){
  items=[]; lastDraftSavedAt="";
  renderList(); computeStats();
  try{ localStorage.removeItem(`${LS_KEY}_${keyerId}`);}catch{}
  toast("Export สำเร็จ","เคลียร์รายการและ Draft แล้ว");
  setStatus("Export สำเร็จ • เคลียร์รายการแล้ว");
  setMobileView("key");
}

function setMobileView(which){
  const keyView=$("viewKey"), listView=$("viewList");
  const tk=$("tabKey"), tl=$("tabList");
  const isMobile=window.matchMedia("(max-width: 980px)").matches;
  if(!isMobile){
    keyView.classList.remove("hidden");
    listView.classList.remove("hidden");
    tk.classList.add("active"); tl.classList.remove("active");
    return;
  }
  if(which==="key"){
    keyView.classList.remove("hidden"); listView.classList.add("hidden");
    tk.classList.add("active"); tl.classList.remove("active");
  }else{
    keyView.classList.add("hidden"); listView.classList.remove("hidden");
    tl.classList.add("active"); tk.classList.remove("active");
  }
}

function enforceDigitsMaxLen(el,maxLen){
  el.addEventListener("input",()=>{ el.value=String(el.value||"").replace(/[^\d]/g,"").slice(0,maxLen); });
}
function enforceDigits(el){
  el.addEventListener("input",()=>{ el.value=String(el.value||"").replace(/[^\d]/g,""); });
}

function bindEvents(){
  $("tabKey").addEventListener("click",()=>setMobileView("key"));
  $("tabList").addEventListener("click",()=>setMobileView("list"));
  window.addEventListener("resize",()=>setMobileView("key"));

  $("btnSetKeyerId").addEventListener("click",()=>{
    const v1=validateKeyerId($("keyerIdInput").value);
    if(!v1.ok) return toast("ตั้งค่าไม่ได้",v1.error);
    keyerId=v1.value;
    localStorage.setItem(`${LS_KEY}_activeKeyerId`,keyerId);
    $("keyerHint").textContent=`ปัจจุบัน: ${keyerId} (เปลี่ยนได้)`;
    loadLocal();
    renderList(); computeStats();
    toast("ตั้งค่า Keyer ID",`บันทึกเป็น ${keyerId}`);
    $("twoNum").focus();
  });

  $("btnAdd2D").addEventListener("click",add2D);
  $("btnAdd3D").addEventListener("click",add3D);

  $("twoNum").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();$("twoTop").focus();}});
  $("twoTop").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();$("twoBottom").focus();}});
  $("twoBottom").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();add2D();}});

  $("threeNum").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();$("threeStraight").focus();}});
  $("threeStraight").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();$("threeTod").focus();}});
  $("threeTod").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();add3D();}});

  $("btnPasteAdd").addEventListener("click",()=>{
    if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
    const parsed=parsePasteBlock($("pasteArea").value);
    if(parsed.okCount===0) return toast("ไม่มีรายการถูกต้อง",`ข้าม ${parsed.badCount} รายการ`);
    for(const it of parsed.toAdd.reverse()) items.unshift(it);
    $("pasteArea").value="";
    renderList(); computeStats(); saveLocal("paste");
    toast("เพิ่มจาก Paste",`เพิ่มสำเร็จ ${parsed.okCount} • ข้าม ${parsed.badCount}`);
    setMobileView("list");
  });

  $("list").addEventListener("click",(e)=>{
    const btn=e.target.closest(".btn-del");
    if(!btn) return;
    const id=btn.dataset.id;
    items=items.filter(it=>it.id!==id);
    renderList(); computeStats(); saveLocal("del");
  });

  $("btnClear").addEventListener("click",()=>{
    if(!keyerId) return;
    if(!confirm("ยืนยันล้างรายการทั้งหมด?")) return;
    clearDraft();
    toast("ล้างแล้ว","Draft ถูกเคลียร์แล้ว");
    setStatus("ล้างรายการแล้ว");
  });

  $("btnExport").addEventListener("click",async()=>{
    if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
    if(!items.length) return toast("Export ไม่ได้","ยังไม่มีรายการ");
    if(!askExportConfirm()) return;
    const {zipBlob,zipFile,zipName}=buildExportArtifacts();
    const r=await shareFileOrFallback(zipFile,zipBlob,zipName);
    if(!r.shared) toast("ดาวน์โหลด ZIP แล้ว","ถ้าอยากส่ง LINE: ไปที่ Files/Downloads → Share → LINE");
    afterSuccessfulExport();
  });

  $("btnShare").addEventListener("click",async()=>{
    if(!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID","กรุณาตั้งค่า Keyer ID ก่อน");
    if(!items.length) return toast("ยังไม่มีรายการ","คีย์ก่อนแล้วค่อยแชร์");
    if(!askExportConfirm()) return;
    const {zipBlob,zipFile,zipName}=buildExportArtifacts();
    const r=await shareFileOrFallback(zipFile,zipBlob,zipName);
    if(!r.shared) toast("เครื่องนี้แชร์ไฟล์ไม่รองรับ","ดาวน์โหลดแล้วไปแชร์ใน LINE ได้จาก Files");
    afterSuccessfulExport();
  });

  setInterval(()=>saveLocal("auto"),DRAFT_INTERVAL_MS);
  window.addEventListener("beforeunload",()=>{ try{saveLocal("unload");}catch{} });

  // ✅ ตามที่สั่ง: จำกัดการพิมพ์
  enforceDigitsMaxLen($("twoNum"),2);
  enforceDigitsMaxLen($("threeNum"),3);
  enforceDigitsMaxLen($("keyerIdInput"),6);
  enforceDigits($("twoTop")); enforceDigits($("twoBottom"));
  enforceDigits($("threeStraight")); enforceDigits($("threeTod"));
}

function boot(){
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("./sw.js").catch(()=>{}); }

  const active=localStorage.getItem(`${LS_KEY}_activeKeyerId`);
  if(active && /^\d{6}$/.test(active)){
    keyerId=active;
    $("keyerIdInput").value=keyerId;
    $("keyerHint").textContent=`ปัจจุบัน: ${keyerId} (เปลี่ยนได้)`;
    loadLocal();
  }else{
    $("keyerHint").textContent="ยังไม่ได้ตั้งค่า • ต้องตั้ง Keyer ID ก่อนเริ่มคีย์";
  }

  bindEvents();
  renderList(); computeStats();
  setStatus("พร้อมทำงาน");
  setMobileView("key");
  setTimeout(()=>{ if(keyerId) $("twoNum").focus(); },200);
}

boot();
