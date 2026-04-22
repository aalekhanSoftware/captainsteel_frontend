import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Sale, SaleResponse, SaleSearchRequest } from '../models/sale.model';

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  private apiUrl = `${environment.apiUrl}/api/sales`;

  constructor(private http: HttpClient) {}

  searchSales(params: SaleSearchRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.apiUrl}/searchSale`, params);
  }

  createSale(sale: Sale): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, sale);
  }

  updateSale(id: number, sale: Sale): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, sale);
  }

  deleteSale(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getSaleDetails(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }
}