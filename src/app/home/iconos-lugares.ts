import * as L from 'leaflet';
import { binoculars, library, restaurant, cafe, location } from 'ionicons/icons';
import { Categoria } from '../services/registro-ubicacion.service';

/** Nombre que se muestra para cada categoría. */
export const NOMBRES_CATEGORIA: Record<Categoria, string> = {
  mirador: 'Mirador',
  museo: 'Museo',
  restaurante: 'Restaurante',
  cafeteria: 'Cafetería',
  otro: 'Otro',
};

/** Ícono de Ionicons para cada categoría. */
const ICONO_CATEGORIA: Record<Categoria, string> = {
  mirador: binoculars,
  museo: library,
  restaurante: restaurant,
  cafeteria: cafe,
  otro: location,
};

/**
 * Crea el pin (de un color por categoría) con su ícono en el centro.
 * Los íconos de Ionicons vienen como "data:image/svg+xml;utf8,<svg...>",
 * así que les quitamos ese prefijo para usar el <svg> directamente.
 */
export function iconoLugar(categoria: Categoria): L.DivIcon {
  const svg = ICONO_CATEGORIA[categoria].replace('data:image/svg+xml;utf8,', '');

  return L.divIcon({
    className: 'pin-lugar',
    html: `<div class="pin pin-${categoria}"><span>${svg}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 41], // la punta del pin
    popupAnchor: [0, -38],
  });
}