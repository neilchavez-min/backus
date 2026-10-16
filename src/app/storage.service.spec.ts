import { StorageService } from './storage.service';

// Elimina los datos entre pruebas para que cada caso empiece con una base limpia.
function eliminarBaseDeDatos(): Promise<void> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.deleteDatabase('backusVentasDB');
    solicitud.onsuccess = () => resolve();
    solicitud.onerror = () => reject(solicitud.error ?? new Error('No se pudo limpiar la base de prueba.'));
    solicitud.onblocked = () => reject(new Error('La base de datos de prueba sigue abierta.'));
  });
}

describe('StorageService', () => {
  let storage: StorageService;

  // Crea un servicio nuevo después de limpiar IndexedDB.
  beforeEach(async () => {
    await eliminarBaseDeDatos();
    storage = new StorageService();
  });

  afterEach(async () => {
    await eliminarBaseDeDatos();
  });

  // La finalización debe guardar subtotales correctos y limpiar el carrito atómicamente.
  it('should persist purchase lines and clear the cart in IndexedDB', async () => {
    await storage.agregarAlCarrito({
      productoId: 1,
      producto: 'Cristal 620 ml',
      categoria: 'Cerveza',
      precio: 7.5,
      cantidad: 2
    });

    const pedidoId = await storage.finalizarCompra([
      {
        productoId: 1,
        producto: 'Cristal 620 ml',
        precioUnitario: 7.5,
        cantidad: 2,
        subtotal: 0
      },
      {
        productoId: 2,
        producto: 'Pilsen Callao 620 ml',
        precioUnitario: 8,
        cantidad: 1,
        subtotal: 0
      }
    ], 'OFFLINE');

    expect(await storage.listarCarrito()).toEqual([]);
    const [pedido] = await storage.listarPedidos();
    expect(pedido.id).toBe(Number(pedidoId));
    expect(pedido.tipo).toBe('compra');
    expect(pedido.lineas.map((linea) => linea.subtotal)).toEqual([15, 8]);
    expect(pedido.total).toBe(23);
    expect(pedido.estado).toBe('PENDIENTE');
    expect(pedido.origen).toBe('OFFLINE');
    expect(Number.isNaN(Date.parse(pedido.fecha))).toBeFalse();
  });

  // Los pedidos manuales también quedan locales, con origen y estado inicial definidos.
  it('should persist a manual order with online origin and pending state', async () => {
    await storage.guardarPedido({
      tipo: 'pedido',
      observacion: 'Coordinar entrega con el cliente',
      lineas: [],
      total: 0,
      origen: 'ONLINE'
    });

    const [pedido] = await storage.listarPedidos();
    expect(pedido.tipo).toBe('pedido');
    expect(pedido.observacion).toBe('Coordinar entrega con el cliente');
    expect(pedido.total).toBe(0);
    expect(pedido.origen).toBe('ONLINE');
    expect(pedido.estado).toBe('PENDIENTE');
  });

  // Datos inválidos y pedidos vacíos se rechazan antes de persistir.
  it('should reject invalid line quantities and empty orders', async () => {
    await expectAsync(storage.finalizarCompra([
      {
        productoId: 1,
        producto: 'Cristal 620 ml',
        precioUnitario: 7.5,
        cantidad: 1.5,
        subtotal: 0
      }
    ], 'OFFLINE')).toBeRejectedWithError(RangeError);

    await expectAsync(storage.guardarPedido({
      tipo: 'pedido',
      lineas: [],
      total: 0,
      origen: 'OFFLINE'
    })).toBeRejectedWithError('El pedido debe incluir productos o una observación.');
  });
});
