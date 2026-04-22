import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PowderCoatingResponse, PowderCoatingSearchRequest, PowderCoatingReturnResponse, PowderCoatingReturnRequest } from '../models/powder-coating.model';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PowderCoatingService {
  private apiUrl = `${environment.apiUrl}/api/powder-coating`;
  private powderCoatingReturnsApiUrl = `${environment.apiUrl}/api/powder-coating-returns`;

  constructor(private http: HttpClient) {}

  searchProcesses(params: PowderCoatingSearchRequest): Observable<PowderCoatingResponse> {
    return this.http.post<PowderCoatingResponse>(`${this.apiUrl}/search`, params);
  }

  createProcess(data: {
    customerId: number;
    productId: number;
    quantity: number;
    status: string;
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  updateProcess(id: number, data: {
    customerId: number;
    productId: number;
    quantity: number;
    status: string;
  }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  deleteProcess(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
  

  getProcess(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/getProcess`, { id });
  }

  getProcessReturns(processId: number): Observable<any> {
    return this.http.post<any>(
      `${this.powderCoatingReturnsApiUrl}/getByProcessId`,
      { processId }
    );
  }

  deleteReturn(id: number): Observable<any> {
    return this.http.post(`${this.powderCoatingReturnsApiUrl}/delete`, { id });
  }

  createReturn(data: PowderCoatingReturnRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/return`, data);
  }

  generatePdf(data: { customerId: number; processIds: number[] }): Observable<{ blob: Blob; filename: string }> {
    return this.http.post(`${this.apiUrl}/generate-pdf`, data, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'estimate.pdf';
        const blob = new Blob([response.body!], { type: 'application/pdf' });
        return { blob, filename };
      })
    );
  }
} 