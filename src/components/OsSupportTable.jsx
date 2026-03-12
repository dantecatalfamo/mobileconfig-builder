import { useState } from 'react'

const OS_ORDER = ['iOS', 'macOS', 'tvOS', 'visionOS', 'watchOS']

const ROW_HELP = {
  'Introduced':         'The OS version when support for this payload was first introduced.',
  'Deprecated':         'The OS version when this payload was deprecated. Deprecated payloads still work but may be removed in a future OS release.',
  'Removed':            'The OS version when this payload was removed and no longer has any effect.',
  'Supervised':         'When true, this payload can only be installed on supervised devices (enrolled via Apple School Manager, Apple Business Manager, or Configurator).',
  'Requires DEP':       'When true, this payload can only be used on devices provisioned through Apple\'s Device Enrollment Program (DEP/ABM/ASM).',
  'User-approved MDM':  'When true, this payload can only be used on devices where the user has explicitly approved the MDM enrollment, rather than it being silently enrolled.',
  'Manual install':     'When true, this profile can be installed manually by the user directly on the device without MDM.',
  'Device channel':     'When true, this payload can be delivered over the MDM device channel, which applies settings device-wide regardless of the logged-in user.',
  'User channel':       'When true, this payload can be delivered over the MDM user channel, which applies settings only to the currently active user session (primarily macOS).',
  'Multiple allowed':   'When true, multiple instances of this payload type can be installed on the same device simultaneously.',
  'User enrollment':    'How this payload behaves under User Enrollment (BYOD). "allowed" = works with or without; "required" = only works under user enrollment; "forbidden" = cannot be used under user enrollment; "ignored" = present but has no effect.',
  'Shared iPad':        'How this payload behaves on Shared iPad devices. "allowed" = works with or without; "required" = only works on Shared iPad; "forbidden" = cannot be used on Shared iPad; "ignored" = present but has no effect.',
  'Allowed enrollments':'The enrollment types that are permitted to use this payload: "supervised" = supervised MDM, "device" = device enrollment, "user" = user enrollment, "local" = local/manual install.',
  'Allowed scopes':     'The scopes this payload can be applied to: "system" = device-wide, "user" = current user only.',
  'Supervised keys':    'Number of individual keys in this payload that require supervised mode on this OS. Other keys may still be usable without supervision.',
  'Deprecated keys':    'Number of individual keys in this payload that have been deprecated on this OS. These keys still function but may be removed in a future release.',
}

function RowLabel({ label }) {
  const help = ROW_HELP[label]
  return (
    <td className="os-row-label">
      {label}
      {help && <span className="os-row-hint" title={help}>?</span>}
    </td>
  )
}

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

function hasAny(oses, payOS, field) {
  return oses.some(os => payOS[os]?.[field] !== undefined && payOS[os]?.[field] !== null)
}

