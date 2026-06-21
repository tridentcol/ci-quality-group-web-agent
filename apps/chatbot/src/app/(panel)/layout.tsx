import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/panel/sidebar";
import { MobileNav } from "@/components/panel/mobile-nav";
import { CommandMenu } from "@/components/panel/command-menu";
import { ConfirmProvider } from "@/components/panel/confirm-dialog";

// El proxy ya protege estas rutas; este guard es defensa en profundidad.
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-full flex-1 flex-col lg:flex-row">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main id="contenido" className="flex-1 overflow-y-auto bg-background">
          <ConfirmProvider>{children}</ConfirmProvider>
        </main>
      </div>
      <CommandMenu />
      <Toaster richColors position="bottom-right" closeButton />
    </div>
  );
}
