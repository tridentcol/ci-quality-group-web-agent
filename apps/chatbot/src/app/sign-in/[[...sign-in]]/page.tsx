import { SignIn } from "@clerk/nextjs";

// Renderizado dinámico: evita prerender en build (que requeriría la publishableKey).
export const dynamic = "force-dynamic";

// Sin registro abierto: solo administradores invitados en Clerk.
// El SignUp no se expone; los usuarios se crean desde el dashboard de Clerk.
export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <SignIn />
    </div>
  );
}
