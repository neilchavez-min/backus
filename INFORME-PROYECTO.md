# Informe del proyecto: Backus Ventas PWA

## 1. Resumen

**Backus Ventas PWA** es una aplicación web progresiva académica para apoyar el registro de pedidos de vendedores de campo que trabajan con conectividad débil o intermitente. Permite consultar un catálogo local, agregar productos a un carrito y conservar tanto el carrito como las compras en el navegador.

La aplicación funciona sin backend. Los datos de catálogo se distribuyen como un archivo JSON; los cambios del usuario se guardan en IndexedDB. Por ese motivo, finalizar una compra registra localmente un pedido pendiente: no cobra, no envía información a Backus ni sincroniza datos con un servidor.

### Resultado de la revisión técnica

Revisión realizada el 16 de octubre de 2026 sobre el código, la configuración, la documentación y las pruebas del workspace.

| Verificación | Resultado |
|---|---|
| Compilación de producción (`npm run build`) | Correcta; bundle inicial de 343.12 kB sin superar el límite de advertencia de 500 kB. |
| Pruebas unitarias (`npm test -- --watch=false`) | 8 de 9 pruebas pasan. Una falla al limpiar IndexedDB porque la base sigue abierta (`La base de datos de prueba sigue abierta`). |
| Catálogo fuente | 9 productos; la documentación anterior indicaba 3. |
| Alcance de datos | Catálogo estático; carrito e historial guardados únicamente en IndexedDB del dispositivo. No hay backend ni sincronización. |

**Evaluación general:** la compilación y el flujo principal están implementados para una demostración offline-first. Antes de considerar la calidad verificada, se debe resolver la prueba bloqueada por la conexión a IndexedDB y mejorar la gestión de foco de los diálogos para usuarios de teclado y tecnologías de asistencia. La indicación online/offline representa el estado de conectividad del navegador, no la disponibilidad de un servidor.

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
| `src/app/app.component.spec.ts` | Pruebas de catálogo, filtros, cantidades y flujo de la interfaz. |
| `src/app/storage.service.spec.ts` | Pruebas de persistencia, cálculos y validación de IndexedDB. |

## 5. Catálogo

El catálogo está en `src/assets/data/catalogo.json` y contiene nueve productos de práctica:

| ID | Producto | Categoría | Precio |
|---:|---|---|---:|
| 1 | Cristal 620 ml | Cerveza | S/ 7.50 |
| 2 | Pilsen Callao 620 ml | Cerveza | S/ 8.00 |
| 3 | Cusqueña 620 ml | Cerveza | S/ 9.00 |
| 4 | Cristal lata 355 ml | Cerveza | S/ 4.50 |
| 5 | Pilsen Callao lata 355 ml | Cerveza | S/ 5.00 |
| 6 | Cusqueña Dorada 310 ml | Cerveza | S/ 5.50 |
| 7 | Arequipeña 620 ml | Cerveza | S/ 7.00 |
| 8 | San Juan 620 ml | Cerveza | S/ 7.00 |
| 9 | Pilsen Callao 1 L | Cerveza | S/ 11.50 |

`CatalogoService.obtenerCatalogo()` solicita `assets/data/catalogo.json` mediante `HttpClient`. Angular Service Worker configura caché para `/assets/data/catalogo.json` (y `/data/catalogo.json`) con estrategia `performance`, máximo 20 respuestas y duración de un día. Para que el caché offline esté disponible, primero se debe abrir la aplicación con conexión y permitir que el Service Worker almacene los recursos.

## 6. Flujo de uso

1. La aplicación consulta el catálogo local y muestra los productos y sus precios.
2. El usuario puede buscar por nombre sin distinguir mayúsculas/minúsculas, filtrar por categoría y combinar ambos filtros. **Limpiar filtros** restablece la lista.
3. Cada producto acepta una cantidad: solo se agregan cantidades enteras mayores que cero. Un artículo ya presente aumenta su cantidad acumulada.
4. Al pulsar **Agregar al carrito**, persiste el producto en IndexedDB y actualiza el contador del carrito.
5. Al abrir **Carrito**, aparece una ventana flotante. El usuario puede:
   - aumentar o reducir unidades;
   - quitar un producto;
   - vaciar el carrito;
   - revisar el total.
6. Antes de confirmar, se rechazan carritos vacíos o con cantidades/precios inválidos. El resumen calcula un subtotal por línea y el total de los subtotales, redondeados a dos decimales.
7. Al pulsar **Finalizar compra**, se solicita confirmación. Si se acepta, la aplicación guarda el pedido en IndexedDB y vacía el carrito dentro de una misma transacción; si se cancela o falla el guardado, no se confirma el éxito ni se pierde el carrito.
8. El historial muestra pedidos locales con sus líneas, subtotales, total, fecha, origen y estado. Cada registro permite descargar su detalle.
9. El estado de conexión se muestra en la cabecera y se actualiza mediante eventos `online` y `offline`. La interfaz informa claramente que el registro se conserva en el dispositivo y no se envía a un servidor.

El formulario de registro manual también se guarda en IndexedDB tanto online como offline. No simula un envío remoto: los registros permanecen en estado `PENDIENTE` hasta que se implemente una integración opcional con un servidor.

