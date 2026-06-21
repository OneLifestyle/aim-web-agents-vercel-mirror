# Source-Lift Pattern

Status: reusable planning pattern.

Use this pattern for each existing working web app before deciding whether to import it into `aim-web-agents`.

## Pattern

1. Identify the source location.
2. Confirm the current working state.
3. Make it run outside AI Studio or v0.
4. Move provider calls server-side when provider keys are involved.
5. Protect provider keys.
6. Add beta gate or preview protection.
7. Correct model and cost assumptions.
8. Deploy to Vercel preview if safe.
9. Tag or freeze the baseline.
10. Only then decide whether to import into `aim-web-agents`.

## Import Rule

An app should enter `aim-web-agents` only through an explicit import task.

The import task should say:

- where the source comes from;
- which frozen baseline is being imported;
- where it lands in `apps/`;
- what runtime proof is required;
- which integrations and abstractions are deliberately out of scope.

## Platform Rule

Do not build the platform ahead of the apps.

Shared packages, auth, Hub integration, provider routing, billing, databases, and production deployment work should be introduced only through explicit tasks after a real imported app proves the need.

## Security Rule

Do not commit provider keys, beta tokens, credentials, private configuration, session data, or environment files.

Provider calls that require secrets should run server-side. Preview and beta gates should protect unfinished or private work.
