import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import {
  addConversation,
  addMessage,
  addUser,
  findConversationBetween,
  findConversationById,
  findUserByEmail,
  findUserById,
  getConversationsForUser,
  getMessages,
  initDb,
  updateMessage,
  updateUser,
} from "./db.js";
import { detectLang, translateText } from "./translate.js";
import type { Lang, Message, PublicUser } from "./types.js";

const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET is not set. Add it to server/.env before deploying."
  );
}

const jwtSecret = JWT_SECRET || "bridgechat-dev-secret-change-me";

if (process.env.DEEPL_API_KEY) {
  console.log("Translation: DeepL (MyMemory fallback)");
} else {
  console.log(
    "Translation: MyMemory only (add DEEPL_API_KEY in server/.env for better quality)"
  );
}

const clientOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigin =
  clientOrigins.length > 0
    ? clientOrigins
    : true;

const app = express();
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
});

type AuthPayload = { userId: string; email: string };

function toPublic(user: {
  id: string;
  email: string;
  displayName: string;
  language: Lang;
  createdAt: string;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    language: user.language,
    createdAt: user.createdAt,
  };
}

function signToken(userId: string, email: string): string {
  return jwt.sign({ userId, email } satisfies AuthPayload, jwtSecret, {
    expiresIn: "7d",
  });
}

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as AuthPayload;
    (req as express.Request & { userId: string }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

function displayForViewer(message: Message, viewerLang: Lang, viewerId: string) {
  if (message.senderId === viewerId) {
    return message.originalText;
  }
  return message.translations[viewerLang] ?? message.originalText;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  const { email, password, displayName, language } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
    language?: Lang;
  };

  if (!email?.trim() || !password || !displayName?.trim()) {
    res.status(400).json({ error: "Email, password, and name are required" });
    return;
  }

  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: "Password too short" });
    return;
  }
  if (await findUserByEmail(normalized)) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const lang: Lang = language === "zh" ? "zh" : "en";
  const user = {
    id: randomUUID(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 10),
    displayName: displayName.trim(),
    language: lang,
    createdAt: new Date().toISOString(),
  };
  await addUser(user);

  const token = signToken(user.id, user.email);
  res.status(201).json({ token, user: toPublic(user) });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json({ token: signToken(user.id, user.email), user: toPublic(user) });
});

app.get("/api/me", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: toPublic(user) });
});

app.patch("/api/me/language", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { language } = req.body as { language?: Lang };
  if (language !== "en" && language !== "zh") {
    res.status(400).json({ error: "Invalid language" });
    return;
  }
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  user.language = language;
  await updateUser(user);
  res.json({ user: toPublic(user) });
});

app.get("/api/users/search", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const email = String(req.query.email || "")
    .trim()
    .toLowerCase();
  if (!email) {
    res.status(400).json({ error: "Email required" });
    return;
  }
  const user = await findUserByEmail(email);
  if (!user || user.id === userId) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: toPublic(user) });
});

app.get("/api/conversations", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const conversations = await getConversationsForUser(userId);
  const me = await findUserById(userId);
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const list = await Promise.all(
    conversations.map(async (c) => {
      const otherId = c.participantIds.find((id) => id !== userId)!;
      const other = await findUserById(otherId);
      const messages = await getMessages(c.id);
      const last = messages[messages.length - 1];
      return {
        id: c.id,
        updatedAt: c.updatedAt,
        otherUser: other ? toPublic(other) : null,
        lastMessage: last
          ? {
              id: last.id,
              text: displayForViewer(last, me.language, userId),
              senderId: last.senderId,
              createdAt: last.createdAt,
            }
          : null,
      };
    })
  );
  res.json({ conversations: list });
});

app.post("/api/conversations", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "Email required" });
    return;
  }
  const other = await findUserByEmail(email.trim().toLowerCase());
  if (!other || other.id === userId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let conversation = await findConversationBetween(userId, other.id);
  if (!conversation) {
    conversation = {
      id: randomUUID(),
      participantIds: [userId, other.id],
      updatedAt: new Date().toISOString(),
    };
    await addConversation(conversation);
  }

  res.json({
    conversation: {
      id: conversation.id,
      otherUser: toPublic(other),
      updatedAt: conversation.updatedAt,
    },
  });
});

app.get("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const conversation = await findConversationById(String(req.params.id));
  if (!conversation || !conversation.participantIds.includes(userId)) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const me = await findUserById(userId);
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const messages = (await getMessages(conversation.id)).map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: displayForViewer(m, me.language, userId),
    originalText: m.originalText,
    createdAt: m.createdAt,
    translating:
      m.senderId !== userId &&
      !m.translations[me.language] &&
      detectLang(m.originalText) !== me.language,
  }));
  res.json({ messages });
});

const onlineUsers = new Map<string, Set<string>>();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("Unauthorized"));
  try {
    const payload = jwt.verify(token, jwtSecret) as AuthPayload;
    (socket as typeof socket & { userId: string }).userId = payload.userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = (socket as typeof socket & { userId: string }).userId;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);
  socket.join(`user:${userId}`);

  socket.on("send_message", async (payload: { conversationId: string; text: string }) => {
    const text = payload?.text?.trim();
    const conversationId = payload?.conversationId;
    if (!text || !conversationId) return;

    const conversation = await findConversationById(conversationId);
    if (!conversation || !conversation.participantIds.includes(userId)) return;

    const sender = await findUserById(userId);
    if (!sender) return;

    const otherId = conversation.participantIds.find((id) => id !== userId)!;
    const other = await findUserById(otherId);
    if (!other) return;

    const sourceLang = detectLang(text);
    const message: Message = {
      id: randomUUID(),
      conversationId,
      senderId: userId,
      originalText: text,
      translations: { [sourceLang]: text },
      createdAt: new Date().toISOString(),
    };
    await addMessage(message);

    const base = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      originalText: message.originalText,
      createdAt: message.createdAt,
    };

    io.to(`user:${userId}`).emit("message", {
      ...base,
      text: text,
      translating: false,
    });

    const needsTranslate = sourceLang !== other.language;
    io.to(`user:${otherId}`).emit("message", {
      ...base,
      text: text,
      translating: needsTranslate,
    });

    if (needsTranslate) {
      const translated = await translateText(text, other.language, sourceLang);
      message.translations[other.language] = translated;
      await updateMessage(message);

      io.to(`user:${otherId}`).emit("message_translated", {
        id: message.id,
        conversationId: message.conversationId,
        text: translated,
        originalText: message.originalText,
        translating: false,
      });
    }
  });

  socket.on("disconnect", () => {
    const set = onlineUsers.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) onlineUsers.delete(userId);
    }
  });
});

async function start() {
  try {
    await initDb();
    const host = process.env.HOST || "0.0.0.0";
    server.listen(PORT, host, () => {
      console.log(
        `Friends Forever Chat server listening on http://${host}:${PORT}`
      );
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();