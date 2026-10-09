import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../Model/User.js";

const router = Router();
const TOKEN_TTL = "7d";

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

router.post("/signup", async (req, res) => {
  try {
    const { handle, displayName, email, password } = req.body;

    if (!handle || !displayName || !email || !password) {
      return res.status(400).json({ error: "handle, displayName, email, and password are all required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const normalizedHandle = handle.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ handle: normalizedHandle }, { email: normalizedEmail }],
    });
    if (existing) {
      const field = existing.handle === normalizedHandle ? "handle" : "email";
      return res.status(409).json({ error: `That ${field} is already taken` });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      handle: normalizedHandle,
      displayName: displayName.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const token = issueToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("Signup error:", err);
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = handle or email
    if (!identifier || !password) {
      return res.status(400).json({ error: "identifier and password are required" });
    }

    const normalized = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ handle: normalized }, { email: normalized }],
    });

    // Same error for "no such user" and "wrong password" — don't leak which
    // one it was, that's an account-enumeration side channel.
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = issueToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Could not log in" });
  }
});

export default router;
