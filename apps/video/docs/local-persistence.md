# Local project persistence

The alpha uses IndexedDB database `aim-video-local-projects`, version 1, with:

- `projects`: validated versioned `VideoProject` manifests and list metadata;
- `assets`: local `Blob` records keyed by project and the manifest's unique
  `localBlobKey`, then returned to the runtime by stable asset ID.

Before **Save locally** commits, every manifest asset must have either current
runtime bytes or a retained stored blob and those bytes must match the declared
MIME type, size and SHA-256. Retained records must also match the project ID,
asset ID, collision-free tuple-encoded composite key, unique local blob key and content hash in the
manifest. Signature-valid runtime files with an absent or inaccurate browser
MIME label are normalized to the detected canonical MIME before storage; their
bytes, size and SHA-256 do not change. The validated manifest and blobs are then written in one
IndexedDB transaction; an incomplete/corrupt attempted save leaves the prior
record unchanged. Save displays a locked **Saving…** state so an older snapshot
cannot overwrite edits or reopen a project after Close. Photograph, replacement,
audio and branding validation share a pending-operation lock and generation
guard; Save, Close, render and other edits remain disabled until the operation
finishes, and a stale completion cannot mutate a different/closed project. Open parses the
manifest, checks the storage key against the manifest identity, rechecks every
stored blob and record, restores only valid object URLs and separately reports missing
and corrupt assets. Delete removes the selected local manifest and its
browser-local blobs. Close clears decoded images and revokes all object URLs
held by the runtime. The header distinguishes **Saved** from **Unsaved changes**;
closing a dirty project requires confirmation, and browser navigation receives
the browser's unsaved-work warning.

Unsupported versions are rejected as `UNSUPPORTED_VERSION`; malformed records
are sanitized into safe, deletable corrupt list entries and cannot be opened;
stored envelope/manifest identity mismatches are rejected; absent blobs are returned as
`missingAssetIds` so the operator receives a visible replacement instruction.
Version `1.0.0` is the first format, so no earlier data migration exists. A
database version change closes the current connection; a blocked open returns a
controlled retry instruction instead of hanging, and a rejected open is not
cached so a later retry can succeed.

The Chrome proof creates, renames, imports 15 signature-valid synthetic PNGs
through the real multiple-file input (with deliberately inaccurate browser MIME
labels), saves, closes, reopens and deletes through the visible UI. A bounded
test-only validation delay proves Save and Close remain disabled during intake.
It compares every ordered shot's stable ID, source references,
duration and content/settings hashes across close/reopen; rejects an incomplete
save without damaging the earlier record; detects deliberately altered Blob
bytes; safely lists and deletes malformed and unsupported manifests; and ends
with zero records in both object stores.

This is explicitly labelled Local Project. There is no cloud sync, account,
server upload, database service or Hub persistence claim. Browser storage may
be cleared by the browser or operating system, so it is not a substitute for a
future Hub-owned durable workflow.
