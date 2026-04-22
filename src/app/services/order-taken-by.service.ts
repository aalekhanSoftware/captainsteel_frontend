import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrderTakenBy, OrderTakenBySearchRequest, OrderTakenByResponse } from '../models/order-taken-by.model';

@Injectable({
  providedIn: 'root'
})
export class OrderTakenByService {
  private apiUrl = `${environment.apiUrl}/api/order-taken-by`;

  constructor(private http: HttpClient) {}

  search(params: OrderTakenBySearchRequest): Observable<OrderTakenByResponse> {
    return this.http.post<OrderTakenByResponse>(`${this.apiUrl}/search`, params);
  }

  create(data: OrderTakenBy): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  update(data: OrderTakenBy): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/update`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/delete`, { id });
  }

  listActive(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/list-active`, {});
  }

  getDetail(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/detail`, { id });
  }
}
