import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Group from "../src/models/Group.js";
import Participant from "../src/models/Participant.js";
import Expense from "../src/models/Expense.js";
import Invite from "../src/models/Invite.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/splitmint";

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function run() {
  await mongoose.connect(MONGO_URI);

  await Promise.all([
    User.deleteMany({}),
    Group.deleteMany({}),
    Participant.deleteMany({}),
    Expense.deleteMany({}),
    Invite.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash("Test@123", 10);

  // Create users
  const owner = await User.create({ email: "john@test.com", passwordHash, name: "John" });
  const alice = await User.create({ email: "alice@test.com", passwordHash, name: "Alice" });
  const bob = await User.create({ email: "bob@test.com", passwordHash, name: "Bob" });
  const chris = await User.create({ email: "chris@test.com", passwordHash, name: "Chris" });
  const diana = await User.create({ email: "diana@test.com", passwordHash, name: "Diana" });

  console.log("\n=== TEST CREDENTIALS ===");
  console.log("john@test.com / Test@123");
  console.log("alice@test.com / Test@123");
  console.log("bob@test.com / Test@123");
  console.log("chris@test.com / Test@123");
  console.log("diana@test.com / Test@123");
  console.log("========================\n");

  // GROUP 1: Hackathon Expenses
  const group1 = await Group.create({ name: "Hackathon Expenses", owner: owner._id, participants: [] });
  const g1_john = await Participant.create({
    group: group1._id,
    name: "John",
    email: owner.email,
    status: "active",
    color: "#111827",
    userId: owner._id
  });
  const g1_alice = await Participant.create({
    group: group1._id,
    name: "Alice",
    email: alice.email,
    status: "active",
    color: "#f97316",
    userId: alice._id
  });
  const g1_bob = await Participant.create({
    group: group1._id,
    name: "Bob",
    email: bob.email,
    status: "active",
    color: "#0ea5e9",
    userId: bob._id
  });
  group1.participants = [g1_john._id, g1_alice._id, g1_bob._id];
  await group1.save();

  // Group 1 expenses
  await Expense.create({
    group: group1._id,
    description: "Lunch for team",
    category: "food",
    amount: 150,
    date: new Date("2026-02-05"),
    payer: g1_john._id,
    splitMode: "equal",
    splits: [
      { participant: g1_john._id, amount: 50 },
      { participant: g1_alice._id, amount: 50 },
      { participant: g1_bob._id, amount: 50 }
    ]
  });

  await Expense.create({
    group: group1._id,
    description: "Coffee and snacks",
    category: "food",
    amount: 75.50,
    date: new Date("2026-02-06"),
    payer: g1_alice._id,
    splitMode: "custom",
    splits: [
      { participant: g1_john._id, amount: 25 },
      { participant: g1_alice._id, amount: 30 },
      { participant: g1_bob._id, amount: 20.50 }
    ]
  });

  await Expense.create({
    group: group1._id,
    description: "Venue booking",
    category: "uncategorized",
    amount: 500,
    date: new Date("2026-02-07"),
    payer: g1_bob._id,
    splitMode: "percentage",
    splits: [
      { participant: g1_john._id, amount: round2(500 * 0.5) },
      { participant: g1_alice._id, amount: round2(500 * 0.3) },
      { participant: g1_bob._id, amount: round2(500 * 0.2) }
    ]
  });

  // GROUP 2: Weekend Trip
  const group2 = await Group.create({ name: "Weekend Trip", owner: alice._id, participants: [] });
  const g2_alice = await Participant.create({
    group: group2._id,
    name: "Alice",
    email: alice.email,
    status: "active",
    color: "#f97316",
    userId: alice._id
  });
  const g2_chris = await Participant.create({
    group: group2._id,
    name: "Chris",
    email: chris.email,
    status: "active",
    color: "#22c55e",
    userId: chris._id
  });
  const g2_diana = await Participant.create({
    group: group2._id,
    name: "Diana",
    email: diana.email,
    status: "active",
    color: "#ec4899",
    userId: diana._id
  });
  group2.participants = [g2_alice._id, g2_chris._id, g2_diana._id];
  await group2.save();

  // Group 2 expenses
  await Expense.create({
    group: group2._id,
    description: "Hotel booking",
    category: "lodging",
    amount: 450,
    date: new Date("2026-02-08"),
    payer: g2_alice._id,
    splitMode: "equal",
    splits: [
      { participant: g2_alice._id, amount: 150 },
      { participant: g2_chris._id, amount: 150 },
      { participant: g2_diana._id, amount: 150 }
    ]
  });

  await Expense.create({
    group: group2._id,
    description: "Dinner",
    category: "food",
    amount: 180,
    date: new Date("2026-02-08"),
    payer: g2_chris._id,
    splitMode: "custom",
    splits: [
      { participant: g2_alice._id, amount: 60 },
      { participant: g2_chris._id, amount: 60 },
      { participant: g2_diana._id, amount: 60 }
    ]
  });

  await Expense.create({
    group: group2._id,
    description: "Gas for car",
    category: "transport",
    amount: 120,
    date: new Date("2026-02-08"),
    payer: g2_diana._id,
    splitMode: "percentage",
    splits: [
      { participant: g2_alice._id, amount: round2(120 * 0.4) },
      { participant: g2_chris._id, amount: round2(120 * 0.4) },
      { participant: g2_diana._id, amount: round2(120 * 0.2) }
    ]
  });

  // GROUP 3: Project Meeting
  const group3 = await Group.create({ name: "Project Meeting", owner: bob._id, participants: [] });
  const g3_bob = await Participant.create({
    group: group3._id,
    name: "Bob",
    email: bob.email,
    status: "active",
    color: "#0ea5e9",
    userId: bob._id
  });
  const g3_john = await Participant.create({
    group: group3._id,
    name: "John",
    email: owner.email,
    status: "active",
    color: "#111827",
    userId: owner._id
  });
  const g3_diana = await Participant.create({
    group: group3._id,
    name: "Diana",
    email: diana.email,
    status: "active",
    color: "#ec4899",
    userId: diana._id
  });
  group3.participants = [g3_bob._id, g3_john._id, g3_diana._id];
  await group3.save();

  // Group 3 expenses
  await Expense.create({
    group: group3._id,
    description: "Meeting room rental",
    category: "uncategorized",
    amount: 200,
    date: new Date("2026-02-09"),
    payer: g3_bob._id,
    splitMode: "equal",
    splits: [
      { participant: g3_bob._id, amount: round2(200 / 3) },
      { participant: g3_john._id, amount: round2(200 / 3) },
      { participant: g3_diana._id, amount: round2(200 / 3) }
    ]
  });

  await Expense.create({
    group: group3._id,
    description: "Catering",
    category: "food",
    amount: 300,
    date: new Date("2026-02-09"),
    payer: g3_john._id,
    splitMode: "custom",
    splits: [
      { participant: g3_bob._id, amount: 100 },
      { participant: g3_john._id, amount: 120 },
      { participant: g3_diana._id, amount: 80 }
    ]
  });

  console.log("\n=== GROUPS CREATED ===");
  console.log("1. Hackathon Expenses (Owner: John) - 3 members, 3 expenses");
  console.log("2. Weekend Trip (Owner: Alice) - 3 members, 3 expenses");
  console.log("3. Project Meeting (Owner: Bob) - 3 members, 2 expenses");
  console.log("========================\n");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
