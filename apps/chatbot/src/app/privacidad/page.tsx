// Aviso de privacidad y tratamiento de datos (Ley 1581/2012, Colombia).
// Página PÚBLICA (proxy.ts no la protege): se enlaza desde el bot y el panel.

export const metadata = {
  title: "Aviso de privacidad — CI Quality Group",
  description: "Política de tratamiento de datos personales (Ley 1581 de 2012).",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Aviso de privacidad y tratamiento de datos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        CI Quality Group · Última actualización: junio de 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          En cumplimiento de la <strong>Ley 1581 de 2012</strong> y sus decretos reglamentarios
          (Habeas Data), CI Quality Group informa cómo trata los datos personales de quienes
          interactúan con su asistente de atención al cliente por Messenger, WhatsApp e Instagram.
        </p>

        <Section title="1. Responsable del tratamiento">
          CI Quality Group, empresa de disposición final de desechos, chatarrización y compra/venta
          de chatarra en Colombia. Para ejercer sus derechos puede escribir por los mismos canales de
          atención.
        </Section>

        <Section title="2. Datos que recolectamos">
          Mensajes que usted nos envía, su nombre y datos de contacto (teléfono o correo) cuando los
          proporciona, y la información necesaria para atender sus solicitudes y cotizaciones
          (materiales de interés, cantidades). No solicitamos datos sensibles.
        </Section>

        <Section title="3. Finalidad">
          Responder consultas, cotizar precios, gestionar solicitudes/leads, dar continuidad a la
          conversación y mejorar la atención. No vendemos ni compartimos sus datos con terceros con
          fines publicitarios.
        </Section>

        <Section title="4. Conservación">
          Conservamos las conversaciones por el período de retención configurado por la empresa
          (por defecto 12 meses) y luego se eliminan automáticamente. Los datos de perfil se
          conservan mientras exista relación o hasta que solicite su supresión.
        </Section>

        <Section title="5. Sus derechos">
          Usted puede <strong>conocer, actualizar, rectificar y suprimir</strong> sus datos, y
          revocar la autorización de tratamiento. Para solicitar la eliminación de su perfil e
          historial, indíquelo por el canal de atención y procederemos conforme a la ley.
        </Section>

        <Section title="6. Autorización">
          Al continuar la conversación con nuestro asistente, usted autoriza el tratamiento de sus
          datos personales conforme a este aviso.
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </section>
  );
}
