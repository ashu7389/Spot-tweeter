import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const ALLOWED_TYPES = new Set([...IMAGE_TYPES, ...VIDEO_TYPES]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — keep in sync with frontend check
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB — keep in sync with frontend check

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Trust the detected mimetype for the extension rather than the
    // client-supplied filename — a renamed .exe reporting a video
    // mimetype still only gets a media extension on disk.
    const safeExt = EXT_BY_MIME[file.mimetype] || "";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, unique);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    return cb(new Error("Unsupported file type. Use JPEG, PNG, GIF, WebP, MP4, MOV, or WebM."));
  }
  cb(null, true);
}

// Multer's `limits.fileSize` is a single number applied before the file
// type is known, so it can't tell images and videos apart on its own.
// We set it to the larger (video) cap here, then enforce the tighter
// image-specific cap ourselves once the mimetype is known — in the
// posts route, after upload.single() has run — using req.file.size
// and req.file.mimetype. See routes/posts.js.
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
});

export { IMAGE_TYPES, VIDEO_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES };
