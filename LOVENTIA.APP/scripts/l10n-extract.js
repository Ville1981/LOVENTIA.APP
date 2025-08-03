import fs from 'fs';
import path from 'path';
import i18nextScanner from 'i18next-scanner';

/**
 * Skripti joka etsii tekstin kääntämiseen tarkoitetut avaimet ja päivittää käännöstiedostot
 */
async function extract() {
  const inputFiles = ['src/**/*.{js,jsx}'];
  const outputPath = 'src/locales';

  i18nextScanner.run(
    { input: inputFiles },
    {},
    (err, stats) => {
      if (err) console.error(err);
      console.log('i18n extraction complete');
    }
  );
}

extract();
