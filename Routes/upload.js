const express = require('express');
const multer = require('multer');
const { storage } = require('../config/cloudinary'); // Import the storage engine
const router = express.Router();

const upload = multer({ storage: storage });

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // req.file.path is the URL returned by Cloudinary
    // req.file.filename is the public_id
    const imageUrl = req.file.path; 
    const publicId = req.file.filename;

    // TODO: Insert into your SQL database here
    // Example: await db.query('INSERT INTO uploads (url, public_id) VALUES (?, ?)', [imageUrl, publicId]);

    res.status(200).json({ 
      success: true,
      url: imageUrl, 
      public_id: publicId 
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;