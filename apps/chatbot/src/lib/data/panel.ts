import "server-only";
import { and, asc, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  conversations,
  customerProfiles,
  images,
  knowledgeGaps,
  knowledgeQa,
  knowledgeSources,
  leads,
  materials,
  messages,
  quotes,
  systemEvents,
} from "@/lib/db/schema";

type LeadStatus = "new" | "contacted" | "quoted" | "ready" | "won" | "lost";

/**
 * Consultas de lectura del panel, compartidas por la PÁGINA (server-side, datos en el
 * primer pintado, sin skeleton) y por su API (mutaciones/refresh). Las fechas se
 * serializan a ISO para que la forma sea idéntica por ambos caminos.
 */

export async function listLeads() {
  const rows = await db
    .select({
      id: leads.id,
      ref: leads.ref,
      conversationId: leads.conversationId,
      name: leads.name,
      contact: leads.contact,
      interest: leads.interest,
      materialName: materials.name,
      quantity: leads.quantity,
      unit: leads.unit,
      agreedPriceCop: leads.agreedPriceCop,
      fulfillment: leads.fulfillment,
      scheduledFor: leads.scheduledFor,
      paymentMethod: leads.paymentMethod,
      requestedDiscount: leads.requestedDiscount,
      discountApprovedPct: leads.discountApprovedPct,
      status: leads.status,
      notes: leads.notes,
      test: leads.test,
      channel: conversations.channel,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(materials, eq(leads.materialId, materials.id))
    .leftJoin(conversations, eq(leads.conversationId, conversations.id))
    .orderBy(desc(leads.createdAt));
  return rows.map((r) => ({
    ...r,
    status: r.status as LeadStatus,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
  }));
}
export type LeadRow = Awaited<ReturnType<typeof listLeads>>[number];

// Un solo lead, enriquecido igual que listLeads (con canal y material). Se usa
// tras un PATCH para devolver la misma forma que consume el cliente (si no, el
// badge de canal/material desaparecería hasta recargar).
export async function getLead(id: string): Promise<LeadRow | null> {
  const [r] = await db
    .select({
      id: leads.id,
      ref: leads.ref,
      conversationId: leads.conversationId,
      name: leads.name,
      contact: leads.contact,
      interest: leads.interest,
      materialName: materials.name,
      quantity: leads.quantity,
      unit: leads.unit,
      agreedPriceCop: leads.agreedPriceCop,
      fulfillment: leads.fulfillment,
      scheduledFor: leads.scheduledFor,
      paymentMethod: leads.paymentMethod,
      requestedDiscount: leads.requestedDiscount,
      discountApprovedPct: leads.discountApprovedPct,
      status: leads.status,
      notes: leads.notes,
      test: leads.test,
      channel: conversations.channel,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(materials, eq(leads.materialId, materials.id))
    .leftJoin(conversations, eq(leads.conversationId, conversations.id))
    .where(eq(leads.id, id))
    .limit(1);
  if (!r) return null;
  return { ...r, status: r.status as LeadStatus, createdAt: r.createdAt ? r.createdAt.toISOString() : null };
}

export async function listMaterials() {
  const rows = await db.select().from(materials).orderBy(desc(materials.updatedAt));
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null }));
}
export type MaterialRow = Awaited<ReturnType<typeof listMaterials>>[number];

export async function listGaps(status: "open" | "resolved" | "all" = "open") {
  const base = db
    .select({
      id: knowledgeGaps.id,
      question: knowledgeGaps.question,
      status: knowledgeGaps.status,
      resolvedAnswer: knowledgeGaps.resolvedAnswer,
      createdAt: knowledgeGaps.createdAt,
    })
    .from(knowledgeGaps)
    .orderBy(desc(knowledgeGaps.createdAt));
  const rows =
    status === "all"
      ? await base
      : await base.where(eq(knowledgeGaps.status, status === "resolved" ? "resolved" : "open"));
  return rows.map((r) => ({
    ...r,
    status: r.status as "open" | "resolved",
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
  }));
}
export type GapRow = Awaited<ReturnType<typeof listGaps>>[number];

export async function listKnowledgeSources() {
  const rows = await db
    .select({
      id: knowledgeSources.id,
      type: knowledgeSources.type,
      name: knowledgeSources.name,
      status: knowledgeSources.status,
      error: knowledgeSources.error,
      chunkCount: knowledgeSources.chunkCount,
      qaCount: knowledgeSources.qaCount,
      createdAt: knowledgeSources.createdAt,
      updatedAt: knowledgeSources.updatedAt,
    })
    .from(knowledgeSources)
    .orderBy(desc(knowledgeSources.createdAt));
  return rows.map((r) => ({
    ...r,
    status: r.status as "pending" | "processing" | "ready" | "failed",
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));
}
export type SourceRow = Awaited<ReturnType<typeof listKnowledgeSources>>[number];

export async function listConversations() {
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      customerName: conversations.customerName,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.lastMessageAt));
  return rows.map((r) => ({
    ...r,
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
  }));
}
export type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];

