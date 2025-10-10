// File: client/src/pages/Privacy.jsx

// --- REPLACE START: simple Privacy Policy page (lightweight) ---
import React from "react";

const Privacy = () => {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-gray-700">
        We respect your privacy. This page explains what data we collect and why.
        We only collect the minimum necessary to operate the Loventia service.
      </p>

      <h2 className="mt-6 text-xl font-semibold">What we collect</h2>
      <ul className="ml-5 list-disc text-gray-700">
        <li>Account details (email, profile data you add).</li>
        <li>Technical logs (IP, user agent) to secure the service.</li>
        <li>Optional analytics (only if you consent).</li>
      </ul>

      <h2 className="mt-6 text-xl font-semibold">How we use it</h2>
      <p className="text-gray-700">
        To provide the app, fight fraud/abuse, improve features and – if consented – measure usage.
      </p>

      <h2 className="mt-6 text-xl font-semibold">Your rights</h2>
      <p className="text-gray-700">
        You can request access, correction, or deletion of your data at any time. Contact support.
      </p>

      <p className="mt-8 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
    </main>
  );
};

export default Privacy;
// --- REPLACE END ---
