import { useState } from 'react'

const OS_SHORT = { iOS: 'iOS', macOS: 'macOS', tvOS: 'tvOS', visionOS: 'visionOS', watchOS: 'watchOS' }

function OsBadges({ supportedOS }) {
  if (!supportedOS) return null
  const badges = Object.entries(supportedOS)
    .filter(([, info]) => info?.introduced && info.introduced !== 'n/a')
    .map(([os, info]) => ({ os, version: info.introduced }))
  if (!badges.length) return null
  return (
    <span className="os-badges">
      {badges.map(({ os, version }) => (
        <span key={os} className="os-badge">{OS_SHORT[os] ?? os} {version}+</span>
      ))}
    </span>
  )
}

function DeprecationBadge({ supportedOS }) {
  const entries = Object.entries(supportedOS || {})
  const removed    = entries.filter(([, i]) => i?.removed).map(([os, i]) => `${OS_SHORT[os] ?? os} ${i.removed}`)
  const deprecated = entries.filter(([, i]) => i?.deprecated && !i?.removed).map(([os, i]) => `${OS_SHORT[os] ?? os} ${i.deprecated}`)
  return <>
    {removed.length > 0 && <span className="key-removed">removed {removed.join(', ')}</span>}
    {deprecated.length > 0 && <span className="key-deprecated">deprecated {deprecated.join(', ')}</span>}
  </>
}

function SupervisedBadge({ supportedOS }) {
  const oses = Object.entries(supportedOS || {})
    .filter(([, i]) => i?.supervised)
    .map(([os]) => OS_SHORT[os] ?? os)
  if (!oses.length) return null
  return <span className="key-supervised">supervised {oses.join(', ')}</span>
}

function DefaultBadge({ defaultVal }) {
  if (defaultVal === undefined || defaultVal === null) return null
  const label = String(defaultVal)
  return <span className="key-default" title={`Default: ${label}`}>default: {label.length > 24 ? label.slice(0, 24) + '…' : label}</span>
}

function NotSupportedNote({ supportedOS, payloadSupportedOS }) {
  if (!supportedOS || !payloadSupportedOS) return null
  const notOn = Object.entries(payloadSupportedOS)
    .filter(([os, payInfo]) =>
      payInfo?.introduced && payInfo.introduced !== 'n/a' &&
      supportedOS[os]?.introduced === 'n/a'
    )
    .map(([os]) => OS_SHORT[os] ?? os)
  if (!notOn.length) return null
  return <span className="key-not-supported" title={`Not supported on: ${notOn.join(', ')}`}>not on {notOn.join(', ')}</span>
}

export function FieldLabel({ title, keyName, description, required, supportedOS, payloadSupportedOS, defaultVal }) {
  const [show, setShow] = useState(false)
  return (
    <div className="field-label">
      <span className="field-name">{title || keyName}{required && <span className="required">*</span>}</span>
      <span className="key-code">{keyName}</span>
      <OsBadges supportedOS={supportedOS} />
      <DefaultBadge defaultVal={defaultVal} />
      <SupervisedBadge supportedOS={supportedOS} />
      <DeprecationBadge supportedOS={supportedOS} />
      <NotSupportedNote supportedOS={supportedOS} payloadSupportedOS={payloadSupportedOS} />
      {description && <>
        <button className="help-btn" onClick={() => setShow(s=>!s)}>?</button>
        {show && <div className="field-desc">{description}</div>}
      </>}
    </div>
  )
}

export function LabelWithHelp({ label, required, help }) {
  const [show, setShow] = useState(false)
  return (
    <div className="field-label">
      <span className="field-name">
        {label}{required && <span className="required">*</span>}
      </span>
      {help && <>
        <button className="help-btn" onClick={() => setShow(s => !s)}>?</button>
        {show && <div className="field-desc">{help}</div>}
      </>}
    </div>
  )
}
