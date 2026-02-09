import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import Invite from "../models/Invite.js";
import Participant from "../models/Participant.js";

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

function deriveName(email, name) {
  if (name && name.trim()) return name.trim();
  const local = email.split("@")[0];
  return local ? local.replace(/\./g, " ") : "User";
}

router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const email = parsed.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const name = deriveName(email, parsed.name);
    const user = await User.create({ email, passwordHash, name });

    const invites = await Invite.find({ email, status: "pending" });
    for (const invite of invites) {
      await Participant.findByIdAndUpdate(invite.participant, {
        userId: user._id,
        status: "active",
        name: user.name
      });
      invite.status = "accepted";
      await invite.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
    return res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const email = parsed.email.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
    return res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

export default router;
