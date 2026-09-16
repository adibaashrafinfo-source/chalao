import type { SiteSettings, SocialKey } from "@/lib/site-settings";

// Simplified brand marks drawn from basic shapes — recognisable at 18px and no external
// icon library needed (lucide dropped brand icons in v1).
const icons: Record<SocialKey, React.ReactNode> = {
  facebook: (
    <path
      d="M13.5 20v-6.5h2.2l.3-2.6h-2.5V9.2c0-.7.2-1.2 1.2-1.2H16V5.6c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.4v1.9H8.4v2.6h2.2V20z"
      fill="currentColor"
    />
  ),
  instagram: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="16.6" cy="7.4" r="1.1" fill="currentColor" />
    </>
  ),
  youtube: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" />
    </>
  ),
  tiktok: (
    <>
      <circle cx="9.5" cy="16.5" r="3.3" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M12.8 16.5V4.5c.6 2.2 2.2 3.6 4.4 3.8v2.4c-1.6-.1-2.9-.6-4-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  linkedin: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="8.3" cy="8.4" r="1.15" fill="currentColor" />
      <path d="M7.4 10.9h1.9v6.2H7.4z" fill="currentColor" />
      <path
        d="M11.2 17.1v-6.2h1.8v.9c.4-.6 1.1-1 2-1 1.5 0 2.4 1 2.4 2.7v3.6h-1.9v-3.3c0-.9-.4-1.4-1.1-1.4s-1.3.5-1.3 1.5v3.2z"
        fill="currentColor"
      />
    </>
  ),
  whatsapp: (
    <>
      <path
        d="M4.8 19.2l1-3.4A7 7 0 1 1 8.6 18.4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M9.6 9.3c.3-.1.6 0 .8.3l.6 1c.1.2.1.5-.1.7l-.4.4c.4.9 1 1.5 1.9 1.9l.4-.4c.2-.2.5-.2.7-.1l1 .6c.3.2.4.5.3.8-.2.6-.8 1-1.5.9-2.2-.2-4-2-4.3-4.3-.1-.7.3-1.3.9-1.5z"
        fill="currentColor"
      />
    </>
  ),
};

const labels: Record<SocialKey, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

export function SocialLinks({ settings }: { settings: SiteSettings }) {
  // Only links that have actually been filled in from the admin panel are shown.
  const entries = (Object.keys(icons) as SocialKey[])
    .map((key) => ({ key, href: settings[key] }))
    .filter((entry): entry is { key: SocialKey; href: string } => Boolean(entry.href));

  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {entries.map(({ key, href }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={labels[key]}
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-brand-lime hover:text-brand-dark"
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
              {icons[key]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