function BoolCell({ value }) {
  if (value === true)  return <td className="os-cell-ok">Yes</td>
  if (value === false) return <td>No</td>
  return <td>—</td>
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
  const p = payloadSupportedOS

  const hasDeprecated        = hasAny(supportedOSes, p, 'deprecated')
  const hasRemoved           = hasAny(supportedOSes, p, 'removed')
  const hasSupervised        = hasAny(supportedOSes, p, 'supervised')
  const hasRequiresDep       = hasAny(supportedOSes, p, 'requiresdep')
  const hasUserApprovedMDM   = hasAny(supportedOSes, p, 'userapprovedmdm')
  const hasAllowManualInstall= hasAny(supportedOSes, p, 'allowmanualinstall')
  const hasDeviceChannel     = hasAny(supportedOSes, p, 'devicechannel')
  const hasUserChannel       = hasAny(supportedOSes, p, 'userchannel')
  const hasMultiple          = hasAny(supportedOSes, p, 'multiple')
  const hasUserEnrollment    = hasAny(supportedOSes, p, 'userenrollment')
  const hasSharedIPad        = hasAny(supportedOSes, p, 'sharedipad')
  const hasAllowedEnrollments= hasAny(supportedOSes, p, 'allowed-enrollments')
  const hasAllowedScopes     = hasAny(supportedOSes, p, 'allowed-scopes')
  const hasSupervisedKeys    = Object.values(keyInfo).some(i => i.supervisedCount > 0)
  const hasDeprecatedKeys    = Object.values(keyInfo).some(i => i.deprecatedCount > 0)

  return (
    <div className="os-support-section">
      <div className="os-support-row">
        <span className="os-support-label">Platform:</span>
        <span className="os-support-chips">
          {supportedOSes.map(os => {
            const info = p[os]
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
                <RowLabel label="Introduced" />
                {supportedOSes.map(os => <td key={os}>{p[os].introduced}+</td>)}
              </tr>

              {hasDeprecated && (
                <tr>
                  <RowLabel label="Deprecated" />
                  {supportedOSes.map(os => {
                    const v = p[os]?.deprecated
                    return <td key={os} className={v ? 'os-cell-warn' : ''}>{v || '—'}</td>
                  })}
                </tr>
              )}

              {hasRemoved && (
                <tr>
                  <RowLabel label="Removed" />
                  {supportedOSes.map(os => {
                    const v = p[os]?.removed
                    return <td key={os} className={v ? 'os-cell-bad' : ''}>{v || '—'}</td>
                  })}
                </tr>
              )}

              {hasSupervised && (
                <tr>
                  <RowLabel label="Supervised" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.supervised} />)}
                </tr>
              )}

              {hasRequiresDep && (
                <tr>
                  <RowLabel label="Requires DEP" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.requiresdep} />)}
                </tr>
              )}

              {hasUserApprovedMDM && (
                <tr>
                  <RowLabel label="User-approved MDM" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.userapprovedmdm} />)}
                </tr>
              )}

              {hasAllowManualInstall && (
                <tr>
                  <RowLabel label="Manual install" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.allowmanualinstall} />)}
                </tr>
              )}

              {hasDeviceChannel && (
                <tr>
                  <RowLabel label="Device channel" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.devicechannel} />)}
                </tr>
              )}

              {hasUserChannel && (
                <tr>
                  <RowLabel label="User channel" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.userchannel} />)}
                </tr>
              )}

              {hasMultiple && (
                <tr>
                  <RowLabel label="Multiple allowed" />
                  {supportedOSes.map(os => <BoolCell key={os} value={p[os]?.multiple} />)}
                </tr>
              )}

              {hasUserEnrollment && (
                <tr>
                  <RowLabel label="User enrollment" />
                  {supportedOSes.map(os => {
                    const mode = p[os]?.userenrollment?.mode
                    const cls = mode === 'forbidden' ? 'os-cell-bad' : mode === 'required' ? 'os-cell-warn' : ''
                    return <td key={os} className={cls}>{mode || '—'}</td>
                  })}
                </tr>
              )}

              {hasSharedIPad && (
                <tr>
                  <RowLabel label="Shared iPad" />
                  {supportedOSes.map(os => {
                    const mode = p[os]?.sharedipad?.mode
                    const cls = mode === 'forbidden' ? 'os-cell-bad' : mode === 'required' ? 'os-cell-warn' : ''
                    return <td key={os} className={cls}>{mode || '—'}</td>
                  })}
                </tr>
              )}

              {hasAllowedEnrollments && (
                <tr>
                  <RowLabel label="Allowed enrollments" />
                  {supportedOSes.map(os => {
                    const v = p[os]?.['allowed-enrollments']
                    return <td key={os}>{v ? v.join(', ') : '—'}</td>
                  })}
                </tr>
              )}

              {hasAllowedScopes && (
                <tr>
                  <RowLabel label="Allowed scopes" />
                  {supportedOSes.map(os => {
                    const v = p[os]?.['allowed-scopes']
                    return <td key={os}>{v ? v.join(', ') : '—'}</td>
                  })}
                </tr>
              )}

              {hasSupervisedKeys && (
                <tr>
                  <RowLabel label="Supervised keys" />
                  {supportedOSes.map(os => {
                    const n = keyInfo[os]?.supervisedCount || 0
                    return <td key={os} className={n ? 'os-cell-warn' : ''}>{n || '—'}</td>
                  })}
                </tr>
              )}

              {hasDeprecatedKeys && (
                <tr>
                  <RowLabel label="Deprecated keys" />
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
