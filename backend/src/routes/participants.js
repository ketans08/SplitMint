import express from "express";
import { z } from "zod";
import crypto from "crypto";
import Group from "../models/Group.js";
import Participant from "../models/Participant.js";
import Expense from "../models/Expense.js";
import Invite from "../models/Invite.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireGroupAccess } from "../utils/access.js";
import { computeBalances } from "../utils/balance.js";

const router = express.Router();
router.use(authMiddleware);

const createSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  color: z.string().optional(),
  avatar: z.string().optional()
});

router.post("/", async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body);
    const { group, access } = await requireGroupAccess(parsed.groupId, req.user.id);
    if (!group || !access) return res.status(403).json({ error: "Not allowed" });

    if (group.participants.length >= 4) {
      return res.status(400).json({ error: "Max 3 participants + primary user" });
    }

    const email = parsed.email.toLowerCase();

    const existingParticipant = await Participant.findOne({ group: group._id, email });
    if (existingParticipant) {
      return res.status(409).json({ error: "Participant already invited or linked" });
    }

    const existingUser = await User.findOne({ email });

    const participant = await Participant.create({
      group: group._id,
      name: parsed.name,
      email,
      color: parsed.color || "#4b5563",
      avatar: parsed.avatar || "",
      userId: existingUser?._id || null,
      status: existingUser ? "active" : "pending"
    });

    let inviteToken = null;
    if (!existingUser) {
      const invite = await Invite.create({
        group: group._id,
        participant: participant._id,
        email,
        status: "pending",
        token: crypto.randomBytes(24).toString("hex"),
        invitedBy: req.user.id
      });
      inviteToken = invite.token;
    }

    group.participants.push(participant._id);
    await group.save();

    return res.json({ participant, inviteToken });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

const updateSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  avatar: z.string().optional()
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const participant = await Participant.findById(req.params.id);
    if (!participant) return res.status(404).json({ error: "Participant not found" });

    const { group, owner } = await requireGroupAccess(participant.group, req.user.id);
    if (!group || !owner) return res.status(403).json({ error: "Not allowed" });

    participant.name = parsed.name;
    participant.color = parsed.color || participant.color;
    participant.avatar = parsed.avatar || participant.avatar;
    await participant.save();

    return res.json({ participant });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.delete("/:id", async (req, res) => {
  const participant = await Participant.findById(req.params.id);
  if (!participant) return res.status(404).json({ error: "Participant not found" });

  const { group, access } = await requireGroupAccess(participant.group, req.user.id);
  if (!group || !access) return res.status(403).json({ error: "Not allowed" });

  const participants = await Participant.find({ group: group._id });
  const expenses = await Expense.find({ group: group._id });
  const { balances } = computeBalances(expenses, participants);
  const targetBalance = balances.find((b) => b.participant._id.toString() === participant._id.toString());
  const net = targetBalance ? targetBalance.net : 0;

  if (Math.abs(net) > 0.01) {
    return res.status(400).json({ error: "Participant has unsettled balance" });
  }

  await Expense.deleteMany({
    group: group._id,
    $or: [
      { payer: participant._id },
      { "splits.participant": participant._id }
    ]
  });

  await Invite.deleteMany({ participant: participant._id });

  group.participants = group.participants.filter((id) => id.toString() !== participant._id.toString());

  if (group.owner.toString() === participant.userId?.toString()) {
    group.owner = req.user.id;
  }

  await group.save();
  await participant.deleteOne();

  return res.json({ ok: true });
});

export default router;
