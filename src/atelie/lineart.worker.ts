/// <reference lib="webworker" />
import { photoToLineArt, type LineArtOptions } from "./lineart";

type Job = { id: number; data: Uint8ClampedArray; w: number; h: number; opts: LineArtOptions };

self.onmessage = (event: MessageEvent<Job>) => {
  const { id, data, w, h, opts } = event.data;
  try {
    const out = photoToLineArt(data, w, h, opts);
    (self as unknown as Worker).postMessage({ id, data: out }, [out.buffer]);
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, error: (error as Error)?.message || "falhou" });
  }
};
