import express from "express";
import { z } from "zod";
import Group from "../models/Group.js";
import Expense from "../models/Expense.js";
import { authMiddleware } from "../middleware/auth.js";
import { equalSplit, round2 } from "../utils/balance.js";
import { requireGroupAccess } from "../utils/access.js";

const router = express.Router();
router.use(authMiddleware);

const splitInput = z.array(
  z.object({
    participantId: z.string(),
    value: z.number()
  })
);

const createSchema = z.object({
  groupId: z.string(),
  description: z.string().min(1),
  category: z.string().optional(),
  amount: z.number().positive(),
  date: z.string(),
  payerId: z.string(),
  splitMode: z.enum(["equal", "custom", "percentage"]),
  splits: splitInput.optional()
});

function buildSplits(mode, amount, participantIds, splitsInput) {
  if (mode === "equal") {
    return equalSplit(amount, participantIds).map((s) => ({
      participant: s.participant,
      amount: s.amount
    }));
  }

  if (!splitsInput || splitsInput.length === 0) return [];

  if (mode === "custom") {
    const mapped = splitsInput.map((s) => ({
      participant: s.participantId,
      amount: round2(s.value)
    }));
    return mapped;
  }

  if (mode === "percentage") {
    const mapped = splitsInput.map((s) => ({
      participant: s.participantId,
      amount: round2((s.value / 100) * amount)
    }));
    return mapped;
  }

  return [];
}

function validateSplitTotals(amount, splits) {
  const sum = round2(splits.reduce((acc, s) => acc + s.amount, 0));
  return Math.abs(round2(amount - sum)) <= 0.01;
}

router.post("/", async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body);
    const access = await requireGroupAccess(parsed.groupId, req.user.id);
    if (!access.group || !access.access) return res.status(403).json({ error: "Not allowed" });

    const group = await Group.findById(parsed.groupId).populate("participants");
    if (!group) return res.status(404).json({ error: "Group not found" });

    const participantIds = group.participants.map((p) => p._id.toString());
    if (!participantIds.includes(parsed.payerId)) return res.status(400).json({ error: "Invalid payer" });

    const splits = buildSplits(parsed.splitMode, parsed.amount, participantIds, parsed.splits);
    if (!validateSplitTotals(parsed.amount, splits)) {
      return res.status(400).json({ error: "Split total must match amount" });
    }

    const expense = await Expense.create({
      group: group._id,
      description: parsed.description,
      category: parsed.category || "uncategorized",
      amount: round2(parsed.amount),
      date: new Date(parsed.date),
      payer: parsed.payerId,
      splitMode: parsed.splitMode,
      splits
    });

    return res.json({ expense });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.get("/", async (req, res) => {
  const { groupId, q, participantId, min, max, start, end } = req.query;
  if (!groupId) return res.status(400).json({ error: "groupId required" });

  const access = await requireGroupAccess(groupId, req.user.id);
  if (!access.group || !access.access) return res.status(403).json({ error: "Not allowed" });

  const filter = { group: access.group._id };
  if (q) filter.description = { $regex: q, $options: "i" };
  if (participantId) {
    filter.$or = [
      { payer: participantId },
      { "splits.participant": participantId }
    ];
  }
  if (min || max) {
    filter.amount = {};
    if (min) filter.amount.$gte = Number(min);
    if (max) filter.amount.$lte = Number(max);
  }
  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lte = new Date(end);
  }

  const expenses = await Expense.find(filter)
    .sort({ date: -1 })
    .populate("payer")
    .populate("splits.participant");

  return res.json({ expenses });
});

const updateSchema = z.object({
  description: z.string().min(1),
  category: z.string().optional(),
  amount: z.number().positive(),
  date: z.string(),
  payerId: z.string(),
  splitMode: z.enum(["equal", "custom", "percentage"]),
  splits: splitInput.optional()
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: "Expense not found" });

    const access = await requireGroupAccess(expense.group, req.user.id);
    if (!access.group || !access.access) return res.status(403).json({ error: "Not allowed" });

    const group = await Group.findById(expense.group).populate("participants");
    const participantIds = group.participants.map((p) => p._id.toString());
    if (!participantIds.includes(parsed.payerId)) return res.status(400).json({ error: "Invalid payer" });

    const splits = buildSplits(parsed.splitMode, parsed.amount, participantIds, parsed.splits);
    if (!validateSplitTotals(parsed.amount, splits)) {
      return res.status(400).json({ error: "Split total must match amount" });
    }

    expense.description = parsed.description;
    expense.category = parsed.category || "uncategorized";
    expense.amount = round2(parsed.amount);
    expense.date = new Date(parsed.date);
    expense.payer = parsed.payerId;
    expense.splitMode = parsed.splitMode;
    expense.splits = splits;
    await expense.save();

    return res.json({ expense });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.delete("/:id", async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ error: "Expense not found" });

  const access = await requireGroupAccess(expense.group, req.user.id);
  if (!access.group || !access.access) return res.status(403).json({ error: "Not allowed" });

  await expense.deleteOne();
  return res.json({ ok: true });
});

export default router;
