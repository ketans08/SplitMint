import express from "express";
import Invite from "../models/Invite.js";
import Participant from "../models/Participant.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/accept", async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "Token required" });

  const invite = await Invite.findOne({ token });
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.status === "accepted") return res.json({ ok: true, groupId: invite.group });

  const user = await User.findById(req.user.id);
  const userEmail = (user?.email || "").toLowerCase();
  if (invite.email !== userEmail) {
    return res.status(403).json({ error: "Invite email does not match" });
  }

  await Participant.findByIdAndUpdate(invite.participant, {
    userId: req.user.id,
    status: "active",
    name: user?.name || undefined
  });

  invite.status = "accepted";
  await invite.save();

  return res.json({ ok: true, groupId: invite.group });
});

export default router;
