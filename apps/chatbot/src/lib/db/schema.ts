import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  serial,
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
  // Ubicación de la sede para la TARJETA de ubicación que envía el bot:
  //  - WhatsApp: tarjeta nativa interactiva (usa lat/lng + nombre/dirección).
  //  - Messenger/IG: tarjeta (template) con imagen de mapa (Google Static Maps si hay
  //    GOOGLE_MAPS_API_KEY) + botón "Abrir en Maps".
  locationName: text('location_name'),
  locationAddress: text('location_address'),
  locationLat: numeric('location_lat'),
  locationLng: numeric('location_lng'),
  // Enlace de Maps (opcional); si falta se deriva de lat/lng.
  locationMapsUrl: text('location_maps_url'),
  retentionMonths: integer('retention_months').notNull().default(12), // Habeas Data
  maxAutoDiscountPct: numeric('max_auto_discount_pct').notNull().default('0'),
  // Generar preguntas frecuentes (Q&A) al ingerir documentos (gpt-4o-mini).
  // Toggle de costo: el admin puede apagarlo desde Ajustes.
  qaGenerationEnabled: boolean('qa_generation_enabled').notNull().default(true),
  // Afinación del bot (no-code). NULL = usar el valor por defecto del código.
  ragK: integer('rag_k'), // nº de fragmentos a recuperar
  ragMinScore: numeric('rag_min_score'), // umbral de similitud [0..1]
  mediaMinScore: numeric('media_min_score'), // umbral para adjuntar medios [0..1]
  temperature: numeric('temperature'), // creatividad del modelo [0..1]
  maxAttachments: integer('max_attachments'), // tope de medios por respuesta
  // Reglas/instrucciones extra que el admin agrega al system prompt (no-code).
  extraInstructions: text('extra_instructions'),
  // Centro de notificaciones (multi-canal, configurable desde la UI):
  // { email:{enabled,to,resendKey,from}, telegram:{enabled,token,chatId}, whatsapp:{enabled} }
  notifications: jsonb('notifications'),
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
    // Medio fijo de esta FAQ: el bot lo adjunta cuando esta pregunta se recupera.
    imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('qa_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('qa_source_idx').on(t.sourceId), // FK: borrar/listar Q&A por fuente
  ],
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
    index('chunks_source_idx').on(t.sourceId), // FK: borrar/listar chunks por fuente
  ],
)

// images — banco de imágenes ilustrativas. El bot adjunta SOLO imágenes de aquí
// (tool find_image), nunca inventa URLs. Se buscan por similitud sobre el
// embedding de nombre+descripción+etiquetas. La URL es pública (Meta la descarga).
export const images = pgTable(
  'images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: text('type').notNull().default('image'), // image | video
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    tags: jsonb('tags').notNull().default([]), // string[]
    url: text('url').notNull(), // URL pública servida por /api/media/<id> (proxy)
    blobUrl: text('blob_url'), // URL del blob PRIVADO (la lee el proxy con el token)
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
  unit: text('unit').notNull().default('kg'), // libre: kg|ton|unidad|libra|metro|galón…
  retailPriceCop: numeric('retail_price_cop').notNull(),
  wholesalePriceCop: numeric('wholesale_price_cop'),
  wholesaleThreshold: numeric('wholesale_threshold'),
  // Segundo escalón mayorista (volumen mayor): precio + umbral aún más bajo.
  wholesalePrice2Cop: numeric('wholesale_price2_cop'),
  wholesaleThreshold2: numeric('wholesale_threshold2'),
  // Cantidad mínima para comprar/vender este material (en su unidad).
  minOrder: numeric('min_order'),
  active: boolean('active').notNull().default(true),
  // Medio fijo del material (foto/clip): el bot lo adjunta al cotizarlo.
  imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
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
  (t) => [
    unique('conversations_channel_external_id_uniq').on(t.channel, t.externalId),
    index('conversations_last_msg_idx').on(t.lastMessageAt), // listado por actividad
  ],
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
}, (t) => [
  // Consulta caliente: últimos mensajes de una conversación por fecha.
  index('messages_conv_created_idx').on(t.conversationId, t.createdAt),
])

// leads — solicitudes capturadas para cotización
export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Identificador corto y legible para humanos: "Lead #<ref>" (búsqueda/notificación).
  ref: serial('ref').notNull(),
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
  unit: text('unit'), // unidad de la cantidad acordada (ej. kg) — la confirma el bot
  requestedDiscount: boolean('requested_discount').notNull().default(false),
  discountApprovedPct: numeric('discount_approved_pct'),
  // Datos del "casi cierre": el bot los acuerda con el cliente y los deja listos
  // para que un humano solo confirme el pago y coordine.
  agreedPriceCop: numeric('agreed_price_cop'), // precio final pactado (con descuento)
  fulfillment: text('fulfillment'), // logística: lleva a planta / recogemos + dirección
  scheduledFor: text('scheduled_for'), // fecha/horario acordado (texto del cliente)
  paymentMethod: text('payment_method'), // método de pago acordado (efectivo/transferencia…)
  status: text('status').notNull().default('new'), // new|contacted|quoted|ready|won|lost
  notes: text('notes'),
  // Lead de PRUEBA (capturado desde el playground): visible pero claramente
  // marcado, no notifica al admin. Para ver el flujo como en producción.
  test: boolean('test').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('leads_conversation_idx').on(t.conversationId), // upsert/lookup por conversación
  index('leads_created_idx').on(t.createdAt), // listado por fecha
])

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
}, (t) => [index('gaps_conversation_idx').on(t.conversationId)])

// test_scenarios — escenarios de prueba del bot, editables desde el panel.
// Cada uno define una conversación (turnos del cliente) y qué se espera del bot
// en el último turno (tools, contexto, texto). Se corren en modo eval (no escriben).
export const testScenarios = pgTable('test_scenarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  messages: jsonb('messages').notNull().default([]), // string[] — turnos del cliente
  // { expectTools?: string[]; forbidTools?: string[]; expectContext?: 'any'|'with'|'without';
  //   replyIncludes?: string; replyExcludes?: string }
  expectations: jsonb('expectations').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// webhook_events — idempotencia de reintentos de Meta
export const webhookEvents = pgTable('webhook_events', {
  eventId: text('event_id').primaryKey(), // id del mensaje de Meta
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow(),
})

// quotes — cotizaciones formales generadas desde un lead (o a mano). Snapshot editable
// con líneas; se comparten por un enlace público imprimible (/cotizacion/<id>).
export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  ref: serial('ref').notNull(), // "Cotización #N"
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  customerName: text('customer_name'),
  customerContact: text('customer_contact'),
  // [{ description, quantity, unit, unitPriceCop }]
  items: jsonb('items').notNull().default([]),
  notes: text('notes'),
  validDays: integer('valid_days').notNull().default(8), // vigencia en días
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// system_events — bitácora de salud (errores/avisos) para el Panel de salud. Antes
// los fallos solo iban a console; aquí el admin los ve sin esperar quejas.
export const systemEvents = pgTable(
  'system_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    level: text('level').notNull(), // error | warning | info
    source: text('source').notNull(), // webhook | generate | ingest | notify | …
    message: text('message').notNull(),
    context: jsonb('context'), // datos adicionales del evento
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('system_events_created_idx').on(t.createdAt)],
)
