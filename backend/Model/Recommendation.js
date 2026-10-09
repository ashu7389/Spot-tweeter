import mongoose from "mongoose";

const recommendationSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// One recommendation per (author, targetUser) pair — writing a new one
// edits the existing one rather than piling up duplicates.
recommendationSchema.index({ author: 1, targetUser: 1 }, { unique: true });

recommendationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Recommendation", recommendationSchema);
