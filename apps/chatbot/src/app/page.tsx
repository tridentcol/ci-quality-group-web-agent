import { redirect } from "next/navigation";

// La home redirige directo a /sign-in (pública, 200 siempre). Antes redirigía
// a /dashboard esperando que el proxy de Clerk reenviara a /sign-in, pero
// auth.protect() en una ruta de página sin sesión responde 404 (rewrite), no
// redirect — dejaba la raíz del sitio rota para visitantes anónimos y para el
// crawler de Meta (bloqueaba "Publicar" en App Review: "Se detectó una URL
// dañada"). Un admin ya logueado que caiga aquí es reenviado a /dashboard por
// el propio componente <SignIn /> (fallback redirect de Clerk).
export default function Home() {
  redirect("/sign-in");
}
