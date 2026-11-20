export function crc32(bytes: Uint8Array): number;
export function makeZip(files: { path: string; content: string | Uint8Array }[], date?: Date): Uint8Array<ArrayBuffer>;
