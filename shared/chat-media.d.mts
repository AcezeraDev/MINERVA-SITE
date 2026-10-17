export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "image"; query: string; caption: string; style?: ImageStyle }
  | { type: "generate"; prompt: string; caption: string; edit: boolean };

export type ImageStyle = "icone" | "wallpaper" | "desenho" | "logo";
export const IMAGE_STYLES: ImageStyle[];
export function imageStyleFrom(text: string): ImageStyle | "";
export function normalizeImageStyle(value: string): ImageStyle | "";
export function splitImageStyle(query: string): { query: string; style: ImageStyle | "" };
export function withImageStyle(text: string, style: string): string;
export function previousGalleryStyle(history?: Array<{ role?: string; text?: string; content?: string }>): ImageStyle | "";

export function hasImageMarker(text: string): boolean;
export function stripImageMarkers(text: string): string;
export function stripPendingMarker(text: string): string;
export function splitMessageMedia(
  text: string,
  options?: { limit?: number; streaming?: boolean },
): MessageSegment[];
export function asksForImage(text: string): boolean;
export function extractSuggestions(text: string): { text: string; suggestions: string[] };
export function describeImageMarkers(text: string): string;
export function continuesGallery(text: string, history?: Array<{ role?: string; text?: string; content?: string }>): string;
export function asksToGenerateImage(text: string): boolean;
export function continuesGeneration(text: string, history?: Array<{ role?: string; text?: string; content?: string }>): string;
