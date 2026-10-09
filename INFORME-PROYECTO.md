# Informe del proyecto: Backus Ventas PWA

## 1. Resumen

**Backus Ventas PWA** es una aplicación web progresiva académica para apoyar el registro de pedidos de vendedores de campo que trabajan con conectividad débil o intermitente. Permite consultar un catálogo local, agregar productos a un carrito y conservar tanto el carrito como las compras en el navegador.

La aplicación funciona sin backend. Los datos de catálogo se distribuyen como un archivo JSON; los cambios del usuario se guardan en IndexedDB. Por ese motivo, finalizar una compra registra localmente un pedido pendiente: no cobra, no envía información a Backus ni sincroniza datos con un servidor.

## 2. Objetivos

- Mostrar un catálogo de productos incluso después de que sus recursos hayan sido almacenados en caché.
- Permitir que el usuario agregue productos y administre cantidades.
- Mantener el carrito al recargar la página o perder la conexión.
- Guardar compras finalizadas y consultarlas posteriormente.
- Ofrecer una interfaz adaptable a escritorio, tableta y teléfono.
- Demostrar conceptos de PWA, Service Worker e IndexedDB con tecnologías del navegador.

## 3. Tecnologías

- Angular 17.3 con componentes standalone y TypeScript.
- Angular Service Worker (`ngsw-worker.js`) para la experiencia PWA y caché.
- `HttpClient` para solicitar el JSON del catálogo.
- IndexedDB nativo para almacenamiento persistente en el navegador.
- HTML, SCSS, Angular Forms y RxJS.
- `http-server` para probar la compilación de producción en `localhost:8080`.

> El código está implementado sobre Angular 17.3 porque esa es la versión de este repositorio. Utiliza APIs standalone disponibles en esa versión.

## 4. Estructura relevante

| Archivo | Responsabilidad |
|---|---|
| `src/app/app.component.ts` | Estado de conexión, catálogo, carrito, historial y acciones de compra. |
| `src/app/app.component.html` | Interfaz del catálogo, carrito flotante, historial y registro manual. |
| `src/app/app.component.scss` | Estilos de componentes y ajustes responsive. |
| `src/styles.scss` | Estilos globales y tema visual. |
| `src/app/catalogo.service.ts` | Interfaz `Producto` y solicitud HTTP del catálogo. |
| `src/app/storage.service.ts` | Apertura y operaciones de IndexedDB. |
| `src/assets/data/catalogo.json` | Catálogo académico local. |
| `src/manifest.webmanifest` | Nombre, iconos, colores y modo de presentación instalable. |
| `ngsw-config.json` | Recursos precargados y estrategia de caché del catálogo. |
| `src/app/app.config.ts` | Proveedores de HTTP, rutas y registro del Service Worker. |
| `src/app/app.component.spec.ts` | Pruebas del renderizado del catálogo y del flujo de compra. |

## 5. Catálogo

El catálogo está en `src/assets/data/catalogo.json` y contiene estos productos ficticios de práctica:

| ID | Producto | Categoría | Precio |
|---:|---|---|---:|
| 1 | Cristal 620 ml | Cerveza | S/ 7.50 |
| 2 | Pilsen Callao 620 ml | Cerveza | S/ 8.00 |
| 3 | Cusqueña 620 ml | Cerveza | S/ 9.00 |

`CatalogoService.obtenerCatalogo()` solicita `assets/data/catalogo.json` mediante `HttpClient`. Angular Service Worker configura caché para `/assets/data/catalogo.json` (y `/data/catalogo.json`) con estrategia `performance`, máximo 20 respuestas y duración de un día. Para que el caché offline esté disponible, primero se debe abrir la aplicación con conexión y permitir que el Service Worker almacene los recursos.

## 6. Flujo de uso

1. La aplicación consulta el catálogo local y muestra los productos y sus precios.
2. Al pulsar **Agregar al carrito**, guarda el producto en IndexedDB y actualiza el contador del carrito.
3. Al abrir **Carrito**, aparece una ventana flotante. El usuario puede:
   - aumentar o reducir unidades;
   - quitar un producto;
   - vaciar el carrito;
   - revisar el total.
4. Al pulsar **Finalizar compra**, se solicita confirmación.
5. Si se confirma, la aplicación registra la compra en IndexedDB y vacía el carrito dentro de una misma transacción. Si se cancela, el carrito no cambia.
6. El historial muestra las compras almacenadas localmente. Cada compra permite descargar un comprobante de texto.
7. El estado de conexión se muestra en la cabecera y se actualiza mediante eventos `online` y `offline`.

