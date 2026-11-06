<!-- codex-review -->
_Codex review — `gpt-6.1-sol`, effort `xhigh`._

## Required Changes

🔴 **[blocking] Mask private numbers**

**Location:** `src/a.ts:1`

The FAQ text still exposes the number.

🔴 **[blocking] Cancel the previous step**

**Location:** `src/b.ts:2`

The callback runs before the cancellation.

## Verdict

**[x] 🔄 Request Changes** — Address both findings before merging.
