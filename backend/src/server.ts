import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client";
import { GoogleGenAI } from "@google/genai";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// --------------------
// ENV SETUP
// --------------------
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing in .env");
}

// --------------------
// PRISMA SETUP (SQLite)
// --------------------
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// --------------------
// GEMINI SETUP
// --------------------
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --------------------
// EXPRESS SETUP
// --------------------
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --------------------
// HEALTH CHECK
// --------------------
app.get("/", (_req, res) => {
  res.send("Customer Support Chat Backend is running");
});

// --------------------
// POST /chat/message
// --------------------
app.post("/chat/message", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    if (message.length > 1000) {
      return res
        .status(400)
        .json({ error: "Message too long (max 1000 chars)." });
    }

    let conversationId = sessionId;

    // --------------------
    // CREATE OR VALIDATE CONVERSATION
    // --------------------
    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: {},
      });
      conversationId = conversation.id;
    } else {
      const exists = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!exists) {
        return res.status(404).json({ error: "Conversation not found." });
      }
    }

    // --------------------
    // SAVE USER MESSAGE
    // --------------------
    await prisma.message.create({
      data: {
        conversationId,
        sender: "user",
        text: message,
      },
    });

    // --------------------
    // FETCH LAST 10 MESSAGES
    // --------------------
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
      take: 10,
    });

    // --------------------
    // GENERATE SUPPORT RESPONSE
    // --------------------
    const aiReply = await generateSupportReply(history);

    // --------------------
    // SAVE AI MESSAGE
    // --------------------
    await prisma.message.create({
      data: {
        conversationId,
        sender: "ai",
        text: aiReply,
      },
    });

    res.json({
      reply: aiReply,
      sessionId: conversationId,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------
// GET /chat/history
// --------------------
app.get("/chat/history", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required." });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: sessionId },
    orderBy: { timestamp: "asc" },
  });

  res.json({ messages });
});

// --------------------
// SUPPORT AGENT LOGIC (CORE FIX)
// --------------------
async function generateSupportReply(history: any[]): Promise<string> {
  try {
    const faq = `
Store Information:

Business:
- We are an online e-commerce store.
- This chat is for customer support only.

Shipping:
- We ship worldwide, including the USA.
- Delivery time: 5–10 business days.
- Tracking details are shared after shipment.

Returns & Refunds:
- 30-day return policy.
- Items must be unused and in original packaging.
- Refunds are processed within 5–7 business days after approval.

Orders:
- Orders can be canceled within 24 hours of placement.
- Orders cannot be canceled once shipped.

Support:
- Available Monday–Friday, 9 AM–6 PM.
- Contact via chat or email.

Rules:
- Only answer store-related questions.
- Do not guess or invent information.
- If a question is unrelated, politely refuse.
`;

    const conversationText = history
      .map(
        (m) => `${m.sender === "user" ? "Customer" : "Support"}: ${m.text}`
      )
      .join("\n");

    const prompt = `
You are a customer support agent for an online store.
Answer ONLY using the information below.
Do NOT act as a general AI assistant.
Keep responses short, polite, and professional.

${faq}

Conversation:
${conversationText}
`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    return result.text ?? "Sorry, I don’t have that information.";
  } catch (err) {
    console.error("Gemini error:", err);
    return "Sorry, something went wrong. Please try again.";
  }
}

// --------------------
// START SERVER
// --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
