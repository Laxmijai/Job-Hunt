import multer from "multer";
const storage = multer.memoryStorage();
export const singleUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return callback(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
    callback(null, true);
  },
}).single("file");