## 7. Persistencia local

La base se llama `backusVentasDB` y su versión actual es `2`.

### Object Store `carrito`

Usa `productoId` como clave. Cada registro contiene:

```text
productoId, producto, categoria, precio, cantidad
```

El carrito se lee al iniciar la aplicación, así que sobrevive a recargas y desconexiones. Los datos están limitados al navegador y al origen (protocolo, host y puerto) donde se ejecuta la app.

### Modelo de pedido

Cada pedido nuevo incluye:

```ts
interface LineaPedido {
  productoId: number;
  producto: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

type EstadoPedido = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';
type OrigenPedido = 'ONLINE' | 'OFFLINE';
```

Además, el registro mantiene `id`, `fecha`, `lineas`, `total`, `estado` y `origen`. Los pedidos manuales sin artículos guardan su texto como `observacion`, con total cero.

### Object Store `pedidos`

Usa `id` como clave con autoincremento. Cada compra mantiene sus líneas de pedido, con precio unitario, cantidad y subtotal, además del total, fecha ISO, origen (`ONLINE` u `OFFLINE`) y estado inicial `PENDIENTE`. Los pedidos manuales se guardan con una observación y pueden tener líneas vacías.

La compra finalizada no es un comprobante tributario ni prueba de pago. El detalle `.txt` se genera localmente para la demostración. Los registros antiguos se pueden seguir leyendo; si no guardaban origen, el historial los identifica como `NO REGISTRADO`.

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

Las pruebas verifican búsqueda insensible a mayúsculas, combinación con categoría, validación de cantidades, guardado offline con origen explícito, cálculos de subtotales/total en IndexedDB, lectura del historial y persistencia del pedido junto con el vaciado del carrito.

En la revisión del 16 de octubre de 2026, la suite ejecutó 9 pruebas: 8 pasaron y 1 falló al intentar borrar la base de datos de prueba mientras seguía abierta. Por ello, la suite no está completamente verde; debe revisarse el cierre de conexiones de IndexedDB y la limpieza de la prueba antes de usar este resultado como validación continua.

## 13. Alcance y limitaciones

- No hay API ni base de datos remota.
- No existe sincronización entre dispositivos o entre orígenes diferentes.
- Los registros de compra son locales y pueden borrarse al eliminar los datos del sitio o mediante las herramientas del navegador.
- No se procesan pagos, no se confirma stock y los precios son datos ficticios de uso académico.
- Para usar la PWA offline, es necesario haber cargado previamente la aplicación y el catálogo con conexión en el mismo origen.

## 14. Evaluación y recomendaciones

### Fortalezas observadas

- Separación clara entre presentación, consulta de catálogo y persistencia local.
- TypeScript y plantillas Angular configurados en modo estricto.
- La compra y el vaciado del carrito se realizan en una misma transacción de IndexedDB.
- Las entradas de cantidades y las líneas de compra se validan antes de guardarse; se recalculan subtotales y totales.
- Los errores de lectura y escritura se presentan en la interfaz, y el usuario recibe aviso de que los pedidos no se envían al servidor.
- La compilación de producción genera un bundle inicial por debajo del presupuesto configurado.

### Hallazgos y acciones recomendadas

| Prioridad | Hallazgo | Recomendación |
|---|---|---|
| Alta | Una de las 9 pruebas falla porque la limpieza de IndexedDB detecta una conexión aún abierta. | Identificar el ciclo de vida de la conexión que permanece abierta; cerrar las conexiones de forma consistente y dejar la prueba repetible. |
| Media | Los diálogos tienen `role="dialog"` y `aria-modal`, pero no se observa gestión de foco al abrir/cerrar ni confinamiento del foco dentro del diálogo. | Enfocar el diálogo o su primer control al abrirlo, mantener la navegación por teclado dentro de él y devolver el foco al control que lo abrió. Verificar también teclado y lector de pantalla. |
| Media | El estado “CONECTADO” solo refleja `navigator.onLine`; no comprueba acceso a un servidor. | Mantener claro en interfaz y documentación que indica conectividad del navegador y no sincronización ni disponibilidad del servicio. |
| Baja | La documentación del README describía tres productos, aunque el catálogo contiene nueve. | Corregido en esta revisión; conservar sincronizados el catálogo y los documentos cuando cambien los datos. |

### Alcance de esta revisión

Se revisaron los componentes principales, los servicios de catálogo y almacenamiento, configuración Angular y del Service Worker, manifest, catálogo, pruebas unitarias y documentación. Se ejecutaron la compilación de producción y la suite unitaria. No se realizó una prueba manual en dispositivos, auditoría automatizada de accesibilidad ni validación de una integración con backend, porque esta última no forma parte del proyecto actual.

## 15. Conclusión

Backus Ventas PWA muestra cómo una interfaz Angular puede mantener una experiencia útil ante interrupciones de conectividad: el Service Worker conserva los recursos de la aplicación y el catálogo, mientras IndexedDB mantiene el carrito y los pedidos en el dispositivo. La solución es adecuada como demostración frontend offline-first y no requiere backend para el alcance actual.
