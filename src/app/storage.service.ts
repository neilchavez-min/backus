import { Injectable } from '@angular/core';

/** Producto almacenado en el carrito persistente del navegador. */
export interface CarritoItem {
  productoId: number;
  producto: string;
  categoria: string;
  precio: number;
  cantidad: number;
}

/** Línea normalizada que se conserva como parte de una compra o pedido. */
export interface LineaPedido {
  productoId: number;
  producto: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

/** Estados previstos para los registros, incluida una futura sincronización. */
export type EstadoPedido = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';
export type OrigenPedido = 'ONLINE' | 'OFFLINE' | 'NO REGISTRADO';

/** Forma canónica de un registro leído desde IndexedDB. */
export interface PedidoGuardado {
  id: number;
  tipo: 'pedido' | 'compra';
  fecha: string;
  lineas: LineaPedido[];
  total: number;
  estado: EstadoPedido;
  origen: OrigenPedido;
  observacion?: string;
}

type PedidoNuevo = Omit<PedidoGuardado, 'id' | 'fecha' | 'estado'>;

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly nombreDB = 'backusVentasDB';
  private readonly versionDB = 2;
  private readonly nombreStore = 'pedidos';
  private readonly nombreStoreCarrito = 'carrito';

  /** Abre la base local y crea los almacenes cuando se crea o actualiza su versión. */
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

