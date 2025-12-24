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
// PRISMA SETUP
// --------------------
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// --------------------
// GEMINI SETUP (NEW SDK)
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
  res.send("AI Chat Backend is running");
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

    // Create or validate conversation
    if (!conversationId) {
      const conversation = await prisma.conversation.create({ data: {} });
      conversationId = conversation.id;
    } else {
      const exists = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!exists) {
        return res.status(404).json({ error: "Conversation not found." });
      }
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId,
        sender: "user",
        text: message,
      },
    });

    // Fetch last 10 messages
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
      take: 10,
    });

    // Generate AI reply
    const aiReply = await generateGeminiReply(history);

    // Save AI reply
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
    console.error("Chat endpoint error:", err);
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
// GEMINI REPLY FUNCTION
// --------------------
async function generateGeminiReply(history: any[]): Promise<string> {
  try {
    const faq = `
Store FAQ:
- Shipping: We ship worldwide, including USA.
- Returns: 30-day return/refund policy.
- Support: Mon–Fri, 9am–6pm.
`;

    const historyText = history
      .map(
        (m) => `${m.sender === "user" ? "User" : "Agent"}: ${m.text}`
      )
      .join("\n");

    const prompt = `
You are a helpful support agent for a small e-commerce store.
Answer clearly and concisely.

${faq}

Conversation:
${historyText}
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

    return result.text ?? "No response from AI.";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "Sorry, there was an error with the AI agent.";
  }
}

// --------------------
// START SERVER
// --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
