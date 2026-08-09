# Audio and media rights

Every `MediaAsset` must record:

- source;
- owner;
- licence or permission;
- permitted use.

The operator must enter the actual source, rights owner and licence/permission
basis or reference, then confirm authorisation before adding photographs. A
separate production-media record gates music, voiceover, logos and watermarks.
The manifest records those supplied details, the permitted client-video use and
a separate confirmation timestamp. Generic placeholder records do not pass
export preflight. This is an audit aid, not a substitute for retaining the
underlying licence or client permission.

The automated fixtures use only locally drawn synthetic images, a locally
synthesised music WAV and deterministic speech/silence WAV fixtures. Their rights record says self-created test media and
limits use to internal deterministic renderer verification. No customer media
or commercial music is bundled or used in tests.

The audio production path supports one looping music track, one optional
voiceover, independent volume, fade in/out and a 28% music gain while speech is
detected when reduction is enabled. The local detector analyses 30 ms PCM RMS
windows, estimates thresholds from the track, uses hysteresis, rejects brief
spikes and holds across pauses shorter than 0.8 s. Music ducks over 0.18 s and
recovers over 0.65 s. These are alpha assumptions for relatively clean spoken
voiceover, not studio-grade VAD.

The derived `energy-rms-v1` envelope contains only the source asset ID/hash,
analysis parameters and active time ranges. It is safe to recalculate, does not
retain raw PCM, does not recognize words or speakers and never sends audio to a
provider. Replacing or removing voiceover invalidates it; music replacement,
volume and ducking toggles do not. Preview and export share the same envelope
and gain calculation; export schedules the same attack/activity/release knots.

Common founder/company control of OneLifestyle and Singularealty does not clear
third-party packages, fonts, music, logos, photographs or other external media.
Each still requires its applicable licence or permission. This record is not
legal advice.
