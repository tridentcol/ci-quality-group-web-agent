/**
 * Contenido de las 3 líneas de negocio. Fuente única para la portada (tarjetas)
 * y para cada subpágina de detalle (/manufactura, /valorizacion, /servicios-ambientales).
 * Editar aquí el texto; la media real se coloca en /public/images o /public/videos
 * y se referencia en `media`.
 */
export interface Linea {
  slug: string;
  num: string;
  tag: string;
  title: string;
  /** Frase corta para la tarjeta y el hero de la subpágina. */
  tagline: string;
  /** Resumen breve para la tarjeta de la portada. */
  summary: string;
  /** Párrafos de la introducción en la subpágina. */
  intro: string[];
  /** Puntos destacados / capacidades. */
  highlights: { title: string; body: string }[];
  chips: string[];
  /** Media del hero de la subpágina. */
  media: {
    /** Etiqueta del placeholder si no hay media real. */
    label: string;
    image?: string; // p.ej. '/images/manufactura-hero.jpg'
    video?: string; // p.ej. '/videos/manufactura.mp4'
    poster?: string;
  };
  /** Fotos de la galería de la subpágina de detalle. */
  gallery?: string[];
}

export const lineas: Linea[] = [
  {
    slug: 'manufactura',
    num: '01',
    tag: 'Manufactura',
    title: 'Lámina arquitectónica trapezoidal',
    tagline: 'Acero PPGL galvalume conformado en frío para cubiertas y fachadas de alto desempeño.',
    summary:
      'Producción de lámina en acero PPGL galvalume, conformada en frío desde bobina para cubiertas y fachadas de alto desempeño.',
    intro: [
      'Fabricamos lámina arquitectónica trapezoidal en acero PPGL galvalume, conformada en frío directamente desde bobina. Un producto pensado para cubiertas y fachadas que exigen durabilidad, buen acabado y desempeño estructural.',
      'Cada lote se produce bajo estándares técnicos exigentes, con trazabilidad del material, para responder a proyectos de industria, energía y construcción de gran escala.',
    ],
    highlights: [
      { title: 'Acero PPGL galvalume', body: 'Recubrimiento de alta resistencia a la corrosión, ideal para ambientes industriales y costeros.' },
      { title: 'Conformado en frío', body: 'Perfilado desde bobina que preserva las propiedades del acero y garantiza geometría precisa.' },
      { title: 'Cubierta y fachada', body: 'Perfil trapezoidal versátil para techos y envolventes arquitectónicas de alto desempeño.' },
      { title: 'Estándar y trazabilidad', body: 'Producción controlada con trazabilidad del material de principio a fin.' },
    ],
    chips: ['Acero PPGL', 'Galvalume', 'Conformado en frío'],
    media: { label: 'foto / video de producción de lámina', image: '/images/manufactura-hero.jpg' },
    gallery: ['/images/manufactura-1.jpg', '/images/manufactura-2.jpg', '/images/manufactura-3.jpg'],
  },
  {
    slug: 'valorizacion',
    num: '02',
    tag: 'Valorización',
    title: 'Valorización y chatarra',
    tagline: 'Aprovechamiento de residuos industriales y comercialización moderna de chatarra.',
    summary:
      'Aprovechamiento de residuos industriales y comercialización moderna de chatarra, devolviendo el material al ciclo productivo.',
    intro: [
      'Recuperamos el valor de los residuos industriales y de la chatarra, devolviendo el material al ciclo productivo en lugar de enviarlo a disposición. Es economía circular aplicada: lo que otros descartan vuelve a ser materia prima.',
      'Operamos con trazabilidad y procesos de comercialización modernos, dando a grandes generadores una alternativa responsable, medible y rentable para sus flujos de material.',
    ],
    highlights: [
      { title: 'Aprovechamiento', body: 'Clasificación y recuperación de materiales para su reincorporación al ciclo productivo.' },
      { title: 'Chatarra', body: 'Compra y comercialización moderna de chatarra ferrosa y no ferrosa.' },
      { title: 'Trazabilidad', body: 'Registro y seguimiento del material para una gestión transparente y verificable.' },
      { title: 'Enfoque industrial', body: 'Soluciones a la medida de grandes generadores de industria y energía.' },
    ],
    chips: ['Aprovechamiento', 'Chatarra', 'Trazabilidad'],
    media: { label: 'foto / video de patio y valorización', image: '/images/valorizacion-hero.jpg' },
    gallery: ['/images/valorizacion-1.jpg', '/images/valorizacion-2.jpg', '/images/valorizacion-3.jpg'],
  },
  {
    slug: 'servicios-ambientales',
    num: '03',
    tag: 'Ambiental',
    title: 'Servicios ambientales',
    tagline: 'Recolección, transporte y disposición final con gestión autorizada y responsable.',
    summary:
      'Recolección, transporte y disposición final de residuos ordinarios, RESPEL y RCD con gestión autorizada y responsable.',
    intro: [
      'Gestionamos el ciclo completo de residuos: recolección, transporte y disposición final de residuos ordinarios, peligrosos (RESPEL) y de construcción y demolición (RCD), con gestión autorizada.',
      'Un servicio con compromiso ambiental verificable —sin greenwashing— y trazabilidad total, para clientes que necesitan cumplir y demostrar su responsabilidad ambiental.',
    ],
    highlights: [
      { title: 'Residuos ordinarios', body: 'Recolección y disposición final responsable de residuos no peligrosos.' },
      { title: 'RESPEL', body: 'Manejo de residuos peligrosos con gestión autorizada y trazabilidad.' },
      { title: 'RCD', body: 'Gestión de residuos de construcción y demolición para obras y proyectos.' },
      { title: 'Cumplimiento verificable', body: 'Documentación y trazabilidad para demostrar el cumplimiento ambiental.' },
    ],
    chips: ['Ordinarios', 'RESPEL', 'RCD'],
    media: { label: 'foto / video de gestión ambiental', image: '/images/ambiental-hero.jpg' },
    gallery: ['/images/ambiental-1.jpg', '/images/ambiental-2.jpg', '/images/ambiental-3.jpg'],
  },
];

export const getLinea = (slug: string): Linea | undefined => lineas.find((l) => l.slug === slug);
