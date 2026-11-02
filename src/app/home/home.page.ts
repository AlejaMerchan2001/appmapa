import { AfterViewInit, ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonModal, IonItem, IonLabel, IonTextarea, IonButton,
  IonButtons, IonSelect, IonSelectOption, IonInput, IonIcon, IonChip,
  IonList, ModalController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, cameraOutline, listOutline, star, starOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { CapturaComponent } from './captura.component';
import * as L from 'leaflet';
import { Categoria, RegistroUbicacion, RegistroUbicacionService } from '../services/registro-ubicacion.service';
import { iconoLugar, NOMBRES_CATEGORIA } from './iconos-lugares';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonModal, IonItem, IonLabel, IonTextarea, IonButton,
    IonButtons, IonSelect, IonSelectOption, IonInput, IonIcon, IonChip,
    IonList
  ],
})
export class HomePage implements AfterViewInit {
  /** Ventana de "Nuevo registro" (la que tiene #modal en el HTML). */
  @ViewChild('modal') modal!: IonModal;

  /** Controla si la lista "Mis lugares" está abierta. */
  listaAbierta = false;

  /** Marcadores dibujados, por id de registro (para abrirlos desde la lista). */
  private marcadores = new Map<string, L.Marker>();

  private map!: L.Map;
  /** Capa donde se dibujan los registros (se limpia al cambiar de pestaña). */
  private capaRegistros = L.layerGroup();

  /** Pestañas superiores para filtrar los lugares del mapa. */
  tabs: { id: 'todos' | Categoria; nombre: string }[] = [
    { id: 'todos', nombre: 'Todos' },
    { id: 'mirador', nombre: 'Miradores' },
    { id: 'museo', nombre: 'Museos' },
    { id: 'restaurante', nombre: 'Restaurantes' },
    { id: 'cafeteria', nombre: 'Cafeterías' },
  ];
  tabActivo: 'todos' | Categoria = 'todos';
  registros: RegistroUbicacion[] = [];
  private registroService = inject(RegistroUbicacionService);
  private modalController = inject(ModalController);
  /** Avisa a Angular que hay datos nuevos para mostrar (la app no usa zone.js). */
  private cdr = inject(ChangeDetectorRef);
  private capturando = false;
  retomando = false;

  /** Etiquetas que el usuario puede marcar al registrar un lugar. */
  etiquetasDisponibles = [
    'Económico', 'Buena vista', 'Tranquilo', 'Wifi', 'Pet friendly', 'Para ir en familia',
  ];
  estrellas = [1, 2, 3, 4, 5];

  /** Deja espacio arriba para que las ventanitas no queden debajo de las pestañas. */
  private opcionesPopup: L.PopupOptions = {
    autoPanPaddingTopLeft: L.point(10, 60),
  };

  private iconoMarcador = L.icon({
    iconUrl: 'assets/icon/marker.png',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });

  // Estado temporal mientras se llena el modal
  fotoTemporal: string | null = null;
  nombreTemporal = '';
  notaTemporal = '';
  categoriaTemporal: Categoria = 'otro';
  calificacionTemporal = 0;
  etiquetasTemporal: string[] = [];
  coordsTemporal: { lat: number; lng: number } | null = null;

  constructor() {
    addIcons({ add, cameraOutline, listOutline, star, starOutline });
  }

  ngAfterViewInit(): void {
    this.initMapa();
  }

