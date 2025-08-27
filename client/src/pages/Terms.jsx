import React from "react";

/**
 * Terms & Conditions Page
 * - Placeholder version with basic sections
 * - Replace with legal text later
 */
const Terms = () => (
  <div className="p-6 max-w-4xl mx-auto">
    <h1 className="text-2xl font-bold mb-6">Terms & Conditions</h1>

    <p className="mb-4">
      Welcome to Loventia. By using our platform, you agree to the following
      terms and conditions. Please read carefully.
    </p>

    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">1. Eligibility</h2>
        <p>
          You must be at least 18 years old to use Loventia. By registering, you
          confirm that you meet this requirement.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. User Conduct</h2>
        <p>
          You agree to use the platform responsibly, respect other users, and
          not engage in harassment, scams, or illegal activities.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Content</h2>
        <p>
          Users are responsible for the content they share. Loventia reserves
          the right to remove inappropriate content without notice.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Privacy</h2>
        <p>
          Your personal data will be handled according to our{" "}
          <a href="/privacy" className="text-blue-400 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Termination</h2>
        <p>
          Loventia may suspend or terminate your account if you violate these
          terms or engage in harmful behavior.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Liability</h2>
        <p>
          Loventia provides its services "as is" and is not liable for damages,
          losses, or disputes arising from the use of the platform.
        </p>
      </section>
    </div>

    <p className="mt-6 text-sm text-gray-300">
      This is a placeholder version of the Terms & Conditions. The full legal
      text will be provided later.
    </p>
  </div>
);

export default Terms;
