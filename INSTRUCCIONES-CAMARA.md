# Actualizar el proyecto que ya tienes en el computador

Conserva tu carpeta android y los permisos de ubicación que ya corregiste.

Copia de este ZIP a tu proyecto estos archivos:
- src/app/home/home.page.ts
- src/app/home/home.page.html
- src/app/home/captura.component.ts (nuevo)

En la terminal, dentro de tu proyecto, ejecuta uno por uno:

```powershell
npm install @capacitor-community/camera-preview@8.0.2
npm run build
npx cap sync android
npx cap open android
```

En android/app/src/main/AndroidManifest.xml añade, si no existe, dentro de manifest y fuera de application:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Mantén los permisos existentes de ubicación e internet. Conecta el teléfono y pulsa Run en Android Studio. Acepta el permiso de cámara.

Al pulsar un punto del mapa o Registrar en mi ubicación actual se abre una pantalla propia de cámara con Galería abajo a la izquierda, captura en el centro y giro de cámara a la derecha. La foto tomada o elegida abre la modal original. La galería usa el mismo punto seleccionado, no la ubicación incluida en los metadatos de la imagen.

La compilación web fue verificada. Falta verificar la vista previa nativa y el selector en un dispositivo Android; este paquete no contiene una APK. La pantalla de cámara es nueva y no replica todos los controles de la cámara del fabricante. En navegador se requiere acceso a cámara y localhost o HTTPS.
