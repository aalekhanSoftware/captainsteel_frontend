import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  QuotationService,
  QuotationItemDetail,
  QuotationItemSearchRequest,
  QuotationListPdfRequest,
  QuotationItemStatusCode
} from '../../../services/quotation.service';
import { CustomerService } from '../../../services/customer.service';
import { ProductService } from '../../../services/product.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { QuotationStatus } from '../../../models/quotation.model';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { OrderTakenByService } from '../../../services/order-taken-by.service';
import { OrderTakenBy } from '../../../models/order-taken-by.model';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    SearchableSelectComponent,
    PaginationComponent
  ],
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.scss']
})
export class OrderComponent implements OnInit {
  private static readonly validQuotationItemStatuses = new Set<string>(['O', 'IP', 'C', 'B']);

  searchForm: FormGroup;
  quotationItems: QuotationItemDetail[] = [];
  currentPage = 0;
  totalPages = 0;
  totalItems = 0;
  perPageRecord = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  loading = false;
  isDownloadingPdf = false;
  customers: any[] = [];
  isLoadingCustomers = false;
  products: any[] = [];
  isLoadingProducts = false;
  orderTakenByList: OrderTakenBy[] = [];
  isLoadingOrderTakenBy = false;

  /** Rows selected for bulk status update (quotation item ids). */
  readonly selectedItemIds = new Set<number>();
  bulkTargetStatus: QuotationItemStatusCode | '' = '';
  isBulkStatusUpdating = false;

  @ViewChild('selectAllCheckbox') selectAllCheckbox?: ElementRef<HTMLInputElement>;

  quotationItemStatusOptions = [
    { value: 'O', label: 'Open' },
    { value: 'IP', label: 'In Process' },
    { value: 'C', label: 'Completed' },
    { value: 'B', label: 'Billed' }
  ];

  quotationStatusOptions: any[] = [];

  constructor(
    private fb: FormBuilder,
    private quotationService: QuotationService,
    private customerService: CustomerService,
    private productService: ProductService,
    private orderTakenByService: OrderTakenByService,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    this.searchForm = this.fb.group({
      quotationItemStatuses: [['O', 'IP']], // Default selected
      productId: [''],
      quotationStatuses: [],
      customerId: [''],
      orderTakenById: [''],
      startDate: [''],
      endDate: ['']
    });

    // Initialize quotationStatusOptions from QuotationStatus enum
    this.quotationStatusOptions = Object.entries(QuotationStatus).map(([key, value]) => ({ label: value, value: key }));
  }

  ngOnInit(): void {
    this.loadQuotationItems();
    this.loadCustomers();
    this.loadProducts();
    this.loadOrderTakenBy();
  }

  loadQuotationItems(page: number = 0): void {
    this.loading = true;
    this.currentPage = page;

    const formValue = this.searchForm.value;
    const request: QuotationItemSearchRequest & { orderTakenById?: number } = {
      currentPage: page,
      perPageRecord: this.perPageRecord,
      sortBy: 'id',
      sortDir: 'desc',
      quotationItemStatuses: formValue.quotationItemStatuses && formValue.quotationItemStatuses.length > 0 ? formValue.quotationItemStatuses : undefined,
      productId: formValue.productId ? Number(formValue.productId) : undefined,
      isProduction: true, // Always pass true
      quotationStatuses: formValue.quotationStatuses && formValue.quotationStatuses.length > 0 ? formValue.quotationStatuses : undefined,
      customerId: formValue.customerId ? Number(formValue.customerId) : undefined,
      orderTakenById: formValue.orderTakenById ? Number(formValue.orderTakenById) : undefined,
      startDate: formValue.startDate || undefined,
      endDate: formValue.endDate || undefined
    };

    this.quotationService.searchQuotationItemsWithDetails(request).subscribe({
      next: (response) => {
        this.quotationItems = response.content;
        this.totalPages = response.totalPages;
        this.totalItems = response.totalItems;
        this.loading = false;
        this.clearBulkUiState();
      },
      error: (error) => {
        console.error('Error loading quotation items:', error);
        this.snackbar.error('Failed to load quotation items');
        this.loading = false;
        this.clearBulkUiState();
      }
    });
  }

  private clearBulkUiState(): void {
    this.selectedItemIds.clear();
    this.bulkTargetStatus = '';
    this.queueSyncSelectAllIndeterminate();
  }

