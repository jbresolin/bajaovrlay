import type { Graphic, Layer } from '@bajaovrlay/shared';

/**
 * The name the operator knows a graphic by (its manifest's name). Falls back to the id:
 * an item outlives its graphic's package being removed, and its row must still say
 * something about what it would put on air.
 */
export function findGraphicNameOrItsId(graphics: Graphic[], graphicId: string): string {
  const graphic = graphics.find((candidate) => candidate.id === graphicId);
  return graphic?.manifest.name ?? graphicId;
}

/** The name of a layer as the layer panel shows it, or its id when the layer is unknown. */
export function findLayerNameOrItsId(layers: Layer[], layerId: string): string {
  const layer = layers.find((candidate) => candidate.id === layerId);
  return layer?.name ?? layerId;
}
