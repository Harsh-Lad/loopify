import type { Metadata } from "next";
import { LegalShell } from "@/components/landing/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Loopify.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="October 2026">
      <section>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Loopify (the
          &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms.
        </p>
      </section>
      <section>
        <h2>1. Accounts</h2>
        <p>
          You must provide accurate information and keep your credentials secure. You are responsible for activity under
          your account. Workspace owners are responsible for the members they invite.
        </p>
      </section>
      <section>
        <h2>2. Acceptable use</h2>
        <ul>
          <li>Do not use the Service for unlawful, harmful or abusive purposes.</li>
          <li>Do not attempt to disrupt, reverse engineer or gain unauthorized access to the Service.</li>
          <li>Do not upload content you do not have the right to share.</li>
        </ul>
      </section>
      <section>
        <h2>3. Your content</h2>
        <p>
          You retain ownership of the content you put into the Service. You grant us a limited license to host, process
          and display it as needed to provide the Service, including AI features you choose to use.
        </p>
      </section>
      <section>
        <h2>4. AI features</h2>
        <p>
          AI-generated output such as task cards, summaries and answers may be inaccurate or incomplete. Review output
          before relying on it.
        </p>
      </section>
      <section>
        <h2>5. Plans and billing</h2>
        <p>
          Paid plans are billed in advance on a recurring basis until cancelled. Prices and plan features may change
          with notice. [Counsel to specify refund, tax and renewal terms.]
        </p>
      </section>
      <section>
        <h2>6. Suspension and termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access to an account or workspace that
          violates these Terms or puts the Service or other users at risk.
        </p>
      </section>
      <section>
        <h2>7. Disclaimers and liability</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent permitted by
          law, our liability is limited as described here. [Counsel to draft limitation of liability and indemnity
          clauses.]
        </p>
      </section>
      <section>
        <h2>8. Changes and contact</h2>
        <p>
          We may update these Terms and will note the date of the latest revision above. Continued use after changes
          means you accept them. Questions? Contact us at [legal contact address to be added].
        </p>
      </section>
    </LegalShell>
  );
}
