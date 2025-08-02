// server/config/upload.js

const multer = require('multer');
const path = require('path');

// Configure storage: files first land in a temp uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

// Filter allowed file types, now including GIF for bypass scenarios
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, GIF) are allowed'));
  }
};

// Export configured multer instance
const upload = multer({ storage, fileFilter });

module.exports = upload;
