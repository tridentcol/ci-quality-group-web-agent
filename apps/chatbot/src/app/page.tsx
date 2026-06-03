import { redirect } from "next/navigation";

// La home redirige al panel. Si no hay sesión, el proxy de Clerk
// llevará a /sign-in al alcanzar /dashboard (ruta protegida).
export default function Home() {
  redirect("/dashboard");
}
