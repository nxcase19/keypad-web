/**
 * Keypad App - renderer
 * รูปแบบคีย์เหมือนเดิม:
 *  - 2ตัว: เลข + บน + ล่าง
 *  - 3ตัว: เลข + ตรง + โต๊ด
 * Enter flow:
 *  - 2ตัว: เลข -> บน -> ล่าง -> เพิ่ม
 *  - 3ตัว: เลข -> ตรง -> โต๊ด -> เพิ่ม
 */

const $ = (id) => document.getElementById(id);

let keyerId = "";
let items = [];
let lastDraftSavedAt = "";

const DRAFT_INTERVAL_MS = 60_000;

function nowIso() { return new Date().toISOString(); }

function fmtMoney(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("th-TH");
}
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch { return ""; }
}

function toast(title, msg) {
  const el = $("toast");
  el.innerHTML = `<div class="t">${title}</div><div class="m">${msg || ""}</div>`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2400);
}
function setStatus(msg) { $("status").textContent = msg; }

function makeId() {
  return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function validateKeyerId(v) {
  const s = String(v || "").trim();
  if (!/^\d{6}$/.test(s)) return { ok: false, error: "Keyer ID ต้องเป็นตัวเลข 6 หลัก" };
  return { ok: true, value: s };
}

function padNumber(raw, len) {
  const s = String(raw || "").trim();
  if (!/^\d+$/.test(s)) return null;
  if (s.length > len) return null;
  return s.padStart(len, "0");
}

function normalizeAmountAllowBlank(v) {
  const s0 = String(v ?? "").trim();
  if (s0 === "") return { ok: true, value: 0 };
  const s = s0.replace(/,/g, "");
  if (!/^\d+$/.test(s)) return { ok: false, error: "ยอดต้องเป็นจำนวนเต็ม" };
  const n = Number(s);
  if (n < 0) return { ok: false, error: "ยอดต้องไม่ติดลบ" };
  return { ok: true, value: n };
}

function itemTotal(it) {
  if (it.type === "2d") return (Number(it.top) || 0) + (Number(it.bottom) || 0);
  if (it.type === "3d") return (Number(it.straight) || 0) + (Number(it.tod) || 0);
  return 0;
}

function ensureItemIds() {
  let changed = false;
  items = items.map((it) => {
    if (!it.id) { changed = true; return { ...it, id: makeId() }; }
    return it;
  });
  if (changed) saveDraft("backfill-id");
}

function computeStats() {
  const total = items.reduce((s, it) => s + itemTotal(it), 0);
  $("statItems").textContent = String(items.length);
  $("statTotal").textContent = fmtMoney(total);
  $("statDraft").textContent = lastDraftSavedAt ? `บันทึก ${fmtTime(lastDraftSavedAt)}` : "ยังไม่บันทึก";
}

function renderList() {
  const list = $("list");
  if (!items.length) {
    list.innerHTML = `<div class="hint" style="padding:10px">ยังไม่มีรายการ</div>`;
    return;
  }

  list.innerHTML = items.slice(0, 800).map((it) => {
    const badge = it.type === "2d" ? "2ตัว" : "3ตัว";
    const fields = it.type === "2d"
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

  // ให้เห็นรายการล่าสุดบนสุดเสมอ
  list.scrollTop = 0;
}

async function saveDraft(reason) {
  if (!keyerId) return;
  try {
    const res = await window.api.saveDraft(keyerId, items);
    if (res?.ok) {
      lastDraftSavedAt = nowIso();
      computeStats();
      if (reason) setStatus(`Draft saved (${reason}) • ${fmtTime(lastDraftSavedAt)}`);
    }
  } catch {}
}

async function loadDraft() {
  if (!keyerId) return;
  const res = await window.api.loadDraft(keyerId);
  if (!res?.ok) return toast("โหลด Draft ไม่ได้", res?.error || "");
  const draft = res.draft || { items: [] };

  items = Array.isArray(draft.items) ? draft.items : [];
  lastDraftSavedAt = draft.lastSavedAt || "";
  ensureItemIds();
  renderList();
  computeStats();
}

function add2D() {
  if (!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID", "กรุณาตั้งค่า Keyer ID ก่อน");
  const num = padNumber($("twoNum").value, 2);
  if (!num) return toast("เลขไม่ถูกต้อง", "เลข 2 ตัวต้องเป็น 00-99 (พิมพ์ 7 ได้ = 07)");

  const top1 = normalizeAmountAllowBlank($("twoTop").value);
  if (!top1.ok) return toast("ยอดไม่ถูกต้อง", top1.error);
  const bottom1 = normalizeAmountAllowBlank($("twoBottom").value);
  if (!bottom1.ok) return toast("ยอดไม่ถูกต้อง", bottom1.error);

  items.unshift({ id: makeId(), type: "2d", number: num, top: top1.value, bottom: bottom1.value, createdAt: nowIso() });

  $("twoNum").value = "";
  $("twoTop").value = "";
  $("twoBottom").value = "";

  renderList();
  computeStats();
  saveDraft("2d");
  $("twoNum").focus();
}

function add3D() {
  if (!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID", "กรุณาตั้งค่า Keyer ID ก่อน");
  const num = padNumber($("threeNum").value, 3);
  if (!num || num.length !== 3) return toast("เลขไม่ถูกต้อง", "เลข 3 ตัวต้องครบ 3 หลัก (เช่น 001)");

  const st1 = normalizeAmountAllowBlank($("threeStraight").value);
  if (!st1.ok) return toast("ยอดไม่ถูกต้อง", st1.error);
  const tod1 = normalizeAmountAllowBlank($("threeTod").value);
  if (!tod1.ok) return toast("ยอดไม่ถูกต้อง", tod1.error);

  items.unshift({ id: makeId(), type: "3d", number: num, straight: st1.value, tod: tod1.value, createdAt: nowIso() });

  $("threeNum").value = "";
  $("threeStraight").value = "";
  $("threeTod").value = "";

  renderList();
  computeStats();
  saveDraft("3d");
  $("threeNum").focus();
}

function parsePasteBlock(text) {
  const lines = String(text || "").split(/\r?\n/);
  let okCount = 0;
  let badCount = 0;
  const toAdd = [];

  function normalizeLine(str) {
    return str
      .replace(/[=:：xX×*]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function mergeOcrSplitDigits(str) {
    let prev = str;
    let curr = str.replace(/(?<!\d)(\d)(?!\d)\s+(?<!\d)(\d)(?!\d)/g, "$1$2");
    while (curr !== prev) {
      prev = curr;
      curr = prev.replace(/(?<!\d)(\d)(?!\d)\s+(?<!\d)(\d)(?!\d)/g, "$1$2");
    }
    return curr;
  }

  function extractKeywordValue(str, keywordRe) {
    const m = str.match(keywordRe);
    return m ? Number(m[1]) : 0;
  }

  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;

    const normalized = mergeOcrSplitDigits(normalizeLine(raw));
    const nums = normalized.match(/\d+/g);

    if (!nums || nums.length < 1) {
      badCount++;
      continue;
    }

    const first = nums[0];
    const nLen = first.length;

    if (nLen > 3) {
      badCount++;
      continue;
    }

    const hasTop = /บน/.test(raw);
    const hasBottom = /ล่าง/.test(raw);
    const hasStraight = /ตรง/.test(raw);
    const hasTod = /โต[๊้]?ด/.test(raw);

    // ===== 2D =====
    if (nLen <= 2) {
      const num = padNumber(first, 2);
      if (!num) {
        badCount++;
        continue;
      }

      let top = 0;
      let bottom = 0;

      if (hasTop || hasBottom) {
        top = extractKeywordValue(raw, /บน\s*(\d+)/);
        bottom = extractKeywordValue(raw, /ล่าง\s*(\d+)/);
      } else {
        const top1 = normalizeAmountAllowBlank(nums[1] ?? "");
        const bottom1 = normalizeAmountAllowBlank(nums[2] ?? "");

        if (!top1.ok || !bottom1.ok) {
          badCount++;
          continue;
        }

        top = top1.value;
        bottom = bottom1.value;
      }

      toAdd.push({
        id: makeId(),
        type: "2d",
        number: num,
        top,
        bottom,
        createdAt: nowIso(),
      });

      okCount++;
      continue;
    }

    // ===== 3D =====
    if (nLen === 3) {
      const num = padNumber(first, 3);
      if (!num || num.length !== 3) {
        badCount++;
        continue;
      }

      let straight = 0;
      let tod = 0;

      if (hasStraight || hasTod) {
        straight = extractKeywordValue(raw, /ตรง\s*(\d+)/);
        tod = extractKeywordValue(raw, /โต[๊้]?ด\s*(\d+)/);
      } else {
        const st1 = normalizeAmountAllowBlank(nums[1] ?? "");
        const tod1 = normalizeAmountAllowBlank(nums[2] ?? "");

        if (!st1.ok || !tod1.ok) {
          badCount++;
          continue;
        }

        straight = st1.value;
        tod = tod1.value;
      }

      toAdd.push({
        id: makeId(),
        type: "3d",
        number: num,
        straight,
        tod,
        createdAt: nowIso(),
      });

      okCount++;
      continue;
    }

    badCount++;
  }

  return { okCount, badCount, toAdd };
}

async function initKeyer() {
  try {
    let candidate = "";

    if (window.api?.getConfig) {
      try {
        const cfgRes = await window.api.getConfig();
        if (cfgRes?.ok && cfgRes.config?.keyerId) {
          candidate = String(cfgRes.config.keyerId).trim();
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (!candidate) {
      try {
        const ls = localStorage.getItem("keyerId");
        if (ls) candidate = String(ls).trim();
      } catch (e) {
        console.error(e);
      }
    }

    const v1 = validateKeyerId(candidate);
    if (v1.ok) {
      keyerId = v1.value;
      $("keyerIdInput").value = keyerId;
      $("keyerHint").textContent = `ปัจจุบัน: ${keyerId} (เปลี่ยนได้)`;
      try {
        await loadDraft();
      } catch (e) {
        console.error(e);
      }
    } else {
      $("keyerHint").textContent = "ยังไม่ได้ตั้งค่า • ต้องตั้ง Keyer ID ก่อนเริ่มคีย์";
    }
  } catch (e) {
    console.error(e);
    $("keyerHint").textContent = "ยังไม่ได้ตั้งค่า • ต้องตั้ง Keyer ID ก่อนเริ่มคีย์";
  }
}

function bindEvents() {
  $("btnSetKeyerId").addEventListener("click", async () => {
    const v = $("keyerIdInput").value;
    const v1 = validateKeyerId(v);
    if (!v1.ok) return toast("ตั้งค่าไม่ได้", v1.error);

    let persisted = false;
    let apiError = "";

    if (window.api?.setKeyerId) {
      try {
        const res = await window.api.setKeyerId(v1.value);
        if (res?.ok === true) persisted = true;
        else apiError = res?.error || "";
      } catch (e) {
        console.error(e);
        apiError = e?.message || "";
      }
    }

    if (!persisted) {
      try {
        localStorage.setItem("keyerId", v1.value);
        persisted = true;
      } catch (e) {
        console.error(e);
        return toast("ตั้งค่าไม่ได้", apiError || e?.message || "บันทึกไม่ได้");
      }
    }

    keyerId = v1.value;
    $("keyerHint").textContent = `ปัจจุบัน: ${keyerId} (เปลี่ยนได้)`;
    toast("ตั้งค่า Keyer ID", `บันทึกเป็น ${keyerId}`);
    await loadDraft();
    $("twoNum").focus();
  });

  $("btnAdd2D").addEventListener("click", add2D);
  $("btnAdd3D").addEventListener("click", add3D);

  // Enter flow 2ตัว: เลข -> บน -> ล่าง -> เพิ่ม
  $("twoNum").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("twoTop").focus(); } });
  $("twoTop").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("twoBottom").focus(); } });
  $("twoBottom").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add2D(); } });

  // Enter flow 3ตัว: เลข -> ตรง -> โต๊ด -> เพิ่ม
  $("threeNum").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("threeStraight").focus(); } });
  $("threeStraight").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("threeTod").focus(); } });
  $("threeTod").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add3D(); } });

  $("btnPasteAdd").addEventListener("click", () => {
    if (!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID", "กรุณาตั้งค่า Keyer ID ก่อน");

    const text = $("pasteArea").value;
    const parsed = parsePasteBlock(text);
    if (parsed.okCount === 0) return toast("ไม่มีรายการถูกต้อง", `ข้าม ${parsed.badCount} รายการ`);

    // newest on top: reverse before unshift
    for (const it of parsed.toAdd.reverse()) items.unshift(it);

    $("pasteArea").value = "";
    renderList();
    computeStats();
    saveDraft("paste");
    toast("เพิ่มจาก Paste", `เพิ่มสำเร็จ ${parsed.okCount} • ข้าม ${parsed.badCount}`);
  });

  // Delete per item
  $("list").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-del");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    items = items.filter((it) => it.id !== id);
    renderList();
    computeStats();
    saveDraft("del");
  });

  $("btnClear").addEventListener("click", async () => {
    if (!keyerId) return;
    const ok = confirm("ยืนยันล้างรายการทั้งหมด?");
    if (!ok) return;

    items = [];
    lastDraftSavedAt = "";
    renderList();
    computeStats();
    await window.api.clearDraft(keyerId);
    toast("ล้างแล้ว", "Draft ถูกเคลียร์แล้ว");
    setStatus("ล้างรายการแล้ว");
  });

  $("btnExport").addEventListener("click", async () => {
    if (!keyerId) return toast("ยังไม่ได้ตั้ง Keyer ID", "กรุณาตั้งค่า Keyer ID ก่อน");
    if (!items.length) return toast("Export ไม่ได้", "ยังไม่มีรายการ");

    setStatus("กำลัง Export...");
    const res = await window.api.exportBatch({ keyerId, items });
    if (res?.canceled) return setStatus("ยกเลิก Export");
    if (!res?.ok) {
      toast("Export ล้มเหลว", res?.error || "");
      return setStatus("Export ล้มเหลว");
    }

    items = [];
    lastDraftSavedAt = "";
    renderList();
    computeStats();
    await window.api.clearDraft(keyerId);

    toast("Export สำเร็จ", `items ${res.batchMeta.totalItems} • total ${fmtMoney(res.batchMeta.totalAmount)}`);
    setStatus("Export สำเร็จ • เคลียร์รายการแล้ว");
  });

  setInterval(() => saveDraft("auto"), DRAFT_INTERVAL_MS);

  window.addEventListener("beforeunload", () => {
    try { window.api.saveDraft(keyerId, items); } catch {}
  });
}

(async function boot() {
  bindEvents();
  await initKeyer();
  renderList();
  computeStats();
  setStatus("พร้อมทำงาน");
  setTimeout(() => { if (keyerId) $("twoNum").focus(); }, 200);
})();
