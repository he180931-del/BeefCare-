/** Options shared by feature-owned feed mutations. */
export type FeedCommandOptions = { key?: string }

/**
 * Creates the idempotency key for one feed command intent.
 *
 * The feature owns key creation so pages, dialogs, and API adapters cannot
 * drift into subtly different retry semantics. The scope is only a fallback
 * label for runtimes without crypto.randomUUID; it is not used as a command
 * identity by the backend.
 */
export function newFeedCommandKey(scope = 'feed-command'): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${scope}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}
