# Local media limits and validation

## Property photographs

- 15 photographs are required for complete export; maximum 30.
- JPEG, PNG and WebP are supported.
- Actual magic bytes are checked; the browser MIME label is not trusted.
- Maximum 25 MiB per photograph and 500 MiB total image input.
- The total bound also applies before a replacement is appended.
- Minimum decoded size 640 × 360.
- Maximum decoded edge 16,000 pixels and maximum 80 megapixels.
- PNG, JPEG and WebP header dimensions are read from at most 512 KiB before a
  full bitmap decode, allowing declared oversize images to be rejected first.
- Zero-byte, unsupported-signature, corrupt, oversized, undersized and duplicate
  files receive file-specific operator errors.

## Audio

- WAV, MP3 and M4A are supported and signature-checked.
- Maximum 100 MiB and 30 minutes per track.
- The file must decode to a finite positive duration.
- One music and one voiceover track are supported.

## Logo and watermark

- JPEG, PNG and WebP are supported and signature-checked.
- Maximum 10 MiB, 8,000 pixels on either edge and 32 megapixels.

All decoding and hashing happens locally. No selected media is uploaded. The
runtime replaces/revokes object URLs when a stable runtime asset is replaced,
when **Clear unused media** removes an orphaned source, and on project close or
project switch. Replacing/removing a storyboard shot deliberately retains the
old source as unused until that explicit cleanup action. Generated MP4 proof
files and browser reports are gitignored.
