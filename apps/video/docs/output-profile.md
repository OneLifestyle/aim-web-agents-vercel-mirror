# Client-alpha output profile

Profile ID: `client-alpha-1080p-v1`

| Setting | Value |
| --- | --- |
| Container | MP4 |
| Canvas | 1920 × 1080 |
| Aspect ratio | 16:9 |
| Frame rate | 30 fps |
| Video codec | H.264/AVC |
| Audio codec | AAC-LC, stereo, 48 kHz |
| Pixel format | YUV 4:2:0 (`yuv420p`) |
| Video target | Variable bitrate, 6 Mbps target |
| Audio target | 192 kbps target |
| Action-safe inset | 3.5% on every edge |
| Title-safe inset | 5% on every edge |
| Expected photographic size | 15–60 MB per minute |
| Filename | `{project-slug}-{variant}-client-alpha-1080p-v1.mp4` |

The measured low-detail synthetic fixtures are approximately 19–20 MB per
minute. The wider range is a planning bound, not a minimum or maximum enforced
by the browser encoder; photographic complexity and browser implementation
affect actual size.

The profile declares `yuv420p`. Chrome's AVC encoder produced High Profile
`avc1.640028`, BT.709 limited-range output in the proof. The browser inspection
API and independent ISO-BMFF atom parser do not expose a direct decoded pixel-
format name, so the evidence does not overstate an independent pixel-format
measurement.

The unbranded variant omits logos, watermarks and contact details and uses a
neutral closing frame. It also omits the branded artist metadata tag; the
fixture scans the completed MP4 for the product-brand string. It is a portal-safe candidate only. This profile is not
a certification against every portal's current policy. The branded variant may
include a logo, watermark and agent/agency end card for direct marketing,
agency sites, YouTube and vendor review.
