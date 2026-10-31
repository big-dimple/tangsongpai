/** A short, original synthetic fire: turbulent low air and irregular sparks.
 * No recording or gameplay RNG is used. Cache the resulting buffer per context. */
export const HIGH_MULTIPLIER_FIRE_SECONDS = 1.7;

export function createHighMultiplierFire(context: BaseAudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(rate * HIGH_MULTIPLIER_FIRE_SECONDS), rate);
  const data = buffer.getChannelData(0);
  let seed = 0x68e3f219;
  const random = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  const lowStep = 1 - Math.exp(-2 * Math.PI * 155 / rate);
  const airStep = 1 - Math.exp(-2 * Math.PI * 2100 / rate);
  const swayStep = 1 - Math.exp(-1 / (rate * .035));
  const sparkDecay = Math.exp(-1 / (rate * .006));
  let low = 0, air = 0, sway = .8, target = .8, nextSway = 0, spark = 0;
  for (let i = 0; i < data.length; i++) {
    const noise = random() * 2 - 1;
    low += lowStep * (noise - low);
    air += airStep * (noise - air);
    if (--nextSway <= 0) { target = .5 + random() * .65; nextSway = rate * (.03 + random() * .09); }
    sway += swayStep * (target - sway);
    spark *= sparkDecay;
    if (random() < 25 / rate) spark = Math.min(1, spark + .3 + random() * .7);
    // Soft saturation keeps rare coincident sparks bounded before the mix bus.
    data[i] = Math.tanh((low * 2.5 + (air - low) * .8) * sway + (noise - air) * spark * .6);
  }
  return buffer;
}
