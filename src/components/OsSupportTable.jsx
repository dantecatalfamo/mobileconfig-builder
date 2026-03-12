import { useState } from 'react'

const OS_ORDER = ['iOS', 'macOS', 'tvOS', 'visionOS', 'watchOS']

// Recursively collect per-OS info from payloadkeys and their subkeys
function collectKeyInfo(payloadkeys) {
  const osInfo = {}

  function ensureOs(os) {
    if (!osInfo[os]) osInfo[os] = { supervisedCount: 0, deprecatedCount: 0 }
  }

  function walk(keys) {
    for (const k of (keys || [])) {
      if (k.supportedOS) {
        for (const [os, info] of Object.entries(k.supportedOS)) {
          if (!info || info.introduced === 'n/a') continue
          ensureOs(os)
          if (info.supervised) osInfo[os].supervisedCount++
          if (info.deprecated) osInfo[os].deprecatedCount++
        }
      }
      if (k.subkeys) walk(k.subkeys)
    }
  }

  walk(payloadkeys)
  return osInfo
}

export function OsSupportTable({ payloadSupportedOS, payloadkeys }) {
  const [expanded, setExpanded] = useState(false)
  if (!payloadSupportedOS) return null

  const supportedOSes = OS_ORDER.filter(os => {
    const info = payloadSupportedOS[os]
    return info && info.introduced && info.introduced !== 'n/a'
  })
  if (!supportedOSes.length) return null

  const keyInfo = collectKeyInfo(payloadkeys)

  const hasDeprecated     = supportedOSes.some(os => payloadSupportedOS[os]?.deprecated)
  const hasRemoved        = supportedOSes.some(os => payloadSupportedOS[os]?.removed)
  const hasSupervised     = supportedOSes.some(os => payloadSupportedOS[os]?.supervised)
  const hasRequiresDep    = supportedOSes.some(os => payloadSupportedOS[os]?.requiresdep)
  const hasUserEnrollment = supportedOSes.some(os => payloadSupportedOS[os]?.userenrollment)
  const hasMultiple       = supportedOSes.some(os => payloadSupportedOS[os]?.multiple !== undefined)
  const hasSupervisedKeys = Object.values(keyInfo).some(i => i.supervisedCount > 0)
  const hasDeprecatedKeys = Object.values(keyInfo).some(i => i.deprecatedCount > 0)

  return (
    <div className="os-support-section">
      <div className="os-support-row">
        <span className="os-support-label">Platform:</span>
        <span className="os-support-chips">
          {supportedOSes.map(os => {
            const info = payloadSupportedOS[os]
            const cls = info.removed ? 'os-chip-removed' : info.deprecated ? 'os-chip-deprecated' : ''
            return (
              <span key={os} className={`os-chip ${cls}`} title={
                info.deprecated ? `Deprecated ${info.deprecated}${info.removed ? `, removed ${info.removed}` : ''}` : ''
              }>
                {os} {info.introduced}+
                {info.deprecated && !info.removed && <span className="os-chip-dep"> dep</span>}
                {info.removed && <span className="os-chip-dep"> removed</span>}
              </span>
            )
          })}
        </span>
        <button className="os-details-btn" onClick={() => setExpanded(s => !s)}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="os-details">
          <table className="os-table">
            <thead>
              <tr>
                <th></th>
                {supportedOSes.map(os => <th key={os}>{os}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Introduced</td>
                {supportedOSes.map(os => (
                  <td key={os}>{payloadSupportedOS[os].introduced}+</td>
                ))}
              </tr>

              {hasDeprecated && (
                <tr>
                  <td>Deprecated</td>
                  {supportedOSes.map(os => {
                    const v = payloadSupportedOS[os]?.deprecated
                    return <td key={os} className={v ? 'os-cell-warn' : ''}>{v || '—'}</td>
                  })}
                </tr>
              )}

              {hasRemoved && (
                <tr>
                  <td>Removed</td>
                  {supportedOSes.map(os => {
                    const v = payloadSupportedOS[os]?.removed
                    return <td key={os} className={v ? 'os-cell-bad' : ''}>{v || '—'}</td>
                  })}
                </tr>
              )}

              {hasSupervised && (
                <tr>
                  <td>Supervised</td>
                  {supportedOSes.map(os => {
                    const sup = payloadSupportedOS[os]?.supervised
                    return <td key={os} className={sup ? 'os-cell-warn' : ''}>{sup ? 'Required' : '—'}</td>
                  })}
                </tr>
              )}

              {hasRequiresDep && (
                <tr>
                  <td>Requires DEP</td>
                  {supportedOSes.map(os => {
                    const dep = payloadSupportedOS[os]?.requiresdep
                    return <td key={os} className={dep ? 'os-cell-warn' : ''}>{dep ? 'Yes' : '—'}</td>
                  })}
                </tr>
              )}

              {hasUserEnrollment && (
                <tr>
                  <td>User Enrollment</td>
                  {supportedOSes.map(os => {
                    const mode = payloadSupportedOS[os]?.userenrollment?.mode
                    const cls = mode === 'forbidden' ? 'os-cell-bad' : mode === 'required' ? 'os-cell-warn' : ''
                    return <td key={os} className={cls}>{mode || '—'}</td>
                  })}
                </tr>
              )}

              {hasMultiple && (
                <tr>
                  <td>Multiple allowed</td>
                  {supportedOSes.map(os => {
                    const m = payloadSupportedOS[os]?.multiple
                    return <td key={os}>{m === true ? 'Yes' : m === false ? 'No' : '—'}</td>
                  })}
                </tr>
              )}

              {hasSupervisedKeys && (
                <tr>
                  <td>Supervised keys</td>
                  {supportedOSes.map(os => {
                    const n = keyInfo[os]?.supervisedCount || 0
                    return <td key={os} className={n ? 'os-cell-warn' : ''}>{n || '—'}</td>
                  })}
                </tr>
              )}

              {hasDeprecatedKeys && (
                <tr>
                  <td>Deprecated keys</td>
                  {supportedOSes.map(os => {
                    const n = keyInfo[os]?.deprecatedCount || 0
                    return <td key={os} className={n ? 'os-cell-warn' : ''}>{n || '—'}</td>
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
