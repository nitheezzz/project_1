import type { ReactNode } from "react";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from "@shared/legal";

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-screen">
      <article className="legal-document">
        <a className="legal-brand" href="/">
          studywithfun<span>.</span>
        </a>
        <a className="legal-back" href="/">
          ← Back to sign in
        </a>
        <header className="legal-heading">
          <span className="eyebrow">STUDYWITHFUN · POLICY {LEGAL_VERSION}</span>
          <h1>{title}</h1>
          <p>Effective {LEGAL_EFFECTIVE_DATE}</p>
        </header>
        <aside className="legal-draft-note" role="note">
          Operator details still need to be completed before this is a final
          production legal notice. The site owner must add their legal name,
          privacy contact, and governing jurisdiction.
        </aside>
        <div className="legal-copy">{children}</div>
        <footer className="legal-footer">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/">studywithfun</a>
        </footer>
      </article>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This notice describes the current studywithfun study organizer. It is a
        factual draft, not legal advice. The service operator’s legal name and a
        working privacy contact have not been supplied for this project; the
        operator must add them before relying on this notice for public or
        production use.
      </p>

      <h2>Information the service handles</h2>
      <ul>
        <li>
          Account information such as username, email address, display name,
          profile details, password hash, session/sign-in data, and recorded
          acceptance of these policies.
        </li>
        <li>
          Study content you submit: note titles and text; task titles, details,
          assignment, status, priority, due dates and times; and Study Materials
          titles, descriptions, filenames, metadata, and PDF files.
        </li>
        <li>
          Social information including friend searches/requests, accepted
          friendships, and private chat message text.
        </li>
        <li>
          Technical information needed to operate and protect the service, such
          as request and error information, timestamps, and rate-limit/security
          signals. The exact retention period for platform diagnostics is set by
          the hosting providers.
        </li>
      </ul>

      <h2>How information is used</h2>
      <p>
        Information is used to create and protect accounts, deliver email
        verification, save and display your workspace, provide friend and chat
        features, issue PDF access, operate reminders, and troubleshoot or
        protect the service. Browser notification permission and alerts are
        handled by your browser while you use the site.
      </p>

      <h2>Storage and security</h2>
      <p>
        Account and workspace records are stored in the service database; PDF
        files are stored in the service’s file storage. Passwords are stored as
        scrypt hashes, and one-time verification codes are stored as keyed
        hashes. The published site uses HTTPS for connections. These safeguards
        do not make the service end-to-end encrypted.
      </p>
      <p>
        <strong>
          studywithfun does not currently provide end-to-end encryption.
        </strong>{" "}
        Content is submitted to and processed by the service, and authorized
        service infrastructure/operators may be able to access it. Do not store
        information here that you require to remain cryptographically unreadable
        to the service operator.
      </p>

      <h2>Service providers and sharing</h2>
      <p>
        Hosting, database, durable file storage, diagnostics, and transactional
        email providers may process information as needed to operate the
        features you request. Verification email delivery is unavailable until
        the operator configures an authorized provider and verified sender.
        This draft does not assert that any provider is bound by a particular
        retention or data-location commitment; consult the providers’ notices
        and complete the operator’s vendor review before production use.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Notes and tasks can be removed through the app. Removing a PDF from the
        visible Study Materials library does not currently confirm permanent
        deletion of the underlying stored file. Chat messages and accounts do
        not have a self-service deletion flow. The service has no published
        retention schedule; records may remain in backups or provider systems.
        The operator must provide a working contact for access, correction, or
        deletion requests and state applicable retention periods.
      </p>

      <h2>Changes</h2>
      <p>
        The policy version and acceptance time are recorded when an account
        accepts the current terms and privacy notice. If a material update is
        made, the app may ask you to review and accept the updated version before
        continuing to use private workspace features.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions">
      <p>
        These Terms &amp; Conditions are a general draft for studywithfun, not
        legal advice. The service operator’s legal identity, jurisdiction, and
        contact details have not been supplied and must be completed before
        public production use.
      </p>

      <h2>Using the service</h2>
      <p>
        studywithfun provides account-based tools for study notes, tasks,
        materials, reminders, and interactions with accepted friends. You must
        provide accurate account information, keep your sign-in credentials
        private, and use only accounts you are authorized to access. You are
        responsible for activity performed through your account.
      </p>

      <h2>Your content</h2>
      <p>
        You retain the rights you have in content you submit. You authorize the
        service to store, transmit, and display that content as needed to provide
        the features you use. Do not upload or share content you do not have the
        right to use, or content that is unlawful, abusive, or harmful.
      </p>

      <h2>Privacy and security limits</h2>
      <p>
        The Privacy Policy explains the information handled by the service.
        studywithfun is not end-to-end encrypted: content is processed by the
        service and may be accessible to authorized operators. Do not rely on
        this service as a confidential vault, a backup service, or the sole copy
        of important work. Keep independent copies of important materials.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access another person’s account or content.</li>
        <li>
          Do not interfere with the service, evade its security controls, or use
          it to distribute malware, spam, or unlawful material.
        </li>
        <li>
          Respect other users in friend requests and private conversations.
        </li>
      </ul>

      <h2>Availability and changes</h2>
      <p>
        The service is provided as-is for personal study organization. Features,
        stored data, and availability may change; uninterrupted access,
        permanent retention, and error-free operation are not guaranteed. You
        should keep your own copies of important study materials.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        The operator may restrict access when needed to protect the service or
        respond to misuse. There is currently no self-service account deletion
        control; the operator must publish a contact and explain the process for
        account closure and data requests.
      </p>

      <h2>Legal terms to complete</h2>
      <p>
        Applicable law, venue, the operator’s legal identity, and any mandatory
        consumer rights depend on the service operator and the user’s location.
        Those details have not been provided and must be completed by the
        operator; this page does not invent a jurisdiction or limit rights that
        cannot legally be limited.
      </p>
    </LegalShell>
  );
}
