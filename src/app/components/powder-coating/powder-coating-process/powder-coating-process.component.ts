import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PowderCoatingService } from '../../../services/powder-coating.service';
import { ProductService } from '../../../services/product.service';
import { CategoryService } from '../../../services/category.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PowderCoatingProcess } from '../../../models/powder-coating.model';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../../services/customer.service';
import { ReturnModalComponent } from '../return-modal/return-modal.component';
import { ModalService } from '../../../services/modal.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-powder-coating-process',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoaderComponent,
    SearchableSelectComponent,
    FormsModule,
    RouterLink,
    ReturnModalComponent,
    PaginationComponent
  ],
  templateUrl: './powder-coating-process.component.html',
  styleUrls: ['./powder-coating-process.component.scss']
})
export class PowderCoatingProcessComponent implements OnInit {
  @ViewChild(ReturnModalComponent) returnModal!: ReturnModalComponent;
  processes: PowderCoatingProcess[] = [];
  products: any[] = [];
  // categories: any[] = [];
  searchForm!: FormGroup;
  isLoading = false;
  isLoadingProducts = false;
  customers: any[] = [];
  isLoadingCustomers = false;
  selectedProcesses: Set<number> = new Set();
  selectedCustomerId?: number;
  isGeneratingPdf = false;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  constructor(
    private powderCoatingService: PowderCoatingService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private customerService: CustomerService,
    private modalService: ModalService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadProcesses();
    this.loadCustomers();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      productId: [''],
      categoryId: [''],
      customerId: ['']
    });
  }

  loadProducts(): void {
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

  loadProcesses(): void {
    this.isLoading = true;
    this.selectedCustomerId = undefined;
    this.selectedProcesses.clear();
    const params = {
      ...this.searchForm.value,
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      sortBy: 'id',
      sortDir: 'desc'
    };

    this.powderCoatingService.searchProcesses(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.processes = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load processes');
        this.isLoading = false;
      }
    });
  }

  private updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadProcesses();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadProcesses();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadProcesses();
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = [];
    const totalPages = this.totalPages;
    const currentPage = this.currentPage + 1;

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i);
        }
      }
    }

    return pageNumbers;
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
      error: (error) => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
      }
    });
  }

  deleteProcess(id: number): void {
    if (confirm('Are you sure you want to delete this process?')) {
      this.powderCoatingService.deleteProcess(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Process deleted successfully');
            this.loadProcesses();
          }
        },
        error: () => {
          this.snackbar.error('Failed to delete process');
        }
      });
    }
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadProcesses();
  }

  loadCustomers(): void {
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

  openReturnModal(processId: number): void {
    this.modalService.open('return', processId);
  }

  isCheckboxDisabled(process: any): boolean {
    return this.selectedCustomerId !== undefined && 
           this.selectedCustomerId !== process.customerId;
  }

  toggleProcessSelection(process: any, event: Event): void {
    if (this.isCheckboxDisabled(process)) {
      event.preventDefault();
      this.snackbar.error('You can select records of only one customer');
      return;
    }

    if (this.selectedProcesses.size === 0) {
      this.selectedCustomerId = process.customerId;
      this.selectedProcesses.add(process.id);
    } else {
      if (this.selectedProcesses.has(process.id)) {
        this.selectedProcesses.delete(process.id);
        if (this.selectedProcesses.size === 0) {
          this.selectedCustomerId = undefined;
        }
      } else {
        this.selectedProcesses.add(process.id);
      }
    }
  }

  generatePdf(): void {
    if (!this.selectedCustomerId || this.selectedProcesses.size === 0) {
      this.snackbar.error('Please select at least one process');
      return;
    }

    this.isGeneratingPdf = true;
    const data = {
      customerId: this.selectedCustomerId,
      processIds: Array.from(this.selectedProcesses)
    };

    this.powderCoatingService.generatePdf(data).subscribe({
      next: (response) => {
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isGeneratingPdf = false;
      },
      error: () => {
        this.snackbar.error('Failed to generate PDF');
        this.isGeneratingPdf = false;
      }
    });
  }
}
