import mongoose from "mongoose";

const splitSchema = new mongoose.Schema(
  {
    participant: { type: mongoose.Schema.Types.ObjectId, ref: "Participant", required: true },
    amount: { type: Number, required: true }
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    description: { type: String, required: true },
    category: { type: String, default: "uncategorized" },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: "Participant", required: true },
    splitMode: { type: String, enum: ["equal", "custom", "percentage"], required: true },
    splits: [splitSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
