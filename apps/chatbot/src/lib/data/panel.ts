import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, knowledgeGaps, knowledgeSources, leads, materials, messages } from "@/lib/db/schema";

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
