import Link from "next/link";

export function AuthCard({
  title,
  description,
  switchPrompt,
  switchLink,
  switchHref,
  children,
}: {
  title: string;
  description: string;
  switchPrompt: string;
  switchLink: string;
  switchHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg sm:p-10">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      {children}
      <p className="mt-6 text-center text-sm text-text-secondary">
        {switchPrompt}{" "}
        <Link href={switchHref} className="font-display font-semibold text-brand-dark underline-offset-4 hover:underline">
          {switchLink}
        </Link>
      </p>
    </div>
  );
}
