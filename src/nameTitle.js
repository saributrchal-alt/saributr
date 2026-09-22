// Full rank names avoid abbreviations shared by different services.
export const titleGroups = [
  ['ทั่วไป', ['นาย','นาง','นางสาว','ด.ช.','ด.ญ.']],
  ['นักบวช', ['พระ','พระมหา','พระครู','พระอาจารย์','สามเณร','แม่ชี','ภิกษุณี','สามเณรี']],
  ['ทหารบก', ['จอมพล','พลเอก','พลโท','พลตรี','พันเอก','พันโท','พันตรี','ร้อยเอก','ร้อยโท','ร้อยตรี','ว่าที่ร้อยเอก','ว่าที่ร้อยโท','ว่าที่ร้อยตรี','จ่าสิบเอก','จ่าสิบโท','จ่าสิบตรี','สิบเอก','สิบโท','สิบตรี','พลทหาร']],
  ['ทหารเรือ', ['จอมพลเรือ','พลเรือเอก','พลเรือโท','พลเรือตรี','นาวาเอก','นาวาโท','นาวาตรี','เรือเอก','เรือโท','เรือตรี','พันจ่าเอก','พันจ่าโท','พันจ่าตรี','จ่าเอก','จ่าโท','จ่าตรี']],
  ['ทหารอากาศ', ['จอมพลอากาศ','พลอากาศเอก','พลอากาศโท','พลอากาศตรี','นาวาอากาศเอก','นาวาอากาศโท','นาวาอากาศตรี','เรืออากาศเอก','เรืออากาศโท','เรืออากาศตรี','พันจ่าอากาศเอก','พันจ่าอากาศโท','พันจ่าอากาศตรี','จ่าอากาศเอก','จ่าอากาศโท','จ่าอากาศตรี']],
  ['ตำรวจ', ['พลตำรวจเอก','พลตำรวจโท','พลตำรวจตรี','พันตำรวจเอก','พันตำรวจโท','พันตำรวจตรี','ร้อยตำรวจเอก','ร้อยตำรวจโท','ร้อยตำรวจตรี','ดาบตำรวจ','จ่าสิบตำรวจ','สิบตำรวจเอก','สิบตำรวจโท','สิบตำรวจตรี']]
]
export const nameTitles = ['', ...titleGroups.flatMap(([,titles])=>titles)]
const aliases = [...nameTitles.filter(Boolean).map(t=>[t,t]),
  ['เด็กชาย','ด.ช.'],['เด็กหญิง','ด.ญ.'],['ดช.','ด.ช.'],['ดญ.','ด.ญ.']
].sort((a,b)=>b[0].length-a[0].length)
export function splitName(fullName = '') {
  const value = fullName.trim()
  const match = aliases.find(([prefix]) => value.startsWith(prefix) && value.slice(prefix.length).trim())
  return match ? {title: match[1], name: value.slice(match[0].length).trim()} : {title: '', name: value}
}
export function joinName(title, name) {
  const value = name.trim()
  if (!value) return ''
  // Also accept a pasted full name without duplicating its prefix.
  return title ? `${title} ${splitName(value).name}` : value
}
export function siblingRole(order, fullName, gender) {
  if (order !== 'พี่' && order !== 'น้อง') return order
  const {title} = splitName(fullName)
  const suffix = gender==='male' ? 'ชาย' : gender==='female' ? 'สาว' : ['นาย','ด.ช.','พระ','พระมหา','พระครู','พระอาจารย์','สามเณร'].includes(title) ? 'ชาย' : ['นาง','นางสาว','ด.ญ.','แม่ชี','ภิกษุณี','สามเณรี'].includes(title) ? 'สาว' : ''
  return order + suffix
}
