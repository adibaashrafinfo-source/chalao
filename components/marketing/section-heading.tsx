import { Reveal } from "@/components/marketing/reveal";

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <span className="rounded-full bg-brand-lime-tint px-3 py-1 font-display text-xs font-semibold text-brand-dark">
        {eyebrow}
      </span>
      <h2 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">{title}</h2>
      <p className="text-pretty text-base leading-relaxed text-text-secondary">{description}</p>
    </Reveal>
  );
}
