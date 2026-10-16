# Backus Ventas PWA

Aplicación web progresiva de práctica para registrar pedidos de vendedores de campo. El catálogo se solicita como JSON local y Angular Service Worker lo conserva en caché; cuando no hay conexión, los pedidos se guardan en IndexedDB del navegador.

> Este espacio de trabajo existente usa Angular 17.3. El código de este taller utiliza APIs standalone compatibles con esa versión y no cambia las dependencias principales del proyecto.

## Archivos del taller

1. `src/manifest.webmanifest`: nombre, colores, modo standalone e iconos de la PWA.
2. `src/assets/data/catalogo.json`: catálogo académico local de nueve productos.
3. `src/app/app.config.ts`: `HttpClient`, rutas y registro del service worker solo en producción.
4. `src/app/catalogo.service.ts`: tipo `Producto` y consulta HTTP del catálogo.
5. `ngsw-config.json`: precaché de recursos y caché de datos del catálogo por un día.
6. `src/app/app.component.ts`, `src/app/app.component.html` y `src/app/app.component.scss`: estado online/offline, catálogo con búsqueda y filtros, cantidades, carrito y registro de pedidos.
7. `src/app/storage.service.ts`: base `backusVentasDB` con almacenes `carrito` y `pedidos`, ambos persistidos localmente en IndexedDB.
8. El carrito flotante permite aumentar o reducir unidades, quitar artículos, vaciar y finalizar una compra. Antes de finalizar solicita confirmación; el pedido se persiste en `pedidos` y el carrito se limpia en una misma transacción.
9. El historial muestra pedidos y compras con sus líneas, subtotales, total, estado y origen, y permite descargar el detalle como `.txt`. Todo se ejecuta en el navegador, sin backend ni procesamiento de pagos.

## Cómo ejecutar y verificar

1. Instala las dependencias del proyecto si aún no están instaladas:

   ```bash
   npm install
   ```

2. Ejecuta el servidor de desarrollo:

   ```bash
   npm start
   ```

   Abre `http://localhost:4200/`. El service worker se registra en producción, no durante el desarrollo.

3. Genera la compilación de producción:

   ```bash
   ng build --configuration production
   ```

4. Sirve la compilación en localhost, un origen seguro para probar service workers:

   ```bash
   npx http-server ./dist/backus-ventas-pwa/browser -p 8080
   ```

   Visita `http://localhost:8080/`. Si `http-server` no está disponible localmente, `npx` lo descargará para esa ejecución.

5. En Chrome abre DevTools con **F12** y comprueba:

   - **Application → Manifest**: nombre, colores e iconos 192×192 y 512×512.
   - **Application → Service Workers**: `ngsw-worker.js` instalado y activo. Espera a que la aplicación se estabilice y recarga si es necesario.
   - **Application → Cache Storage**: recursos estáticos y el catálogo después de cargarlo con conexión.
   - **Application → IndexedDB → backusVentasDB → carrito**: agrega productos y comprueba sus cantidades guardadas.
   - **Application → IndexedDB → backusVentasDB → pedidos**: finaliza una compra y verifica `id`, `tipo`, `lineas`, `total`, `fecha`, `origen` (`ONLINE`/`OFFLINE`) y `estado: "PENDIENTE"`. La sección Historial permite revisar pedidos y descargar sus detalles locales.

   Para probar el estado offline, activa **Network → Offline** o desconecta la red desde DevTools y recarga la página después de su primer acceso online. El carrito y los pedidos se guardan localmente; no hay sincronización con servidor ni procesamiento de pagos.
