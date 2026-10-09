import { Component, HostListener, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoService } from './catalogo.service';
import type { Producto } from './catalogo.service';
import { StorageService, type CarritoItem, type CompraGuardada } from './storage.service';

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
  carrito: CarritoItem[] = [];
  compras: CompraGuardada[] = [];
  pedido = '';
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
    return this.carrito.reduce((total, item) => total + item.precio * item.cantidad, 0);
  }

  get cantidadCarrito(): number {
    return this.carrito.reduce((total, item) => total + item.cantidad, 0);
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

  async agregarAlCarrito(producto: Producto): Promise<void> {
    const itemExistente = this.carrito.find((item) => item.productoId === producto.id);
    const nuevoItem: CarritoItem = {
      productoId: producto.id,
      producto: producto.producto,
      categoria: producto.categoria,
      precio: producto.precio,
      cantidad: itemExistente ? itemExistente.cantidad + 1 : 1
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
      this.compras = await this.storageService.listarCompras();
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
    if (this.carrito.length === 0 || this.procesandoCompra) {
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas finalizar la compra por S/ ${this.totalCarrito.toFixed(2)}? Se guardará en este dispositivo.`
    );
    if (!confirmar) {
      return;
    }

    const items = this.carrito.map((item) => ({ ...item }));
    const total = this.totalCarrito;
    this.procesandoCompra = true;
    this.mensaje = '';
    this.errorPedido = '';

    try {
      await this.storageService.finalizarCompra(items, total);
      this.carrito = [];
      this.cerrarCarrito();
      this.mensaje = 'Compra finalizada y guardada en este dispositivo. Puedes consultar o descargar el comprobante en el historial.';
      await this.cargarHistorial();
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo finalizar la compra: ${error.message}`
        : 'No se pudo finalizar la compra.';
    } finally {
      this.procesandoCompra = false;
    }
  }

  exportarComprobante(compra: CompraGuardada): void {
    const lineas = [
      'BACKUS VENTAS - COMPROBANTE DE COMPRA',
      `Compra: ${compra.id}`,
      `Fecha: ${new Date(compra.fecha).toLocaleString('es-PE')}`,
      '',
      ...compra.items.map((item) =>
        `${item.producto} | ${item.cantidad} x S/ ${item.precio.toFixed(2)} = S/ ${(item.cantidad * item.precio).toFixed(2)}`
      ),
      '',
      `TOTAL: S/ ${compra.total.toFixed(2)}`,
      `Estado: ${compra.estado}`,
      'Comprobante generado localmente; no representa un pago.'
    ];
    const archivo = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `compra-${compra.id}.txt`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async guardarPedido(): Promise<void> {
    const detalle = this.pedido.trim();
    if (!detalle) {
      return;
    }

    this.mensaje = '';
    this.errorPedido = '';

    if (this.online) {
      this.mensaje = 'Pedido procesado correctamente (simulación en línea).';
      this.pedido = '';
      return;
    }

    try {
      await this.storageService.guardarPedido({ pedido: detalle });
      this.mensaje = 'Pedido guardado en este dispositivo y pendiente de sincronización.';
      this.pedido = '';
    } catch (error: unknown) {
      this.errorPedido = error instanceof Error
        ? `No se pudo guardar el pedido localmente: ${error.message}`
        : 'No se pudo guardar el pedido localmente.';
    }
  }
}
