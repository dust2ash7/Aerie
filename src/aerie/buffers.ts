const cache = new Map<string, AudioBuffer>();
const bytes = new Map<string, ArrayBuffer>();

export function getBuffer(id: string): AudioBuffer | undefined {
  return cache.get(id);
}

export function rememberBytes(id: string, data: ArrayBuffer) {
  bytes.set(id, data);
}

export function takeBytes(id: string): ArrayBuffer | undefined {
  return bytes.get(id);
}

export async function decodeAsset(ctx: BaseAudioContext, id: string, data: ArrayBuffer): Promise<AudioBuffer> {
  const copy = data.slice(0);
  bytes.set(id, copy);
  const audio = await ctx.decodeAudioData(data.slice(0));
  cache.set(id, audio);
  return audio;
}

export async function ensureBuffer(ctx: BaseAudioContext, id: string): Promise<AudioBuffer | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const raw = bytes.get(id);
  if (!raw) return null;
  try {
    const audio = await ctx.decodeAudioData(raw.slice(0));
    cache.set(id, audio);
    return audio;
  } catch {
    return null;
  }
}
