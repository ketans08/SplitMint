import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
    color: { type: String, default: "#4b5563" },
    avatar: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Participant", participantSchema);
