import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Estructura de cada producto disponible en el catálogo local. */
export interface Producto {
  id: number;
  producto: string;
  categoria: string;
  precio: number;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private readonly catalogoUrl = 'assets/data/catalogo.json';

  constructor(private readonly http: HttpClient) {}

  /** Solicita el catálogo como flujo HTTP; en producción el Service Worker puede servirlo de caché. */
  obtenerCatalogo(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.catalogoUrl);
  }
}
