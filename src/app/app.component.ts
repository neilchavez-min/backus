import { Component, HostListener, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from './catalogo.service';
import type { Producto } from './catalogo.service';
import {
  StorageService,
  type CarritoItem,
  type LineaPedido,
  type OrigenPedido,
  type PedidoGuardado
} from './storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly title = 'Backus Ventas PWA';
  online = navigator.onLine;
  productos: Producto[] = [];
  cantidadesSeleccionadas: Record<number, number | null> = {};
  carrito: CarritoItem[] = [];
  pedidos: PedidoGuardado[] = [];
  pedido = '';
  busqueda = '';
  categoriaSeleccionada = '';
  mensaje = '';
  errorCatalogo = '';
  errorPedido = '';
  errorHistorial = '';
  cargandoHistorial = true;
  procesandoCompra = false;
  carritoAbierto = false;

  constructor(
    private readonly catalogoService: CatalogoService,
    private readonly storageService: StorageService
  ) {}

  get totalCarrito(): number {
    return this.redondearImporte(
      this.carrito.reduce(
        (total, item) => total + this.redondearImporte(item.precio * item.cantidad),
        0
      )
    );
  }

  get cantidadCarrito(): number {
    return this.carrito.reduce((total, item) => total + item.cantidad, 0);
  }

  get categorias(): string[] {
    return [...new Set(this.productos.map((producto) => producto.categoria))]
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  get productosFiltrados(): Producto[] {
    const busqueda = this.busqueda.trim().toLocaleLowerCase('es');
    return this.productos.filter((producto) => {
      const coincideNombre = producto.producto.toLocaleLowerCase('es').includes(busqueda);
      const coincideCategoria = !this.categoriaSeleccionada ||
        producto.categoria === this.categoriaSeleccionada;
      return coincideNombre && coincideCategoria;
    });
  }

  abrirCarrito(): void {
    this.carritoAbierto = true;
  }

  cerrarCarrito(): void {
    this.carritoAbierto = false;
  }

  ngOnInit(): void {
    this.catalogoService.obtenerCatalogo().subscribe({
      next: (productos) => {
        this.productos = productos;
        for (const producto of productos) {
          this.cantidadesSeleccionadas[producto.id] = 1;
        }
        this.errorCatalogo = '';
      },
      error: (error: unknown) => {
        this.errorCatalogo = error instanceof Error
          ? `No se pudo cargar el catálogo: ${error.message}`
          : 'No se pudo cargar el catálogo.';
      }
    });

    this.cargarCarrito();
    this.cargarHistorial();
  }

  @HostListener('window:online')
  actualizarConexionOnline(): void {
    this.online = true;
  }

  @HostListener('window:offline')
  actualizarConexionOffline(): void {
    this.online = false;
  }

  async cargarCarrito(): Promise<void> {
    try {
      this.carrito = await this.storageService.listarCarrito();
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo cargar el carrito: ${error.message}`
        : 'No se pudo cargar el carrito.';
    }
  }

  async agregarAlCarrito(
    producto: Producto,
    cantidad = this.cantidadesSeleccionadas[producto.id] ?? 1
  ): Promise<void> {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      this.errorPedido = 'La cantidad debe ser un número entero mayor que cero.';
      this.mensaje = '';
      return;
    }

    const nuevoItem: CarritoItem = {
      productoId: producto.id,
      producto: producto.producto,
      categoria: producto.categoria,
      precio: producto.precio,
      cantidad
    };

    try {
      await this.storageService.agregarAlCarrito(nuevoItem);
      this.carrito = await this.storageService.listarCarrito();
      this.mensaje = this.online
        ? `${producto.producto} agregado y guardado en el carrito.`
        : `Sin conexión: ${producto.producto} se guardó en el carrito de este dispositivo.`;
      this.errorPedido = '';
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo guardar el producto en el carrito: ${error.message}`
        : 'No se pudo guardar el producto en el carrito.';
    }
  }

  async limpiarCarrito(): Promise<void> {
    try {
      await this.storageService.limpiarCarrito();
      this.carrito = [];
      this.mensaje = 'Carrito vaciado correctamente.';
      this.errorPedido = '';
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo vaciar el carrito: ${error.message}`
        : 'No se pudo vaciar el carrito.';
    }
  }

  async cambiarCantidad(item: CarritoItem, cambio: number): Promise<void> {
    const cantidad = item.cantidad + cambio;
    if (cantidad < 1) {
      return;
    }

    try {
      await this.storageService.actualizarCantidad(item.productoId, cantidad);
      this.carrito = await this.storageService.listarCarrito();
      this.mensaje = `Cantidad de ${item.producto} actualizada.`;
      this.errorPedido = '';
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo actualizar el carrito: ${error.message}`
        : 'No se pudo actualizar el carrito.';
    }
  }

  async quitarProducto(item: CarritoItem): Promise<void> {
    try {
      await this.storageService.quitarDelCarrito(item.productoId);
      this.carrito = await this.storageService.listarCarrito();
      this.mensaje = `${item.producto} se quitó del carrito.`;
      this.errorPedido = '';
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo quitar el producto: ${error.message}`
        : 'No se pudo quitar el producto.';
    }
  }

  async cargarHistorial(): Promise<void> {
    this.cargandoHistorial = true;
    try {
      this.pedidos = await this.storageService.listarPedidos();
      this.errorHistorial = '';
    } catch (error: unknown) {
      this.errorHistorial = error instanceof Error
        ? `No se pudo cargar el historial: ${error.message}`
        : 'No se pudo cargar el historial.';
    } finally {
      this.cargandoHistorial = false;
    }
  }

  async finalizarCompra(): Promise<void> {
    if (this.procesandoCompra) {
      return;
    }

    if (this.carrito.length === 0) {
      this.errorPedido = 'Agrega al menos un producto antes de finalizar el pedido.';
      return;
    }

    let lineas: LineaPedido[];
    try {
      lineas = this.carrito.map((item) => {
        if (
          !Number.isInteger(item.cantidad) ||
          item.cantidad < 1 ||
          !Number.isFinite(item.precio) ||
          item.precio <= 0
        ) {
          throw new RangeError('El carrito contiene cantidades o precios inválidos.');
        }
        return {
          productoId: item.productoId,
          producto: item.producto,
          precioUnitario: item.precio,
          cantidad: item.cantidad,
          subtotal: this.redondearImporte(item.precio * item.cantidad)
        };
      });
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se puede guardar la compra: ${error.message}`
        : 'El carrito contiene datos inválidos.';
      this.mensaje = '';
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas finalizar el pedido por S/ ${this.totalCarrito.toFixed(2)}? Se guardará en este dispositivo.`
    );
    if (!confirmar) {
      return;
    }

    const origen = this.online ? 'ONLINE' : 'OFFLINE';
    this.procesandoCompra = true;
    this.mensaje = '';
    this.errorPedido = '';

    try {
      await this.storageService.finalizarCompra(lineas, origen);
      this.carrito = [];
      await this.cargarHistorial();
      this.cerrarCarrito();
      this.mensaje = this.mensajePersistencia(origen);
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo finalizar la compra: ${error.message}`
        : 'No se pudo finalizar la compra.';
    } finally {
      this.procesandoCompra = false;
    }
  }

  exportarComprobante(pedido: PedidoGuardado): void {
    const lineas = [
      'BACKUS VENTAS - COMPROBANTE LOCAL',
      `Registro: ${pedido.tipo === 'compra' ? 'Compra' : 'Pedido'} ${pedido.id}`,
      `Fecha: ${pedido.fecha === 'Fecha no registrada' ? pedido.fecha : new Date(pedido.fecha).toLocaleString('es-PE')}`,
      `Origen: ${pedido.origen}`,
      `Estado: ${pedido.estado}`,
      '',
      ...pedido.lineas.map((linea) =>
        `${linea.producto} | ${linea.cantidad} x S/ ${linea.precioUnitario.toFixed(2)} = S/ ${linea.subtotal.toFixed(2)}`
      ),
      ...(pedido.observacion ? [`Observación: ${pedido.observacion}`] : []),
      '',
      `TOTAL: S/ ${pedido.total.toFixed(2)}`,
      'Registro generado localmente; no representa un pago.'
    ];
    const archivo = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${pedido.tipo}-${pedido.id}.txt`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async guardarPedido(): Promise<void> {
    const detalle = this.pedido.trim();
    if (!detalle) {
      this.errorPedido = 'Escribe el detalle antes de guardar el pedido.';
      return;
    }

    this.mensaje = '';
    this.errorPedido = '';

    try {
      const origen: Exclude<OrigenPedido, 'NO REGISTRADO'> = this.online ? 'ONLINE' : 'OFFLINE';
      await this.storageService.guardarPedido({
        tipo: 'pedido',
        observacion: detalle,
        lineas: [],
        total: 0,
        origen
      });
      this.pedido = '';
      await this.cargarHistorial();
      this.mensaje = this.mensajePersistencia(origen);
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo guardar el pedido localmente: ${error.message}`
        : 'No se pudo guardar el pedido localmente.';
    }
  }

  private mensajePersistencia(origen: Exclude<OrigenPedido, 'NO REGISTRADO'>): string {
    return origen === 'OFFLINE'
      ? 'Pedido guardado en este dispositivo con estado PENDIENTE. No se envió al servidor.'
      : 'Pedido guardado en IndexedDB con estado PENDIENTE. No hay sincronización con servidor configurada.';
  }

  private redondearImporte(importe: number): number {
    return Math.round((importe + Number.EPSILON) * 100) / 100;
  }
}
