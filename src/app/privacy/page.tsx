import type { Metadata } from "next";
import { LegalShell } from "@/components/landing/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Loopify collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="October 2026">
      <section>
        <p>
          This Privacy Policy explains how Loopify (&ldquo;Loopify&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
          uses and shares information when you use our website and the Loopify application (the &ldquo;Service&rdquo;).
        </p>
      </section>
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information</strong> such as your name, email address and password (stored hashed).
          </li>
          <li>
            <strong>Workspace content</strong> you create, including plans, task cards, boards, diary entries, summaries
            and comments.
          </li>
          <li>
            <strong>Captured content</strong> you submit for AI processing, such as pasted conversations or notes.
          </li>
          <li>
            <strong>Connected data</strong> from integrations you authorize, such as Google Sheets you choose to
            connect.
          </li>
          <li>
            <strong>Usage data</strong> such as device, browser, log and diagnostic information.
          </li>
        </ul>
      </section>
      <section>
        <h2>2. How we use information</h2>
        <ul>
          <li>To provide, maintain and improve the Service.</li>
          <li>To generate task cards, summaries and answers using AI features you invoke.</li>
          <li>To produce reports and insights for workspace members with the appropriate role.</li>
          <li>To communicate with you about your account, security and product updates.</li>
          <li>To protect the Service, prevent abuse and comply with legal obligations.</li>
        </ul>
      </section>
      <section>
        <h2>3. AI processing</h2>
        <p>
          When you use AI features, the relevant content is sent to third-party AI providers solely to produce the
          requested output. [Counsel to confirm provider terms, retention and training commitments.]
        </p>
      </section>
      <section>
        <h2>4. Sharing</h2>
        <p>
          We do not sell your personal information. We share information with service providers who help us operate the
          Service, with members of your workspace according to its settings, and when required by law.
        </p>
      </section>
      <section>
        <h2>5. Data retention</h2>
        <p>
          We keep information for as long as your account is active or as needed to provide the Service, then delete or
          anonymize it within a reasonable period. [Counsel to specify retention periods.]
        </p>
      </section>
      <section>
        <h2>6. Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, export or delete your personal
          information, and to object to or restrict certain processing. Contact us to exercise these rights.
        </p>
      </section>
      <section>
        <h2>7. Security</h2>
        <p>
          We use reasonable technical and organizational measures to protect information. No method of transmission or
          storage is completely secure.
        </p>
      </section>
      <section>
        <h2>8. Changes and contact</h2>
        <p>
          We may update this policy from time to time and will note the date of the latest revision above. Questions?
          Contact us at [privacy contact address to be added].
        </p>
      </section>
    </LegalShell>
  );
}
