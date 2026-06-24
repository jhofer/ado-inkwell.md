import pako from "pako";

/**
 * Encodes a single 6-bit value using the PlantUML base64 alphabet.
 * PlantUML uses a custom base64 alphabet (not the standard one) for its
 * compressed-URL encoding scheme.
 */
function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b); // '0'–'9'
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b); // 'A'–'Z'
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b); // 'a'–'z'
  b -= 26;
  if (b === 0) return "-";
  if (b === 1) return "_";
  return "?";
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return (
    encode6bit(c1 & 63) +
    encode6bit(c2 & 63) +
    encode6bit(c3 & 63) +
    encode6bit(c4 & 63)
  );
}

/**
 * Encodes a Uint8Array of compressed bytes into PlantUML's custom base64 format.
 */
function encode64(data: Uint8Array): string {
  let r = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      r += append3bytes(data[i], 0, 0);
    } else {
      r += append3bytes(data[i], data[i + 1], data[i + 2]);
    }
  }
  return r;
}

/**
 * Compresses a PlantUML diagram source string and returns the encoded form
 * suitable for embedding in a PlantUML server URL.
 */
export function encodePlantUml(text: string): string {
  const compressed = pako.deflate(text, { level: 9 });
  return encode64(compressed);
}

/**
 * Returns the public plantuml.com SVG URL for a given diagram source.
 *
 * The URL is used as the `src` of an <img> tag; <img> fetches bypass the
 * browser's CORS restriction, so no server-side proxy is needed.
 */
export function getPlantUmlSvgUrl(source: string): string {
  const normalized =
    source.trim().startsWith("@startuml")
      ? source.trim()
      : `@startuml\n${source.trim()}\n@enduml`;
  const encoded = encodePlantUml(normalized);
  return `https://www.plantuml.com/plantuml/svg/${encoded}`;
}

/**
 * Renders a PlantUML diagram source string to an SVG image URL.
 *
 * This is the callback expected by the inkwell-md `Editor` component's
 * `onRenderPlantUml` prop:
 *   `(source: string) => Promise<{ imageData: string }>`
 *
 * We return the public plantuml.com URL directly as `imageData`.
 * The Editor renders this as an <img src={imageData}>, which works for both
 * regular URLs and data-URIs.
 */
export async function renderPlantUml(
  source: string
): Promise<{ imageData: string }> {
  return { imageData: getPlantUmlSvgUrl(source) };
}
