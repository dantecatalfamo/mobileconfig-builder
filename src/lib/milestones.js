// Fires a GoatCounter event (script loaded in index.html). No-op if the
// counter is blocked or hasn't loaded yet. Sends only the event name.
export function recordMilestone(event) {
  try {
    window.goatcounter?.count?.({ path: event, title: event, event: true });
  } catch {
    // analytics must never break the app
  }
}
