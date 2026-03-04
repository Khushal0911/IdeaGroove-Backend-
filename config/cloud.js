import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Generic storage for non-chat uploads (images only) ───────────────────────
const createStorage = (subFolder, allowedFormats = ["jpg", "png", "jpeg"]) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: `ideagroove/${subFolder}`,
      resource_type: "image",
      type: "upload",
      access_mode: "public",
      allowed_formats: allowedFormats,
    }),
  });

const createUpload = (subFolder, allowedFormats) =>
  multer({
    storage: createStorage(subFolder, allowedFormats),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });

// ─── Special chat storage: PDFs use resource_type "raw", images use "image" ───
// multer-storage-cloudinary ignores resource_type:"auto", so we must branch manually.
const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === "application/pdf";
    return {
      folder: "ideagroove/chats",
      // ✅ "raw" lets Cloudinary serve the PDF with a public URL (no 401)
      // ✅ "image" for jpg/png so they get image transformations
      resource_type: isPdf ? "raw" : "image",
      type: "upload",
      access_mode: "public",
      // For raw uploads Cloudinary preserves the original extension automatically
      allowed_formats: isPdf ? ["pdf"] : ["jpg", "jpeg", "png"],
    };
  },
});

export const uploadChat = multer({
  storage: chatStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and PDF files are allowed"), false);
    }
  },
});

// ─── Other upload types (unchanged) ───────────────────────────────────────────
export const uploadProfilePic = createUpload("profile_pics", [
  "jpg",
  "png",
  "jpeg",
]);
export const uploadNote = createUpload("notes", ["jpg", "png", "jpeg", "pdf"]);
export const uploadEvent = createUpload("events", ["jpg", "png", "jpeg"]);

export { cloudinary };