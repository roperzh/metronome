'use strict';

const fs = require('fs');
const path = require('path');

// WAV file generation utilities
function writeUInt32LE(buf, value, offset) {
  buf[offset]     = (value >>> 0)  & 0xff;
  buf[offset + 1] = (value >>> 8)  & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function writeUInt16LE(buf, value, offset) {
  buf[offset]     = (value >>> 0) & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeInt16LE(buf, value, offset) {
  // Handle negative values via two's complement
  if (value < 0) value = 0xffff + value + 1;
  buf[offset]     = (value >>> 0) & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

/**
 * Build a WAV buffer from an array of 16-bit PCM samples.
 *
 * @param {Int16Array} samples
 * @param {number} sampleRate
 * @returns {Buffer}
 */
function buildWav(samples, sampleRate) {
  const numChannels   = 1;
  const bitsPerSample = 16;
  const byteRate      = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign    = numChannels * (bitsPerSample / 8);
  const dataSize      = samples.length * blockAlign;
  const headerSize    = 44;
  const buf           = Buffer.alloc(headerSize + dataSize);

  // RIFF chunk
  buf.write('RIFF', 0, 'ascii');
  writeUInt32LE(buf, headerSize - 8 + dataSize, 4); // ChunkSize
  buf.write('WAVE', 8, 'ascii');

  // fmt sub-chunk
  buf.write('fmt ', 12, 'ascii');
  writeUInt32LE(buf, 16, 16);             // Subchunk1Size (PCM)
  writeUInt16LE(buf, 1, 20);             // AudioFormat   (PCM = 1)
  writeUInt16LE(buf, numChannels, 22);
  writeUInt32LE(buf, sampleRate, 24);
  writeUInt32LE(buf, byteRate, 28);
  writeUInt16LE(buf, blockAlign, 32);
  writeUInt16LE(buf, bitsPerSample, 34);

  // data sub-chunk
  buf.write('data', 36, 'ascii');
  writeUInt32LE(buf, dataSize, 40);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    writeInt16LE(buf, samples[i], 44 + i * 2);
  }

  return buf;
}

/**
 * Generate a sine-burst click with exponential decay.
 *
 * @param {object} opts
 * @param {number} opts.sampleRate   - samples per second (default 44100)
 * @param {number} opts.durationMs   - total duration in milliseconds (default 50)
 * @param {number} opts.frequency    - sine frequency in Hz
 * @param {number} opts.amplitude    - peak amplitude 0–1
 * @param {number} opts.decayRate    - exponential decay constant (higher = faster decay)
 * @returns {Int16Array}
 */
function generateClick({ sampleRate = 44100, durationMs = 50, frequency, amplitude, decayRate }) {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const samples    = new Int16Array(numSamples);
  const maxInt16   = 32767;

  for (let i = 0; i < numSamples; i++) {
    const t       = i / sampleRate;
    const envelope = Math.exp(-decayRate * t);
    const sine     = Math.sin(2 * Math.PI * frequency * t);
    samples[i]    = Math.round(amplitude * maxInt16 * envelope * sine);
  }

  return samples;
}

// --- Configuration -----------------------------------------------------------

const SAMPLE_RATE = 44100;
const DURATION_MS = 50;

// Regular click: moderate pitch, moderate amplitude, fast decay
const clickSamples = generateClick({
  sampleRate: SAMPLE_RATE,
  durationMs: DURATION_MS,
  frequency:  1000,   // Hz  – crisp tick
  amplitude:  0.7,
  decayRate:  80,     // envelope falls to ~1% by ~57 ms
});

// Accent click: slightly higher pitch, full amplitude, same fast decay
const accentSamples = generateClick({
  sampleRate: SAMPLE_RATE,
  durationMs: DURATION_MS,
  frequency:  1200,   // Hz  – slightly brighter
  amplitude:  1.0,    // louder / more prominent
  decayRate:  80,
});

// Subdivision click: shorter, quieter, lower pitch – clearly distinct from beat clicks
const subSamples = generateClick({
  sampleRate: SAMPLE_RATE,
  durationMs: 30,     // shorter burst (~30 ms)
  frequency:  800,    // Hz  – lower pitch, less prominent
  amplitude:  0.4,    // softer
  decayRate:  80,
});

// --- Write files -------------------------------------------------------------

const assetsDir = path.join(__dirname, '..', 'assets');

const clickPath  = path.join(assetsDir, 'click.wav');
const accentPath = path.join(assetsDir, 'click-accent.wav');
const subPath    = path.join(assetsDir, 'click-sub.wav');

fs.writeFileSync(clickPath,  buildWav(clickSamples,  SAMPLE_RATE));
fs.writeFileSync(accentPath, buildWav(accentSamples, SAMPLE_RATE));
fs.writeFileSync(subPath,    buildWav(subSamples,    SAMPLE_RATE));

console.log(`Created: ${clickPath}`);
console.log(`Created: ${accentPath}`);
console.log(`Created: ${subPath}`);
console.log('Done.');
