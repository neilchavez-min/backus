import { Injectable } from '@angular/core';

export interface CarritoItem {
  productoId: number;
  producto: string;
  categoria: string;
  precio: number;
  cantidad: number;
}

export interface CompraGuardada {
  id: number;
  tipo: 'compra';
  items: CarritoItem[];
  total: number;
  fecha: string;
  estado: 'pendiente';
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly nombreDB = 'backusVentasDB';
  private readonly versionDB = 2;
  private readonly nombreStore = 'pedidos';
  private readonly nombreStoreCarrito = 'carrito';

  abrirDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const solicitud = indexedDB.open(this.nombreDB, this.versionDB);

      solicitud.onupgradeneeded = () => {
        const db = solicitud.result;

        if (!db.objectStoreNames.contains(this.nombreStore)) {
          db.createObjectStore(this.nombreStore, {
            keyPath: 'id',
            autoIncrement: true
          });
        }

        if (!db.objectStoreNames.contains(this.nombreStoreCarrito)) {
          db.createObjectStore(this.nombreStoreCarrito, {
            keyPath: 'productoId'
          });
        }
      };

      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => {
        reject(solicitud.error ?? new Error('No se pudo abrir IndexedDB.'));
      };
    });
  }

  async guardarPedido(pedido: Record<string, unknown>): Promise<IDBValidKey> {
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStore, 'readwrite');
      const solicitud = transaccion.objectStore(this.nombreStore).add({
        ...pedido,
        fecha: new Date().toISOString(),
        estado: 'pendiente'
      });
      let idPedido: IDBValidKey;

      solicitud.onsuccess = () => {
        idPedido = solicitud.result;
      };
      transaccion.oncomplete = () => {
        db.close();
        resolve(idPedido);
      };
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo guardar el pedido.'));
      };
      transaccion.onabort = () => {
        db.close();
        reject(transaccion.error ?? new Error('Se canceló el guardado del pedido.'));
      };
    });
  }

  async finalizarCompra(items: CarritoItem[], total: number): Promise<IDBValidKey> {
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      const transaccion = db.transaction(
        [this.nombreStore, this.nombreStoreCarrito],
        'readwrite'
      );
      const solicitud = transaccion.objectStore(this.nombreStore).add({
        tipo: 'compra',
        items,
        total,
        fecha: new Date().toISOString(),
        estado: 'pendiente'
      });
      let idPedido: IDBValidKey;

      transaccion.objectStore(this.nombreStoreCarrito).clear();
      solicitud.onsuccess = () => {
        idPedido = solicitud.result;
      };
      transaccion.oncomplete = () => {
        db.close();
        resolve(idPedido);
      };
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo finalizar la compra.'));
      };
      transaccion.onabort = () => {
        db.close();
        reject(transaccion.error ?? new Error('Se canceló la compra.'));
      };
    });
  }

  async agregarAlCarrito(item: CarritoItem): Promise<void> {
    const db = await this.abrirDB();

    await new Promise<void>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStoreCarrito, 'readwrite');
      const store = transaccion.objectStore(this.nombreStoreCarrito);
      const datos: CarritoItem = {
        productoId: item.productoId,
        producto: item.producto,
        categoria: item.categoria,
        precio: item.precio,
        cantidad: item.cantidad
      };

      const solicitud = store.put(datos);

      transaccion.oncomplete = () => {
        db.close();
        resolve();
      };
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo guardar el carrito.'));
      };
      transaccion.onabort = () => {
        db.close();
        reject(transaccion.error ?? new Error('Se canceló la operación del carrito.'));
      };
      solicitud.onerror = () => {
        reject(solicitud.error ?? new Error('No se pudo agregar el producto al carrito.'));
      };
    });
  }

  async listarCarrito(): Promise<CarritoItem[]> {
    const db = await this.abrirDB();

    return new Promise<CarritoItem[]>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStoreCarrito, 'readonly');
      const solicitud = transaccion.objectStore(this.nombreStoreCarrito).getAll();

      solicitud.onsuccess = () => {
        db.close();
        resolve((solicitud.result ?? []) as CarritoItem[]);
      };
      solicitud.onerror = () => {
        db.close();
        reject(solicitud.error ?? new Error('No se pudo leer el carrito.'));
      };
    });
  }

  async actualizarCantidad(productoId: number, cantidad: number): Promise<void> {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new RangeError('La cantidad debe ser un entero mayor que cero.');
    }

    const db = await this.abrirDB();

    await new Promise<void>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStoreCarrito, 'readwrite');
      const store = transaccion.objectStore(this.nombreStoreCarrito);
      const solicitud = store.get(productoId);

      solicitud.onsuccess = () => {
        const item = solicitud.result as CarritoItem | undefined;
        if (!item) {
          transaccion.abort();
          return;
        }
        store.put({ ...item, cantidad });
      };
      transaccion.oncomplete = () => {
        db.close();
        resolve();
      };
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo actualizar la cantidad.'));
      };
      transaccion.onabort = () => {
        db.close();
        reject(transaccion.error ?? new Error('Se canceló la actualización.'));
      };
    });
  }

  async quitarDelCarrito(productoId: number): Promise<void> {
    const db = await this.abrirDB();

    await new Promise<void>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStoreCarrito, 'readwrite');
      transaccion.objectStore(this.nombreStoreCarrito).delete(productoId);
      transaccion.oncomplete = () => {
        db.close();
        resolve();
      };
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo quitar el producto.'));
      };
      transaccion.onabort = () => {
        db.close();
        reject(transaccion.error ?? new Error('Se canceló la eliminación.'));
      };
    });
  }

  async listarCompras(): Promise<CompraGuardada[]> {
    const db = await this.abrirDB();

    return new Promise<CompraGuardada[]>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStore, 'readonly');
      const solicitud = transaccion.objectStore(this.nombreStore).getAll();

      solicitud.onsuccess = () => {
        const compras = (solicitud.result as Array<CompraGuardada | Record<string, unknown>>)
          .filter((registro): registro is CompraGuardada => registro.tipo === 'compra');
        resolve(compras.reverse());
      };
      transaccion.oncomplete = () => db.close();
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo cargar el historial.'));
      };
    });
  }

  async limpiarCarrito(): Promise<void> {
    const db = await this.abrirDB();

    await new Promise<void>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStoreCarrito, 'readwrite');
      const solicitud = transaccion.objectStore(this.nombreStoreCarrito).clear();

      solicitud.onsuccess = () => {
        db.close();
        resolve();
      };
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo vaciar el carrito.'));
      };
    });
  }
}