  /** Valida y persiste un pedido manual; IndexedDB asigna id, fecha y estado inicial. */
  async guardarPedido(pedido: PedidoNuevo): Promise<IDBValidKey> {
    const lineas = this.validarLineas(pedido.lineas);
    const observacion = pedido.observacion?.trim();
    if (pedido.tipo !== 'pedido') {
      throw new Error('El tipo del registro no es válido.');
    }
    if (pedido.origen !== 'ONLINE' && pedido.origen !== 'OFFLINE') {
      throw new Error('El origen del pedido no es válido.');
    }
    if (!lineas.length && !observacion) {
      throw new Error('El pedido debe incluir productos o una observación.');
    }

    const datos: PedidoNuevo = {
      tipo: 'pedido',
      lineas,
      total: this.calcularTotal(lineas),
      origen: pedido.origen,
      ...(observacion ? { observacion } : {})
    };
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStore, 'readwrite');
      const solicitud = transaccion.objectStore(this.nombreStore).add({
        ...datos,
        fecha: new Date().toISOString(),
        estado: 'PENDIENTE' satisfies EstadoPedido
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

  /** Guarda la compra y limpia el carrito en una única transacción de escritura. */
  async finalizarCompra(lineasPedido: LineaPedido[], origen: Exclude<OrigenPedido, 'NO REGISTRADO'>): Promise<IDBValidKey> {
    if (origen !== 'ONLINE' && origen !== 'OFFLINE') {
      throw new Error('El origen del pedido no es válido.');
    }
    const lineas = this.validarLineas(lineasPedido);
    if (lineas.length === 0) {
      throw new Error('No se puede finalizar una compra sin productos válidos.');
    }

    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      const transaccion = db.transaction(
        [this.nombreStore, this.nombreStoreCarrito],
        'readwrite'
      );
      const solicitud = transaccion.objectStore(this.nombreStore).add({
        tipo: 'compra',
        lineas,
        total: this.calcularTotal(lineas),
        origen,
        fecha: new Date().toISOString(),
        estado: 'PENDIENTE' satisfies EstadoPedido
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

  /** Añade unidades al producto existente o crea una entrada nueva en el carrito. */
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

      const lectura = store.get(datos.productoId);

      lectura.onsuccess = () => {
        const existente = lectura.result as CarritoItem | undefined;
        store.put({
          ...datos,
          cantidad: (existente?.cantidad ?? 0) + datos.cantidad
        });
      };

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
    });
  }

  /** Devuelve todas las entradas actualmente guardadas en el carrito. */
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

  /** Reemplaza la cantidad del producto y rechaza cantidades no enteras o menores a uno. */
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

  /** Elimina del carrito el producto identificado por su id. */
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

  /** Lee, normaliza y ordena los registros más recientes primero. */
  async listarPedidos(): Promise<PedidoGuardado[]> {
    const db = await this.abrirDB();

    return new Promise<PedidoGuardado[]>((resolve, reject) => {
      const transaccion = db.transaction(this.nombreStore, 'readonly');
      const solicitud = transaccion.objectStore(this.nombreStore).getAll();

      solicitud.onsuccess = () => {
        const pedidos = (solicitud.result as Array<Record<string, unknown>>)
          .map((registro) => this.normalizarPedido(registro))
          .filter((pedido): pedido is PedidoGuardado => pedido !== null)
          .sort((a, b) => b.id - a.id);
        resolve(pedidos);
      };
      transaccion.oncomplete = () => db.close();
      transaccion.onerror = () => {
        db.close();
        reject(transaccion.error ?? new Error('No se pudo cargar el historial.'));
      };
    });
  }

  /** Comprueba los datos de cada línea y recalcula su subtotal desde precio y cantidad. */
  private validarLineas(lineas: LineaPedido[]): LineaPedido[] {
    if (!Array.isArray(lineas)) {
      throw new TypeError('Las líneas del pedido deben ser una lista.');
    }

    return lineas.map((linea) => {
      if (
        !Number.isInteger(linea.productoId) ||
        !linea.producto.trim() ||
        !Number.isFinite(linea.precioUnitario) ||
        linea.precioUnitario <= 0 ||
        !Number.isInteger(linea.cantidad) ||
        linea.cantidad <= 0
      ) {
        throw new RangeError('El pedido contiene una línea con datos inválidos.');
      }

      return {
        productoId: linea.productoId,
        producto: linea.producto.trim(),
        precioUnitario: linea.precioUnitario,
        cantidad: linea.cantidad,
        subtotal: this.redondearImporte(linea.precioUnitario * linea.cantidad)
      };
    });
  }

  /** Obtiene el total a partir de los subtotales ya normalizados. */
  private calcularTotal(lineas: LineaPedido[]): number {
    return this.redondearImporte(lineas.reduce((total, linea) => total + linea.subtotal, 0));
  }

  /** Redondea un importe monetario a dos decimales compensando precisión binaria. */
  private redondearImporte(importe: number): number {
    return Math.round((importe + Number.EPSILON) * 100) / 100;
  }

  /** Adapta registros actuales y antiguos a la forma que consume la interfaz. */
  private normalizarPedido(registro: Record<string, unknown>): PedidoGuardado | null {
    const id = registro['id'];
    if (typeof id !== 'number' || !Number.isInteger(id)) {
      return null;
    }

    const tipo: PedidoGuardado['tipo'] = registro['tipo'] === 'compra' ? 'compra' : 'pedido';
    const origen = registro['origen'] === 'ONLINE' || registro['origen'] === 'OFFLINE'
      ? registro['origen']
      : 'NO REGISTRADO';
    const estado: EstadoPedido = registro['estado'] === 'SINCRONIZADO' ||
      registro['estado'] === 'sincronizado'
      ? 'SINCRONIZADO'
      : registro['estado'] === 'ERROR' || registro['estado'] === 'error'
        ? 'ERROR'
        : 'PENDIENTE';
    const lineasGuardadas = Array.isArray(registro['lineas'])
      ? registro['lineas']
      : Array.isArray(registro['items'])
        ? registro['items']
        : [];
    const lineas: LineaPedido[] = [];

    for (const valor of lineasGuardadas) {
      if (typeof valor !== 'object' || valor === null) {
        continue;
      }
      const linea = valor as Record<string, unknown>;
      const productoId = linea['productoId'];
      const producto = linea['producto'];
      const precioUnitario = linea['precioUnitario'] ?? linea['precio'];
      const cantidad = linea['cantidad'];
      if (
        typeof productoId !== 'number' ||
        typeof producto !== 'string' ||
        typeof precioUnitario !== 'number' ||
        typeof cantidad !== 'number' ||
        !Number.isInteger(cantidad) ||
        cantidad < 1
      ) {
        continue;
      }

      lineas.push({
        productoId,
        producto,
        precioUnitario,
        cantidad,
        subtotal: this.redondearImporte(precioUnitario * cantidad)
      });
    }

    const total = typeof registro['total'] === 'number'
      ? registro['total']
      : this.calcularTotal(lineas);
    const fecha = typeof registro['fecha'] === 'string' &&
      Number.isFinite(Date.parse(registro['fecha']))
      ? registro['fecha']
      : 'Fecha no registrada';
    const observacion = typeof registro['observacion'] === 'string'
      ? registro['observacion']
      : typeof registro['pedido'] === 'string'
        ? registro['pedido']
        : undefined;

    return {
      id,
      tipo,
      fecha,
      lineas,
      total,
      estado,
      origen,
      ...(observacion ? { observacion } : {})
    };
  }

  /** Borra todas las entradas del carrito conservando los pedidos guardados. */
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
