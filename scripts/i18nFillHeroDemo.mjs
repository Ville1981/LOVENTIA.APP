// --- REPLACE START: fill hero demo lines for all locales with per-language strings ---
/* eslint-disable no-console */
/* Node ESM script: fills etusivu.heroTekstit[0..2] for every language and mirrors to hero.0/1/2 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.join(ROOT, "client", "public", "locales");
const TARGET_NS = "translation"; // we write translation.json by default

// CLI flags
//   --dry-run  : do not write files, only print planned changes
//   --ns=name  : namespace file name (defaults to "translation")
const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has("--dry-run") || argv.has("-n");
const nsArg = Array.from(argv).find((a) => a.startsWith("--ns="));
const NAMESPACE = nsArg ? nsArg.split("=")[1] : TARGET_NS;

// Keep in sync with i18n init
const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur",
];

// Per-language hero lines (3 kpl / kieli)
const HERO_LINES = {
  en: [
    "Find love that lasts.",
    "Meet people who share your values.",
    "Your next match is one click away."
  ],
  fi: [
    "Löydä kestävä rakkaus.",
    "Tapaa arvojasi jakavia ihmisiä.",
    "Seuraava osuma on yhden klikkauksen päässä."
  ],
  sv: [
    "Hitta kärlek som varar.",
    "Möt människor som delar dina värderingar.",
    "Din nästa match är ett klick bort."
  ],
  de: [
    "Finde Liebe, die bleibt.",
    "Triff Menschen, die deine Werte teilen.",
    "Dein nächstes Match ist nur einen Klick entfernt."
  ],
  fr: [
    "Trouvez un amour qui dure.",
    "Rencontrez des personnes qui partagent vos valeurs.",
    "Votre prochaine rencontre est à un clic."
  ],
  es: [
    "Encuentra un amor que perdure.",
    "Conoce a personas que comparten tus valores.",
    "Tu próxima coincidencia está a un clic."
  ],
  it: [
    "Trova un amore che duri.",
    "Incontra persone che condividono i tuoi valori.",
    "Il tuo prossimo match è a un clic."
  ],
  pt: [
    "Encontre um amor que dure.",
    "Conheça pessoas que partilham os seus valores.",
    "A sua próxima combinação está a um clique."
  ],
  pl: [
    "Znajdź miłość na lata.",
    "Poznaj ludzi podzielających Twoje wartości.",
    "Twoje kolejne dopasowanie jest o jedno kliknięcie."
  ],
  ro: [
    "Găsește o iubire de durată.",
    "Cunoaște oameni care îți împărtășesc valorile.",
    "Următoarea potrivire este la un click distanță."
  ],
  tr: [
    "Uzun süren bir aşk bulun.",
    "Değerlerinizi paylaşan insanlarla tanışın.",
    "Sıradaki eşleşmeniz bir tık uzakta."
  ],
  nl: [
    "Vind liefde die blijft.",
    "Ontmoet mensen die jouw waarden delen.",
    "Je volgende match is één klik verwijderd."
  ],
  no: [
    "Finn kjærlighet som varer.",
    "Møt mennesker som deler dine verdier.",
    "Din neste match er ett klikk unna."
  ],
  da: [
    "Find kærlighed, der varer.",
    "Mød mennesker, der deler dine værdier.",
    "Dit næste match er ét klik væk."
  ],
  cs: [
    "Najděte lásku, která vydrží.",
    "Poznejte lidi, kteří sdílí vaše hodnoty.",
    "Vaše další shoda je na jedno kliknutí."
  ],
  sk: [
    "Nájdite lásku, ktorá vydrží.",
    "Stretnite ľudí, ktorí zdieľajú vaše hodnoty.",
    "Vaša ďalšia zhoda je na jedno kliknutie."
  ],
  hu: [
    "Találj tartós szerelmet.",
    "Ismerj meg embereket, akik osztják az értékeidet.",
    "A következő párod egy kattintásra van."
  ],
  et: [
    "Leia armastus, mis kestab.",
    "Kohtu inimestega, kes jagavad sinu väärtusi.",
    "Sinu järgmine sobivus on vaid kliki kaugusel."
  ],
  lt: [
    "Rask meilę, kuri trunka.",
    "Sutik žmonių, kurie dalijasi tavo vertybėmis.",
    "Kitas atitikmuo – vos vienu paspaudimu."
  ],
  lv: [
    "Atrodi mīlestību, kas ilgst.",
    "Satiec cilvēkus, kuri dalās tavās vērtībās.",
    "Tava nākamā saderība ir viena klikšķa attālumā."
  ],
  bg: [
    "Намерете любов, която остава.",
    "Запознайте се с хора, които споделят вашите ценности.",
    "Следващото ви съвпадение е на един клик."
  ],
  el: [
    "Βρείτε μια αγάπη που διαρκεί.",
    "Γνωρίστε ανθρώπους που μοιράζονται τις αξίες σας.",
    "Το επόμενο ταίρι σας απέχει ένα κλικ."
  ],
  uk: [
    "Знайдіть кохання, що триватиме.",
    "Знайомтеся з людьми, які поділяють ваші цінності.",
    "Ваше наступне співпадіння — за один клік."
  ],
  ru: [
    "Найдите любовь, которая останется.",
    "Знакомьтесь с людьми, разделяющими ваши ценности.",
    "Ваше следующее совпадение — в один клик."
  ],
  ja: [
    "長く続く愛を見つけよう。",
    "価値観を共有できる人と出会おう。",
    "次のマッチはワンクリック先に。"
  ],
  ko: [
    "오래가는 사랑을 찾아보세요.",
    "가치를 공유하는 사람들을 만나보세요.",
    "다음 매칭은 한 번의 클릭으로."
  ],
  zh: [
    "找到持久的爱。",
    "结识与您价值观相同的人。",
    "下一次匹配只需一次点击。"
  ],
  ar: [
    "اعثر على حب يدوم.",
    "قابل أشخاصًا يشاركونك القيم.",
    "تطابقك التالي على بُعد نقرة واحدة."
  ],
  he: [
    "מצאו אהבה שנשארת.",
    "הכירו אנשים שחולקים את הערכים שלכם.",
    "ההתאמה הבאה במרחק קליק אחד."
  ],
  hi: [
    "ऐसा प्यार पाएँ जो बना रहे।",
    "अपने मूल्यों को साझा करने वाले लोगों से मिलें।",
    "आपका अगला मैच सिर्फ एक क्लिक दूर है।"
  ],
  sw: [
    "Pata upendo unaodumu.",
    "Kutana na watu wanaoshirikiana na maadili yako.",
    "Mechi yako inayofuata iko umbali wa bonyeza moja."
  ],
  ur: [
    "ایسی محبت پائیں جو برقرار رہے۔",
    "ان لوگوں سے ملیے جو آپ کی قدروں کو بانٹتے ہیں۔",
    "آپ کی اگلی میچ صرف ایک کلک کی دوری پر ہے۔"
  ],
};

// ---------- utils ----------
function readJson(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`WARN: cannot read JSON ${file}: ${e.message}`);
    return fallback;
  }
}
function writeJson(file, data) {
  const out = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}
function deepSet(obj, dotKey, value) {
  const parts = dotKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    const last = i === parts.length - 1;
    if (last) cur[k] = value;
    else {
      if (typeof cur[k] !== "object" || cur[k] == null || Array.isArray(cur[k])) cur[k] = {};
      cur = cur[k];
    }
  }
}
function ensureArray3(lines, fallback) {
  if (!Array.isArray(lines) || lines.length < 3) return fallback.slice(0, 3);
  return [String(lines[0]), String(lines[1]), String(lines[2])];
}

// ---------- main ----------
(function run() {
  console.log(`📝 Fill hero lines (${DRY_RUN ? "dry-run" : "write"})`);
  console.log(`Locales root: ${LOCALES_ROOT}`);
  console.log(`Namespace   : ${NAMESPACE}.json\n`);

  let touched = 0;

  for (const lng of SUPPORTED) {
    const dir = path.join(LOCALES_ROOT, lng);
    const file = path.join(dir, `${NAMESPACE}.json`);
    const before = readJson(file, {});

    // choose language-specific lines, fall back to EN if missing
    const source = HERO_LINES[lng] || HERO_LINES.en;
    const lines = ensureArray3(source, HERO_LINES.en);

    // clone + apply both structures
    const after = JSON.parse(JSON.stringify(before));
    deepSet(after, "etusivu.heroTekstit", lines);
    // also mirror to legacy keys hero.0/1/2 for safety
    deepSet(after, "hero.0", lines[0]);
    deepSet(after, "hero.1", lines[1]);
    deepSet(after, "hero.2", lines[2]);

    const changed = JSON.stringify(before) !== JSON.stringify(after);
    if (changed) {
      touched++;
      console.log(`  [~] ${lng}/${NAMESPACE}.json  -> set etusivu.heroTekstit[3] + hero.0/1/2`);
      if (!DRY_RUN) {
        // backup once per run
        const bak = `${file}.bak`;
        if (!fs.existsSync(bak)) {
          try { fs.copyFileSync(file, bak); } catch {}
        }
        writeJson(file, after);
      }
    } else {
      console.log(`  [=] ${lng}/${NAMESPACE}.json  up-to-date`);
    }
  }

  console.log(`\n${DRY_RUN ? "Would update" : "Updated"} ${touched} file(s).`);
  if (DRY_RUN) console.log("Run again without --dry-run to write changes.");
})();

// --- REPLACE END ---