  private queueSyncSelectAllIndeterminate(): void {
    queueMicrotask(() => this.syncSelectAllCheckboxIndeterminate());
  }

  private syncSelectAllCheckboxIndeterminate(): void {
    const el = this.selectAllCheckbox?.nativeElement;
    if (!el) {
      return;
    }
    const ids = this.getSelectableIdsOnPage();
    if (ids.length === 0) {
      el.indeterminate = false;
      return;
    }
    let selectedOnPage = 0;
    for (const id of ids) {
      if (this.selectedItemIds.has(id)) {
        selectedOnPage++;
      }
    }
    el.indeterminate = selectedOnPage > 0 && selectedOnPage < ids.length;
  }

  getSelectableIdsOnPage(): number[] {
    return this.quotationItems.filter((item) => this.isRowSelectable(item)).map((item) => item.id);
  }

  get selectableIdsOnPageCount(): number {
    return this.getSelectableIdsOnPage().length;
  }

  isRowSelectable(item: QuotationItemDetail): boolean {
    return item.id != null && item.id > 0;
  }

  isRowSelected(id: number): boolean {
    return this.selectedItemIds.has(id);
  }

  isAllSelectableOnPageSelected(): boolean {
    const ids = this.getSelectableIdsOnPage();
    if (ids.length === 0) {
      return false;
    }
    return ids.every((id) => this.selectedItemIds.has(id));
  }

  get selectedCount(): number {
    return this.selectedItemIds.size;
  }

  onSelectAllPageClick(event: MouseEvent): void {
    event.preventDefault();
    const ids = this.getSelectableIdsOnPage();
    if (ids.length === 0 || this.isBulkStatusUpdating) {
      return;
    }
    if (this.isAllSelectableOnPageSelected()) {
      ids.forEach((id) => this.selectedItemIds.delete(id));
    } else {
      ids.forEach((id) => this.selectedItemIds.add(id));
    }
    this.queueSyncSelectAllIndeterminate();
  }

  onRowCheckboxChange(item: QuotationItemDetail, checked: boolean): void {
    if (!this.isRowSelectable(item) || this.isBulkStatusUpdating) {
      return;
    }
    if (checked) {
      this.selectedItemIds.add(item.id);
    } else {
      this.selectedItemIds.delete(item.id);
    }
    this.queueSyncSelectAllIndeterminate();
  }

  applyBulkItemStatus(): void {
    const ids = Array.from(this.selectedItemIds);
    if (ids.length === 0) {
      this.snackbar.error('Select one or more rows, choose a status, then apply.');
      return;
    }
    const status = this.bulkTargetStatus;
    if (!status || !OrderComponent.validQuotationItemStatuses.has(status)) {
      this.snackbar.error('Choose a status to apply to the selected rows.');
      return;
    }

    const newStatus = status as QuotationItemStatusCode;
    this.isBulkStatusUpdating = true;

    this.quotationService.updateQuotationItemsStatusBulk({ ids, quotationItemStatus: newStatus }).subscribe({
      next: (response) => {
        this.isBulkStatusUpdating = false;
        if (response.success) {
          for (const row of this.quotationItems) {
            if (this.selectedItemIds.has(row.id)) {
              row.quotationItemStatus = newStatus;
            }
          }
          this.selectedItemIds.clear();
          this.bulkTargetStatus = '';
          this.queueSyncSelectAllIndeterminate();
          this.snackbar.success(response.message || 'Quotation item statuses updated successfully');
        } else {
          this.snackbar.error(response.message || 'Could not update item statuses.');
        }
      },
      error: (error: unknown) => {
        this.isBulkStatusUpdating = false;
        const msg =
          (error as { error?: { message?: string } })?.error?.message ||
          'Failed to update quotation item statuses.';
        console.error('Error bulk-updating quotation item status:', error);
        this.snackbar.error(msg);
      }
    });
  }

