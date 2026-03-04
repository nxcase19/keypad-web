# Keypad Web v3 (PWA Offline)

## v3 เพิ่มอะไร
- จำกัดการพิมพ์เลข: 2ตัวพิมพ์ได้แค่ 2 หลัก, 3ตัวพิมพ์ได้แค่ 3 หลัก (กัน paste/พิมพ์เกิน)
- Export มี Summary ยืนยันก่อนส่ง
- ปุ่ม “แชร์ (LINE)” (ใช้ Web Share API ถ้าเครื่องรองรับ) ถ้าไม่รองรับจะดาวน์โหลด ZIP ให้แทน
- Draft Recovery: ถ้ามี Draft ก่อนหน้า จะถามกู้คืน/ล้าง
- Offline-first (Service Worker)

## อัปเดตขึ้น GitHub
Add file → Upload files → ลากไฟล์ทั้งหมดทับของเดิม → Commit
Vercel จะ deploy อัตโนมัติ
