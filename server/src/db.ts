import pg from "pg";
import type { Conversation, Lang, Message, User } from "./types.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "WARNING: DATABASE_URL is not set. Add your Neon/Postgres URL to server/.env"
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  language: Lang;
  created_at: Date | string;
};

type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
  updated_at: Date | string;
  last_read_at_a: Date | string | null;
  last_read_at_b: Date | string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  original_text: string;
  translations: Partial<Record<Lang, string>> | string;
  created_at: Date | string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  reply_to_id: string | null;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    language: row.language,
    createdAt: toIso(row.created_at),
  };
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    participantIds: [row.participant_a, row.participant_b],
    updatedAt: toIso(row.updated_at),
    lastReadAtA: row.last_read_at_a ? toIso(row.last_read_at_a) : null,
    lastReadAtB: row.last_read_at_b ? toIso(row.last_read_at_b) : null,
  };
}

export function peerLastReadAt(
  conversation: Conversation,
  viewerId: string
): string | null {
  if (conversation.participantIds[0] === viewerId) {
    return conversation.lastReadAtB;
  }
  return conversation.lastReadAtA;
}

function mapMessage(row: MessageRow): Message {
  const translations =
    typeof row.translations === "string"
      ? (JSON.parse(row.translations) as Partial<Record<Lang, string>>)
      : row.translations || {};
  const attachment =
    row.attachment_url && row.attachment_name && row.attachment_mime
      ? {
          url: row.attachment_url,
          name: row.attachment_name,
          mime: row.attachment_mime,
          size: Number(row.attachment_size || 0),
        }
      : null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    originalText: row.original_text,
    translations,
    createdAt: toIso(row.created_at),
    attachment,
    replyToId: row.reply_to_id || null,
  };
}

export async function initDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. Create server/.env with your Neon connection string."
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      language TEXT NOT NULL CHECK (language IN ('en', 'zh')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY,
      participant_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (participant_a <> participant_b)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_idx
      ON conversations (
        LEAST(participant_a, participant_b),
        GREATEST(participant_a, participant_b)
      );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_text TEXT NOT NULL,
      translations JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at_a TIMESTAMPTZ;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at_b TIMESTAMPTZ;

    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS messages_conversation_idx
      ON messages (conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
      ON push_subscriptions (user_id);
  `);

  console.log("Postgres: connected and schema ready");
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function addUser(user: User): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, display_name, language, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.id,
      user.email,
      user.passwordHash,
      user.displayName,
      user.language,
      user.createdAt,
    ]
  );
}

export async function updateUser(user: User): Promise<void> {
  await pool.query(
    `UPDATE users
     SET email = $2,
         password_hash = $3,
         display_name = $4,
         language = $5
     WHERE id = $1`,
    [user.id, user.email, user.passwordHash, user.displayName, user.language]
  );
}

export async function findConversationBetween(
  a: string,
  b: string
): Promise<Conversation | undefined> {
  const { rows } = await pool.query<ConversationRow>(
    `SELECT * FROM conversations
     WHERE (participant_a = $1 AND participant_b = $2)
        OR (participant_a = $2 AND participant_b = $1)
     LIMIT 1`,
    [a, b]
  );
  return rows[0] ? mapConversation(rows[0]) : undefined;
}

export async function addConversation(conversation: Conversation): Promise<void> {
  const [a, b] = conversation.participantIds;
  await pool.query(
    `INSERT INTO conversations (id, participant_a, participant_b, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [conversation.id, a, b, conversation.updatedAt]
  );
}

export async function touchConversation(id: string): Promise<void> {
  await pool.query(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function getConversationsForUser(
  userId: string
): Promise<Conversation[]> {
  const { rows } = await pool.query<ConversationRow>(
    `SELECT * FROM conversations
     WHERE participant_a = $1 OR participant_b = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(mapConversation);
}

export async function addMessage(message: Message): Promise<void> {
  await pool.query(
    `INSERT INTO messages (
       id, conversation_id, sender_id, original_text, translations, created_at,
       attachment_url, attachment_name, attachment_mime, attachment_size,
       reply_to_id
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
    [
      message.id,
      message.conversationId,
      message.senderId,
      message.originalText,
      JSON.stringify(message.translations),
      message.createdAt,
      message.attachment?.url ?? null,
      message.attachment?.name ?? null,
      message.attachment?.mime ?? null,
      message.attachment?.size ?? null,
      message.replyToId ?? null,
    ]
  );
  await touchConversation(message.conversationId);
}

export async function updateMessage(message: Message): Promise<void> {
  await pool.query(
    `UPDATE messages
     SET original_text = $2,
         translations = $3::jsonb
     WHERE id = $1`,
    [message.id, message.originalText, JSON.stringify(message.translations)]
  );
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { rows } = await pool.query<MessageRow>(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows.map(mapMessage);
}

export async function findConversationById(
  id: string
): Promise<Conversation | undefined> {
  const { rows } = await pool.query<ConversationRow>(
    `SELECT * FROM conversations WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapConversation(rows[0]) : undefined;
}

export async function findMessageById(id: string): Promise<Message | undefined> {
  const { rows } = await pool.query<MessageRow>(
    `SELECT * FROM messages WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapMessage(rows[0]) : undefined;
}

export async function findMessagesByIds(ids: string[]): Promise<Message[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<MessageRow>(
    `SELECT * FROM messages WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return rows.map(mapMessage);
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<string | null> {
  const conversation = await findConversationById(conversationId);
  if (!conversation || !conversation.participantIds.includes(userId)) {
    return null;
  }
  const readAt = new Date().toISOString();
  const column =
    conversation.participantIds[0] === userId
      ? "last_read_at_a"
      : "last_read_at_b";
  await pool.query(
    `UPDATE conversations SET ${column} = $2::timestamptz WHERE id = $1`,
    [conversationId, readAt]
  );
  return readAt;
}

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function upsertPushSubscription(
  userId: string,
  sub: PushSubscriptionRow
): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.p256dh, sub.auth]
  );
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [
    endpoint,
  ]);
}

export async function getPushSubscriptionsForUser(
  userId: string
): Promise<PushSubscriptionRow[]> {
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  return rows;
}
