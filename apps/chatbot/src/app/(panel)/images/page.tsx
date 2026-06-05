import { ImagesManager } from "./images-manager";

export default function ImagesPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Imágenes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Banco de imágenes ilustrativas. El bot adjunta solo imágenes de aquí cuando ayudan a
          explicar (foto de un material, diagrama de un proceso, una sede). La descripción y las
          etiquetas son las que usa para encontrarlas.
        </p>
      </header>
      <ImagesManager />
    </div>
  );
}
