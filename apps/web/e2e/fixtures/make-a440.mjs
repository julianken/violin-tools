// make-a440.mjs — generate the committed Tuner e2e audio fixture (S18 ph6, epic
// #90). DESIGN.md / AGENTS.md win on any conflict.
//
// Chromium's `--use-file-for-fake-audio-capture` feeds a WAV file in as the fake
// microphone (replacing the default beep), so the §17 Tuner can detect a KNOWN
// pitch deterministically in the e2e. This script writes a MONO, 48 kHz, 16-bit
// PCM WAV of a pure A4 = 440 Hz sine — long enough to loop through several rAF
// frames and stabilize the smoother on A4 (the open A string), in tune.
//
// Run it from apps/web:  node e2e/fixtures/make-a440.mjs
// It is deterministic (no RNG), so re-running reproduces the byte-identical file.
// The fixture is committed so CI does not need to regenerate it; this script is
// committed alongside it so the fixture is reproducible and auditable.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SAMPLE_RATE = 48000; // §17 / ph4: the detector reads ctx.sampleRate; 48 kHz
const FREQUENCY = 440; // A4 — the open A string (§17.4), the canonical tuner check
const DURATION_S = 2; // a couple of seconds — many rAF frames to stabilize on A4
const AMPLITUDE = 0.6; // headroom below clipping; well above the §17 clarity gate

const sampleCount = SAMPLE_RATE * DURATION_S;
const bytesPerSample = 2; // 16-bit PCM
const dataSize = sampleCount * bytesPerSample;

// WAV header (44 bytes) + PCM data. Mono, 16-bit, little-endian.
const buffer = Buffer.alloc(44 + dataSize);
let offset = 0;
const writeStr = (s) => {
  buffer.write(s, offset, 'ascii');
  offset += s.length;
};
const writeU32 = (n) => {
  buffer.writeUInt32LE(n, offset);
  offset += 4;
};
const writeU16 = (n) => {
  buffer.writeUInt16LE(n, offset);
  offset += 2;
};

writeStr('RIFF');
writeU32(36 + dataSize); // chunk size
writeStr('WAVE');
writeStr('fmt ');
writeU32(16); // PCM fmt chunk size
writeU16(1); // audio format = PCM
writeU16(1); // channels = mono
writeU32(SAMPLE_RATE);
writeU32(SAMPLE_RATE * bytesPerSample); // byte rate (mono)
writeU16(bytesPerSample); // block align
writeU16(16); // bits per sample
writeStr('data');
writeU32(dataSize);

for (let i = 0; i < sampleCount; i += 1) {
  const sample = Math.sin((2 * Math.PI * FREQUENCY * i) / SAMPLE_RATE) * AMPLITUDE;
  // Clamp to the 16-bit signed range and write little-endian.
  const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
  buffer.writeInt16LE(Math.round(intSample), offset);
  offset += 2;
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), 'a440.wav');
writeFileSync(outPath, buffer);
console.log(`Wrote ${String(buffer.length)} bytes → ${outPath}`);
