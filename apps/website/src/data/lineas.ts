/**
 * Contenido de las 4 líneas de negocio. Fuente única para la portada (tarjetas)
 * y para cada subpágina de detalle (/manufactura, /valorizacion, /servicios-ambientales,
 * /servicios-industriales). Editar aquí el texto; la media real se coloca en
 * /public/images o /public/videos y se referencia en `media`.
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
    title: 'Lámina, tuberías y cubiertas metálicas',
    tagline: 'Acero PPGL galvalume conformado en frío, compra/venta de tuberías y fabricación de cubiertas metálicas.',
    summary:
      'Producción de lámina en acero PPGL galvalume, compra y venta de tuberías, y fabricación, instalación y desinstalación de cubiertas metálicas a la medida.',
    intro: [
      'Fabricamos lámina arquitectónica trapezoidal en acero PPGL galvalume, conformada en frío directamente desde bobina. Un producto pensado para cubiertas y fachadas que exigen durabilidad, buen acabado y desempeño estructural.',
      'Además, compramos y vendemos tuberías de distintos calibres para todo tipo de proyecto, y fabricamos, instalamos y desinstalamos cubiertas metálicas a la medida para proyectos industriales, comerciales y residenciales.',
    ],
    highlights: [
      { title: 'Acero PPGL galvalume', body: 'Recubrimiento de alta resistencia a la corrosión, ideal para ambientes industriales y costeros.' },
      { title: 'Conformado en frío', body: 'Perfilado desde bobina que preserva las propiedades del acero y garantiza geometría precisa.' },
      { title: 'Cubierta y fachada', body: 'Perfil trapezoidal versátil para techos y envolventes arquitectónicas de alto desempeño.' },
      { title: 'Tuberías', body: 'Compra y venta de tuberías de diferentes calibres para todo tipo y tamaño de proyecto.' },
      { title: 'Instalación y desinstalación', body: 'Fabricación, instalación y desinstalación de cubiertas metálicas a la medida del proyecto.' },
      { title: 'Estándar y trazabilidad', body: 'Producción controlada con trazabilidad del material de principio a fin.' },
    ],
    chips: ['Acero PPGL', 'Galvalume', 'Tuberías', 'Cubiertas metálicas'],
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
      'Recolectamos el material ferroso y no ferroso directamente en la ubicación del cliente, con precios competitivos, y lo enviamos a siderúrgicas nacionales autorizadas, entregando certificado de disposición final.',
    ],
    highlights: [
      { title: 'Aprovechamiento', body: 'Clasificación y recuperación de materiales para su reincorporación al ciclo productivo.' },
      { title: 'Chatarra', body: 'Compra de chatarra ferrosa y no ferrosa con precios competitivos.' },
      { title: 'Recolección en sitio', body: 'Recogemos el material directamente en la ubicación del cliente.' },
      { title: 'Certificado de disposición final', body: 'Envío a siderúrgicas nacionales autorizadas con certificado de disposición final.' },
      { title: 'Trazabilidad', body: 'Registro y seguimiento del material para una gestión transparente y verificable.' },
    ],
    chips: ['Aprovechamiento', 'Chatarra', 'Trazabilidad', '+30 vagones'],
    media: { label: 'foto / video de patio y valorización', image: '/images/valorizacion-hero.jpg' },
    gallery: ['/images/valorizacion-1.jpg', '/images/valorizacion-2.jpg', '/images/valorizacion-3.jpg'],
  },
  {
    slug: 'servicios-ambientales',
    num: '03',
    tag: 'Ambiental',
    title: 'Servicios ambientales',
    tagline: 'Residuos, aguas residuales, gestión ambiental y RAEE, con gestión autorizada y responsable.',
    summary:
      'Recolección y disposición final de residuos ordinarios, RESPEL y RCD, aguas residuales, gestión ambiental y RAEE, con gestión autorizada.',
    intro: [
      'Gestionamos el ciclo completo de residuos: recolección, transporte y disposición final de residuos ordinarios, peligrosos (RESPEL) y de construcción y demolición (RCD), además de aguas residuales domésticas y no domésticas y limpieza de trampas y lodos.',
      'También acompañamos la gestión ambiental de nuestros clientes: diagnóstico y planificación, seguimiento de indicadores, consultoría para permisos y licencias ambientales, fumigación y control de plagas, y recolección de RAEE de paneles solares — con trazabilidad total y compromiso ambiental verificable.',
    ],
    highlights: [
      { title: 'Recolección y transporte de residuos', body: 'Residuos ordinarios, peligrosos y químicos (RESPEL) y de construcción y demolición (RCD) hasta su destino final.' },
      { title: 'Aguas residuales', body: 'Recolección de aguas residuales domésticas y no domésticas.' },
      { title: 'Trampas y lodos', body: 'Limpieza y desinfección de separadores de grasas, fosas sépticas, tanques de almacenamiento y plantas de tratamiento.' },
      { title: 'Gestión ambiental y permisos', body: 'Diagnóstico, planificación, seguimiento de indicadores y consultoría para el trámite de permisos y licencias ambientales.' },
      { title: 'RAEE — paneles solares', body: 'Desmontaje, transporte seguro y disposición de paneles solares mediante gestores autorizados.' },
      { title: 'Fumigación y control de plagas', body: 'Inspección y estrategias de control de plagas en instalaciones, con métodos seguros y efectivos.' },
    ],
    chips: ['Ordinarios', 'RESPEL', 'RCD', 'Aguas residuales', 'RAEE'],
    media: { label: 'foto / video de gestión ambiental', image: '/images/ambiental-hero.jpg' },
    gallery: [
      '/images/ambiental-1.jpg',
      '/images/ambiental-2.jpg',
      '/images/ambiental-3.jpg',
      '/images/ambiental-4.jpg',
      '/images/ambiental-5.jpg',
    ],
  },
  {
    slug: 'servicios-industriales',
    num: '04',
    tag: 'Industrial',
    title: 'Servicios industriales complementarios',
    tagline: 'Fabricación de vagones para volquetas, mantenimiento de aires acondicionados y suministro de personal calificado.',
    summary:
      'Fabricación y reparación de vagones para ampirroles y volquetas, mantenimiento de aires acondicionados y suministro de personal calificado.',
    intro: [
      'Además de manufactura, valorización y gestión ambiental, respaldamos a la industria con servicios complementarios: fabricamos y reparamos vagones a la medida para camiones ampirroles y volquetas, con materiales de alta calidad y estándares rigurosos de seguridad y durabilidad.',
      'También damos mantenimiento a equipos de aire acondicionado y ponemos a disposición personal calificado —mecánicos, electricistas, limpieza, poda y mantenimiento general— para la operación diaria de su empresa.',
    ],
    highlights: [
      { title: 'Vagones y volquetas', body: 'Fabricación y reparación de vagones a la medida para camiones ampirroles y volquetas, con diseño personalizado.' },
      { title: 'Materiales de alta calidad', body: 'Estándares rigurosos de seguridad y durabilidad en cada vagón fabricado.' },
      { title: 'Aires acondicionados', body: 'Técnicos especialistas en mantenimiento preventivo, correctivo, instalación y desinstalación de equipos y bombas.' },
      { title: 'Suministro de personal', body: 'Personal capacitado: mecánicos, electricistas, limpieza, poda y mantenimiento general.' },
    ],
    chips: ['Vagones', 'Volquetas', 'Aires acondicionados', 'Personal calificado'],
    media: { label: 'foto / video de fabricación de vagones', image: '/images/servicios-industriales-hero.jpg' },
    gallery: [
      '/images/servicios-industriales-1.jpg',
      '/images/servicios-industriales-2.jpg',
      '/images/servicios-industriales-3.jpg',
    ],
  },
];

export const getLinea = (slug: string): Linea | undefined => lineas.find((l) => l.slug === slug);
