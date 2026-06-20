import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { botConfig } from "@/lib/db/schema";
import { SettingsForm, type BusinessHours, type Channels } from "./settings-form";

export default async function SettingsPage() {
  const [cfg] = await db.select().from(botConfig).where(eq(botConfig.id, 1));

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identidad y tono del bot, horarios, canales, privacidad y descuentos.
        </p>
      </header>

      {cfg ? (
        <SettingsForm
          initial={{
            botName: cfg.botName,
            tonePrompt: cfg.tonePrompt,
            welcomeMessage: cfg.welcomeMessage,
            afterHoursMessage: cfg.afterHoursMessage,
            businessHours: (cfg.businessHours as BusinessHours | null) ?? null,
            channelsEnabled: cfg.channelsEnabled as Channels,
            adminWhatsapp: cfg.adminWhatsapp,
            retentionMonths: cfg.retentionMonths,
            maxAutoDiscountPct: Number(cfg.maxAutoDiscountPct),
            qaGenerationEnabled: cfg.qaGenerationEnabled,
          }}
        />
      ) : (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No hay configuración. Corre <code className="font-mono">pnpm --filter chatbot seed</code>.
        </p>
      )}
    </div>
  );
}
