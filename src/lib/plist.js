import schemasData from '../schemas.json'

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function ind(n) { return '\t'.repeat(n) }

function valueToPlistLines(value, type, depth, subkeys = []) {
  const pad = ind(depth)
  if (value === undefined || value === null || value === '') return []
  if (type === '<boolean>') {
    return [`${pad}<${(value === true || value === 'true' || value === 1) ? 'true' : 'false'}/>`]
  }
  if (type === '<integer>' || type === '<real>') {
    const num = Number(value); if (isNaN(num)) return []
    const tag = type === '<real>' ? 'real' : 'integer'
    return [`${pad}<${tag}>${num}</${tag}>`]
  }
  if (type === '<date>') return [`${pad}<date>${escapeXml(value)}</date>`]
  if (type === '<data>') return [`${pad}<data>${escapeXml(value)}</data>`]
  if (type === '<array>') {
    if (!Array.isArray(value) || value.length === 0) return []
    const itemSchema = subkeys[0]
    const lines = [`${pad}<array>`]
    for (const item of value) {
      if (item === undefined || item === null || item === '') continue
      if (itemSchema?.type === '<dictionary>' || (typeof item === 'object' && !Array.isArray(item))) {
        lines.push(...dictToPlistLines(item, itemSchema?.subkeys || [], depth + 1))
      } else {
        lines.push(...valueToPlistLines(item, itemSchema?.type || '<string>', depth + 1, itemSchema?.subkeys || []))
      }
    }
    lines.push(`${pad}</array>`); return lines
  }
  if (type === '<dictionary>') {
    if (typeof value !== 'object' || Array.isArray(value)) return []
    return dictToPlistLines(value, subkeys, depth)
  }
  if (typeof value === 'object') return []
  return [`${pad}<string>${escapeXml(String(value))}</string>`]
}

function dictToPlistLines(obj, subkeyDefs = [], depth) {
  const pad = ind(depth), inner = ind(depth + 1)
  const lines = [`${pad}<dict>`]
  const schemaByKey = Object.fromEntries((subkeyDefs || []).filter(s => s.key).map(s => [s.key, s]))
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue
    const sk = schemaByKey[key]
    const type = sk?.type || (typeof value === 'boolean' ? '<boolean>' : typeof value === 'number' ? '<integer>' : '<string>')
    const vlines = valueToPlistLines(value, type, depth + 1, sk?.subkeys || [])
    if (!vlines.length) continue
    lines.push(`${inner}<key>${escapeXml(key)}</key>`, ...vlines)
  }
  lines.push(`${pad}</dict>`); return lines
}

export function generateMobileconfig(profileMeta, payloadForms) {
  const profileUUID = crypto.randomUUID().toUpperCase()
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">','<dict>',
    '\t<key>PayloadContent</key>','\t<array>',
  ]
  for (const form of payloadForms) {
    const payloadUUID = crypto.randomUUID().toUpperCase()
    const schemaByKey = Object.fromEntries((schemasData.profiles[form.profileId]?.payloadkeys || []).filter(s=>s.key).map(s=>[s.key,s]))
    lines.push('\t\t<dict>')
    lines.push('\t\t\t<key>PayloadType</key>',`\t\t\t<string>${escapeXml(form.payloadType)}</string>`)
    lines.push('\t\t\t<key>PayloadVersion</key>','\t\t\t<integer>1</integer>')
    lines.push('\t\t\t<key>PayloadUUID</key>',`\t\t\t<string>${payloadUUID}</string>`)
    lines.push('\t\t\t<key>PayloadIdentifier</key>',`\t\t\t<string>${escapeXml(profileMeta.identifier)}.${escapeXml(form.payloadType)}</string>`)
    for (const [key, value] of Object.entries(form.values)) {
      if (['PayloadType','PayloadVersion','PayloadUUID','PayloadIdentifier'].includes(key)) continue
      if (value === undefined || value === null || value === '') continue
      const sk = schemaByKey[key]
      const vlines = valueToPlistLines(value, sk?.type || '<string>', 3, sk?.subkeys || [])
      if (!vlines.length) continue
      lines.push(`\t\t\t<key>${escapeXml(key)}</key>`, ...vlines)
    }
    lines.push('\t\t</dict>')
  }
  lines.push('\t</array>')
  lines.push('\t<key>PayloadDescription</key>',`\t<string>${escapeXml(profileMeta.description)}</string>`)
  lines.push('\t<key>PayloadDisplayName</key>',`\t<string>${escapeXml(profileMeta.displayName)}</string>`)
  lines.push('\t<key>PayloadIdentifier</key>',`\t<string>${escapeXml(profileMeta.identifier)}</string>`)
  lines.push('\t<key>PayloadOrganization</key>',`\t<string>${escapeXml(profileMeta.organization)}</string>`)
  lines.push('\t<key>PayloadRemovalDisallowed</key>',`\t<${profileMeta.removalDisallowed ? 'true' : 'false'}/>`)
  lines.push('\t<key>PayloadScope</key>',`\t<string>${escapeXml(profileMeta.scope)}</string>`)
  lines.push('\t<key>PayloadType</key>','\t<string>Configuration</string>')
  lines.push('\t<key>PayloadUUID</key>',`\t<string>${profileUUID}</string>`)
  lines.push('\t<key>PayloadVersion</key>','\t<integer>1</integer>')
  lines.push('</dict>','</plist>')
  return lines.join('\n')
}
