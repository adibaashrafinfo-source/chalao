import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/marketing/legal-page";
import { legal } from "@/lib/marketing/legal";

export const metadata: Metadata = {
  title: { absolute: `Terms of Service · ${legal.productName}` },
  description: "The agreement between a seller and Chalao: plans, payment, acceptable use and liability.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms are the agreement between you and ${legal.businessName} for the use of ${legal.productName}. Using the service means you accept them.`}
    >
      <LegalSection heading="The service">
        <p>
          {legal.productName} helps a business manage orders from first message to delivery: products and stock,
          customers, orders, courier bookings, cash on delivery, and messages from connected channels. We provide
          it as software; we do not sell your products, deliver your parcels or collect your money.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <ul>
          <li>You must be at least 18 and able to enter a contract.</li>
          <li>The details you give us must be accurate, and you must keep them up to date.</li>
          <li>
            You are responsible for everything done with your account, so keep your password to yourself. Tell us
            promptly if you think someone else has it.
          </li>
          <li>
            If you invite colleagues, you are responsible for what they do in your organisation&apos;s account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Plans and payment">
        <ul>
          <li>
            Plans and their limits are shown on the <Link href="/#pricing">pricing section</Link>. Limits are
            enforced by the software.
          </li>
          <li>
            Payment is manual. You send the amount by bKash or Nagad to the number shown on your billing page and
            submit the transaction number. Nothing is charged automatically, and we hold no card details.
          </li>
          <li>
            A subscription starts when we confirm the payment, and runs for the number of months paid for. There
            is a short grace period after a period ends, after which paid features stop until the next payment is
            confirmed. Your data is not deleted during this time.
          </li>
          <li>
            <strong>PLACEHOLDER — refund policy.</strong> State plainly whether payments are refundable, and
            within what period.
          </li>
          <li>Prices may change. We will give notice before a change affects a period you have already paid for.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Your data and your customers">
        <ul>
          <li>Your business data stays yours. We do not sell it and we do not use it to compete with you.</li>
          <li>
            You are responsible for the personal information of your customers that you put into the service —
            for having a reason to hold it, for what you send them, and for answering them when they ask about it.
          </li>
          <li>
            We handle that information on your instructions, as described in the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Connected channels and couriers">
        <ul>
          <li>
            Connecting a Facebook page, an Instagram account or a courier means you have the authority to do so,
            and that you will follow that provider&apos;s own rules. Meta&apos;s messaging policies apply to every
            message sent through a connected page, including automated ones.
          </li>
          <li>
            Those providers are independent of us. We are not responsible for a courier losing a parcel, a
            platform suspending a page, an API changing, or a provider being unavailable.
          </li>
          <li>
            Where a reply is generated automatically, you remain responsible for it, exactly as you would be for a
            message typed by a member of your staff.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>You may not use {legal.productName} to:</p>
        <ul>
          <li>sell anything unlawful, counterfeit, or prohibited by the platforms you connect;</li>
          <li>send unsolicited bulk messages, or contact people who have not asked to hear from you;</li>
          <li>upload someone else&apos;s personal information without a lawful reason to hold it;</li>
          <li>attempt to reach another organisation&apos;s data, break the service, or get around its limits;</li>
          <li>resell or rebrand the service without our written agreement.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Availability">
        <p>
          We work to keep the service running, but we do not promise it will be uninterrupted or error-free.
          Maintenance, provider outages and things outside our control can interrupt it. The service is provided
          as it is, without warranties beyond those the law does not allow us to exclude.
        </p>
      </LegalSection>

      <LegalSection heading="Liability">
        <p>
          To the extent the law allows, neither party is liable for indirect or consequential loss, including lost
          profit or lost data. Our total liability for any claim is limited to the amount you paid us in the three
          months before the claim arose. Nothing here limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection heading="Suspension and ending the agreement">
        <ul>
          <li>You may stop using the service and close your account at any time.</li>
          <li>
            We may suspend or close an account that breaks these terms, does not pay, or puts the service or other
            users at risk. Where it is reasonable to do so, we will warn you first.
          </li>
          <li>
            After an account closes you can ask for an export of your data for {legal.deletionDays} days, after
            which it is deleted as described in the <Link href="/privacy">Privacy Policy</Link>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Changes and governing law">
        <p>
          We may update these terms. Material changes will be announced in the dashboard before they take effect,
          and the date at the top of this page will change. These terms are governed by the laws of Bangladesh,
          and the courts of Bangladesh have jurisdiction.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
