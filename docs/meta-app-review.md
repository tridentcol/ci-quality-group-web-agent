# Meta App Review — CI Quality Group (asistente de atención al cliente)

Guía para el paso **Uso permitido** (Permissions & Features). Para cada permiso Meta pide:
descripción, screencast, (algunos) llamadas de prueba a la API y confirmación de cumplimiento.

> **Las descripciones están en inglés a propósito**: el equipo de revisión de Meta es global y
> revisa en inglés. Reduce ambigüedad y acelera la aprobación. (Si prefieres, hay versión en español.)

---

## Estrategia: pide solo lo que puedas demostrar

Meta exige **ver la experiencia funcionando** en el screencast para cada permiso. Por eso:

- **Envía AHORA (Messenger, ya funciona):** `pages_messaging`, `pages_show_list`,
  `pages_manage_metadata`, `public_profile` (y `business_management` solo si lo necesitas para el
  flujo de conexión).
- **Deja para una 2ª solicitud (cuando WhatsApp esté en vivo):** `whatsapp_business_messaging`,
  `whatsapp_business_management`. Si los envías sin poder grabar WhatsApp respondiendo, los rechazan.

Editar la solicitud y quitar permisos no penaliza; pedir algo que no puedes demostrar sí cuesta un
rechazo y reinicia tiempos.

---

## Descripciones (pegar en "Describe cómo tu app usa este permiso")

### pages_messaging
> Our app is an AI-powered customer-service assistant for CI Quality Group, a Colombian company that
> handles waste disposal, vehicle scrapping, and the purchase/sale of scrap metal. When a customer
> sends a message to the business's Facebook Page via Messenger, the app receives it through the
> messaging webhook, generates a reply from the company's own knowledge base and official price list,
> and sends the response back to the customer using the Send API. The assistant answers product and
> service questions, shares prices and quotes, and captures purchase/sale leads. A human agent can
> take over any conversation from our admin panel. We use `pages_messaging` solely to receive and
> respond to messages that customers initiate with the Page.

### pages_show_list
> During onboarding, the business administrator connects the app to their Facebook Page. We use
> `pages_show_list` to display the Pages the administrator manages so they can select the correct
> Page to connect for customer messaging. We do not access Pages the administrator has not selected.

### pages_manage_metadata
> After the administrator selects their Page, we use `pages_manage_metadata` to subscribe our app to
> that Page's messaging webhooks (subscribed_apps) so the app can receive incoming customer messages
> in real time. This is required to deliver the Messenger auto-reply experience. We only manage the
> webhook subscription for the Page the administrator explicitly connects.

### business_management
> We use `business_management` to access the business assets (the Facebook Page, and later the
> WhatsApp Business Account) that the administrator authorizes during onboarding, so the app can be
> connected to the correct business and operate messaging on its behalf. It is used only to read and
> connect the assets the administrator explicitly grants; we do not modify other business settings.
>
> *(Si tu flujo de conexión NO usa Business Manager, considera quitar este permiso: es de los que más
> escrutinio reciben.)*

### public_profile
> We use `public_profile` as part of Facebook Login so the business administrator can authenticate
> and connect their Page (and WhatsApp) assets to the app. We only use basic profile information
> (name) to identify the signed-in administrator within the admin panel.

### whatsapp_business_messaging  *(2ª solicitud)*
> The app provides the same AI customer-service assistant on WhatsApp. When a customer messages the
> business's WhatsApp Business number, the app receives the message via webhook and replies using the
> company's knowledge base and official price list, supporting product questions, prices, quotes, and
> human handoff from the admin panel. We use `whatsapp_business_messaging` to send and receive these
> customer-initiated service messages.

### whatsapp_business_management  *(2ª solicitud)*
> We use `whatsapp_business_management` to read the configuration of the WhatsApp Business Account the
> administrator connects during onboarding (e.g., the registered phone number) so the app routes
> messages to the correct number. It is used only for the account the administrator authorizes.

---

## Llamadas de prueba a la API (requisito para varios permisos)

Meta exige que tu app **haya hecho al menos una llamada real** con el permiso antes de enviar. Cómo
generarlas:

- **pages_messaging:** desde una cuenta de prueba (o un rol de la app), envía un mensaje a la Página
  y deja que el bot responda → genera una llamada `POST /me/messages` (Send API). También recibir el
  webhook cuenta.
- **pages_manage_metadata:** la suscripción del webhook (`POST /{page-id}/subscribed_apps`) ya cuenta;
  vuelve a guardar la conexión de la Página en el panel si hace falta registrarla de nuevo.
- **business_management / whatsapp_*:** se registran al conectar los assets y al enviar un mensaje de
  WhatsApp de prueba.

Verás las llamadas en **App Dashboard → App Roles/Analytics → API calls** (o el medidor de cada
permiso pasa a "cumplido").

---

## Guion del screencast (Messenger)

Graba una sola toma, ~1–3 min, mostrando la experiencia real de punta a punta. Sin cortes que oculten
pasos. Idealmente con narración o subtítulos en inglés.

1. **Login del admin** en `bot.ci-quality-group.com` (pantalla de inicio de sesión → panel).
2. **(Si aplica) Conexión de la Página:** muestra el flujo de Facebook Login y la selección de la
   Página de la lista (esto evidencia `pages_show_list` + `pages_manage_metadata`).
3. **Cliente escribe en Messenger:** abre Messenger (como cliente/cuenta de prueba) y envía una
   pregunta real, p. ej. *"¿A cuánto compran el cobre?"* o *"¿Hacen disposición de desechos?"*.
4. **El bot responde automáticamente** en Messenger con la información/precio (evidencia
   `pages_messaging`).
5. **En el panel** muestra que la conversación y el **lead** aparecen (Conversaciones / Leads).
6. **Relevo humano:** responde manualmente desde el panel → el mensaje llega al cliente en Messenger.
7. Cierra mostrando el aviso de privacidad enlazado (`/privacidad`).

> Sube el MISMO video en cada permiso de Messenger (Meta lo permite si el flujo muestra ese permiso).

---

## Instrucciones para reproducir (campo "cómo reproducir esta función")

Para `pages_messaging` (y útil para los demás). El revisor debe poder probarlo:

```
1. Abre Messenger y escribe a la Página "CI Quality Group": <enlace m.me/ o nombre de la Página>.
2. Envía: "¿A cuánto compran el cobre?"
3. En segundos, el asistente responde con la información/precio desde la base de conocimiento.
4. Envía: "Quiero vender 200 kg, ¿cómo coordinamos?" → el asistente pide datos y registra el lead.
5. (Panel de administración, acceso de prueba abajo) La conversación y el lead aparecen en el panel;
   un agente humano puede responder manualmente y el cliente lo recibe en Messenger.

Acceso de prueba al panel (solo lectura recomendado):
  URL:    https://bot.ci-quality-group.com
  Correo: <crea un usuario de prueba en Clerk para el revisor>
  Clave:  <…>
```

> Crea un **usuario de prueba** en Clerk para el revisor (no compartas tu cuenta). Si el panel no es
> imprescindible para evaluar el permiso, basta con el flujo de Messenger + el screencast.

---

## Confirmaciones de cumplimiento

Marca "Confirmo que cumpliré con el uso permitido" en cada uno. Es coherente con la realidad de la app:
solo respondes mensajes **iniciados por el cliente**, no envías promociones no solicitadas, no
compartes datos con terceros con fines publicitarios, y respetas Habeas Data (Ley 1581) con borrado
por retención. El aviso público está en `bot.ci-quality-group.com/privacidad`.
