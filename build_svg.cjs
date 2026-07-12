const fs = require('fs');

const G = [
  "1111",
  "1000",
  "1000",
  "1011",
  "1001",
  "1111"
];

const R = [
  "1110",
  "1001",
  "1110",
  "1010",
  "1001",
  "1001"
];

const O = [
  "1111",
  "1001",
  "1001",
  "1001",
  "1001",
  "1111"
];

const Q = [
  "1111",
  "1001",
  "1001",
  "1001",
  "1111",
  "0011"
];

const letters = [G, R, O, Q];
const startX = 408;
const startY = 6;
const size = 6;
const advance = 30;
const color = "#F97316";

let svgOutput = "";

letters.forEach((letter, index) => {
  const xOffset = startX + index * advance;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (letter[r][c] === "1") {
        svgOutput += `  <rect x="${xOffset + c * size}" y="${startY + r * size}" width="${size}" height="${size}" fill="${color}"/>\n`;
      }
    }
  }
});

['dark', 'light'].forEach(theme => {
  const filePath = `C:/Users/loyslow/.config/opencode/plugins/opencode-voice-groq/assets/opencode-voice-${theme}.svg`;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/<text.*<\/text>/, svgOutput.trim());
  content = content.replace('width="490"', 'width="530"').replace('viewBox="0 0 490 42"', 'viewBox="0 0 530 42"');
  fs.writeFileSync(filePath, content);
});
console.log("SVGs updated");
