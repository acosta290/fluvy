/** A path's 32-bit FNV-1a key, in base 36: how the Material icons Home Assistant draws are told apart (`MDI_GLYPHS`). */
export function pathKey(path: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
