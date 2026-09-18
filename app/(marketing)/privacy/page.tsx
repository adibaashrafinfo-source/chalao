import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { legal } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: { absolute: `Privacy Policy · ${legal.productName}` },
  description:
    "What Chalao collects, why, and how a seller or their customer can have it deleted.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what ${legal.productName} collects, why we collect it, who else sees it, and how to have it deleted.`}
    >
      <LegalSection heading="Who we are">
        <p>
          {legal.productName} is order management software for businesses that sell on Facebook, Instagram and
          similar channels. It is operated by <strong>{legal.businessName}</strong>, {legal.address}.
        </p>
        <p>
          Two different kinds of people appear in this policy. A <strong>seller</strong> is a business that has an
          account with us. A <strong>customer</strong> is someone who buys from that seller, or messages their
          page. We handle a customer&apos;s information on the seller&apos;s instructions — the seller decides what
          is collected and why, and we process it for them.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect from sellers">
        <ul>
          <li>
            <strong>Account details</strong> — name, email address, password (stored only as a cryptographic hash,
            never as text we can read), business name and phone number.
          </li>
          <li>
            <strong>Business data you enter</strong> — products, prices, stock, orders, customers, courier
            bookings and notes.
          </li>
          <li>
            <strong>Payment records</strong> — the transaction number you give us when you pay for a subscription
            by bKash or Nagad, the amount, and the date. We never see or store your bKash or Nagad PIN, and money
            is not taken automatically.
          </li>
          <li>
            <strong>Technical records</strong> — the IP address and browser your requests come from, and error
            logs, kept so we can keep the service running and secure.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="What we handle on a seller's behalf">
        <ul>
          <li>
            <strong>Customer records</strong> a seller enters or imports — name, phone number, delivery address,
            district and order history.
          </li>
          <li>
            <strong>Messages</strong> sent to a seller&apos;s connected page, along with the sender&apos;s
            page-scoped ID, their display name and profile picture as the platform provides them. A page-scoped ID
            identifies someone only within that one page; it is not a Facebook profile, and it does not give us
            access to anyone&apos;s account, friends, email address or phone number.
          </li>
        </ul>
        <p>
          A customer who wants their information removed should contact the seller they bought from. Sellers can
          delete customer records themselves, and we will act on a request passed to us — see{" "}
          <Link href="/data-deletion">Data deletion</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="Why we hold it">
        <ul>
          <li>To provide the service a seller signed up for: orders, inventory, couriers and messages.</li>
          <li>To confirm a subscription payment and apply the right plan limits.</li>
          <li>To keep accounts secure, investigate misuse and meet our legal obligations.</li>
          <li>To reply when someone contacts support.</li>
        </ul>
        <p>
          We do not sell personal information, we do not share it for advertising, and we do not use a
          seller&apos;s business data or their customers&apos; messages to train machine learning models for
          anyone else.
        </p>
      </LegalSection>

      <LegalSection heading="Who else sees it">
        <ul>
          <li>
            <strong>Courier companies</strong> — when a seller books a parcel, the recipient&apos;s name, phone
            number, address and cash-on-delivery amount are sent to the courier the seller chose, because the
            parcel cannot be delivered otherwise.
          </li>
          <li>
            <strong>Meta Platforms</strong> — when a seller connects a Facebook page or Instagram account,
            messages travel between us and Meta so that replies reach the person who wrote in. Meta&apos;s own
            handling of that data is governed by Meta&apos;s privacy policy.
          </li>
          <li>
            <strong>Infrastructure providers</strong> — Supabase (database and authentication) and Vercel
            (application hosting). They store and process data so that we can run the service, under contract, and
            for no purpose of their own.
          </li>
          <li>
            <strong>Authorities</strong> — only where the law requires it, and only what it requires.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How it is protected">
        <ul>
          <li>Traffic is encrypted in transit; stored data is encrypted at rest by our database provider.</li>
          <li>
            Every record belongs to exactly one organisation, and the database itself refuses to return one
            organisation&apos;s rows to another — not merely the application in front of it.
          </li>
          <li>
            Courier and channel access keys are held in an encrypted vault. They are readable only by the server,
            never by a signed-in user, and never by us through the ordinary interface.
          </li>
          <li>Messages and order history are append-only: they can be added to, but not silently rewritten.</li>
        </ul>
        <p>
          No system is perfectly secure. If a breach affects personal information we hold, we will tell affected
          sellers without undue delay and explain what happened.
        </p>
      </LegalSection>

      <LegalSection heading="How long it is kept">
        <p>
          Business data is kept while the account is open, because that is what the account is for. After an
          account is closed we delete or anonymise personal information within {legal.deletionDays} days, except
          where we must keep records for tax or legal reasons. Payment records are kept as long as the law
          requires.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <ul>
          <li>You can see and correct your own account details and business data from inside the dashboard.</li>
          <li>You can export or delete customer records yourself.</li>
          <li>
            You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete it —
            see <Link href="/data-deletion">Data deletion</Link>.
          </li>
          <li>You can disconnect a channel or a courier at any time from Settings.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          We use cookies for one thing: keeping you signed in. There are no advertising cookies, no tracking
          pixels and no third-party analytics that follow you across other websites. Clearing these cookies signs
          you out.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          {legal.productName} is business software and is not intended for anyone under 18. We do not knowingly
          collect information from children.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If this policy changes in a way that matters, we will say so in the dashboard before the change takes
          effect, and update the date at the top of this page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
