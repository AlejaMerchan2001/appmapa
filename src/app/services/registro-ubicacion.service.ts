import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type Categoria = 'mirador' | 'museo' | 'restaurante' | 'cafeteria' | 'otro';

export interface RegistroUbicacion {
  id: string;
  /** Nombre del lugar (opcional en registros antiguos). */
  nombre?: string;
  lat: number;
  lng: number;
  /** Descripción del lugar. */
  nota: string;
  fotoBase64: string;
  fecha: string;
  /** Opcional: los registros antiguos no la tienen y se tratan como 'otro'. */
  categoria?: Categoria;
  /** Calificación de 1 a 5 estrellas (0 = sin calificar). */
  calificacion?: number;
  /** Etiquetas elegidas, por ejemplo "Wifi" o "Económico". */
  etiquetas?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class RegistroUbicacionService {
  private readonly STORAGE_KEY = 'registros_ubicacion';

  /** Devuelve todos los registros guardados. */
  async obtenerTodos(): Promise<RegistroUbicacion[]> {
    const { value } = await Preferences.get({ key: this.STORAGE_KEY });
    if (!value) {
      return [];
    }
    try {
      return JSON.parse(value) as RegistroUbicacion[];
    } catch {
      return [];
    }
  }

  /** Agrega un nuevo registro y lo persiste. Devuelve el registro creado. */
  async agregar(datos: Omit<RegistroUbicacion, 'id' | 'fecha'>): Promise<RegistroUbicacion> {
    const registros = await this.obtenerTodos();

    const nuevo: RegistroUbicacion = {
      id: Date.now().toString(),
      fecha: new Date().toLocaleString(),
      ...datos,
    };

    registros.push(nuevo);

    try {
      await this.guardarTodos(registros);
    } catch (error) {
      // Normalmente QuotaExceededError: la foto es demasiado grande para el
      // almacenamiento web (localStorage, ~5 MB). Revertimos para no dejar el
      // estado inconsistente y avisamos a quien llama.
      registros.pop();
      throw new Error(
        'No hay espacio para guardar el registro. La foto es demasiado grande o se alcanzó el límite de almacenamiento.'
      );
    }

    return nuevo;
  }

  /** Elimina un registro por id. */
  async eliminar(id: string): Promise<void> {
    const registros = (await this.obtenerTodos()).filter((r) => r.id !== id);
    await this.guardarTodos(registros);
  }

  /** Borra todos los registros. */
  async limpiar(): Promise<void> {
    await Preferences.remove({ key: this.STORAGE_KEY });
  }

  private async guardarTodos(registros: RegistroUbicacion[]): Promise<void> {
    await Preferences.set({
      key: this.STORAGE_KEY,
      value: JSON.stringify(registros),
    });
  }
}