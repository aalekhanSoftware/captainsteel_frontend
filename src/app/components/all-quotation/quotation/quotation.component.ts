// Updated to use encrypted ID in URL instead of localStorage for edit functionality
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { QuotationService } from '../../../services/quotation.service';
import { CustomerService } from '../../../services/customer.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ModalService } from '../../../services/modal.service';
import { DateUtils } from '../../../shared/utils/date-utils';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SaleModalComponent } from '../../sale-modal/sale-modal.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { QuotationStatus, StatusOption } from '../../../models/quotation.model';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { IndianCurrencyPipe } from '../../../shared/pipes/indian-currency.pipe';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-quotation',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    RouterModule,
    MatDialogModule,
    SaleModalComponent,
    LoaderComponent,
    SearchableSelectComponent,
    PaginationComponent,
    IndianCurrencyPipe
  ],
  templateUrl: './quotation.component.html',
  styleUrl: './quotation.component.scss'
})
export class QuotationComponent implements OnInit, OnDestroy {
  quotations: any[] = [];
  searchForm!: FormGroup;
  isLoading = false;
  statusOptions: any[] = [];


// Pagination properties
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;
  selectedQuotation:any = null;
  products: any[] = [];
  isLoadingProducts = false;
  customers: any[] = [];
  isLoadingCustomers = false;
  private destroy$ = new Subject<void>();
  private clickOutsideListener?: (event: Event) => void;

  constructor(
    private quotationService: QuotationService,
    private customerService: CustomerService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private dialog: MatDialog,
    private modalService: ModalService,
    private dateUtils: DateUtils,
    private encryptionService: EncryptionService,
    private router: Router
  ){
    this.initializeForm();
    this.statusOptions = Object.entries(QuotationStatus).map(([key, value]) => ({ label: value, value: key }));
    this.setupClickOutsideListener();
  }

