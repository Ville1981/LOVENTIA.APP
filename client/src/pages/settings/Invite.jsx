// --- REPLACE START: Invite friends page ---
import React, { useEffect, useState } from "react";
import api from "../../utils/axiosInstance";
import ShareButtons from "../../components/ShareButtons";

const Invite = () => {
  const [shareUrl, setShareUrl] = useState(window.location.origin);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/referral/my-code");
        const url = res?.data?.shareUrl || `${window.location.origin}/register`;
        if (mounted) setShareUrl(url);
      } catch {
        // fallback
        setShareUrl(`${window.location.origin}/register`);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Invite friends</h1>
      <p className="text-gray-600 mb-4">
        Share your invite link. Friends signing up with your link will be marked as referred by you.
      </p>

      <div className="p-3 border rounded bg-gray-50 mb-3 break-all" data-testid="invite-link">
        {shareUrl}
      </div>

      <ShareButtons url={shareUrl} text="Join me on Loventia!" />
    </div>
  );
};

export default Invite;
// --- REPLACE END ---
