import assert from 'node:assert/strict'
import {parseCardImport} from '../src/cardImport.js'
const value={format:'saributr-card-v1',citizen_id:'0000000000000',name_title:'นาย',first_name:'สมชาย',last_name:'ใจดี',birth_date:'1982-11-18',kinship_gender:'male',card_address:'ที่อยู่ตามบัตร',avatar_image:'data:image/jpeg;base64,/9j/AA==',id:'untrusted',is_admin:true}
const parsed=parseCardImport(JSON.stringify(value));assert.equal(parsed.citizen_id,'0000000000000');assert.equal(parsed.id,undefined);assert.equal(parsed.is_admin,undefined)
for(const bad of [{citizen_id:'123'},{birth_date:'2024-02-30'},{avatar_image:'javascript:alert(1)'},{format:'unknown'},{first_name:''}])assert.throws(()=>parseCardImport(JSON.stringify({...value,...bad})))
assert.throws(()=>parseCardImport('x'.repeat(200001)))
console.log('PASS card import whitelist, dates, image format, ID length and file size')