  async initMapa(): Promise<void> {
    const point = await Geolocation.getCurrentPosition();
    const { latitude, longitude } = point.coords;

    this.map = L.map('map').setView([latitude, longitude], 17);

    // Mapa de OpenStreetMap; el filtro pastel se aplica en global.scss
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.capaRegistros.addTo(this.map);

    L.marker([latitude, longitude], { icon: this.iconoMarcador })
      .addTo(this.map)
      .bindPopup('Estás aquí', this.opcionesPopup)
      .openPopup();

    // Click en cualquier parte del mapa -> iniciar registro
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.iniciarRegistro(e.latlng.lat, e.latlng.lng);
    });

    await this.cargarRegistros();

    setTimeout(() => this.map.invalidateSize(), 100);
  }

  /** Botón para registrar en la ubicación actual del usuario. */
  async registrarAqui(): Promise<void> {
    if (this.capturando) return;

    let coordenadas: { lat: number; lng: number };

    try {
      const point = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      coordenadas = {
        lat: point.coords.latitude,
        lng: point.coords.longitude,
      };
    } catch (error) {
      console.error('No se pudo obtener la ubicación actual:', error);

      window.alert(
        'No se pudo obtener tu ubicación actual. Revisa que la ubicación del celular esté activada y que la aplicación tenga permiso de ubicación precisa.'
      );
      return;
    }

    await this.iniciarRegistro(coordenadas.lat, coordenadas.lng);
  }

  async iniciarRegistro(lat: number, lng: number): Promise<void> {
    if (this.capturando) return;
    this.capturando = true;

    try {
      const imagen = await this.tomarFoto();
      if (!imagen) return;

      this.coordsTemporal = { lat, lng };
      this.fotoTemporal = imagen;
      this.nombreTemporal = '';
      this.notaTemporal = '';
      this.calificacionTemporal = 0;
      this.etiquetasTemporal = [];
      this.categoriaTemporal = this.tabActivo === 'todos' ? 'otro' : this.tabActivo;
      this.cdr.markForCheck();

      await this.modal.present();
      await this.modal.onDidDismiss();
    } catch (error) {
      console.error(error);
      window.alert('No se pudo cargar la fotografía.');
    } finally {
      this.capturando = false;
    }
  }

  /** Abre la cámara y devuelve la foto comprimida (o null si se canceló). */
  private async tomarFoto(): Promise<string | null> {
    const captura = await this.modalController.create({
      component: CapturaComponent,
      backdropDismiss: false,
    });

    await captura.present();

    const { data, role } = await captura.onDidDismiss<{ imagen: string }>();

    if (role !== 'foto' || !data?.imagen) return null;

    return this.comprimirImagen(data.imagen);
  }

  /** Botón "Volver a tomar": abre la cámara otra vez y reemplaza la foto. */
  async retomarFoto(): Promise<void> {
    if (this.retomando) return;
    this.retomando = true;

    try {
      const nueva = await this.tomarFoto();
      if (nueva) this.fotoTemporal = nueva;
      this.cdr.markForCheck();
    } catch (error) {
      console.error(error);
      window.alert('No se pudo tomar la nueva foto.');
    } finally {
      this.retomando = false;
    }
  }

  /** Toca una estrella; si tocas la misma otra vez, se quita la calificación. */
  calificar(valor: number): void {
    this.calificacionTemporal = this.calificacionTemporal === valor ? 0 : valor;
  }

  /** Marca o desmarca una etiqueta. */
  alternarEtiqueta(etiqueta: string): void {
    this.etiquetasTemporal = this.etiquetasTemporal.includes(etiqueta)
      ? this.etiquetasTemporal.filter((e) => e !== etiqueta)
      : [...this.etiquetasTemporal, etiqueta];
  }

  /**
   * Redimensiona la imagen a un ancho máximo y la re-codifica como JPEG con
   * calidad reducida. Devuelve un dataURL mucho más liviano que el original.
   */
  private comprimirImagen(
    dataUrl: string,
    anchoMax = 800,
    calidad = 0.6
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const escala = Math.min(1, anchoMax / img.width);
        const canvas = document.createElement('canvas');

        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto 2D'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };

      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = dataUrl;
    });
  }

  async guardarRegistro(): Promise<void> {
    if (!this.coordsTemporal || !this.fotoTemporal) {
      return;
    }

    try {
      const nuevo = await this.registroService.agregar({
        lat: this.coordsTemporal.lat,
        lng: this.coordsTemporal.lng,
        nombre: this.nombreTemporal.trim(),
        nota: this.notaTemporal.trim(),
        categoria: this.categoriaTemporal,
        calificacion: this.calificacionTemporal,
        etiquetas: this.etiquetasTemporal,
        fotoBase64: this.fotoTemporal,
      });

      this.registros.push(nuevo);
      this.dibujarMarcadores();
      this.cdr.markForCheck();
      await this.cerrarModal();
    } catch (error) {
      const mensaje = error instanceof Error
        ? error.message
        : 'No se pudo guardar el registro.';

      window.alert(mensaje);
    }
  }

  async cerrarModal(): Promise<void> {
    await this.modal.dismiss();

    this.fotoTemporal = null;
    this.nombreTemporal = '';
    this.notaTemporal = '';
    this.calificacionTemporal = 0;
    this.etiquetasTemporal = [];
    this.coordsTemporal = null;
  }

  private async cargarRegistros(): Promise<void> {
    this.registros = await this.registroService.obtenerTodos();
    this.dibujarMarcadores();
    this.cdr.markForCheck(); // actualiza "N lugares guardados" y "Todos · N"
  }

  /** Historial para la lista "Mis lugares": del más reciente al más antiguo. */
  get historial(): RegistroUbicacion[] {
    return [...this.registros].reverse();
  }

  /** Nombre que se muestra en la lista (si no tiene, usa la categoría). */
  tituloDe(r: RegistroUbicacion): string {
    return r.nombre || NOMBRES_CATEGORIA[r.categoria ?? 'otro'];
  }

  categoriaDe(r: RegistroUbicacion): string {
    return NOMBRES_CATEGORIA[r.categoria ?? 'otro'];
  }

  /** Al tocar un lugar de la lista: cierra la lista, viaja al pin y abre su ventanita. */
  irALugar(r: RegistroUbicacion): void {
    this.listaAbierta = false;

    // Si la pestaña actual oculta ese lugar, vuelve a "Todos"
    if (this.tabActivo !== 'todos' && (r.categoria ?? 'otro') !== this.tabActivo) {
      this.seleccionarTab('todos');
    }

    this.map.flyTo([r.lat, r.lng], 18, { duration: 0.8 });
    this.map.once('moveend', () => this.marcadores.get(r.id)?.openPopup());
  }

  /** Cambia de pestaña y vuelve a dibujar solo los lugares de esa categoría. */
  seleccionarTab(id: 'todos' | Categoria): void {
    this.tabActivo = id;
    this.dibujarMarcadores();
  }

  /** Cantidad de registros de una pestaña (para mostrar "Todos · 12"). */
  contar(id: 'todos' | Categoria): number {
    if (id === 'todos') return this.registros.length;
    return this.registros.filter((r) => (r.categoria ?? 'otro') === id).length;
  }

  private dibujarMarcadores(): void {
    if (!this.map) return;
    this.capaRegistros.clearLayers();
    this.marcadores.clear();
    this.registros
      .filter((r) => this.tabActivo === 'todos' || (r.categoria ?? 'otro') === this.tabActivo)
      .forEach((r) => this.agregarMarcador(r));
  }

  private agregarMarcador(registro: RegistroUbicacion): void {
    const categoria = registro.categoria ?? 'otro';
    const titulo = registro.nombre || NOMBRES_CATEGORIA[categoria];

    const calificacion = registro.calificacion ?? 0;
    const estrellas = calificacion > 0
      ? `<p class="estrellas">${'★'.repeat(calificacion)}<span>${'★'.repeat(5 - calificacion)}</span></p>`
      : '';

    const etiquetas = (registro.etiquetas ?? [])
      .map((e) => `<span class="etiqueta">${this.escapar(e)}</span>`)
      .join('');

    const popupContent = `
      <div class="popup-lugar">
        <strong>${this.escapar(titulo)}</strong>
        <small>${NOMBRES_CATEGORIA[categoria]}</small>
        <img src="${registro.fotoBase64}" alt="" />
        ${estrellas}
        ${etiquetas ? `<div class="etiquetas">${etiquetas}</div>` : ''}
        <p>${this.escapar(registro.nota) || '(sin descripción)'}</p>
        <p class="meta">Fecha: ${registro.fecha}</p>
        <p class="meta">Ubicación: ${registro.lat.toFixed(5)}, ${registro.lng.toFixed(5)}</p>
      </div>
    `;

    const marcador = L.marker([registro.lat, registro.lng], { icon: iconoLugar(categoria) })
      .addTo(this.capaRegistros)
      .bindPopup(popupContent, this.opcionesPopup);

    this.marcadores.set(registro.id, marcador);
  }

  /** Evita que un texto escrito por el usuario se interprete como HTML. */
  private escapar(texto: string): string {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }
}