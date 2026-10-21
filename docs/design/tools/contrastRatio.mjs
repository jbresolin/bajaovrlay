// WCAG 2 contrast ratio between a text colour and a panel colour, with the panel optionally
// translucent over a backdrop (a glass panel over bright sky is its worst case). Run:
//   node docs/design/tools/contrastRatio.mjs "#ffffff" "#003b71"
//   node docs/design/tools/contrastRatio.mjs "#ffffff" "#0b1220" 0.72 "#e8eef5"
// Prints the ratio and whether it passes AA for normal text (4.5) and large text (3.0).

function parseHexColour(text) {
  const hex = text.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${text}`);
  }
  return [0, 2, 4].map((start) => Number.parseInt(full.slice(start, start + 2), 16) / 255);
}

function compositeOver(top, alpha, bottom) {
  return top.map((channel, index) => channel * alpha + bottom[index] * (1 - alpha));
}

function relativeLuminance([red, green, blue]) {
  const linear = (channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

const [textArgument, panelArgument, alphaArgument = '1', backdropArgument = '#7f7f7f'] =
  process.argv.slice(2);
if (!textArgument || !panelArgument) {
  console.error('Usage: contrastRatio.mjs <text> <panel> [panelAlpha] [backdrop]');
  process.exit(1);
}
const text = parseHexColour(textArgument);
const panelAlpha = Number(alphaArgument);
const panel = compositeOver(
  parseHexColour(panelArgument),
  panelAlpha,
  parseHexColour(backdropArgument),
);

const lighter = Math.max(relativeLuminance(text), relativeLuminance(panel));
const darker = Math.min(relativeLuminance(text), relativeLuminance(panel));
const ratio = (lighter + 0.05) / (darker + 0.05);

const verdict =
  ratio >= 4.5
    ? 'AA normal text'
    : ratio >= 3
      ? 'AA large text only (>= 24px, or >= 18.7px bold)'
      : 'FAILS AA';
console.log(`${ratio.toFixed(2)}:1 — ${verdict}`);