El formulario de registro manual conserva el comportamiento de demostración: online muestra una simulación de procesamiento; offline guarda el pedido en IndexedDB.

## 7. Persistencia local

La base se llama `backusVentasDB` y su versión actual es `2`.

### Object Store `carrito`

Usa `productoId` como clave. Cada registro contiene:

```text
productoId, producto, categoria, precio, cantidad
```

El carrito se lee al iniciar la aplicación, así que sobrevive a recargas y desconexiones. Los datos están limitados al navegador y al origen (protocolo, host y puerto) donde se ejecuta la app.

### Object Store `pedidos`

Usa `id` como clave con autoincremento. Puede contener:

- pedidos guardados por el formulario, junto con `fecha` y `estado: "pendiente"`;
- compras finalizadas con `tipo: "compra"`, `items`, `total`, `fecha` y `estado: "pendiente"`.

La compra finalizada no es un comprobante tributario ni prueba de pago. Se genera localmente para la demostración.

## 8. Diseño responsive y accesibilidad

- En escritorio, el contenido usa un ancho máximo para facilitar la lectura.
- En tabletas, el catálogo se distribuye en columnas y los formularios adaptan su distribución.
- En móviles, los productos se apilan, la cabecera se reorganiza y el carrito aparece como una ventana inferior.
- Los botones disponen de estados deshabilitados cuando la acción no corresponde, y de foco visible para navegación con teclado.
- El modal del carrito puede cerrarse con su botón, haciendo clic en el fondo o pulsando `Escape`.
- Se respeta la preferencia del sistema para reducir animaciones.

## 9. Instalación y ejecución local

Requisitos del workspace: Node.js y npm compatibles con las dependencias instaladas, además de Angular CLI disponible mediante `npx`.

```bash
npm install
npm start
```

La aplicación de desarrollo se sirve normalmente en `http://localhost:4200/`. El Service Worker está desactivado en modo desarrollo; se debe usar una compilación de producción para comprobar su registro.

## 10. Compilación y prueba PWA

Crear la compilación de producción:

```bash
npx ng build --configuration production
```

Servir el resultado con `http-server`:

```bash
npx http-server ./dist/backus-ventas-pwa/browser -p 8080
```

Abrir `http://localhost:8080/`. `localhost` es un origen válido para probar Service Workers. Para probar el modo offline, cargar primero la app online y luego activar **DevTools → Network → Offline** o desconectar la red.

## 11. Verificación en Chrome DevTools

1. Abrir DevTools con **F12**.
2. En **Application → Manifest**, comprobar el nombre, el modo standalone y los iconos de 192×192 y 512×512.
3. En **Application → Service Workers**, comprobar que `ngsw-worker.js` esté instalado y activo en la compilación de producción.
4. En **Application → Cache Storage**, revisar los recursos de la aplicación y la respuesta del catálogo después de haberlo solicitado online.
5. En **Application → IndexedDB → backusVentasDB → carrito**, comprobar los productos y cantidades añadidos.
6. En **Application → IndexedDB → backusVentasDB → pedidos**, comprobar las compras finalizadas y sus campos. El historial también permite verlas desde la interfaz.

Las compras creadas en otro puerto, por ejemplo `localhost:4200`, no aparecerán en `localhost:8080`: cada origen tiene su propio almacenamiento local.

## 12. Pruebas automatizadas

Ejecutar las pruebas unitarias del workspace:

```bash
npx ng test --watch=false
```

Las pruebas del componente verifican la carga del catálogo, la presencia de los controles del carrito y que la compra se guarde y vacíe el carrito únicamente cuando el usuario confirma.

## 13. Alcance y limitaciones

- No hay API ni base de datos remota.
- No existe sincronización entre dispositivos o entre orígenes diferentes.
- Los registros de compra son locales y pueden borrarse al eliminar los datos del sitio o mediante las herramientas del navegador.
- No se procesan pagos, no se confirma stock y los precios son datos ficticios de uso académico.
- Para usar la PWA offline, es necesario haber cargado previamente la aplicación y el catálogo con conexión en el mismo origen.

## 14. Conclusión

Backus Ventas PWA muestra cómo una interfaz Angular puede mantener una experiencia útil ante interrupciones de conectividad: el Service Worker conserva los recursos de la aplicación y el catálogo, mientras IndexedDB mantiene el carrito y los pedidos en el dispositivo. La solución es adecuada como demostración frontend offline-first y no requiere backend para el alcance actual.
