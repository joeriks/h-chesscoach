import type { Account, SyncStatus } from "../../lib/ipc";

export const ALIASES_SETTING = "profile.aliases";

/** One line describing a sync's state for the Settings page. */
export function syncLabel(status: SyncStatus, accounts: Account[]): string | null {
  const name = (id: number) => accounts.find((a) => a.id === id)?.username ?? "account";
  switch (status.state) {
    case "idle":
      return null;
    case "running":
      return `Syncing ${name(status.accountId)}: ${status.phase}${
        status.fetched ? ` (${status.fetched} games)` : ""
      }…`;
    case "done":
      return `${name(status.accountId)}: ${status.inserted} new game${status.inserted === 1 ? "" : "s"}${
        status.duplicates ? `, ${status.duplicates} already known` : ""
      }${status.skipped ? `, ${status.skipped} skipped (variants)` : ""}.`;
    case "failed":
      return `${name(status.accountId)}: sync failed, ${status.error}`;
  }
}
