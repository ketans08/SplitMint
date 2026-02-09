import express from "express";
import { z } from "zod";
import crypto from "crypto";
import Group from "../models/Group.js";
import Participant from "../models/Participant.js";
import Expense from "../models/Expense.js";
import Invite from "../models/Invite.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/auth.js";
import { computeBalances } from "../utils/balance.js";
import { getGroupsForUser, requireGroupAccess } from "../utils/access.js";

const router = express.Router();

router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1),
  participants: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        color: z.string().optional(),
        avatar: z.string().optional()
      })
    )
    .optional()
});

function deriveName(email, name) {
  if (name && name.trim()) return name.trim();
  const local = email.split("@")[0];
  return local ? local.replace(/\./g, " ") : "User";
}

router.post("/", async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body);
    const group = await Group.create({ name: parsed.name, owner: req.user.id, participants: [] });

    const ownerUser = await User.findById(req.user.id);
    const ownerName = ownerUser ? deriveName(ownerUser.email, ownerUser.name) : "User";
    const primary = await Participant.create({
      group: group._id,
      name: ownerName,
      email: ownerUser?.email || "",
      status: "active",
      color: "#111827",
      avatar: "",
      userId: req.user.id
    });

    const extra = parsed.participants || [];
    if (extra.length > 3) return res.status(400).json({ error: "Max 3 participants allowed" });

    const extraDocs = [];
    for (const p of extra) {
      const email = p.email.toLowerCase();
      const existingUser = await User.findOne({ email });
      const participant = await Participant.create({
        group: group._id,
        name: p.name,
        email,
        color: p.color || "#4b5563",
        avatar: p.avatar || "",
        userId: existingUser?._id || null,
        status: existingUser ? "active" : "pending"
      });

      if (!existingUser) {
        await Invite.create({
          group: group._id,
          participant: participant._id,
          email,
          status: "pending",
          token: crypto.randomBytes(24).toString("hex"),
          invitedBy: req.user.id
        });
      }

      extraDocs.push(participant);
    }

    group.participants = [primary._id, ...extraDocs.map((p) => p._id)];
    await group.save();

    return res.json({ group });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.get("/", async (req, res) => {
  const groups = await getGroupsForUser(req.user.id);
  const allGroup = {
    _id: "all",
    name: "All Groups",
    owner: req.user.id,
    participants: [],
    isVirtual: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  return res.json({ groups: [...groups, allGroup] });
});

router.get("/:id", async (req, res) => {
  // Handle virtual "All" group
  if (req.params.id === "all") {
    const groups = await getGroupsForUser(req.user.id);
    const allExpenses = await Expense.find({ group: { $in: groups.map((g) => g._id) } })
      .populate("payer")
      .populate("splits.participant");

    const allParticipants = [];
    const participantMap = new Map();
    for (const group of groups) {
      const participants = await Participant.find({ group: group._id });
      for (const p of participants) {
        const key = p._id.toString();
        if (!participantMap.has(key)) {
          participantMap.set(key, p);
          allParticipants.push(p);
        }
      }
    }

    const { balances, settlements } = computeBalances(allExpenses, allParticipants);
    const totalSpent = allExpenses.reduce((sum, e) => sum + e.amount, 0);

    const allGroup = {
      _id: "all",
      name: "All Groups",
      owner: req.user.id,
      participants: [],
      isVirtual: true
    };

    return res.json({
      group: allGroup,
      expenses: allExpenses,
      summary: {
        totalSpent,
        balances,
        settlements
      }
    });
  }

  const { group, access } = await requireGroupAccess(req.params.id, req.user.id);
  if (!group || !access) return res.status(404).json({ error: "Group not found" });

  const populated = await Group.findById(group._id).populate("participants");
  const expenses = await Expense.find({ group: group._id }).populate("payer").populate("splits.participant");
  const { balances, settlements } = computeBalances(expenses, populated.participants);

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  return res.json({
    group: populated,
    expenses,
    summary: {
      totalSpent,
      balances,
      settlements
    }
  });
});

const updateSchema = z.object({
  name: z.string().min(1)
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const { group, owner } = await requireGroupAccess(req.params.id, req.user.id);
    if (!group || !owner) return res.status(403).json({ error: "Not allowed" });

    group.name = parsed.name;
    await group.save();
    return res.json({ group });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.delete("/:id", async (req, res) => {
  const { group, owner } = await requireGroupAccess(req.params.id, req.user.id);
  if (!group || !owner) return res.status(403).json({ error: "Not allowed" });

  await Expense.deleteMany({ group: group._id });
  await Participant.deleteMany({ group: group._id });
  await Invite.deleteMany({ group: group._id });
  await group.deleteOne();

  return res.json({ ok: true });
});

export default router;
