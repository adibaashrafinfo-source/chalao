import "server-only";

import { createClient } from "@/lib/db/server";

/**
 * Writes one line to the activity log.
 *
 * Only the quiet decisions go here — deleting, renaming, giving a role, taking
 * money off the books. The facts that move stock or money already have their
 * own ledgers, and copying them would make this noisy enough to ignore.
 *
 * Never throws: a failure to write the log must not undo the thing that was
 * just done successfully.
 */
export async function recordAudit(
  action: string,
  entity?: string | null,
  entityId?: string | null,
  detail?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const db = await createClient();
    await db.rpc("record_audit", {
      p_action: action,
      p_entity: entity ?? null,
      p_entity_id: entityId ?? null,
      p_detail: (detail ?? null) as never,
    });
  } catch {
    // Deliberately silent, for the reason above.
  }
}
