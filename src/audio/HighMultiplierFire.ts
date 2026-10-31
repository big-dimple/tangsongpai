/** Original synthetic low fire and slowly varying air, with no crackle samples
 * or gameplay RNG. The loop is cached per audio context. */
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
  const lowStep = 1 - Math.exp(-2 * Math.PI * 125 / rate);
  const airStep = 1 - Math.exp(-2 * Math.PI * 650 / rate);
  const swayStep = 1 - Math.exp(-1 / (rate * .22));
  let low = 0, air = 0, sway = .8, target = .8, nextSway = 0;
  for (let i = 0; i < data.length; i++) {
    const noise = random() * 2 - 1;
    low += lowStep * (noise - low);
    air += airStep * (noise - air);
    if (--nextSway <= 0) { target = .48 + random() * .64; nextSway = rate * (.35 + random() * .55); }
    sway += swayStep * (target - sway);
    data[i] = Math.tanh((low * 3.2 + (air - low) * 1.4) * sway);
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
