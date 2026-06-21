import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  jsonb,
  vector,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * Esquema Drizzle del chatbot (blueprint §4 + addendum de memoria del plan maestro §3).
 * Una sola BD Postgres (Neon) guarda config, conversaciones y los embeddings (pgvector).
 */

// bot_config — singleton (fila única, id = 1)
export const botConfig = pgTable('bot_config', {
  id: integer('id').primaryKey(), // siempre 1
  botName: text('bot_name').notNull().default('Asistente de CI Quality Group'),
  tonePrompt: text('tone_prompt').notNull().default(''),
  welcomeMessage: text('welcome_message').notNull().default(''),
  afterHoursMessage: text('after_hours_message').notNull().default(''),
  businessHours: jsonb('business_hours'),
  channelsEnabled: jsonb('channels_enabled')
    .notNull()
    .default({ messenger: true, whatsapp: true, instagram: true }),
  adminWhatsapp: text('admin_whatsapp'),
  retentionMonths: integer('retention_months').notNull().default(12), // Habeas Data
  maxAutoDiscountPct: numeric('max_auto_discount_pct').notNull().default('0'),
  // Generar preguntas frecuentes (Q&A) al ingerir documentos (gpt-4o-mini).
  // Toggle de costo: el admin puede apagarlo desde Ajustes.
  qaGenerationEnabled: boolean('qa_generation_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// knowledge_sources — fuentes de conocimiento subidas/ingeridas
export const knowledgeSources = pgTable('knowledge_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // pdf|docx|pptx|txt|link|faq
  name: text('name').notNull(),
  originalUrl: text('original_url'),
  // Texto plano canónico ya revisado por el admin: es la fuente de verdad de la
  // que se trocea/embebe. Permite editar y re-ingerir en sitio sin re-parsear, y
  // guardar solo texto (se borra el blob original tras revisar) — menos storage.
  content: text('content'),
  status: text('status').notNull().default('pending'), // pending|processing|ready|failed
  error: text('error'),
  chunkCount: integer('chunk_count').notNull().default(0),
  // Nº de preguntas frecuentes (Q&A) generadas a partir de esta fuente.
  qaCount: integer('qa_count').notNull().default(0),
  // Prioridad de la fuente: ante similitud parecida, gana la de mayor prioridad
  // (info nueva/autoritativa por encima de la vieja). 0 = normal.
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// knowledge_qa — preguntas frecuentes generadas (gpt-4o-mini) por documento.
// Doble valor: (1) visibilidad del conocimiento que aporta cada fuente en el
// panel; (2) mejor recuperación — se embebe la PREGUNTA y el RAG también busca
// aquí (los clientes escriben preguntas → mejor match). La respuesta se deriva
// EXCLUSIVAMENTE del texto de la fuente; el bot no inventa.
export const knowledgeQa = pgTable(
  'knowledge_qa',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(), // de la pregunta
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('qa_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops'))],
)

// knowledge_chunks — vectores RAG (text-embedding-3-small, 1536 dim, índice HNSW cosine)
export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
)

// images — banco de imágenes ilustrativas. El bot adjunta SOLO imágenes de aquí
// (tool find_image), nunca inventa URLs. Se buscan por similitud sobre el
// embedding de nombre+descripción+etiquetas. La URL es pública (Meta la descarga).
export const images = pgTable(
  'images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    tags: jsonb('tags').notNull().default([]), // string[]
    url: text('url').notNull(), // blob público
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('images_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops'))],
)

// materials — precios minorista/mayorista en COP
export const materials = pgTable('materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  unit: text('unit').notNull().default('kg'), // kg|ton|unidad
  retailPriceCop: numeric('retail_price_cop').notNull(),
  wholesalePriceCop: numeric('wholesale_price_cop'),
  wholesaleThreshold: numeric('wholesale_threshold'),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// customer_profiles — memoria de largo plazo (el bot recuerda al cliente entre conversaciones)
export const customerProfiles = pgTable(
  'customer_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channel: text('channel').notNull(),
    externalId: text('external_id').notNull(),
    contact: text('contact'), // teléfono/email — clave de unificación entre canales
    name: text('name'),
    company: text('company'),
    facts: jsonb('facts'), // hechos aprendidos: materiales, volúmenes, preferencias, tono
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('customer_profiles_channel_external_id_uniq').on(t.channel, t.externalId)],
)

// conversations — una por usuario-canal; memoria de corto plazo + enlace al perfil
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channel: text('channel').notNull(), // messenger|whatsapp|instagram|web (texto libre)
    externalId: text('external_id').notNull(), // en web = sessionId anónimo
    customerId: uuid('customer_id').references(() => customerProfiles.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name'),
    status: text('status').notNull().default('bot_active'), // bot_active|human_controlled|closed
    summary: text('summary'), // resumen acumulado para conversaciones largas
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('conversations_channel_external_id_uniq').on(t.channel, t.externalId)],
)

// messages — cada turno de una conversación
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user|assistant|human_agent|system
  content: text('content').notNull(),
  channelMessageId: text('channel_message_id'), // ID del mensaje en Meta (idempotencia)
  // Trazabilidad del turno del bot: { model, routerReason, contextUsed, topScores, tools }.
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// leads — solicitudes capturadas para cotización
export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Nullable: un lead del playground (o de la web sin hilo) puede no tener
  // conversación asociada.
  conversationId: uuid('conversation_id').references(() => conversations.id, {
    onDelete: 'cascade',
  }),
  name: text('name'),
  contact: text('contact'), // teléfono/email capturado
  interest: text('interest'), // material/servicio de interés
  materialId: uuid('material_id').references(() => materials.id, { onDelete: 'set null' }),
  quantity: numeric('quantity'),
  requestedDiscount: boolean('requested_discount').notNull().default(false),
  discountApprovedPct: numeric('discount_approved_pct'),
  status: text('status').notNull().default('new'), // new|contacted|quoted|won|lost
  notes: text('notes'),
  // Lead de PRUEBA (capturado desde el playground): visible pero claramente
  // marcado, no notifica al admin. Para ver el flujo como en producción.
  test: boolean('test').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// knowledge_gaps — preguntas sin respuesta (bucle de aprendizaje)
export const knowledgeGaps = pgTable('knowledge_gaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id, {
    onDelete: 'set null',
  }),
  question: text('question').notNull(),
  status: text('status').notNull().default('open'), // open|resolved
  resolvedAnswer: text('resolved_answer'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// webhook_events — idempotencia de reintentos de Meta
export const webhookEvents = pgTable('webhook_events', {
  eventId: text('event_id').primaryKey(), // id del mensaje de Meta
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow(),
})
