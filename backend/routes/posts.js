import { Router } from "express";
import mongoose from "mongoose";
import Post from "../Model/Post.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { upload, IMAGE_TYPES, VIDEO_TYPES, MAX_IMAGE_BYTES } from "../config/upload.js";

const router = Router();
const PAGE_SIZE = 20;

// GET /api/posts?cursor=<postId>  — cursor-paginated, newest first.
// Cursor pagination (not page numbers) so new posts arriving while you
// scroll don't shift items and cause duplicates/skips.
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { cursor } = req.query;
    const query = { parentPost: null };

    if (cursor) {
      if (!mongoose.isValidObjectId(cursor)) {
        return res.status(400).json({ error: "Invalid cursor" });
      }
      const cursorPost = await Post.findById(cursor).select("createdAt");
      if (cursorPost) {
        query.createdAt = { $lt: cursorPost.createdAt };
      }
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .populate("author", "handle displayName avatarUrl");

    const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1]._id : null;

    res.json({
      posts: posts.map((p) => ({
        ...p.toJSON(),
        likedByMe: req.userId ? p.likes.some((id) => id.toString() === req.userId) : false,
      })),
      nextCursor,
    });
  } catch (err) {
    console.error("Feed fetch error:", err);
    res.status(500).json({ error: "Could not load feed" });
  }
});

// POST /api/posts — create a post, optionally with one image.
router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const { text } = req.body;
    const trimmed = (text || "").trim();

    if (!trimmed && !req.file) {
      return res.status(400).json({ error: "Post needs text or an image" });
    }
    if (trimmed.length > 280) {
      return res.status(400).json({ error: "Post exceeds 280 characters" });
    }

    // multer's fileFilter already rejected anything outside the allowed
    // image/video mimetypes, and its `limits.fileSize` already capped the
    // upload at the video-sized limit — but that single limit can't tell
    // images and videos apart. Enforce the tighter image-specific cap here,
    // now that we know which one we're dealing with.
    let mediaType = "";
    if (req.file) {
      if (IMAGE_TYPES.has(req.file.mimetype)) {
        mediaType = "image";
        if (req.file.size > MAX_IMAGE_BYTES) {
          return res.status(413).json({ error: "Images must be under 5MB" });
        }
      } else if (VIDEO_TYPES.has(req.file.mimetype)) {
        mediaType = "video";
      }
    }

    const post = await Post.create({
      author: req.userId,
      text: trimmed,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : "",
      mediaType,
    });

    const populated = await post.populate("author", "handle displayName avatarUrl");
    res.status(201).json(populated);
  } catch (err) {
    if (err.message?.includes("Unsupported file type")) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Post create error:", err);
    res.status(500).json({ error: "Could not create post" });
  }
});

// POST /api/posts/:id/like — toggle like. Atomic update, no read-modify-write
// race: two simultaneous likes from the same user can't double-count, and
// $addToSet/$pull are each a single atomic op.
router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const post = await Post.findById(id).select("likes");
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const alreadyLiked = post.likes.some((uid) => uid.toString() === req.userId);
    const update = alreadyLiked
      ? { $pull: { likes: req.userId } }
      : { $addToSet: { likes: req.userId } };

    const updated = await Post.findByIdAndUpdate(id, update, { new: true });
    res.json({ likeCount: updated.likes.length, likedByMe: !alreadyLiked });
  } catch (err) {
    console.error("Like toggle error:", err);
    res.status(500).json({ error: "Could not update like" });
  }
});

// DELETE /api/posts/:id — only the author may delete their own post.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const post = await Post.findById(id).select("author");
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    await Post.deleteOne({ _id: id });
    res.status(204).end();
  } catch (err) {
    console.error("Post delete error:", err);
    res.status(500).json({ error: "Could not delete post" });
  }
});

export default router;
