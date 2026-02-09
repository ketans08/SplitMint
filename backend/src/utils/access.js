import Group from "../models/Group.js";
import Participant from "../models/Participant.js";

export async function getGroupsForUser(userId) {
  const owned = await Group.find({ owner: userId }).sort({ createdAt: -1 });
  const participantDocs = await Participant.find({ userId }).select("group");
  const participantGroupIds = participantDocs.map((p) => p.group);
  const shared = await Group.find({ _id: { $in: participantGroupIds } }).sort({ createdAt: -1 });

  const combined = [...owned, ...shared];
  const seen = new Set();
  return combined.filter((g) => {
    const id = g._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function requireGroupAccess(groupId, userId) {
  const group = await Group.findById(groupId);
  if (!group) return { group: null, access: false, owner: false };
  if (group.owner.toString() === userId) return { group, access: true, owner: true };
  const participant = await Participant.findOne({ group: groupId, userId });
  if (participant) return { group, access: true, owner: false };
  return { group, access: false, owner: false };
}
