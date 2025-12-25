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
  res.send("🚀 AI Chat Backend is running");
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
    // CREATE OR VALIDATE SESSION
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
    // GENERATE AI RESPONSE
    // --------------------
    const aiReply = await generateGeminiReply(history);

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
  } catch (error) {
    console.error("Chat error:", error);
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
// GEMINI RESPONSE FUNCTION
// --------------------
async function generateGeminiReply(history: any[]): Promise<string> {
  try {
    const faq = `
Product FAQ — AI Productivity Assistant

About the Product:
- An AI-powered assistant for developers and students.
- Helps with coding, studying, planning, and idea generation.
- Works entirely online via web browser.

Key Features:
- Conversational AI with session memory.
- Code explanation, debugging, and optimization.
- Converts vague ideas into structured plans.
- Supports long technical explanations.
- Fast responses powered by Gemini AI.

Who Should Use This:
- Developers writing or learning code.
- Students preparing notes or understanding concepts.
- Startup founders brainstorming ideas.
- Professionals organizing tasks and workflows.

Pricing:
- Free plan with limited daily messages.
- Pro plan includes unlimited chats and priority speed.
- Monthly and yearly billing options available.

Privacy & Data:
- Chats are securely stored per session.
- No data is sold or shared.
- Users can request deletion of chat history.
- Conversations are not used to train public models.

Technical Info:
- Requires internet connection.
- Best used on Chrome, Firefox, or Edge.
- Markdown supported in replies.

Support:
- Monday–Friday, 9am–6pm IST.
- Email and in-app support available.
- Typical response time under 24 hours.

Refund Policy:
- 7-day refund window for Pro users.
- Refunds subject to fair usage.
`;

    const conversationText = history
      .map(
        (m) => `${m.sender === "user" ? "User" : "Agent"}: ${m.text}`
      )
      .join("\n");

    const prompt = `
You are a knowledgeable support agent for an AI productivity product.
Proactively explain features, benefits, and best use cases.
If the user seems unsure, suggest how the product can help them.
Keep responses friendly, concise, and clear.

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

    return result.text ?? "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini error:", error);
    return "Sorry, there was an issue with the AI response.";
  }
}

// --------------------
// START SERVER
// --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
