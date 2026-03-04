let keyerId=""
let items=[]

function setKeyer(){
 let v=document.getElementById("keyerId").value.trim()
 if(!/^\d{6}$/.test(v)){alert("Keyer ID ต้อง 6 หลัก");return}
 keyerId=v
 document.getElementById("keyerInfo").innerText="ปัจจุบัน: "+v
}

function add2(){
 if(!keyerId){alert("ต้องตั้ง Keyer ID ก่อน");return}
 let n=document.getElementById("twoNum").value.padStart(2,"0")
 let top=parseInt(document.getElementById("twoTop").value||0)
 let bot=parseInt(document.getElementById("twoBottom").value||0)
 items.unshift({num:n,top,bot})
 render()
}

function pasteAdd(){
 let t=document.getElementById("paste").value.split("\n")
 for(let l of t){
  let p=l.trim().split(/\s+/)
  if(p.length>=3){
   items.unshift({num:p[0],top:+p[1],bot:+p[2]})
  }
 }
 render()
}

function render(){
 let el=document.getElementById("list")
 el.innerHTML=""
 items.forEach(i=>{
  let d=document.createElement("div")
  d.className="item"
  d.textContent=`${i.num} บน ${i.top} ล่าง ${i.bot}`
  el.appendChild(d)
 })
}

function clearAll(){
 if(confirm("ล้างรายการทั้งหมด?")){
  items=[]
  render()
 }
}

function summary(){
 let count=items.length
 let total=items.reduce((s,i)=>s+i.top+i.bot,0)
 return {count,total}
}

async function exportZip(){

 if(!items.length){alert("ไม่มีรายการ");return}

 let s=summary()

 let ok=confirm(`ยืนยัน Export ?

จำนวนรายการ: ${s.count}
ยอดรวม: ${s.total} บาท`)

 if(!ok) return

 let batch={
  keyerId,
  created:new Date().toISOString(),
  items
 }

 let json=JSON.stringify(batch,null,2)
 let blob=new Blob([json],{type:"application/json"})
 let file=new File([blob],"batch-"+keyerId+".json")

 if(navigator.canShare && navigator.canShare({files:[file]})){
  try{
   await navigator.share({
    files:[file],
    title:"Batch "+keyerId
   })
   return
  }catch(e){}
 }

 let a=document.createElement("a")
 a.href=URL.createObjectURL(blob)
 a.download="batch-"+keyerId+".json"
 a.click()

 items=[]
 render()
}
