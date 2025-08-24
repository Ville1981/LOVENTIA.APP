#!/usr/bin/env node
/**
 * Safe codemod: replace t("ns.key") -> t("ns:key") for known namespaces.
 * Only modifies JS/TS/JSX/TSX/MJS/CJS files under the provided root (defaults to ./src).
 */
import fs from "fs";
import path from "path";
import process from "process";

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("./src");
const EXT = new Set([".js",".jsx",".ts",".tsx",".mjs",".cjs"]);
const NAMESPACES = new Set([
  "common","profile","discover","lifestyle","navbar","footer","chat","translation"
]);

// Quick pre-check to skip files that don't contain t("ns.key")
const RE_T_DOT = new RegExp(
  String.raw`t\\(\\s*["'](?:(?:${Array.from(NAMESPACES).join("|")}))\\.[^"']+["']\\s*[,)])`
);

let changed = 0, scanned = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (EXT.has(path.extname(ent.name))) fixFile(p);
  }
}

function fixFile(p) {
  scanned++;
  let src = fs.readFileSync(p, "utf8");
  if (!RE_T_DOT.test(src)) return;

  const before = src;

  // Numeroryhmäversio (ei nimettyjä ryhmiä) — yhteensopiva kaikkialla
  // Ryhmät:
  //  1 = quote, 2 = full "ns.rest", 3 = ns, 4 = rest, 5 = tail (, tai ))
  src = src.replace(
    /t\(\s*(["'])((common|profile|discover|lifestyle|navbar|footer|chat|translation)\.([^"']+))\1\s*([,)])/g,
    (match, quote, _full, ns, rest, tail) => {
      return `t(${quote}${ns}:${rest}${quote}${tail}`;
    }
  );

  if (src !== before) {
    fs.writeFileSync(p, src, "utf8");
    changed++;
    console.log("[FIXED]", p);
  }
}

console.log("Scanning:", ROOT);
walk(ROOT);
console.log("Done. Files scanned:", scanned, "Files changed:", changed);
