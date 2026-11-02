/** Deterministic low-fire bed for the multiplier climax.
 * This deliberately avoids broadband rain/noise: the body is a warm low rumble,
 * with sparse soft puffs that read as a deep fireplace rather than a hiss.
 * No approved external fire recording is present in the repository at this time. */
export const HIGH_MULTIPLIER_FIRE_SECONDS = 8;

export function createHighMultiplierFire(context: BaseAudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(rate * HIGH_MULTIPLIER_FIRE_SECONDS), rate);
  const data = buffer.getChannelData(0);
  let seed = 0x68e3f219;
  const random = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  const lowStep = 1 - Math.exp(-2 * Math.PI * 58 / rate);
  const emberStep = 1 - Math.exp(-2 * Math.PI * 155 / rate);
  const warmthStep = 1 - Math.exp(-2 * Math.PI * 310 / rate);
  const flameStep = 1 - Math.exp(-1 / (rate * .32));
  const puffDecay = Math.exp(-1 / (rate * .095));
  let low = 0, ember = 0, warmth = 0, flame = .72, targetFlame = .72;
  let puff = 0, nextPuff = 0;
  for (let i = 0; i < data.length; i++) {
    const noise = random() * 2 - 1;
    low += lowStep * (noise - low);
    ember += emberStep * (noise - ember);
    warmth += warmthStep * (noise - warmth);
    if (i >= nextPuff) {
      puff = .72 + random() * .38;
      nextPuff = i + rate * (.24 + random() * .34);
    } else {
      puff *= puffDecay;
    }
    if (i % Math.max(1, Math.floor(rate * .18)) === 0) targetFlame = .54 + random() * .58;
    flame += flameStep * (targetFlame - flame);
    // The puffs are low-frequency energy, not a layer of bright white noise.
    const body = low * 3.7 + (ember - low) * 1.35 + (warmth - ember) * .55;
    const thump = puff * (low * 2.2 + ember * .75);
    const softCrackle = random() < .012 ? (random() * 2 - 1) * .07 : 0;
    data[i] = .72 * Math.tanh((body + thump + softCrackle) * (.72 + flame * .55));
  }
  // Return to the first sample smoothly so a long scoring sequence can loop
  // without a discontinuity or a sharp transient at the boundary.
  const tail = Math.min(data.length, Math.ceil(rate * .2)), anchor = data[0];
  for (let i = 0; i < tail; i++) {
    const t = i / Math.max(1, tail - 1), blend = t * t * (3 - 2 * t), index = data.length - tail + i;
    data[index] = data[index] * (1 - blend) + anchor * blend;
  }
  return buffer;
}
