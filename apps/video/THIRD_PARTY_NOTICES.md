# Third-party notices

This application includes open-source packages installed through the pinned npm
lockfile. Package licences remain subject to their own terms.

## Runtime packages

| Package | Version | Licence | Source |
| --- | ---: | --- | --- |
| Mediabunny | 1.52.3 | MPL-2.0 | <https://github.com/Vanilagy/mediabunny> |
| React | 19.1.1 | MIT | <https://github.com/facebook/react> |
| React DOM | 19.1.1 | MIT | <https://github.com/facebook/react> |
| Lucide React | 0.555.0 | ISC | <https://github.com/lucide-icons/lucide> |
| Zod | 4.4.3 | MIT | <https://github.com/colinhacks/zod> |

## Mediabunny notice

- Package: `mediabunny@1.52.3`
- Licence: Mozilla Public License 2.0 (MPL-2.0)
- Project: <https://github.com/Vanilagy/mediabunny>
- Licence text in installed package: `node_modules/mediabunny/LICENSE`

Mediabunny package source is used unmodified. This notice does not alter or
replace the package's licence text.

## Development-only direct packages

The pinned lockfile also includes development-only TypeScript, Vite, Vitest,
Playwright, ESLint and type-definition tooling under their package licences
(primarily MIT or Apache-2.0, as recorded in package metadata). They are not
application runtime integrations.

Transitive npm package names, versions and integrity hashes are frozen in
`package-lock.json`; their installed package metadata and licence files remain
authoritative. Before distributing a standalone built artifact publicly or to
clients, generate and review the complete transitive notice/copyright bundle.
This alpha notice is not a claim that third-party fonts, music, logos,
photographs or other media have been cleared.
