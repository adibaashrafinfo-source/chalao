import { bn } from "./messages/bn";
import { en, type Messages } from "./messages/en";

export type Locale = "en" | "bn";
export type { Messages };

const dictionaries: Record<Locale, Messages> = { en, bn };

/** Dashboard uses "en"; marketing site uses "bn". All user-facing strings go through here. */
export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
