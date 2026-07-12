const fs = require('fs');

const G = [
  "1111",
  "1000",
  "1011",
  "1221",
  "1111"
];

const R = [
  "1111",
  "1001",
  "1221",
  "1110",
  "1001"
];

const O = [
  "1111",
  "1001",
  "1221",
  "1221",
  "1111"
];

const Q = [
  "1111",
  "1001",
  "1221",
  "1221",
  "1111",
  "0011"
];

const letters = [G, R, O, Q];
const startX = 408;
const startY = 6;
const size = 6;
const advance = 30;

const COLOR_LIGHT = "#F97316";
const COLOR_DARK = "#C2410C";

let svgOutput = "";

letters.forEach((letter, index) => {
  const xOffset = startX + index * advance;
  for (let r = 0; r < letter.length; r++) {
    for (let c = 0; c < 4; c++) {
      const val = letter[r][c];
      if (val === "1") {
        svgOutput += `  <rect x="${xOffset + c * size}" y="${startY + r * size}" width="${size}" height="${size}" fill="${COLOR_LIGHT}"/>\n`;
      } else if (val === "2") {
        svgOutput += `  <rect x="${xOffset + c * size}" y="${startY + r * size}" width="${size}" height="${size}" fill="${COLOR_DARK}"/>\n`;
      }
    }
  }
});

['dark', 'light'].forEach(theme => {
  const filePath = `C:/Users/loyslow/.config/opencode/plugins/opencode-voice-groq/assets/opencode-voice-${theme}.svg`;
  // First we need to restore the original SVG, since we replaced it with <rect>s already
  let content = fs.readFileSync('C:/Users/loyslow/.config/opencode/plugins/opencode-voice-groq/original_' + theme + '.svg', 'utf8');
  content = content.replace('</svg>', svgOutput + '</svg>');
  content = content.replace('width="396"', 'width="528"').replace('viewBox="0 0 396 42"', 'viewBox="0 0 528 42"');
  fs.writeFileSync(filePath, content);
});
console.log("SVGs updated with correct pixel art");
