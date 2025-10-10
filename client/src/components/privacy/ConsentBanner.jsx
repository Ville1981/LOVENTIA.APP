import { useEffect, useState } from "react";

const key = "loventia-consent-v1";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(key);
    if (!v) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(key, JSON.stringify({ analytics: true, ts: Date.now() }));
    setVisible(false);
    window.dispatchEvent(new CustomEvent('consent:changed', { detail: { analytics: true }}));
  };
  const decline = () => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, ts: Date.now() }));
    setVisible(false);
    window.dispatchEvent(new CustomEvent('consent:changed', { detail: { analytics: false }}));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-5xl m-2 rounded-2xl bg-white shadow-lg p-4 flex flex-col sm:flex-row items-center gap-3">
        <p className="text-sm">
          We use cookies for essential functionality and, with your consent, for analytics. See our
          <a href="/privacy" className="underline ml-1">Privacy</a> and
          <a href="/cookies" className="underline ml-1">Cookies</a>.
        </p>
        <div className="ml-auto flex gap-2">
          <button onClick={decline} className="px-3 py-2 rounded-xl bg-gray-200">Decline</button>
          <button onClick={accept} className="px-3 py-2 rounded-xl bg-black text-white">Allow analytics</button>
        </div>
      </div>
    </div>
  );
}
