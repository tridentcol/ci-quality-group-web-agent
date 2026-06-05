/**
 * Parámetros del RAG, centralizados para afinarlos en un solo sitio.
 * Mídelos con el playground (muestra los scores reales) antes de cambiarlos.
 */

/** Nº de fragmentos a recuperar por consulta. */
export const RAG_K = 5

/**
 * Umbral mínimo de similitud coseno [0..1] para considerar un fragmento.
 * 0.2 era muy permisivo (colaba ruido); 0.25 descarta lo casi-irrelevante sin
 * quedarse corto con preguntas parafraseadas.
 */
export const RAG_MIN_SCORE = 0.25

/**
 * Boost por punto de prioridad de la fuente (se suma al score efectivo solo para
 * ORDENAR, no para filtrar). Acotado a 5 puntos → hasta +0.05. Deja que una
 * fuente prioritaria gane ante empates de similitud, sin romper el ranking.
 */
export const PRIORITY_BOOST = 0.01
export const PRIORITY_BOOST_MAX = 5
