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
      'listarCompras',
      'finalizarCompra'
    ]);
    storage.listarCarrito.and.returnValue(Promise.resolve([]));
    storage.listarCompras.and.returnValue(Promise.resolve([]));

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
    expect(compiled.querySelector('.history-shortcut')?.textContent).toContain('Compras');
    expect(compiled.querySelector('.cart-dialog')).toBeNull();
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
      { productoId: 1, producto: 'Cristal 620 ml', categoria: 'Cerveza', precio: 7.5, cantidad: 2 }
    ];
    app.carrito = items;
    spyOn(window, 'confirm').and.returnValue(true);
    storage.finalizarCompra.and.returnValue(Promise.resolve(1));

    await app.finalizarCompra();

    expect(storage.finalizarCompra).toHaveBeenCalledWith(items, 15);
    expect(app.carrito).toEqual([]);
    expect(app.mensaje).toContain('Compra finalizada');
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
