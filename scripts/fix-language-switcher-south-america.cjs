// scripts/fix-language-switcher-south-america.cjs
// --- REPLACE START: patch SOUTH AMERICA items (pt-BR, es-AR, es-CO, es-MX) with flags + region labels ---
const fs = require("fs");
const path = require("path");

// Säädä tarvittaessa .tsx-versiolle:
const TARGET_FILE = path.join(__dirname, "..", "client", "src", "components", "LanguageSwitcher.jsx");

if (!fs.existsSync(TARGET_FILE)) {
  console.error("LanguageSwitcher file not found:", TARGET_FILE);
  process.exit(1);
}

const original = fs.readFileSync(TARGET_FILE, "utf8");

// Etsitään SOUTH AMERICA -lohko ja korvataan ainoastaan items-taulukko
// Regex pitää ryhmän rakenteen mutta korvaa items: [ ... ] sisällön.
// Sallitaan whitespace- ja rivinvaihtoerot.
const southAmericaLabelPattern = /label:\s*["'`]🌎\s*SOUTH\s+AMERICA["'`]/;
const itemsBlockPattern = /items\s*:\s*\[[\s\S]*?\]/;
const groupBlockPattern = new RegExp(
  // Ryhmän alku: { <whatever> label: "🌎 SOUTH AMERICA" ...
  String.raw`(\{\s*[^{}]*?${southAmericaLabelPattern.source}[^{}]*?,\s*)` + // ryhmän header osa ja pilkku
  // items-blokki, joka korvataan
  String.raw`(${itemsBlockPattern.source})` +
  // loppu: mahdollinen loppuosa ennen sulkevaa aaltosuljetta
  String.raw`(\s*[,}])`,
  "m"
);

if (!groupBlockPattern.test(original)) {
  console.error("Could not locate SOUTH AMERICA group in LanguageSwitcher.jsx. No changes made.");
  process.exit(2);
}

const newItemsBlock =
  `items: [
      { code: "pt-BR", label: "🇧🇷 Português (Brasil)" },
      { code: "es-AR", label: "🇦🇷 Español (Argentina)" },
      { code: "es-CO", label: "🇨🇴 Español (Colombia)" },
      { code: "es-MX", label: "🇲🇽 Español (México)" }
    ]`;

// Korvaa vain items-taulukon, säilytä kaiken muu ryhmän ympärillä ennallaan
const updated = original.replace(groupBlockPattern, (_m, head, _items, tail) => {
  return `${head}${newItemsBlock}${tail}`;
});

// Jos ei muutu, älä kirjoita
if (updated === original) {
  console.log("File unchanged (pattern matched but replacement produced identical content).");
  process.exit(0);
}

// Varmuuskopio
const backup = TARGET_FILE + ".bak";
fs.writeFileSync(backup, original, "utf8");
fs.writeFileSync(TARGET_FILE, updated, "utf8");

console.log("Patched SOUTH AMERICA items in:", TARGET_FILE);
console.log("Backup written to:", backup);
// --- REPLACE END ---
