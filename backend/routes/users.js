import { Router } from "express";
import mongoose from "mongoose";
import User from "../Model/User.js";
import Post from "../Model/Post.js";
import Recommendation from "../Model/Recommendation.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { upload, IMAGE_TYPES, MAX_IMAGE_BYTES } from "../config/upload.js";

const router = Router();
const POSTS_PAGE_SIZE = 20;
const GALLERY_LIMIT = 12; // how many photos/videos to show on the profile
const MAX_LIST_ITEMS = { workDone: 30, currentProjects: 20 };
const MAX_LIST_ITEM_LENGTH = 140;

// Turns a newline-separated textarea value (what the edit form sends) into
// a clean array: trims each line, drops blanks, enforces the same caps the
// schema validates, so a bad request fails fast with a clear message
// instead of a generic Mongoose ValidationError.
function parseListField(raw, fieldName) {
  const lines = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length > MAX_LIST_ITEMS[fieldName]) {
    throw new Error(`Too many ${fieldName} entries (max ${MAX_LIST_ITEMS[fieldName]})`);
  }
  const tooLong = lines.find((s) => s.length > MAX_LIST_ITEM_LENGTH);
  if (tooLong) {
    throw new Error(`Each ${fieldName} entry must be ${MAX_LIST_ITEM_LENGTH} characters or fewer`);
  }
  return lines;
}

// GET /api/users/:handle — public profile: bio fields, work/project lists,
// a photo/video gallery, recommendations, and paginated posts.
// optionalAuth so a logged-in viewer sees "likedByMe" on this user's
// posts too, without requiring auth to view a profile at all.
router.get("/:handle", optionalAuth, async (req, res) => {
  try {
    const handle = req.params.handle.trim().toLowerCase();
    const user = await User.findOne({ handle });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { cursor } = req.query;
    const query = { author: user._id, parentPost: null };
    if (cursor) {
      if (!mongoose.isValidObjectId(cursor)) {
        return res.status(400).json({ error: "Invalid cursor" });
      }
      const cursorPost = await Post.findById(cursor).select("createdAt");
      if (cursorPost) query.createdAt = { $lt: cursorPost.createdAt };
    }

    const [posts, postCount, photos, videos, recommendations] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .limit(POSTS_PAGE_SIZE)
        .populate("author", "handle displayName avatarUrl"),
      cursor ? Promise.resolve(null) : Post.countDocuments({ author: user._id, parentPost: null }),
      // Photos/videos gallery is sourced from this user's own posts —
      // there's no separate media-upload flow, so "Photographs"/"Videos"
      // on the profile just filters posts that carry that media type.
      cursor
        ? Promise.resolve(null)
        : Post.find({ author: user._id, mediaType: "image" })
            .sort({ createdAt: -1 })
            .limit(GALLERY_LIMIT)
            .select("imageUrl createdAt"),
      cursor
        ? Promise.resolve(null)
        : Post.find({ author: user._id, mediaType: "video" })
            .sort({ createdAt: -1 })
            .limit(GALLERY_LIMIT)
            .select("imageUrl createdAt"),
      cursor
        ? Promise.resolve(null)
        : Recommendation.find({ targetUser: user._id })
            .sort({ createdAt: -1 })
            .populate("author", "handle displayName avatarUrl"),
    ]);

    const nextCursor = posts.length === POSTS_PAGE_SIZE ? posts[posts.length - 1]._id : null;

    res.json({
      user,
      postCount: postCount ?? undefined,
      photos: photos ?? undefined,
      videos: videos ?? undefined,
      recommendations: recommendations ?? undefined,
      posts: posts.map((p) => ({
        ...p.toJSON(),
        likedByMe: req.userId ? p.likes.some((id) => id.toString() === req.userId) : false,
      })),
      nextCursor,
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Could not load profile" });
  }
});

// PATCH /api/users/me — update the logged-in user's own profile fields
// and/or avatar image. All fields optional; only what's sent changes.
router.patch("/me", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    const updates = {};

    if (req.body.displayName !== undefined) {
      const displayName = req.body.displayName.trim();
      if (!displayName) {
        return res.status(400).json({ error: "Display name can't be empty" });
      }
      if (displayName.length > 50) {
        return res.status(400).json({ error: "Display name is too long" });
      }
      updates.displayName = displayName;
    }

    if (req.body.bio !== undefined) {
      const bio = req.body.bio.trim();
      if (bio.length > 160) {
        return res.status(400).json({ error: "Bio must be 160 characters or fewer" });
      }
      updates.bio = bio;
    }

    if (req.body.location !== undefined) {
      const location = req.body.location.trim();
      if (location.length > 80) {
        return res.status(400).json({ error: "Location must be 80 characters or fewer" });
      }
      updates.location = location;
    }

    if (req.body.age !== undefined) {
      const raw = req.body.age.trim();
      if (raw === "") {
        updates.age = null;
      } else {
        const age = Number(raw);
        if (!Number.isInteger(age) || age < 13 || age > 120) {
          return res.status(400).json({ error: "Age must be a whole number between 13 and 120" });
        }
        updates.age = age;
      }
    }

    try {
      if (req.body.workDone !== undefined) {
        updates.workDone = parseListField(req.body.workDone, "workDone");
      }
      if (req.body.currentProjects !== undefined) {
        updates.currentProjects = parseListField(req.body.currentProjects, "currentProjects");
      }
    } catch (parseErr) {
      return res.status(400).json({ error: parseErr.message });
    }

    if (req.file) {
      // Avatars are images only — reject a video even though it passed
      // the shared upload middleware's video allowlist.
      if (!IMAGE_TYPES.has(req.file.mimetype)) {
        return res.status(400).json({ error: "Avatar must be an image" });
      }
      if (req.file.size > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: "Avatar image must be under 5MB" });
      }
      updates.avatarUrl = `/uploads/${req.file.filename}`;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ user });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Could not update profile" });
  }
});

// POST /api/users/:handle/recommendations — write (or update) a
// recommendation for another user. Upsert on (author, targetUser) so
// re-submitting edits your existing recommendation instead of duplicating.
router.post("/:handle/recommendations", requireAuth, async (req, res) => {
  try {
    const handle = req.params.handle.trim().toLowerCase();
    const text = (req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({ error: "Recommendation text is required" });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: "Recommendation must be 500 characters or fewer" });
    }

    const targetUser = await User.findOne({ handle });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (targetUser._id.toString() === req.userId) {
      return res.status(400).json({ error: "You can't recommend yourself" });
    }

    const rec = await Recommendation.findOneAndUpdate(
      { author: req.userId, targetUser: targetUser._id },
      { text },
      { new: true, upsert: true, runValidators: true }
    ).populate("author", "handle displayName avatarUrl");

    res.status(201).json({ recommendation: rec });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("Recommendation write error:", err);
    res.status(500).json({ error: "Could not save recommendation" });
  }
});

export default router;