  private loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to load customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.snackbar.error('Failed to load products');
        this.isLoadingProducts = false;
      }
    });
  }

  private loadOrderTakenBy(): void {
    this.isLoadingOrderTakenBy = true;
    this.orderTakenByService.listActive().subscribe({
      next: (response) => {
        if (response?.success && response?.data) {
          this.orderTakenByList = response.data;
        }
        this.isLoadingOrderTakenBy = false;
      },
      error: () => {
        this.snackbar.error('Failed to load order taken by');
        this.isLoadingOrderTakenBy = false;
      }
    });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers().subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
          this.snackbar.success('Customers refreshed successfully');
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  refreshProducts(): void {
    this.isLoadingProducts = true;
    this.productService.refreshProducts().subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
          this.snackbar.success('Products refreshed successfully');
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
      }
    });
  }

  refreshOrderTakenBy(): void {
    this.isLoadingOrderTakenBy = true;
    this.orderTakenByService.listActive().subscribe({
      next: (response) => {
        if (response?.success && response?.data) {
          this.orderTakenByList = response.data;
          this.snackbar.success('Order taken by refreshed successfully');
        }
        this.isLoadingOrderTakenBy = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh order taken by');
        this.isLoadingOrderTakenBy = false;
      }
    });
  }

  onSubmit(): void {
    this.loadQuotationItems(0);
  }

  downloadListPdf(): void {
    this.isDownloadingPdf = true;
    const formValue = this.searchForm.value;
    const request: QuotationListPdfRequest = {
      currentPage: this.currentPage,
      perPageRecord: this.perPageRecord,
      sortBy: 'quoteDate',
      sortDir: 'desc',
      quotationItemStatuses: formValue.quotationItemStatuses && formValue.quotationItemStatuses.length > 0 ? formValue.quotationItemStatuses : undefined,
      quotationStatuses: formValue.quotationStatuses && formValue.quotationStatuses.length > 0 ? formValue.quotationStatuses : undefined,
      customerId: formValue.customerId ? Number(formValue.customerId) : undefined,
      orderTakenById: formValue.orderTakenById ? Number(formValue.orderTakenById) : undefined,
      startDate: formValue.startDate || undefined,
      endDate: formValue.endDate || undefined
    };

    this.quotationService.generateQuotationListPdf(request).subscribe({
      next: ({ blob, filename }) => {
        const downloadName = filename || 'quotation_list.pdf';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.snackbar.success('PDF downloaded successfully');
        this.isDownloadingPdf = false;
      },
      error: () => {
        this.snackbar.error('Failed to download PDF');
        this.isDownloadingPdf = false;
      }
    });
  }

  resetForm(): void {
    this.searchForm.reset({
      quotationItemStatuses: ['O', 'IP'],
      productId: '',
      quotationStatuses: [],
      customerId: '',
      orderTakenById: '',
      startDate: '',
      endDate: ''
    });
    this.loadQuotationItems(0);
  }

  onPageChange(page: number): void {
    this.loadQuotationItems(page);
  }

  onPageSizeChange(newSize: number | string): void {
    const n = typeof newSize === 'number' ? newSize : Number(newSize);
    if (!Number.isFinite(n) || n <= 0) {
      return;
    }
    this.perPageRecord = n;
    this.loadQuotationItems(0);
  }

  getStatusLabel(status: string | null | undefined): string {
    if (status == null || status === '') {
      return '—';
    }
    const statusOption = this.quotationItemStatusOptions.find((option) => option.value === status);
    return statusOption ? statusOption.label : status;
  }

  trackByQuotationItemId(_index: number, item: QuotationItemDetail): number {
    return item.id;
  }

  getQuotationStatusLabel(status: string): string {
    const statusOption = this.quotationStatusOptions.find((option) => option.value === status);
    return statusOption ? statusOption.label : status;
  }

  editQuotation(quotationId: number): void {
    // Navigate to quotation edit page
    if (!quotationId) return;
    const encryptedId = this.encryptionService.encrypt(quotationId.toString());
    this.router.navigate(['/quotation/edit', encryptedId]);
  }

  // Handle quotation item status checkbox changes
  onQuotationItemStatusChange(event: any, value: string): void {
    const statuses = this.searchForm.get('quotationItemStatuses')?.value || [];
    const index = statuses.indexOf(value);

    if (event.target.checked && index === -1) {
      statuses.push(value);
    } else if (!event.target.checked && index !== -1) {
      statuses.splice(index, 1);
    }

    this.searchForm.get('quotationItemStatuses')?.setValue(statuses);
  }

  // Handle quotation status checkbox changes
  onQuotationStatusChange(event: any, value: string): void {
    const statuses = this.searchForm.get('quotationStatuses')?.value || [];
    const index = statuses.indexOf(value);

    if (event.target.checked && index === -1) {
      statuses.push(value);
    } else if (!event.target.checked && index !== -1) {
      statuses.splice(index, 1);
    }

    this.searchForm.get('quotationStatuses')?.setValue(statuses);
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

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
