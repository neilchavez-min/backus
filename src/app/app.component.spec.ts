import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { StorageService } from './storage.service';

describe('AppComponent', () => {
  let storage: jasmine.SpyObj<StorageService>;

  beforeEach(async () => {
    storage = jasmine.createSpyObj<StorageService>('StorageService', [
      'listarCarrito',
      'listarPedidos',
      'finalizarCompra',
      'guardarPedido',
      'agregarAlCarrito',
      'actualizarCantidad',
      'quitarDelCarrito',
      'limpiarCarrito'
    ]);
    storage.listarCarrito.and.returnValue(Promise.resolve([]));
    storage.listarPedidos.and.returnValue(Promise.resolve([]));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: storage }
      ]
    }).compileComponents();
  });

  it('should render the catalog, cart controls, and connection state', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/data/catalogo.json').flush([
      { id: 1, producto: 'Cristal 620 ml', categoria: 'Cerveza', precio: 7.5 }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.title).toBe('Backus Ventas PWA');
    expect(compiled.querySelector('h1')?.textContent).toContain('Tu catálogo');
    expect(compiled.textContent).toContain('Cristal 620 ml');
    expect(compiled.textContent).toContain('CONECTADO');
    expect(compiled.querySelector('.add-button')?.textContent).toContain('Agregar al carrito');
    expect(compiled.querySelector('.cart-shortcut')?.textContent).toContain('Carrito');
    expect(compiled.querySelector('.history-shortcut')?.textContent).toContain('Historial');
    expect(compiled.querySelector('.cart-dialog')).toBeNull();
    expect(compiled.querySelector('.history-dialog')).toBeNull();
    (compiled.querySelector('.history-shortcut') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('[role="dialog"] h2')?.textContent).toContain('Historial de pedidos');
    (compiled.querySelector('[aria-label="Cerrar historial"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('.history-dialog')).toBeNull();
    (compiled.querySelector('.cart-shortcut') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('[role="dialog"] h2')?.textContent).toContain('Carrito de compras');
    expect(compiled.querySelector<HTMLButtonElement>('.checkout-button')?.disabled).toBeTrue();
    http.verify();
  });

  it('should confirm, save, and clear a completed cart purchase', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/data/catalogo.json').flush([]);
    await fixture.whenStable();

    const app = fixture.componentInstance;
    const items = [
      {
        productoId: 1,
        producto: 'Cristal 620 ml',
        precioUnitario: 7.5,
        cantidad: 2,
        subtotal: 15
      }
    ];
    app.carrito = [
      { productoId: 1, producto: 'Cristal 620 ml', categoria: 'Cerveza', precio: 7.5, cantidad: 2 }
    ];
    app.online = false;
    spyOn(window, 'confirm').and.returnValue(true);
    storage.finalizarCompra.and.returnValue(Promise.resolve(1));

    await app.finalizarCompra();

    expect(storage.finalizarCompra).toHaveBeenCalledWith(items, 'OFFLINE');
    expect(app.carrito).toEqual([]);
    expect(app.mensaje).toContain('PENDIENTE');
    expect(app.mensaje).toContain('No se envió al servidor');
    http.verify();
  });

  it('should combine case-insensitive name search with category filter', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/data/catalogo.json').flush([
      { id: 1, producto: 'Cristal 620 ml', categoria: 'Cerveza', precio: 7.5 },
      { id: 2, producto: 'Pilsen Callao 620 ml', categoria: 'Cerveza', precio: 8 },
      { id: 3, producto: 'Pilsen Sin Alcohol', categoria: 'Sin Alcohol', precio: 6 }
    ]);
    await fixture.whenStable();
    const app = fixture.componentInstance;

    app.busqueda = 'PILsen';
    expect(app.productosFiltrados.map((producto) => producto.id)).toEqual([2, 3]);
    app.categoriaSeleccionada = 'Cerveza';
    expect(app.productosFiltrados.map((producto) => producto.id)).toEqual([2]);
    http.verify();
  });

  it('should reject non-integer or non-positive product quantities', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/data/catalogo.json').flush([]);
    await fixture.whenStable();
    const app = fixture.componentInstance;

    await app.agregarAlCarrito({
      id: 1,
      producto: 'Cristal 620 ml',
      categoria: 'Cerveza',
      precio: 7.5
    }, 0);

    expect(storage.agregarAlCarrito).not.toHaveBeenCalled();
    expect(app.errorPedido).toContain('entero mayor que cero');
    http.verify();
  });

  it('should persist a manually registered offline order with its origin', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/data/catalogo.json').flush([]);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.online = false;
    app.pedido = 'Llamar al cliente para confirmar';
    storage.guardarPedido.and.returnValue(Promise.resolve(4));

    await app.guardarPedido();

    expect(storage.guardarPedido).toHaveBeenCalledWith({
      tipo: 'pedido',
      observacion: 'Llamar al cliente para confirmar',
      lineas: [],
      total: 0,
      origen: 'OFFLINE'
    });
    expect(app.mensaje).toContain('PENDIENTE');
    expect(app.mensaje).toContain('No se envió al servidor');
    http.verify();
  });

  it('should keep the cart when the purchase confirmation is cancelled', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/data/catalogo.json').flush([]);
    await fixture.whenStable();

    const app = fixture.componentInstance;
    const item = {
      productoId: 1,
      producto: 'Cristal 620 ml',
      categoria: 'Cerveza',
      precio: 7.5,
      cantidad: 1
    };
    app.carrito = [item];
    spyOn(window, 'confirm').and.returnValue(false);

    await app.finalizarCompra();

    expect(storage.finalizarCompra).not.toHaveBeenCalled();
    expect(app.carrito).toEqual([item]);
    http.verify();
  });
});
