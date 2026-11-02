import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController, IonIcon } from '@ionic/angular';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Camera, CameraErrorCode, MediaTypeSelection } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { imagesOutline, cameraReverseOutline } from 'ionicons/icons';

@Component({
  selector: 'app-captura',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="pantalla">
      <header><button (click)="cancelar()" [disabled]="ocupado()">Cancelar</button><span>Cámara</span></header>
      <div #visor id="cameraPreview" class="visor"></div>
      <p *ngIf="error()">{{ error() }}</p>
      <footer>
        <button aria-label="Elegir foto de galería" (click)="galeria()" [disabled]="ocupado()">
          <ion-icon name="images-outline"></ion-icon><small>Galería</small>
        </button>
        <button class="disparador" aria-label="Tomar foto" (click)="tomar()" [disabled]="ocupado() || !lista()"></button>
        <button aria-label="Cambiar cámara" (click)="cambiar()" [disabled]="ocupado() || !lista() || !nativa">
          <ion-icon name="camera-reverse-outline"></ion-icon><small>Girar</small>
        </button>
      </footer>
    </div>`,
  styles: [`
    :host { display:block; height:100%; background:#000; color:#fff; }
    .pantalla { height:100%; display:flex; flex-direction:column; }
    header { flex-shrink:0; min-height:64px; padding-top:env(safe-area-inset-top); display:flex; align-items:center; gap:30px; }
    button { background:transparent; color:#fff; border:0; padding:16px; cursor:pointer; }
    button:disabled { opacity:.4; }
    .visor { flex:1; min-height:0; overflow:hidden; }
    .visor ::ng-deep video { width:100%; height:100%; object-fit:cover; }
    p { margin:0; padding:12px; background:#000; }
    footer { flex-shrink:0; height:140px; padding-bottom:env(safe-area-inset-bottom); display:flex; align-items:center; justify-content:space-around; background:#000; }
    ion-icon { display:block; font-size:32px; margin:auto auto 6px; }
    small { display:block; }
    .disparador { width:72px; height:72px; border:5px solid #ccc; border-radius:50%; background:#fff; }
  `],
})
export class CapturaComponent {
  @ViewChild('visor', { static:true }) visor!: ElementRef<HTMLElement>;
  private modal = inject(ModalController);
  lista = signal(false);
  ocupado = signal(false);
  error = signal('');
  nativa = Capacitor.isNativePlatform();

  constructor() { addIcons({ imagesOutline, cameraReverseOutline }); }

  async ionViewDidEnter(): Promise<void> { await this.iniciar(); }
  async ionViewWillLeave(): Promise<void> { await this.detener(); }

  private async iniciar(): Promise<void> {
    try {
      const r = this.visor.nativeElement.getBoundingClientRect();
      await CameraPreview.start({
        parent: 'cameraPreview', position: 'rear', toBack: false,
        x: Math.round(r.left), y: Math.round(r.top),
        width: Math.round(r.width), height: Math.round(r.height),
        disableAudio: true, storeToFile: false, lockAndroidOrientation: true,
      });
      this.lista.set(true);
      this.error.set('');
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo abrir la cámara. Puedes elegir una imagen de la galería.');
    }
  }

  private async detener(): Promise<void> {
    if (!this.lista()) return;
    await CameraPreview.stop();
    this.lista.set(false);
  }

  async tomar(): Promise<void> {
    if (this.ocupado() || !this.lista()) return;
    this.ocupado.set(true);
    try {
      const { value } = await CameraPreview.capture({ quality:70 });
      await this.detener();
      await this.modal.dismiss({ imagen:`data:image/jpeg;base64,${value}` }, 'foto');
    } catch (e) { console.error(e); this.error.set('No se pudo tomar la foto. Inténtalo nuevamente.'); }
    finally { this.ocupado.set(false); }
  }

  async galeria(): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.detener();
      const { results } = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo, allowMultipleSelection:false, limit:1,
        quality:70, targetWidth:800, targetHeight:800,
      });
      const foto = results[0];
      const imagen = foto?.webPath || (foto?.thumbnail ? `data:image/jpeg;base64,${foto.thumbnail}` : null);
      if (imagen) await this.modal.dismiss({ imagen }, 'foto');
      else await this.iniciar();
    } catch (e) {
      console.error(e);
      await this.iniciar();
      if ((e as {code?:string})?.code !== CameraErrorCode.ChooseMediaCancelled)
        this.error.set('No se pudo leer la foto de la galería.');
    } finally { this.ocupado.set(false); }
  }

  async cambiar(): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try { await CameraPreview.flip(); }
    catch (e) { console.error(e); this.error.set('No se pudo cambiar de cámara.'); }
    finally { this.ocupado.set(false); }
  }

  async cancelar(): Promise<void> {
    if (this.ocupado()) return;
    try { await this.detener(); await this.modal.dismiss(undefined, 'cancel'); }
    catch (e) { console.error(e); this.error.set('No se pudo cerrar la cámara. Inténtalo nuevamente.'); }
  }
}
