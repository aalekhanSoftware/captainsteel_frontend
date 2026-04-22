import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { PowderCoatingService } from '../../../services/powder-coating.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PowderCoatingReturn } from '../../../models/powder-coating.model';
import { ReturnModalComponent } from '../return-modal/return-modal.component';
import { ModalService } from '../../../services/modal.service';
import { ApiResponse } from '../../../models/api.model';

@Component({
  selector: 'app-add-powder-coating-process',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    LoaderComponent,
    RouterLink,
    ReturnModalComponent
  ],
  templateUrl: './add-powder-coating-process.component.html',
  styleUrls: ['./add-powder-coating-process.component.scss']
})
export class AddPowderCoatingProcessComponent implements OnInit {
  @ViewChild(ReturnModalComponent) returnModal!: ReturnModalComponent;
  
  processForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  processId?: number;
  isEditMode = false;
  showReturns = false;
  isLoadingReturns = false;
  returns: PowderCoatingReturn[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService,
    private customerService: CustomerService,
    private powderCoatingService: PowderCoatingService,
    private snackbar: SnackbarService,
    private modalService: ModalService
  ) {
    this.initializeForm();
    this.processId = this.route.snapshot.params['id'];
    this.isEditMode = !!this.processId;
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();
    this.setupCustomerChange();
    if (this.isEditMode) {
      this.loadProcess();
    }
  }

  private initializeForm(): void {
    this.processForm = this.fb.group({
      customerId: ['', [Validators.required]],
      productId: ['', [Validators.required]],
      quantity: ['', [Validators.required, Validators.min(1)]],
      totalBags: ['', [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      totalAmount: [{ value: '', disabled: true }],
      remarks: [''],
      status: ['A']
    });

    // Setup total amount calculation
    ['quantity', 'unitPrice'].forEach(field => {
      this.processForm.get(field)?.valueChanges.subscribe(() => {
        this.calculateTotalAmount();
      });
    });
  }

  private calculateTotalAmount(): void {
    const quantity = Number(this.processForm.get('quantity')?.value) || 0;
    const unitPrice = Number(this.processForm.get('unitPrice')?.value) || 0;
    const totalAmount = quantity * unitPrice;
    
    this.processForm.patchValue({
      totalAmount: totalAmount.toFixed(2)
    }, { emitEvent: false });
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.processForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const control = this.processForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['min']) return `${fieldName} must be at least ${control.errors['min'].min}`;
    }
    return '';
  }

  resetForm(): void {
    this.processForm.reset({ status: 'A' });
  }

  loadProcess(): void {
    this.loading = true;
    this.powderCoatingService.getProcess(this.processId!).subscribe({
      next: (response) => {
        if (response.success) {
          this.processForm.patchValue({
            customerId: response.data.customerId,
            productId: response.data.productId,
            quantity: response.data.quantity,
            totalBags: response.data.totalBags,
            unitPrice: response.data.unitPrice,
            totalAmount: response.data.totalAmount,
            status: response.data.status
          });
        } else {
          this.snackbar.error('Failed to load process details');
          this.router.navigate(['/powder-coating-process']);
        }
        this.loading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load process details');
        this.loading = false;
        this.router.navigate(['/powder-coating-process']);
      }
    });
  }

  onSubmit(): void {
    if (this.processForm.valid) {
      this.loading = true;
      const request = this.isEditMode ? 
        this.powderCoatingService.updateProcess(this.processId!, this.processForm.value) :
        this.powderCoatingService.createProcess(this.processForm.value);

      request.subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success(`Process ${this.isEditMode ? 'updated' : 'created'} successfully`);
            this.router.navigate(['/powder-coating-process']);
          }
          this.loading = false;
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} process`);
          this.loading = false;
        }
      });
    }
  }

  toggleReturns(): void {
    this.showReturns = !this.showReturns;
    if (this.showReturns && this.returns.length === 0) {
      this.loadReturns();
    }
  }

  loadReturns(): void {
    if (!this.processId) return;
    
    this.isLoadingReturns = true;
    this.powderCoatingService.getProcessReturns(this.processId).subscribe({
      next: (response) => {
        if (response.success) {
          this.returns = response.data;
        }
        this.isLoadingReturns = false;
      },
      error: () => {
        this.snackbar.error('Failed to load returns');
        this.isLoadingReturns = false;
      }
    });
  }

  getTotalReturns(): number {
    return this.returns.reduce((sum, ret) => sum + ret.returnQuantity, 0);
  }

  deleteReturn(id: number): void {
    if (confirm('Are you sure you want to delete this return?')) {
      this.isLoadingReturns = true;
      this.powderCoatingService.deleteReturn(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Return deleted successfully');
            this.loadReturns();
          }
        },
        error: () => {
          this.snackbar.error('Failed to delete return');
          this.isLoadingReturns = false;
        }
      });
    }
  }

  openReturnModal(): void {
    if (this.processId && this.returnModal) {
      this.modalService.open('return', this.processId);
    } else {
      this.snackbar.error('Unable to open return modal');
    }
  }

  private setupCustomerChange(): void {
    this.processForm.get('customerId')?.valueChanges.subscribe(customerId => {
      if (customerId) {
        this.customerService.getCustomerCoatingPrice(customerId).subscribe({
          next: (response: any) => {
            if (response.success) {
              this.processForm.patchValue({
                unitPrice: response.data?.coatingUnitPrice || 0
              });
            } else {
              this.processForm.patchValue({
                unitPrice: 0
              });
            }
          },
          error: () => {
            this.snackbar.error('Failed to get customer coating price');
            this.processForm.patchValue({
              unitPrice: 0
            });
          }
        });
      } else {
        this.processForm.patchValue({
          unitPrice: 0
        });
      }
    });
  }
}
