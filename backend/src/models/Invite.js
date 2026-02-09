import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: "Participant", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
    token: { type: String, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Invite", inviteSchema);
