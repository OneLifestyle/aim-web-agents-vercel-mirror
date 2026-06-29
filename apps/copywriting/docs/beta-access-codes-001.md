# WEBAGENTS-COPYWRITING-BETA-CODES-001

## Scope

Add support for multiple private beta access codes in the Copywriting Web app without adding real authentication, accounts, Hub integration, tenant logging, billing, storage, or provider routing changes.

## Environment Variables

`BETA_ACCESS_CODE` remains supported as the existing primary beta access code.

`BETA_ACCESS_CODES` is now supported as an optional secondary list for additional private beta access codes. Values may be separated with commas, semicolons, new lines, or whitespace. Empty values are ignored. Matching is exact after trimming and remains case-sensitive.

Tester-specific beta codes should be stored only in deployment environment variables, such as Vercel project environment variables. Do not commit beta access code values to the repository, docs, examples, screenshots, logs, or issue text.

The Kevin beta code should be added in Vercel as an environment variable value, not committed.

Changing Vercel environment variables may require a redeploy before the new values are active.

## Security Notes

This beta gate is not real user authentication. It does not create user accounts, sessions tied to named users, durable tenant logging, usage ledgers, per-user quotas, or Hub workspace state.

The app still has no Clerk integration, no authentication provider, no user account system, and no tenant-level audit trail. It is suitable only as a controlled private-beta gate for trusted testers.

The server validates submitted beta access values. Valid beta access code values are not returned to the client by the API and should not be logged.

## Behaviour Preserved

If no beta access environment variables are configured, the existing local-development behaviour remains: the API allows access without requiring a beta code.

If `BETA_ACCESS_CODE` is configured, the existing single-code behaviour remains valid.

If `BETA_ACCESS_CODES` is also configured, the beta gate accepts any configured value from either variable.
