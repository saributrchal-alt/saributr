export const nameTitles = ['', 'นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.']
// Longest prefix first so นางสาว is not mistaken for นาง.
const aliases = [
  ['นางสาว', 'นางสาว'], ['เด็กชาย', 'ด.ช.'], ['เด็กหญิง', 'ด.ญ.'],
  ['ด.ช.', 'ด.ช.'], ['ด.ญ.', 'ด.ญ.'], ['ดช.', 'ด.ช.'], ['ดญ.', 'ด.ญ.'],
  ['นาย', 'นาย'], ['นาง', 'นาง']
]
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
export function siblingRole(order, fullName) {
  if (order !== 'พี่' && order !== 'น้อง') return order
  const {title} = splitName(fullName)
  const suffix = ['นาย', 'ด.ช.'].includes(title) ? 'ชาย' : ['นาง', 'นางสาว', 'ด.ญ.'].includes(title) ? 'สาว' : ''
  return order + suffix
}
