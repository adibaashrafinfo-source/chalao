/**
 * The handful of real-world details the legal pages need.
 *
 * They live in one file because every one of them has to be replaced with the
 * registered business's own details before the site goes live — and because
 * Meta's app reviewers read these pages and check that the operator is named.
 *
 * TODO(Ashraf): replace every PLACEHOLDER below with the registered details.
 */
export const legal = {
  /** The legal entity that runs Chalao, as registered. */
  businessName: "PLACEHOLDER — registered business name",
  /** Trading name shown to users. */
  productName: "Chalao",
  /** Postal address, required on a privacy policy. */
  address: "PLACEHOLDER — street, city, postcode, Bangladesh",
  /** Where privacy and data-deletion requests arrive. A monitored inbox. */
  contactEmail: "PLACEHOLDER — support@yourdomain.com",
  /** Shown on the pages and used when a request has to be answered by a date. */
  lastUpdated: "18 September 2026",
  /** Days within which a deletion request is answered. */
  deletionDays: 30,
} as const;