export async function listQuotes() {
  const rows = await db
    .select({
      id: quotes.id,
      ref: quotes.ref,
      customerName: quotes.customerName,
      customerContact: quotes.customerContact,
      items: quotes.items,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .orderBy(desc(quotes.createdAt));
  type Item = { quantity: number | null; unitPriceCop: number };
  return rows.map((r) => {
    const items = (r.items ?? []) as Item[];
    const total = items.reduce((a, it) => a + (it.quantity != null ? it.quantity * it.unitPriceCop : it.unitPriceCop), 0);
    return {
      id: r.id,
      ref: r.ref,
      customerName: r.customerName,
      customerContact: r.customerContact,
      lines: items.length,
      total,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    };
  });
}
export type QuoteListRow = Awaited<ReturnType<typeof listQuotes>>[number];

export async function listCustomers() {
  const [profiles, convCounts, leadCounts] = await Promise.all([
    db
      .select({
        id: customerProfiles.id,
        name: customerProfiles.name,
        company: customerProfiles.company,
        contact: customerProfiles.contact,
        channel: customerProfiles.channel,
        lastSeenAt: customerProfiles.lastSeenAt,
      })
      .from(customerProfiles)
      .orderBy(desc(customerProfiles.lastSeenAt)),
    db.select({ customerId: conversations.customerId, n: count() }).from(conversations).where(isNotNull(conversations.customerId)).groupBy(conversations.customerId),
    db
      .select({ customerId: conversations.customerId, n: count(leads.id) })
      .from(leads)
      .innerJoin(conversations, eq(leads.conversationId, conversations.id))
      .where(and(isNotNull(conversations.customerId), eq(leads.test, false)))
      .groupBy(conversations.customerId),
  ]);
  const convMap = new Map(convCounts.map((r) => [r.customerId, r.n]));
  const leadMap = new Map(leadCounts.map((r) => [r.customerId, r.n]));
  return profiles.map((p) => ({
    ...p,
    lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
    conversations: convMap.get(p.id) ?? 0,
    leads: leadMap.get(p.id) ?? 0,
  }));
}
export type CustomerRow = Awaited<ReturnType<typeof listCustomers>>[number];

export async function getCustomer(id: string) {
  const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.id, id));
  if (!profile) return null;
  const [convs, leadRows] = await Promise.all([
    db
      .select({
        id: conversations.id,
        channel: conversations.channel,
        status: conversations.status,
        lastMessageAt: conversations.lastMessageAt,
        messageCount: sql<number>`count(${messages.id})::int`,
      })
      .from(conversations)
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.customerId, id))
      .groupBy(conversations.id)
      .orderBy(desc(conversations.lastMessageAt)),
    db
      .select({
        ref: leads.ref,
        interest: leads.interest,
        materialName: materials.name,
        status: leads.status,
        agreedPriceCop: leads.agreedPriceCop,
        conversationId: leads.conversationId,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .innerJoin(conversations, eq(leads.conversationId, conversations.id))
      .leftJoin(materials, eq(leads.materialId, materials.id))
      .where(and(eq(conversations.customerId, id), eq(leads.test, false)))
      .orderBy(desc(leads.createdAt)),
  ]);
  return {
    profile: {
      id: profile.id,
      name: profile.name,
      company: profile.company,
      contact: profile.contact,
      channel: profile.channel,
      facts: (profile.facts ?? null) as unknown,
      lastSeenAt: profile.lastSeenAt ? profile.lastSeenAt.toISOString() : null,
    },
    conversations: convs.map((c) => ({ ...c, lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null })),
    leads: leadRows.map((l) => ({ ...l, createdAt: l.createdAt ? l.createdAt.toISOString() : null })),
  };
}

