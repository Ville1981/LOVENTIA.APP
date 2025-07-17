// server/config/multer.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Hakemistot profiili- ja lisäkuva-uploadseille
const PROFILES_DIR = path.join(__dirname, "../uploads/profiles");
const EXTRA_DIR = path.join(__dirname, "../uploads/extra");

// Varmistetaan, että hakemistot ovat olemassa
[PROFILES_DIR, EXTRA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  // Tallennuskansio kentän mukaan
  destination: (req, file, cb) => {
    if (file.fieldname === "profilePhoto") {
      cb(null, PROFILES_DIR);
    } else {
      cb(null, EXTRA_DIR);
    }
  },
  // Tiedostonimi (ajastettu, uniikki)
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

// Rajataan tiedostotyypit vain kuviin
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), false);
  }
};

// Rajoitetaan tiedoston maksimikoko
const limits = {
  fileSize: 10 * 1024 * 1024, // max 10 MB per file
};

// Export upload-middleware
const upload = multer({
  storage,
  fileFilter,
  limits,
});

module.exports = {
  upload,
};
