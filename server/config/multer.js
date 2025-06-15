// server/config/multer.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Hakemisto profiilikuva- ja lisäkuva-uploadseille
const UPLOAD_DIR = path.join(__dirname, "../uploads/profiles");

// Varmistetaan, että hakemisto on olemassa
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  // Tallennuskansio
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
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
    cb(new Error("Only image files are allowed!"), false);
  }
};

const limits = {
  fileSize: 5 * 1024 * 1024, // max 5MB per file
};

// ProfileUpload for both avatar and extra photos
const profileUpload = multer({
  storage,
  fileFilter,
  limits,
});

// Export both named properties for backward compatibility
module.exports = {
  profileUpload,
  upload: profileUpload
};
