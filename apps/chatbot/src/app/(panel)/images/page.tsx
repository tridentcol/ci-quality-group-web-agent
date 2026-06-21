import { ImagesManager } from "./images-manager";

export default function ImagesPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Medios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Banco de imágenes y videos cortos. El bot adjunta solo medios de aquí cuando ayudan a
          explicar (foto de un material, diagrama o clip de un proceso, una sede). Puedes vincular un
          medio fijo a un material (en Precios) o a una pregunta; si no, lo busca por descripción/etiquetas.
        </p>
      </header>
      <ImagesManager />
    </div>
  );
}
