// client/src/monitoring/consent.js
export function onConsentChange(cb){
  window.addEventListener('consent:changed', e => cb(e.detail));
}
