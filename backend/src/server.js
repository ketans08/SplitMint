import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";
import participantRoutes from "./routes/participants.js";
import expenseRoutes from "./routes/expenses.js";
import inviteRoutes from "./routes/invites.js";

dotenv.config();

const app = express();

const corsOrigin =
  process.env.CORS_ORIGIN ||
  (process.env.NODE_ENV !== "production" ? "http://localhost:5173" : false);

if (corsOrigin) {
  app.use(cors({ origin: corsOrigin, credentials: true }));
}

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/invites", inviteRoutes);

if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDist = path.resolve(__dirname, "../../frontend/dist");

  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ status: "ok", name: "SplitMint API" });
  });
}

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/splitmint";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SplitMint API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Mongo connection error", err);
    process.exit(1);
  });
