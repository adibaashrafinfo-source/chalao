import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { legal } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: { absolute: `Data Deletion · ${legal.productName}` },
  description: "How to have your data deleted from Chalao, including data received from Facebook or Instagram.",
};

/**
 * Meta requires a reachable page explaining how someone can have their data
 * deleted before it will approve an app that receives page messages. This is
 * that page — the URL goes in the app's "Data Deletion Instructions" field.
 */
export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion"
      intro="How to have your information removed from Chalao, whoever you are and however it reached us."
    >
      <LegalSection heading="If you are a seller with an account">
        <p>You can delete most things yourself from inside the dashboard:</p>
        <ul>
          <li>
            <strong>A customer&apos;s record</strong> — open the customer and remove it. Orders that have already
            been placed keep their history, because a business must be able to account for what it sold.
          </li>
          <li>
            <strong>A connected page or account</strong> — Settings → Channels → Disconnect. Disconnecting stops
            new messages arriving; removing the channel deletes it.
          </li>
          <li>
            <strong>A courier connection</strong> — Settings → Couriers. The stored API keys are deleted with it.
          </li>
        </ul>
        <p>
          To delete the whole account and everything in it, email <strong>{legal.contactEmail}</strong> from the
          address the account is registered to, with the subject &ldquo;Delete my account&rdquo;. We will confirm
          and complete the deletion within {legal.deletionDays} days, apart from records we are required by law to
          keep, such as payment records.
        </p>
      </LegalSection>

      <LegalSection heading="If you messaged a business on Facebook or Instagram">
        <p>
          When a business uses {legal.productName} to answer messages sent to its page, we store those messages,
          along with the page-scoped ID the platform gives us, and the display name and profile picture it
          provides. We do not receive your email address, your phone number, your friends or anything from your
          profile beyond that.
        </p>
        <p>There are two ways to have it removed:</p>
        <ul>
          <li>
            <strong>Ask the business.</strong> They hold this conversation and can delete the connection and the
            customer record they keep about you. This is usually the fastest route.
          </li>
          <li>
            <strong>Ask us.</strong> Email <strong>{legal.contactEmail}</strong> with the subject &ldquo;Facebook
            data deletion&rdquo;. Tell us the name of the page you messaged and the name you message from, so we
            can find the right conversation. We will delete the data and confirm within {legal.deletionDays} days.
          </li>
        </ul>
        <p>
          You can also remove {legal.productName}&apos;s access from Facebook yourself, under Settings &amp;
          Privacy → Settings → Apps and Websites. That stops any further data reaching us; email us as well if you
          also want what we already hold to be deleted.
        </p>
      </LegalSection>

      <LegalSection heading="What happens after a request">
        <ul>
          <li>We confirm we received it, usually within a few working days.</li>
          <li>
            We may ask one question to be sure the request is genuine — we will never ask for a password or a
            payment PIN.
          </li>
          <li>
            We delete the data within {legal.deletionDays} days and tell you when it is done, naming anything we
            had to keep and why.
          </li>
        </ul>
        <p>
          What we keep and for how long is set out in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
