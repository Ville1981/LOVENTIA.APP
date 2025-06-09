// File: server/config/multer.js
const multer = require("multer");

// General file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Profile picture uploads
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/profiles/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const profileUpload = multer({ storage: profileStorage });

module.exports = { upload, profileUpload };
