import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: false,
      trim: true,
      maxlength: 280,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    // "image" | "video" | "" (no attachment). Set by the posts route
    // based on the uploaded file's detected mimetype — not trusted
    // from client input.
    mediaType: {
      type: String,
      enum: ["image", "video", ""],
      default: "",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyCount: {
      type: Number,
      default: 0,
    },
    // Self-reference for a reply/thread model. Null = top-level post.
    parentPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Feed queries sort newest-first; this index makes that cheap at scale.
postSchema.index({ createdAt: -1 });

postSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.likeCount = ret.likes ? ret.likes.length : 0;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Post", postSchema);
