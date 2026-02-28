import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createStorage = (subfolder, allowedFormats = ["jpg", "png", "jpeg"]) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: `ideagroove/${subFolder}`,
      resource_type: "auto",
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

export const uploadProfilePic = createUpload("profile_pics", [
  "jpg",
  "png",
  "jpeg",
]);
export const uploadNote = createUpload("notes", ["jpg", "png", "jpeg", "pdf"]);
export const uploadEvent = createUpload("events", ["jpg", "png", "jpeg"]);
export const uploadChat = createUpload("chats", [
  "jpg",
  "png",
  "jpeg",
  "pdf",
  "mp4",
]);

export { cloudinary, storage, upload };
