import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    handle: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: 160,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    age: {
      type: Number,
      min: 13,
      max: 120,
      default: null,
    },
    // Each entry is a short free-text line, e.g. "Editor — Midnight Run (2024)".
    // Kept simple (no verification/linking) to match what the profile page
    // needs today; can grow into a richer sub-schema later if needed.
    workDone: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 30 && arr.every((s) => s.length <= 140),
        message: "Work history entries must be 140 characters or fewer (max 30 entries)",
      },
    },
    currentProjects: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20 && arr.every((s) => s.length <= 140),
        message: "Current project entries must be 140 characters or fewer (max 20 entries)",
      },
    },
  },
  { timestamps: true }
);

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
