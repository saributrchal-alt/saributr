export function parseCardImport(text){
 if(typeof text!=='string'||text.length>200000)throw Error('ไฟล์ข้อมูลใหญ่เกินกำหนด')
 const x=JSON.parse(text)
 if(x?.format!=='saributr-card-v1')throw Error('เลือกไฟล์จากแอปอ่านบัตรรุ่น 1.4 ขึ้นไป')
 const str=(key,max,required=false)=>{const s=x[key];if(typeof s!=='string'||s.length>max||(required&&!s.trim()))throw Error('ข้อมูล '+key+' ไม่ถูกต้อง');return s.trim()}
 const cid=str('citizen_id',13,true);if(!/^\d{13}$/.test(cid))throw Error('เลขบัตรต้องมี 13 หลัก')
 const birth=str('birth_date',10);if(birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(Date.parse(birth))||new Date(birth).toISOString().slice(0,10)!==birth))throw Error('วันเกิดไม่ถูกต้อง')
 const photo=str('avatar_image',100000);if(photo&&!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo))throw Error('รูปภาพไม่ถูกต้อง')
 const gender=str('kinship_gender',10);if(!['male','female',''].includes(gender))throw Error('ข้อมูลเพศไม่ถูกต้อง')
 return {citizen_id:cid,name_title:str('name_title',100),first_name:str('first_name',200,true),last_name:str('last_name',200),birth_date:birth,kinship_gender:gender,card_address:str('card_address',1000),avatar_image:photo}
}
