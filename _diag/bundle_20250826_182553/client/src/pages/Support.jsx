import React from "react";

/**
 * Support Page (FAQ style)
 * - Provides answers to common issues.
 * - No direct contact information included.
 * - "Report" option references removed (not implemented).
 */
const Support = () => (
  <div className="p-6 max-w-3xl mx-auto">
    <h1 className="text-2xl font-bold mb-6">Support - Frequently Asked Questions</h1>

    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">I forgot my password. What should I do?</h2>
        <p>
          Go to the login page and select <strong>Forgot Password</strong>.
          Enter your email address and follow the instructions to reset your password.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">How can I update my profile information?</h2>
        <p>
          Navigate to your <strong>Profile</strong> page and select <em>Edit Profile</em>.
          From there, you can update your details, photos, and preferences.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Why can’t I see my matches?</h2>
        <p>
          Matches only appear when both users have shown mutual interest. 
          Make sure your profile is complete and that you are actively
          engaging with other users to increase your chances of matching.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">How do I hide or unhide my profile?</h2>
        <p>
          Go to <strong>Settings</strong> and toggle the visibility option. 
          You can hide your profile temporarily or make it visible again at any time.
        </p>
      </div>
    </div>
  </div>
);

export default Support;
