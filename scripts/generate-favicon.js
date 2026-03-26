#!/usr/bin/env node

// Generates public/favicon.svg — an 8-tooth gear icon matching the app's dark theme.
// Usage: node scripts/generate-favicon.js

const cx = 32,
  cy = 32; // center of 64x64 viewBox
const outerR = 27; // tooth tip radius
const innerR = 20; // valley radius
const holeR = 9; // center hole radius
const teeth = 8;
const cornerR = 14; // background rounded-rect corner radius
const bgColor = "#161b22"; // matches --surface
const fgColor = "#2f81f7"; // matches --accent

// Each tooth produces 4 points: tooth-top pair, then valley pair.
// tooth half-angle controls the angular width of teeth and valleys.
const toothHalf = Math.PI / (teeth * 4);
const pts = [];

for (let i = 0; i < teeth; i++) {
  const base = (i * 2 * Math.PI) / teeth - Math.PI / 2;

  // Tooth top — two points at outerR
  pts.push([
    cx + outerR * Math.cos(base - toothHalf * 1.5),
    cy + outerR * Math.sin(base - toothHalf * 1.5),
  ]);
  pts.push([
    cx + outerR * Math.cos(base + toothHalf * 1.5),
    cy + outerR * Math.sin(base + toothHalf * 1.5),
  ]);

  // Valley — two points at innerR
  const valley = base + Math.PI / teeth;
  pts.push([
    cx + innerR * Math.cos(valley - toothHalf * 1.5),
    cy + innerR * Math.sin(valley - toothHalf * 1.5),
  ]);
  pts.push([
    cx + innerR * Math.cos(valley + toothHalf * 1.5),
    cy + innerR * Math.sin(valley + toothHalf * 1.5),
  ]);
}

const d =
  pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ") + " Z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${cornerR}" fill="${bgColor}"/>
  <path d="${d}" fill="${fgColor}"/>
  <circle cx="${cx}" cy="${cy}" r="${holeR}" fill="${bgColor}"/>
</svg>
`;

const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "..", "public", "favicon.svg");
fs.writeFileSync(out, svg);
console.log(`Wrote ${out}`);