  ngOnInit(): void {
    this.loadQuotations();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    // Complete the destroy subject to unsubscribe all observables
    this.destroy$.next();
    this.destroy$.complete();
    
    // Remove event listener
    if (this.clickOutsideListener) {
      document.removeEventListener('click', this.clickOutsideListener);
    }
    
    // Clean up references
    this.quotations = [];
    this.products = [];
    this.customers = [];
    this.selectedQuotation = null;
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      customerId: [''],
      startDate: [''],
      endDate: [''],
      status: null
    });
  }

  loadQuotations(): void {
    this.isLoading = true;
    const params = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      startDate: this.searchForm.value.startDate ? this.dateUtils.formatDate(this.searchForm.value.startDate) : '',
      endDate: this.searchForm.value.endDate ? this.dateUtils.formatDate(this.searchForm.value.endDate) : '',
      ...this.searchForm.value,
    };
  
    this.quotationService.searchQuotations(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response:any) => {
          // Initialize showStatusDropdown for each quotation
          this.quotations = response.content.map((q: any) => ({
            ...q,
            showStatusDropdown: false
          }));
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.startIndex = this.currentPage * this.pageSize;
          this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
          this.isLoading = false;
        },
        error: (error:any) => {
          this.snackbar.error(error.message || 'Failed to load quotations');
          this.isLoading = false;
        }
      });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadQuotations();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadQuotations();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadQuotations();
  }

  openSaleModal(quotation: any) {
    this.selectedQuotation = quotation;
    this.modalService.open('sale');
  }

  deleteQuotation(id: number): void {
    if (confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
      this.isLoading = true;
      this.quotationService.deleteQuotation(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.snackbar.success('Quotation deleted successfully');
            this.loadQuotations();
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || 'Failed to delete quotation');
            this.isLoading = false;
          }
        });
    }
  }

  private loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.customers = response.data;
          }
          this.isLoadingCustomers = false;
        },
        error: (error) => {
          this.snackbar.error('Failed to load customers');
          this.isLoadingCustomers = false;
        }
      });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.customers = response.data;
            this.snackbar.success('Customers refreshed successfully');
          }
          this.isLoadingCustomers = false;
        },
        error: (error) => {
          this.snackbar.error('Failed to refresh customers');
          this.isLoadingCustomers = false;
        }
      });
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadQuotations();
  }

  getStatusLabel(status: string): string {
    return QuotationStatus[status as keyof typeof QuotationStatus] || status;
  }

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      Q: 'status-quote',
      A: 'status-accepted',
      D: 'status-declined',
      // R: 'status-ready',
      P: 'status-processing',
      C: 'status-completed'
    };
    return statusClasses[status] || 'status-default';
  }

  generatePdf(id: number, quotation: any, preview: boolean = false): void {
    if (!quotation) return;

    quotation.isPrinting = true;
    
    this.quotationService.generatePdf(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const url = window.URL.createObjectURL(response.blob);
          
          if (preview) {
            // Open PDF in a new tab for preview
            window.open(url, '_blank');
            // Note: We don't revoke URL immediately for preview as the new tab needs it
            // The browser will clean it up when the tab is closed
          } else {
            // Download PDF (existing behavior)
            const link = document.createElement('a');
            link.href = url;
            link.download = response.filename || this.generateQuotationFilename(quotation, 'quotation');
            link.click();
            window.URL.revokeObjectURL(url);
          }
          
          quotation.isPrinting = false;
        },
        error: () => {
          this.snackbar.error('Failed to generate PDF');
          quotation.isPrinting = false;
        }
      });
  }

  generateDispatchPdf(id: number, quotation: any): void {
    if (!quotation) return;

    quotation.isPrinting = true;
    this.quotationService.generateDispatchPdf(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const url = window.URL.createObjectURL(response.blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = response.filename || this.generateQuotationFilename(quotation, 'dispatch-slip');
          link.click();
          window.URL.revokeObjectURL(url);
          quotation.isPrinting = false;
        }, 
        error: () => {
          this.snackbar.error('Failed to generate PDF');
          quotation.isPrinting = false;
        }
      });
  }

  private generateQuotationFilename(quotation: any, type: 'quotation' | 'dispatch-slip'): string {
    const quoteNumber = quotation.quoteNumber || 'unknown';
    const customerName = quotation.customerName;
    
    // Sanitize quote number by removing special characters
    const sanitizedQuoteNumber = quoteNumber.replace(/[^\w\-_.]/g, '-');
    
    if (customerName && customerName.trim()) {
      // Sanitize customer name by removing special characters
      const sanitizedCustomerName = customerName.replace(/[^\w\-_.]/g, '-');
      return type === 'quotation' 
        ? `${sanitizedQuoteNumber}-${sanitizedCustomerName}.pdf`
        : `dispatch-slip-${sanitizedQuoteNumber}-${sanitizedCustomerName}.pdf`;
    } else {
      // No customer name, just use quote number
      return type === 'quotation' 
        ? `${sanitizedQuoteNumber}.pdf`
        : `dispatch-slip-${sanitizedQuoteNumber}.pdf`;
    }
  }

  getStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      Q: 'fa-file-alt',         // Quote
      A: 'fa-check-circle',     // Accepted
      D: 'fa-times-circle',     // Declined
      R: 'fa-clock',            // Ready
      P: 'fa-spinner fa-spin',  // Processing
      C: 'fa-check-double'      // Completed
    };
    return statusIcons[status] || 'fa-question-circle';
  }

  private setupClickOutsideListener(): void {
    this.clickOutsideListener = (event: Event) => {
      const dropdowns = document.querySelectorAll('.status-container');
      dropdowns.forEach(dropdown => {
        if (!dropdown.contains(event.target as Node)) {
          this.quotations.forEach(q => q.showStatusDropdown = false);
        }
      });
    };
    document.addEventListener('click', this.clickOutsideListener);
  }

  toggleStatusDropdown(quotation: any): void {
    event?.stopPropagation();
    this.quotations.forEach(q => {
      if (q !== quotation) q.showStatusDropdown = false;
    });
    quotation.showStatusDropdown = !quotation.showStatusDropdown;
  }

  canChangeStatus(status: string): boolean {
    return ['D','Q', 'A', 'P'].includes(status);
  }

  updateStatus(quotation: any, newStatus: string): void {
    if (!quotation || quotation.isUpdating) return;

    quotation.isUpdating = true;
    quotation.showStatusDropdown = false;
    
    this.quotationService.updateQuotationStatus(quotation.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          quotation.status = newStatus;
          this.snackbar.success('Status updated successfully');
          quotation.isUpdating = false;
        },
        error: (error:any) => {
          this.snackbar.error(error?.error?.message || 'Failed to update status');
          quotation.isUpdating = false;
        }
      });
  }
  
  getAvailableStatusOptions(currentStatus: string): StatusOption[] {
    switch(currentStatus) {
      case 'Q':
        return [
          { label: QuotationStatus.A, value: 'A', disabled: false },
          { label: QuotationStatus.D, value: 'D', disabled: false }
        ];
      case 'A':
        return [
          { label: QuotationStatus.P, value: 'P', disabled: false },
          { label: QuotationStatus.D, value: 'D', disabled: false }
        ];
      case 'P':
        return [{ label: QuotationStatus.C, value: 'C', disabled: false }];
      case 'D':
        return [{ label: QuotationStatus.A, value: 'A', disabled: false }];
      case 'C':
        return []; // Status cannot be updated
      default:
        return [];
    }
  }

  editQuotation(id: number): void {
    if (!id) return;
    const encryptedId = this.encryptionService.encrypt(id.toString());
    this.router.navigate(['/quotation/edit', encryptedId]);
  }

  addQuotation(): void {
    this.router.navigate(['/quotation/create']);
  }  
  
  openWhatsApp(rawNumber: string | number | null | undefined): void {
    const digits = String(rawNumber ?? '').replace(/\D/g, '');
    if (!digits) {
      return;
    }
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    const url = `whatsapp://send?phone=${normalized}`;
    try {
      // Attempt to open native WhatsApp app via custom protocol
      window.location.href = url;
    } catch {
      // Swallow errors; native handlers may block exceptions
    }
  }

  makeCall(rawNumber: string | number | null | undefined): void {
    const digits = String(rawNumber ?? '').replace(/\D/g, '');
    if (!digits) {
      return;
    }
    const url = `tel:+91${digits}`;
    try {
      window.location.href = url;
    } catch {
      // Swallow errors; native handlers may block exceptions
    }
  }
}