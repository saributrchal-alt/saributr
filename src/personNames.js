import { splitName } from './nameTitle.js'
export function nameDefaults(person = {}) {
  const old = splitName(person.full_name)
  return {
    name_title: person.name_title ?? old.title,
    first_name: person.first_name ?? old.name,
    last_name: person.last_name ?? '',
    birth_first_name: person.birth_first_name ?? '',
    birth_last_name: person.birth_last_name ?? ''
  }
}
export function composeName(title, first, last) {
  return [title,first,last].map(v=>(v||'').trim()).filter(Boolean).join(' ')
}
export function matchesName(person, query) {
  return [person.full_name,person.first_name,person.last_name,person.birth_first_name,person.birth_last_name,person.nickname]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
}
