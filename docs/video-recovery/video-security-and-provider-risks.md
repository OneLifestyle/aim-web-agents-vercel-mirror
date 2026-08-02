# AIM Video security and provider risks

Task: `WEBVIDEO-IMPORT-001`
Review date: 2026-08-02

## Result

- Live secrets found: **No**
- Secret values displayed or copied: **No**
- Credential-like values found: **No**
- Credential-bearing configuration surfaces found: **Yes**
- Credential rotation recommended from this audit: **No**
- Security Red Gate for the bounded provider-free lift: **No**
- Public-release security gate still open: **Yes**

Searches covered committed environment files, common key/token/private-key signatures, browser-exposed provider SDK use, provider routes, upload handling, output paths, generated media, model names, dependency freshness and unsafe HTML. Only variable names and risk categories are recorded here.

## OneLifestyle risks

The OneLifestyle source creates the Google AI client in browser code from `process.env.API_KEY` and later appends that key to a provider download URL. A build-time injected value would therefore be exposed to the browser, requests, URL handling and browser tooling. That architecture must not be revived.

Other findings:

- no authentication, server boundary, quota, rate limit, cancellation, timeout or durable job;
- image media converted to base64 in the browser and submitted directly to a paid provider;
- upload handling trusts browser MIME type and has no count, size, dimension or decoded-content bounds;
- provider model/pricing constants are stale, hard-coded and not reconciled to actual billing;
- user text is embedded in provider prompts without a trustworthy policy boundary;
- download MIME, container and codec are not validated;
- object URLs are not consistently revoked;
- runtime styling depends on third-party CDN resources;
- migrated prompt history contains embedded attachments and the repository contains an unreferenced property image of unclear reuse authority;
- no licence or notice was found.

No likely live credential was found, so rotation is not indicated from this source alone. If the architecture was ever deployed with a browser-injected production key, that key should be investigated and rotated outside this repository task.

## Vision Web risks

Committed examples name browser-visible Firebase/Clerk/Stripe variables and `VITE_REPLICATE_API_TOKEN`. A populated Replicate token under a Vite prefix would be public client code and must never be used.

The separate backend is also rejected from this lift because it owns Hub-external responsibilities and has material security debt:

- auth, credits, IAP, SQLite, provider execution, upload storage and download routing are coupled together;
- a so-called signed download token is only encoded and is not cryptographically verified;
- upload validation trusts client MIME labels;
- the configured upload directory is not bounded by a Video-owned storage contract;
- wildcard CORS is combined with credentials by default;
- a mutable SQLite database is committed, although inspected tables contained zero rows;
- plain `.env` is not consistently ignored at repository scope;
- the broad dependency tree reported 23 advisories during the audit.

No live secret was found and no credential rotation is indicated from this source alone.

## Legacy provider-route risks

The legacy AI Studio UI keeps provider tokens server-side, which is directionally safer than OneLifestyle, but the CRM-hosted routes are not safe to lift:

- no authentication, authorisation, quota, rate limiting or cost guard;
- CORS defaults to wildcard and is not an authorisation mechanism;
- uploads lack count, byte-size, dimension and content-signature validation;
- base64 media is posted in large JSON requests;
- the prediction route accepts arbitrary provider input after model allowlisting;
- provider polling can hold a request for roughly ten minutes;
- no cancellation, idempotency, durable job state or output persistence;
- raw provider failures can be returned to the browser;
- user notes are interpolated into analysis prompts;
- model IDs, schemas, pricing and availability are unverified 2026 assumptions;
- an unused Photo address service would expose a browser API key if reactivated.

No tracked live credential was found. Provider integration remains deferred.

## Vision Mobile risks and lessons

The native exporter contains no provider secret path, but it has reliability and file-lifecycle concerns relevant to a future web compositor:

- unreadable images/clips may be skipped rather than failing closed;
- pixel-buffer append results are ignored;
- error reporting is generic;
- temporary-file cleanup is missing;
- generated output is `.mov`, not the required MP4;
- preview and export use different engines, so visual parity is unproven.

The normalized crop contract is a useful algorithm reference, not a security-reviewed implementation.

## Imported `apps/video` posture

The imported baseline contains:

- no environment file or environment-variable dependency;
- no provider SDK, API route or network fetch;
- no auth, Hub, wallet, credits, billing, database or storage integration;
- no sample/customer media, generated video or provider log;
- no unsafe HTML rendering;
- no enabled download/export path;
- a `.gitignore` excluding environment files, dependencies, builds, logs and generated video containers.

The first inherited Vite version was affected by high-severity development-server file-read/deny-bypass advisories. It was updated to 7.3.6. Full and production-only npm audits then reported zero advisories.

Remaining local-baseline risks:

- upload type checks trust browser MIME values;
- there are no image/audio count, size, dimension, decode or duration limits;
- object URLs are not consistently revoked until the page closes;
- all project state is volatile page memory;
- the DOM/CSS preview is not a safe basis for asserting exported media correctness;
- overlay content is React-escaped, but no later renderer contract yet defines text/font/logo sanitisation;
- source licence/authority needs explicit resolution before public distribution.

These are acceptable only for an operator-local, provider-free recovery baseline. They are acceptance requirements for `WEBVIDEO-CLIENT-ALPHA-001` before real customer media is used.

## Required future controls

The next build must include:

1. content-signature/decode validation and bounded file counts, byte sizes, dimensions and audio duration;
2. an explicit local asset lifecycle with object-URL revocation and recoverable project references;
3. renderer path allowlisting, temporary-file cleanup, cancellation and failed-export reporting;
4. codec/container validation of the produced MP4;
5. deterministic text/logo safe areas and font/media-rights metadata;
6. no provider or secret surface until a separate provider/security/cost goal approves a server-side boundary.

No credential value belongs in documentation, issue text, client code, query strings, project files or generated logs.