export async function listImages() {
  const [rows, matUses, qaUses] = await Promise.all([
    db
      .select({
        id: images.id,
        type: images.type,
        name: images.name,
        description: images.description,
        tags: images.tags,
        url: images.url,
        updatedAt: images.updatedAt,
      })
      .from(images)
      .orderBy(desc(images.createdAt)),
    db.select({ imageId: materials.imageId, n: count() }).from(materials).where(isNotNull(materials.imageId)).groupBy(materials.imageId),
    db.select({ imageId: knowledgeQa.imageId, n: count() }).from(knowledgeQa).where(isNotNull(knowledgeQa.imageId)).groupBy(knowledgeQa.imageId),
  ]);
  const matMap = new Map(matUses.map((r) => [r.imageId, r.n]));
  const qaMap = new Map(qaUses.map((r) => [r.imageId, r.n]));
  return rows.map((r) => ({
    ...r,
    type: r.type as "image" | "video",
    tags: (r.tags ?? []) as string[],
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    materialUses: matMap.get(r.id) ?? 0,
    qaUses: qaMap.get(r.id) ?? 0,
  }));
}
export type ImageRow = Awaited<ReturnType<typeof listImages>>[number];

export async function getHealth() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [events, counts] = await Promise.all([
    db.select().from(systemEvents).orderBy(desc(systemEvents.createdAt)).limit(100),
    db.select({ level: systemEvents.level, n: sql<number>`count(*)::int` }).from(systemEvents).where(gte(systemEvents.createdAt, since)).groupBy(systemEvents.level),
  ]);
  const summary: Record<string, number> = { error: 0, warning: 0, info: 0 };
  for (const c of counts) summary[c.level] = c.n;
  return {
    events: events.map((e) => ({
      id: e.id,
      level: e.level as "error" | "warning" | "info",
      source: e.source,
      message: e.message,
      context: (e.context ?? null) as Record<string, unknown> | null,
      createdAt: e.createdAt ? e.createdAt.toISOString() : null,
    })),
    summary,
  };
}
export type HealthData = Awaited<ReturnType<typeof getHealth>>;

export async function getConversationDetail(id: string) {
  const [conv] = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      customerName: conversations.customerName,
      status: conversations.status,
      customerId: conversations.customerId,
    })
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conv) return null;
  const thread = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      metadata: messages.metadata,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  type MsgMeta =
    | { model?: string; routerReason?: string; contextUsed?: boolean; topScores?: number[]; tools?: string[] }
    | null;
  return {
    conversation: conv,
    messages: thread.map((m) => ({
      ...m,
      metadata: (m.metadata ?? null) as MsgMeta,
      createdAt: m.createdAt ? m.createdAt.toISOString() : null,
    })),
  };
}

export async function listSourceQa(sourceId: string) {
  return db
    .select({
      id: knowledgeQa.id,
      question: knowledgeQa.question,
      answer: knowledgeQa.answer,
      imageId: knowledgeQa.imageId,
    })
    .from(knowledgeQa)
    .where(eq(knowledgeQa.sourceId, sourceId))
    .orderBy(asc(knowledgeQa.createdAt));
}

const FAQ_NAME = "Preguntas frecuentes (manual)";
/** Asegura la fuente singleton de FAQs y devuelve su id. */
export async function ensureFaqSource(): Promise<string> {
  const [existing] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.type, "faq"), eq(knowledgeSources.name, FAQ_NAME)))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(knowledgeSources)
    .values({ type: "faq", name: FAQ_NAME, status: "ready" })
    .returning({ id: knowledgeSources.id });
  return row.id;
}
