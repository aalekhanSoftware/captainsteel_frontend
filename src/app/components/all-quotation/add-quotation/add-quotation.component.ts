import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl, AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, Subscription } from 'rxjs';
import { formatDate } from '@angular/common';
import { Dialog, DialogRef } from '@angular/cdk/dialog';

import { QuotationService } from '../../../services/quotation.service';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { OrderTakenByService } from '../../../services/order-taken-by.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { ProductMainType, ProductCalculationType } from '../../../models/product.model';
import { ProductCalculationDialogComponent } from '../../../components/shared/product-calculation-dialog/product-calculation-dialog.component';
import { ProductPolyCarbonateRollCalculationDialogComponent } from '../../../components/shared/product-poly-carbonate-roll-calculation-dialog/product-poly-carbonate-roll-calculation-dialog.component';
import { AccessoriesSelectionDialogComponent } from '../../../components/shared/accessories-selection-dialog/accessories-selection-dialog.component';
import { QuotationDetailData } from '../../../models/quotation.model';

interface ProductOption {
  id: number;
  name: string;
  sale_amount: number;
  tax_percentage: number;
}

@Component({
  selector: 'app-add-quotation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoaderComponent,
    SearchableSelectComponent,
    PaginationComponent
  ],
  animations: [
    trigger('dialogAnimation', [
      transition(':enter', [
        style({ transform: 'translate(-50%, -48%) scale(0.95)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translate(-50%, -48%) scale(0.95)', opacity: 0 }))
      ])
    ])
  ],
  templateUrl: './add-quotation.component.html',
  styleUrls: ['./add-quotation.component.scss']
})
export class AddQuotationComponent implements OnInit, OnDestroy {
  quotationForm!: FormGroup;
  createQuotationForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  isLoadingOrderTakenBy = false;
  orderTakenByList: any[] = [];
  minValidUntilDate: string;
  private destroy$ = new Subject<void>();
  private customerNameSyncSubscription?: Subscription;
  private modalClosedSubscription?: Subscription;
  isLoading = false;
  isEdit = false;
  quotationId?: number;
  quotationStatus?: string; // Add this to store the quotation status
  selectedProduct!: string
  totals: { price: number; tax: number; finalPrice: number; loadingCharge: number } = {
    price: 0,
    tax: 0,
    finalPrice: 0,
    loadingCharge: 0
  };
  private itemSubscriptions: Subscription[] = [];
  private pendingOrderTakenByName?: string;
  hasProductionItemsFlag = false; // Add flag to track production items

  get quotationFormArray() {
    return this.quotationForm as FormGroup;
  }
  get itemsFormArray() {
    return this.quotationForm.get('items') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private quotationService: QuotationService,
    private productService: ProductService,
    private customerService: CustomerService,
    private orderTakenByService: OrderTakenByService,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: Dialog,
    private cdr: ChangeDetectorRef
  ) {
    const today = new Date();
    this.minValidUntilDate = formatDate(today, 'yyyy-MM-dd', 'en');
    this.initForm();
  }

  ngOnInit() {
    this.loadProducts();
    this.loadCustomers();
    this.loadOrderTakenBy();
    this.setupCustomerNameSync();
    this.checkForEdit();
    this.setupItemSubscriptions();
  }

  ngOnDestroy() {
    // Unsubscribe from all subscriptions to prevent memory leaks
    this.destroy$.next();
    this.destroy$.complete();
    
    // Unsubscribe from customer name sync subscription
    if (this.customerNameSyncSubscription) {
      this.customerNameSyncSubscription.unsubscribe();
    }
    
    // Unsubscribe from modal closed subscription
    if (this.modalClosedSubscription) {
      this.modalClosedSubscription.unsubscribe();
    }
    
    // Unsubscribe from all item subscriptions
    this.itemSubscriptions.forEach(sub => {
      if (sub) {
        sub.unsubscribe();
      }
    });
    this.itemSubscriptions = [];
    
    // Clean up any references
    this.products = [];
    this.customers = [];
    this.quotationForm = null!;
  }

  private initForm() {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 2);

    this.quotationForm = this.fb.group({
      customerId: [''],
      customerName: [''],
      contactNumber: [''],
      orderTakenById: [null],
      quoteDate: [formatDate(today, 'yyyy-MM-dd', 'en'), Validators.required],
      validUntil: [formatDate(validUntil, 'yyyy-MM-dd', 'en'), [Validators.required]],
      remarks: [''],
      termsConditions: [''],
      address: [''],
      quotationDiscount: [0, [Validators.min(0), Validators.max(100)]], // Add quotation discount field
      items: this.fb.array([])
    });
    // Subscribe to quotationDiscount changes to trigger recalculation
    this.quotationForm.get('quotationDiscount')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.onQuotationDiscountChange();
      });

    this.addItem();
  }

  private createItemFormGroup(initialData?: any): FormGroup {
    return this.fb.group({
      id: [initialData?.id || null], // Add ID field
      productId: [initialData?.productId || '', Validators.required],
      productType: [initialData?.productType || ''],
      calculationType: [initialData?.calculationType || ''],
      calculationBase: [initialData?.calculationBase || 'W'], // Add calculationBase field
      useManualQuantity: [initialData?.useManualQuantity || false], // Add useManualQuantity field
      quantity: [initialData?.quantity || 1, [Validators.required, Validators.min(1)]],
      weight: [{ value: initialData?.weight || 0, disabled: true }],
      unitPrice: [initialData?.unitPrice || 0, [Validators.required, Validators.min(0.01)]],
      discountPercentage: [initialData?.discountPercentage || 0, [Validators.required, Validators.min(0), Validators.max(100)]],
      itemRemarks: [initialData?.itemRemarks || ''],
      price: [initialData?.price || 0],
      // taxPercentage: [{ value: initialData?.taxPercentage || 18, disabled: true }],
      taxAmount: [{ value: initialData?.taxAmount || 0, disabled: true }],
      loadingCharge: [{ value: initialData?.loadingCharge || 0, disabled: true }],
      finalPrice: [{ value: initialData?.finalPrice || 0, disabled: true }],
      calculations: [initialData?.calculations || []],
      accessoriesSize: [initialData?.accessoriesSize || ''],
      nos: [initialData?.nos ?? initialData?.accessoriesNos ?? 1],
      // New fields
      isProduction: [initialData?.isProduction || false],
      quotationItemStatus: [initialData?.quotationItemStatus || null]
    });
  }

  private feetInchValidator(calculationType: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      if(calculationType === 'SQ_FEET'){
        const feet = group.get('feet')?.value || 0;
        const inch = group.get('inch')?.value
        if (feet === 0 && inch === 0) {
          return { bothZero: true };
        }
      }

      if(calculationType === 'MM'){
        const mm = group.get('mm')?.value || 0;
        if (mm === 0){
          return { mmZero: true };
        }
      }
      return null;
    };
  }


  createCalculationGroup(item: any, calculationType: string): FormGroup {
    console.log('createCalculationGroup item : ', item);
    return this.fb.group({
      mm: [item.mm, calculationType === 'MM' ? Validators.required : null],
      feet: [item.feet],
      nos: [item.nos, Validators.required],
      weight: [item.weight, Validators.required],
      id: [item?.id],
      inch: [item.inch],
      sqFeet: [item.sqFeet, Validators.required],
      runningFeet: [item.runningFeet, Validators.required]
    }, { validators: this.feetInchValidator(calculationType) });
  }
  
  get isCustomerIdSelected(){
    return this.quotationForm?.get('customerId')?.value
  }
  
  private setupCustomerNameSync() {
    // Store subscription reference for proper cleanup
    this.customerNameSyncSubscription = this.quotationForm.get('customerId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(customerId => {
        if (customerId) {
          const selectedCustomer = this.customers.find(c => c.id === customerId);
          if (selectedCustomer) {
            this.quotationForm.patchValue({ customerName: selectedCustomer.name });
            this.quotationForm.patchValue({ address: selectedCustomer.address });
            this.quotationForm.patchValue({ contactNumber: selectedCustomer.mobile });
          }
        }
      });
  }

  addItem(): void {
    const itemGroup = this.fb.group({
      id: [null], // Add ID field
      productId: ['', Validators.required],
      productType: [''],
      calculationType: [''],
      calculationBase: ['W'], // Add calculationBase field with default value (will be overridden for POLY_CARBONATE_ROLL)
      useManualQuantity: [false], // Add useManualQuantity field
      weight: [0],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
      discountPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      itemRemarks: [''],
      price: [0],
      // taxPercentage: [18],
      taxAmount: [0],
      finalPrice: [],
      loadingCharge: [],
      calculations: [[]],
      accessoriesSize: [''],
      nos: [],
      // New fields
      isProduction: [false],
      quotationItemStatus: [null]
    });
    this.setupItemCalculations(itemGroup, this.itemsFormArray.length);
    this.itemsFormArray.push(itemGroup);
    const newIndex = this.itemsFormArray.length - 1;
    this.subscribeToItemChanges(this.itemsFormArray.at(newIndex), newIndex);
    this.calculateTotalAmount();
    // Update the production items flag
    this.hasProductionItemsFlag = this.hasProductionItems();
  }

  removeItem(index: number): void {
    if (this.itemSubscriptions[index]) {
      this.itemSubscriptions[index].unsubscribe();
      this.itemSubscriptions.splice(index, 1);
    }
    
    this.itemsFormArray.removeAt(index);
    
    // Re-index subscriptions
    this.itemsFormArray.controls.forEach((control, newIndex) => {
      if (this.itemSubscriptions[newIndex]) {
        this.itemSubscriptions[newIndex].unsubscribe();
      }
      this.subscribeToItemChanges(control, newIndex);
    });

    this.calculateTotalAmount();
  }

  private loadOrderTakenBy(): void {
    this.isLoadingOrderTakenBy = true;
    this.orderTakenByService.listActive().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.orderTakenByList = response.data;
          this.applyPendingOrderTakenBySelection();
        }
        this.isLoadingOrderTakenBy = false;
      },
      error: (error) => {
        console.error('Failed to load Order Taken By list', error);
        this.isLoadingOrderTakenBy = false;
      }
    });
  }

  refreshOrderTakenBy(): void {
    this.isLoadingOrderTakenBy = true;
    this.orderTakenByService.listActive().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.orderTakenByList = response.data;
          this.applyPendingOrderTakenBySelection();
          this.snackbar.success('Personnel list refreshed successfully');
        }
        this.isLoadingOrderTakenBy = false;
      },
      error: (error) => {
        this.snackbar.error('Failed to refresh personnel list');
        this.isLoadingOrderTakenBy = false;
      }
    });
  }

  private setupItemCalculations(group: FormGroup, index: number) {
    const fields = ['quantity', 'unitPrice', 'taxPercentage', 'discountPercentage'];

    fields.forEach(field => {
      group.get(field)?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.calculateItemPrice(index);
        });
    });
    
    // Listen to calculationBase changes for loading charge recalculation
    group.get('calculationBase')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculateItemPrice(index);
      });
    
    // Listen to weight changes for REGULAR, POLY_CARBONATE, and ACCESSORIES products (affects loading charge)
    group.get('weight')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const productType = group.get('productType')?.value;
        if (productType === 'REGULAR' || productType === 'POLY_CARBONATE' || productType === 'ACCESSORIES') {
          this.calculateItemPrice(index);
        }
      });
    
    // Listen to calculations changes for ACCESSORIES with modal selection
    group.get('calculations')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const productType = group.get('productType')?.value;
        if (productType === 'ACCESSORIES') {
          this.calculateItemPrice(index);
        }
      });
  }

  private calculateItemPrice(index: number): void {
    const group = this.itemsFormArray.at(index) as FormGroup;
    const productType = group.get('productType')?.value;
    const values = {
      quantity: Number(Number(group.get('quantity')?.value || 0).toFixed(3)),
      unitPrice: Number(Number(group.get('unitPrice')?.value || 0).toFixed(2)),
      discountPercentage: Number(Number(group.get('discountPercentage')?.value || 0).toFixed(2)),
      taxAmount: Number(Number(group.get('taxAmount')?.value || 0).toFixed(2)),
      taxPercentage: Number(Number(group.get('taxPercentage')?.value || 18).toFixed(2)),
      loadingCharge: Number(Number(group.get('loadingCharge')?.value || 0).toFixed(2)),
      finalPrice: Number(Number(group.get('finalPrice')?.value || 0).toFixed(2))
    };

    // Calculate loading charge based on calculationBase and productType
    const weight = Number(group.get('weight')?.value || 0);
    const nos = Number(group.get('nos')?.value || 0);
    const calculationBase = group.get('calculationBase')?.value;
    const accessoriesSize = group.get('accessoriesSize')?.value;
    
    let loadingCharge = 0;
    
    // For ACCESSORIES with MULTI selection (modal-based), calculate total loading charge from all sizes
    if (productType === 'ACCESSORIES' && accessoriesSize === 'MULTI') {
      const calculations = group.get('calculations')?.value;
      if (calculations && calculations.sizes && Array.isArray(calculations.sizes)) {
        // Sum loading charge for all standard sizes (weight * 0.10 for each)
        loadingCharge = calculations.sizes.reduce((total: number, sizeItem: any) => {
          const sizeWeight = Number((sizeItem.weight * sizeItem.nos).toFixed(3));
          return total + Number((sizeWeight * 0.10).toFixed(2));
        }, 0);
        loadingCharge = Number(loadingCharge.toFixed(2));
      }
      // Add custom accessories loading charge if present
      if (calculations?.customList && Array.isArray(calculations.customList)) {
        calculations.customList.forEach((customEntry: any) => {
          const w = Number(customEntry.weight ?? customEntry.customWeight ?? 0);
          const n = Number(customEntry.nos ?? customEntry.customNos ?? 0);
          if (w > 0 && n >= 1) {
            const customQuantity = Number((w * n).toFixed(3));
            loadingCharge += Number((customQuantity * 0.10).toFixed(2));
          }
        });
        loadingCharge = Number(loadingCharge.toFixed(2));
      } else if (calculations && calculations.customNos > 0 && calculations.customWeight > 0) {
        const customQuantity = Number((calculations.customWeight * calculations.customNos).toFixed(3));
        loadingCharge += Number((customQuantity * 0.10).toFixed(2));
        loadingCharge = Number(loadingCharge.toFixed(2));
      }

      // Add profile ridge accessories loading charge if present
      if (calculations?.profileRidgeList && Array.isArray(calculations.profileRidgeList)) {
        calculations.profileRidgeList.forEach((profileRidgeEntry: any) => {
          const w = Number(profileRidgeEntry.weight ?? profileRidgeEntry.profileRidgeWeight ?? 0);
          const n = Number(profileRidgeEntry.nos ?? profileRidgeEntry.profileRidgeNos ?? 0);
          if (w > 0 && n >= 1) {
            const profileRidgeQuantity = Number((w * n).toFixed(3));
            loadingCharge += Number((profileRidgeQuantity * 0.10).toFixed(2));
          }
        });
        loadingCharge = Number(loadingCharge.toFixed(2));
      } else if (calculations && calculations.profileRidgeNos > 0 && calculations.profileRidgeWeight > 0) {
        const profileRidgeQuantity = Number((calculations.profileRidgeWeight * calculations.profileRidgeNos).toFixed(3));
        loadingCharge += Number((profileRidgeQuantity * 0.10).toFixed(2));
        loadingCharge = Number(loadingCharge.toFixed(2));
      }
    } else {
      // Check if loading charge should be calculated for other cases
      // For REGULAR and POLY_CARBONATE: calculate if calculationBase is 'W' or null
      // For ACCESSORIES: always calculate loading charge (including custom 'C' or 'Custom')
      const shouldCalculateLoadingCharge = 
        ((productType === 'REGULAR' || productType === 'POLY_CARBONATE') && (calculationBase === 'W' || !calculationBase))
        || (productType === 'ACCESSORIES' && accessoriesSize);
      
      if (shouldCalculateLoadingCharge) {
        // For ACCESSORIES with 'C', 'Custom', 'P', or 'Profile Ridge', use quantity * 0.10
        // For other cases, use weight * 0.10
        if (productType === 'ACCESSORIES' && (accessoriesSize === 'C' || accessoriesSize === 'Custom' || accessoriesSize === 'P' || accessoriesSize === 'Profile Ridge')) {
          loadingCharge = Number((values.quantity * 0.10).toFixed(2));
        } else {
          loadingCharge = Number((weight * 0.10).toFixed(2));
        }
      } else {
        loadingCharge = 0;
      }
    }
    
    const basePrice = Number((values.quantity * values.unitPrice).toFixed(2));
    const discountAmount = Number(((basePrice * values.discountPercentage) / 100).toFixed(2));
    const afterDiscount = Number((basePrice - discountAmount).toFixed(2));
    let taxAmount = Number(((afterDiscount * values.taxPercentage) / 100).toFixed(2));
    
    console.log('quotationDiscount value: ', this.quotationForm.get('quotationDiscount')?.value);
    
    // Apply quotation discount to tax amount
    const quotationDiscount = Number(this.quotationForm.get('quotationDiscount')?.value || 0);
    if (quotationDiscount > 0) {
      taxAmount = Number((taxAmount * (100 - quotationDiscount) / 100).toFixed(2));
    }
    
    const finalPrice = Number((afterDiscount + taxAmount + loadingCharge).toFixed(2));

    group.patchValue({
      price: afterDiscount,
      finalPrice: finalPrice,
      loadingCharge: loadingCharge,
      taxAmount: taxAmount
    }, { emitEvent: false });

    this.calculateTotalAmount();
  //this.cdr.detectChanges();
  }

  // Old inline accessories methods removed - now using modal exclusively
  // Modal handles all accessories calculations via openAccessoriesSelectionDialog()

  getTotalAmount(): number {
    return Math.round(this.itemsFormArray.controls
      .reduce((total, group: any) => total + (group.get('finalPrice').value || 0), 0));
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          // console.log('All products >>>',response.data)
          this.products = response.data;
          console.log('products >>>',this.products)
        }
        this.isLoadingProducts = false;
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
      },
      error: (error) => {
        this.snackbar.error('Failed to load products');
        this.isLoadingProducts = false;
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
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
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
      },
      error: (error) => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
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
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
      },
      error: (error) => {
        this.snackbar.error('Failed to load customers');
        this.isLoadingCustomers = false;
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
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
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
      },
      error: (error) => {
        this.snackbar.error('Failed to refresh customers');
        this.isLoadingCustomers = false;
        // Ensure change detection runs to update the UI
      //this.cdr.detectChanges();
      }
    });
  }

  private calculateTotalAmount(): void {
    const totals = {
      price: 0,
      tax: 0,
      finalPrice: 0,
      loadingCharge: 0,
      taxAmount: 0
    };

    // Get the quotation discount value
    const quotationDiscount = Number(this.quotationForm.get('quotationDiscount')?.value || 0);

    this.itemsFormArray.controls.forEach((group: AbstractControl) => {
      const price = Number(Number(group.get('price')?.value || 0).toFixed(2));
      const finalPrice = Number(Number(group.get('finalPrice')?.value || 0).toFixed(2));
      const loadingCharge = Number(Number(group.get('loadingCharge')?.value || 0).toFixed(2));
      const taxPercentage = Number(Number(group.get('taxPercentage')?.value || 18).toFixed(2));
      let taxAmount = Number(Number(group.get('taxAmount')?.value || 0).toFixed(2));
  
      // Apply quotation discount to tax amount
      if (quotationDiscount > 0) {
        taxAmount = Number((taxAmount * (100 - quotationDiscount) / 100).toFixed(2));
      }
  
      totals.price = Number((totals.price + price).toFixed(2));
      totals.tax = Number((totals.tax + (price * taxPercentage / 100)).toFixed(2));
      totals.finalPrice = Number((totals.finalPrice + finalPrice).toFixed(2));
      totals.loadingCharge = Number((totals.loadingCharge + loadingCharge).toFixed(2));
      totals.taxAmount = Number((totals.taxAmount + taxAmount).toFixed(2));
    });
  
    this.totals = {
      price: totals.price,
      tax: totals.tax,
      finalPrice: totals.finalPrice,
      loadingCharge: totals.loadingCharge
    };
    
    // Apply quotation discount to the total tax as well
    if (quotationDiscount > 0) {
      this.totals.tax = Number((this.totals.tax * (100 - quotationDiscount) / 100).toFixed(2));
    }
  }

  // Add method to handle quotation discount changes
  onQuotationDiscountChange(event?:any): void {
    console.log('Quotation discount changed ', event);
    
    const newValue = Number(event.target.value || 0);
    
    this.quotationForm.get('quotationDiscount')?.setValue(newValue, { emitEvent: false });
    
    // Recalculate all item prices when quotation discount changes
    this.itemsFormArray.controls.forEach((_, index) => {
      this.calculateItemPrice(index);
    });
    this.calculateTotalAmount();
  }

  resetForm(): void {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + 7);

    this.quotationForm.reset({
      quoteDate: formatDate(today, 'yyyy-MM-dd', 'en'),
      validUntil: formatDate(validUntil, 'yyyy-MM-dd', 'en'),
      remarks: '',
      termsConditions: ''
    });

    // Clear items array and add one empty item
    while (this.itemsFormArray.length) {
      this.itemsFormArray.removeAt(0);
    }
    this.addItem();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quotationForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  isItemFieldInvalid(index: number, fieldName: string): boolean {
    const control = this.itemsFormArray.at(index).get(fieldName);
    if (!control) return false;

    const isInvalid = control.invalid && (control.dirty || control.touched);

    if (isInvalid) {
      const errors = control.errors;
      if (errors) {
        if (errors['required']) return true;
        if (errors['min'] && fieldName === 'quantity') return true;
        if (errors['min'] && fieldName === 'unitPrice') return true;
        if ((errors['min'] || errors['max']) &&
          (fieldName === 'taxPercentage' || fieldName === 'discountPercentage')) return true;
      }
    }

    return false;
  }

  getFieldError(fieldName: string): string {
    const control = this.quotationForm.get(fieldName);
    if (control?.errors) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['min']) return `${fieldName} must be greater than ${control.errors['min'].min}`;
      if (control.errors['max']) return `${fieldName} must be less than ${control.errors['max'].max}`;
    }
    return '';
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.values(formGroup.controls).forEach(control => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
        control.markAsDirty();
      }
    });
  }

  onProductSelect(index: number, event: any): void {
    const selectedProduct = this.products.find(p => p.id === event.value);
    if (!selectedProduct) return;

    const itemGroup = this.itemsFormArray.at(index);
    const calculationTypeControl = itemGroup.get('calculationType');

    // Set default calculationBase based on product type
    let defaultCalculationBase = 'W';
    if (selectedProduct.type === 'POLY_CARBONATE_ROLL') {
      defaultCalculationBase = 'SF';
    }

    itemGroup.patchValue({
      productId: selectedProduct.id,
      productType: selectedProduct.type,
      unitPrice: selectedProduct.sale_amount || 0,
      weight: selectedProduct.weight || 0,
      quantity: selectedProduct.quantity || 1,
      calculationType: '',
      calculationBase: defaultCalculationBase, // Set calculationBase based on product type
      accessoriesSize: '',
      nos: '',
      useManualQuantity: false // Reset to calculator mode by default
    });

    // Add or remove validators based on product type
    if (selectedProduct.type === 'REGULAR' || selectedProduct.type === 'POLY_CARBONATE') {
      calculationTypeControl?.setValidators([Validators.required]);
      // Disable quantity by default - user can enable via NOS mode
      itemGroup.get('quantity')?.disable();
    } else if (selectedProduct.type === 'POLY_CARBONATE_ROLL') {
      // For POLY_CARBONATE_ROLL, no calculation type needed, but quantity should be disabled until dialog is used
      calculationTypeControl?.clearValidators();
      itemGroup.get('quantity')?.disable();
    } else {
      calculationTypeControl?.clearValidators();
      itemGroup.get('quantity')?.enable();
    }

    if (selectedProduct.type === 'ACCESSORIES') {
      // Accessories use modal for selection - reset weight/quantity until user opens modal
      itemGroup.patchValue({ weight: 0, quantity: 0 });
      itemGroup.get('quantity')?.disable(); // Disable until modal is used
    }

    calculationTypeControl?.updateValueAndValidity();
  }

  openCalculationDialog(index: number): void {
    const itemGroup = this.itemsFormArray.at(index);
    const selectedProduct = this.products.find(p => p.id === itemGroup.get('productId')?.value);
    const calculationType = itemGroup.get('calculationType')?.value;
    const savedCalculations = itemGroup.get('calculations')?.value || [];
    // Get the calculationBase if it exists
    const calculationBase = itemGroup.get('calculationBase')?.value || 'W';

    if (!selectedProduct || !calculationType) {
      return;
    }

    const dialogRef = this.dialog.open(ProductCalculationDialogComponent, {
      data: {
        product: selectedProduct,
        calculationType: calculationType,
        savedCalculations: savedCalculations,
        calculationBase: calculationBase // Pass calculationBase to dialog
      },
      width: '90%',
      maxWidth: '1200px'
    });

    // Store subscription reference for proper cleanup
    this.modalClosedSubscription = dialogRef.closed.subscribe((result?: any) => {
      if (result) {
        const finalValue = result.finalValue || 0;
        const calculationBase = result.calculationBase || 'W';
        
        // When calculationBase is 'N', use totalNos instead of finalValue for quantity
        let quantityValue = finalValue;
        if (calculationBase === 'N') {
          const totals = result.totals;
          quantityValue = totals?.totalNos || 0;
        }
        
        itemGroup.patchValue({
          weight: calculationBase === 'N' ? 0 : finalValue, // Weight should be 0 when using NOS
          quantity: quantityValue,
          calculations: result.calculations,
          calculationBase: calculationBase // Store the selected calculation base
        });

        // Trigger price calculations
        this.calculateItemPrice(index);
        
        // Force change detection
      //this.cdr.detectChanges();
      }
    });
  }

  openPolyCarbonateRollCalculationDialog(index: number): void {
    const itemGroup = this.itemsFormArray.at(index);
    const selectedProduct = this.products.find(p => p.id === itemGroup.get('productId')?.value);

    if (!selectedProduct || selectedProduct.type !== 'POLY_CARBONATE_ROLL') {
      return;
    }

    const savedCalculations = itemGroup.get('calculations')?.value || [];
    // Handle both array format and single object format for backward compatibility
    const calculationsArray = Array.isArray(savedCalculations) 
      ? savedCalculations 
      : (savedCalculations && typeof savedCalculations === 'object' && Object.keys(savedCalculations).length > 0)
        ? [savedCalculations]
        : [];

    // Get calculationBase from form, default to 'SF' if not set or empty for POLY_CARBONATE_ROLL
    const currentCalculationBase = itemGroup.get('calculationBase')?.value;
    const calculationBase = (currentCalculationBase && currentCalculationBase !== '') 
      ? currentCalculationBase 
      : 'SF';

    const dialogRef = this.dialog.open(ProductPolyCarbonateRollCalculationDialogComponent, {
      data: {
        product: selectedProduct,
        savedCalculations: calculationsArray,
        calculationBase: calculationBase,
        quantity: itemGroup.get('quantity')?.value || 0 // Pass the quantity to the dialog
      },
      width: '90%',
      maxWidth: '1020px'
    });

    // Store subscription reference for proper cleanup
    this.modalClosedSubscription = dialogRef.closed.subscribe((result?: any) => {
      if (result) {
        const finalQuantity = result.quantity || result.finalValue || 0;
        const resultCalculationBase = result.calculationBase || 'SF';
        
        itemGroup.patchValue({
          quantity: finalQuantity,
          calculations: result.calculations || [],
          calculationBase: resultCalculationBase // Store the calculationBase
        });

        // Enable quantity field to show the calculated value
        itemGroup.get('quantity')?.enable();
        
        // Trigger price calculations
        this.calculateItemPrice(index);
      }
    });
  }

  openAccessoriesSelectionDialog(index: number): void {
    const itemGroup = this.itemsFormArray.at(index);
    const selectedProduct = this.products.find(p => p.id === itemGroup.get('productId')?.value);

    if (!selectedProduct || selectedProduct.type !== 'ACCESSORIES') {
      return;
    }

    // Get saved accessories data if available
    const savedAccessories = itemGroup.get('calculations')?.value || null;

    const dialogRef = this.dialog.open(AccessoriesSelectionDialogComponent, {
      data: {
        product: selectedProduct,
        savedAccessories: savedAccessories
      },
      width: '95%',
      maxWidth: '1100px'
    });

    // Store subscription reference for proper cleanup
    this.modalClosedSubscription = dialogRef.closed.subscribe((result?: any) => {
      if (result) {
        const totalQuantity = result.totalQuantity || 0;
        
        // Store the accessories data in calculations field for persistence
        itemGroup.patchValue({
          quantity: totalQuantity,
          weight: totalQuantity,  // Set weight same as quantity for accessories
          calculations: result.accessoriesData,  // Store the full accessories data
          accessoriesSize: 'MULTI',  // Mark as multi-size selection
          nos: 0  // Not used with modal selection
        });

        // Enable quantity field to show the calculated value
        itemGroup.get('quantity')?.enable();
        itemGroup.get('weight')?.enable();
        
        // Trigger price calculations
        this.calculateItemPrice(index);
      }
    });
  }

  validateDates(): void {
    const quoteDate = this.quotationForm.get('quoteDate')?.value;
    const validUntil = this.quotationForm.get('validUntil')?.value;

    if (quoteDate && validUntil && new Date(validUntil) < new Date(quoteDate)) {
      this.quotationForm.get('validUntil')?.setErrors({ invalidDate: true });
    }
  }

  private checkForEdit(): void {
    // Get the encrypted ID from URL parameter
    const encryptedId = this.route.snapshot.paramMap.get('id');

    if (!encryptedId) {
      return;
    }

    try {
      const quotationId = this.encryptionService.decrypt(encryptedId);

      if (!quotationId) {
        // If decryption fails, redirect to quotation list
        this.router.navigate(['/quotation']);
        return;
      }

      this.isLoading = true;
      this.quotationService.getQuotationDetail(parseInt(quotationId)).subscribe({
        next: (response) => {
          if (response?.success && response.data) {
            this.quotationId = parseInt(quotationId);
            this.isEdit = true;
            console.log('edit response >>',response.data)
            this.populateForm(response.data);
          }
          this.isLoading = false;
          // Ensure change detection runs to update the UI
        //this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading quotation details:', error);
          this.snackbar.error('Failed to load quotation details');
          this.isLoading = false;
          // Redirect to quotation list on error
          this.router.navigate(['/quotation']);
          // Ensure change detection runs to update the UI
        //this.cdr.detectChanges();
        }
      });
    } catch (error) {
      console.error('Decryption error:', error);
      // Remove any existing localStorage item for backward compatibility
      localStorage.removeItem('editQuotationId');
      // Redirect to quotation list if decryption fails
      this.router.navigate(['/quotation']);
    }
  }

  private resolveOrderTakenById(data: QuotationDetailData): number | null {
    if (typeof data.orderTakenById === 'number') {
      return data.orderTakenById;
    }

    if (!data.orderTakenByName) {
      return null;
    }

    const normalizedOrderTakenByName = data.orderTakenByName.trim().toLowerCase();
    const matchedOrderTakenBy = this.orderTakenByList.find((person) =>
      typeof person?.name === 'string' && person.name.trim().toLowerCase() === normalizedOrderTakenByName
    );

    return typeof matchedOrderTakenBy?.id === 'number' ? matchedOrderTakenBy.id : null;
  }

  private applyPendingOrderTakenBySelection(): void {
    if (!this.pendingOrderTakenByName || this.orderTakenByList.length === 0) {
      return;
    }

    const normalizedPendingName = this.pendingOrderTakenByName.trim().toLowerCase();
    const matchedOrderTakenBy = this.orderTakenByList.find((person) =>
      typeof person?.name === 'string' && person.name.trim().toLowerCase() === normalizedPendingName
    );

    if (matchedOrderTakenBy?.id != null) {
      this.quotationForm.patchValue({ orderTakenById: matchedOrderTakenBy.id });
      this.pendingOrderTakenByName = undefined;
    }
  }

  async populateForm(data: QuotationDetailData) {
    if (!data) return;

    // Store the quotation status
    this.quotationStatus = data.status;
    const resolvedOrderTakenById = this.resolveOrderTakenById(data);
    this.pendingOrderTakenByName = resolvedOrderTakenById == null ? data.orderTakenByName : undefined;

    // Clear existing items first
    while (this.itemsFormArray.length) {
      this.itemsFormArray.removeAt(0);
    }

    // Patch basic form values
    this.quotationForm.patchValue({
      customerName: data.customerName,
      customerId: data.customerId,
      quoteDate: data.quoteDate,
      validUntil: data.validUntil,
      remarks: data.remarks || '',
      termsConditions: data.termsConditions || '',
      address: data.address,
      contactNumber: data.contactNumber,
      orderTakenById: resolvedOrderTakenById,
      quotationDiscount: data.quotationDiscount || 0 // Add quotation discount
    });    

    // Group ACCESSORIES items by productId, keep others as is
    const groupedItems: any[] = [];
    const accessoriesGroups: { [productId: number]: any[] } = {};
    
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        if (item.productType === 'ACCESSORIES') {
          if (!accessoriesGroups[item.productId]) {
            accessoriesGroups[item.productId] = [];
          }
          accessoriesGroups[item.productId].push(item);
        } else {
          groupedItems.push({ type: 'single', item });
        }
      });
      
      // Add grouped accessories
      Object.keys(accessoriesGroups).forEach(productId => {
        groupedItems.push({ type: 'accessories', items: accessoriesGroups[Number(productId)] });
      });
    }
    
    // Process grouped items
    groupedItems.forEach((group) => {
      if (group.type === 'accessories') {
        // Consolidate multiple accessories items into one form item
        const items = group.items;
        const firstItem = items[0];
        
        const sizes: any[] = [];
        const customList: { weight: number; nos: number; quantity: number; itemRemarks: string }[] = [];
        const profileRidgeList: { weight: number; nos: number; quantity: number; itemRemarks: string }[] = [];
        let totalQuantity = 0;

        items.forEach((item: any) => {
          if (item.accessoriesSize === 'C') {
            customList.push({
              weight: item.accessoriesWeight ?? item.weight ?? 0,
              nos: item.nos ?? 0,
              quantity: item.quantity ?? 0,
              itemRemarks: item.itemRemarks ?? ''
            });
          } else if (item.accessoriesSize === 'P') {
            profileRidgeList.push({
              weight: item.accessoriesWeight ?? item.weight ?? 0,
              nos: item.nos ?? 0,
              quantity: item.quantity ?? 0,
              itemRemarks: item.itemRemarks ?? ''
            });
          } else if (item.accessoriesSize) {
            sizes.push({
              size: item.accessoriesSize,
              weight: item.accessoriesWeight || 0,
              nos: item.nos || 0,
              quantity: item.quantity || 0,
              itemRemarks: item.itemRemarks || ''
            });
          }
          totalQuantity += item.quantity || 0;
        });

        const firstCustom = customList.length > 0 ? customList[0] : null;
        const firstProfileRidge = profileRidgeList.length > 0 ? profileRidgeList[0] : null;
        const accessoriesData = {
          sizes,
          customList,
          profileRidgeList,
          customWeight: firstCustom?.weight ?? 0,
          customNos: firstCustom?.nos ?? 0,
          customItemRemarks: firstCustom?.itemRemarks ?? '',
          profileRidgeWeight: firstProfileRidge?.weight ?? 0,
          profileRidgeNos: firstProfileRidge?.nos ?? 0,
          profileRidgeItemRemarks: firstProfileRidge?.itemRemarks ?? '',
          totalQuantity
        };
        
        const itemGroup = this.createItemFormGroup({
          id: firstItem.id,
          productId: firstItem.productId,
          quantity: totalQuantity,
          unitPrice: firstItem.unitPrice,
          taxPercentage: firstItem.taxPercentage,
          taxAmount: items.reduce((sum: number, it: any) => sum + (it.taxAmount || 0), 0),
          price: items.reduce((sum: number, it: any) => sum + (it.price || 0), 0),
          discountPercentage: firstItem.discountPercentage,
          itemRemarks: firstItem.itemRemarks || '',
          finalPrice: items.reduce((sum: number, it: any) => sum + (it.finalPrice || 0), 0),
          loadingCharge: items.reduce((sum: number, it: any) => sum + (it.loadingCharge || 0), 0),
          productType: 'ACCESSORIES',
          calculationType: '',
          calculationBase: 'W',
          useManualQuantity: false,
          weight: totalQuantity,
          calculations: accessoriesData,
          accessoriesSize: 'MULTI',
          nos: 0,
          isProduction: firstItem.isProduction || false,
          quotationItemStatus: firstItem.quotationItemStatus || null
        });
        
        this.setupItemCalculations(itemGroup, this.itemsFormArray.length);
        this.itemsFormArray.push(itemGroup);
        itemGroup.get('quantity')?.enable();
        itemGroup.get('weight')?.enable();
        
      } else {
        // Single item (non-accessories)
        const item = group.item;
        let accessoriesSize = item.accessoriesSize;
        if (item.productType === 'ACCESSORIES' && item.accessoriesSize === 'C') {
          accessoriesSize = 'Custom';
        } else if (item.productType === 'ACCESSORIES' && item.accessoriesSize === 'P') {
          accessoriesSize = 'Profile Ridge';
        }

        let calculationBase = 'W';
        if (item.productType === 'POLY_CARBONATE_ROLL') {
          calculationBase = (item.calculationBase && item.calculationBase !== '' && ['SF', 'M'].includes(item.calculationBase))
            ? item.calculationBase
            : 'SF';
        } else {
          if (item.calculationBase && ['W', 'RF', 'SF', 'N'].includes(item.calculationBase)) {
            calculationBase = item.calculationBase;
          }
        }
        
        let useManualQuantity = false;
        if ((item.productType === 'REGULAR' || item.productType === 'POLY_CARBONATE')) {
          useManualQuantity = item.calculationType === 'NOS' || !item.calculations || item.calculations.length === 0;
        } else if (item.productType === 'POLY_CARBONATE_ROLL') {
          const hasCalculations = Array.isArray(item.calculations) 
            ? item.calculations.length > 0
            : (item.calculations && typeof item.calculations === 'object' && Object.keys(item.calculations).length > 0);
          if (hasCalculations) {
            useManualQuantity = false;
          }
        }
        
        const itemGroup = this.createItemFormGroup({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercentage: item.taxPercentage,
          taxAmount: item.taxAmount,
          price: item.price,
          discountPercentage: item.discountPercentage,
          itemRemarks: item.itemRemarks || '',
          finalPrice: item.finalPrice,
          loadingCharge: item.loadingCharge,
          productType: item.productType,
          calculationType: item.calculationType,
          calculationBase: calculationBase,
          useManualQuantity: useManualQuantity,
          weight: item.weight,
          calculations: item.calculations,
          accessoriesSize: accessoriesSize,
          nos: item.nos ?? item.nos,
          isProduction: item.isProduction || false,
          quotationItemStatus: item.quotationItemStatus || null
        });
        
        this.setupItemCalculations(itemGroup, this.itemsFormArray.length);
        this.itemsFormArray.push(itemGroup);
        
        if (item.productType === 'ACCESSORIES' && (accessoriesSize === 'Custom' || accessoriesSize === 'Profile Ridge')) {
          itemGroup.get('weight')?.enable();
        }
        
        if ((item.productType === 'REGULAR' || item.productType === 'POLY_CARBONATE') && item.calculationType === 'NOS') {
          itemGroup.get('quantity')?.enable();
        } else if ((item.productType === 'REGULAR' || item.productType === 'POLY_CARBONATE') && item.calculationType !== 'NOS') {
          itemGroup.get('quantity')?.disable();
        } else if (item.productType === 'POLY_CARBONATE_ROLL') {
          const hasCalculations = Array.isArray(item.calculations) 
            ? item.calculations.length > 0
            : (item.calculations && typeof item.calculations === 'object' && Object.keys(item.calculations).length > 0);
          if (hasCalculations) {
            itemGroup.get('quantity')?.enable();
          } else {
            itemGroup.get('quantity')?.disable();
          }
        }
      }
    });
    // Update the production items flag
    this.hasProductionItemsFlag = this.hasProductionItems();
    this.calculateTotalAmount();
  //this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.quotationForm.valid && this.validateAccessoriesItems()) {
      this.loading = true; // Set loading to true when submitting
      const formData = this.prepareFormData();

      const request$ = this.isEdit
        ? this.quotationService.updateQuotation(this.quotationId!, formData)
        : this.quotationService.createQuotation(formData);

      request$.subscribe({
        next: (response: any) => {
          if (response.success) {
            this.snackbar.success(`Quotation ${this.isEdit ? 'updated' : 'created'} successfully`);
            // Navigate back to quotation list
            this.router.navigate(['/quotation']);
          }
          this.loading = false; // Set loading to false when complete
          // Ensure change detection runs to update the UI
        //this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || `Failed to ${this.isEdit ? 'update' : 'create'} quotation`);
          this.loading = false; // Set loading to false when complete
          // Ensure change detection runs to update the UI
        //this.cdr.detectChanges();
        }
      });
    }
  }

  private validateAccessoriesItems(): boolean {
    let valid = true;
    this.itemsFormArray.controls.forEach((ctrl: AbstractControl) => {
      const type = ctrl.get('productType')?.value;
      if (type === 'ACCESSORIES') {
        const size = ctrl.get('accessoriesSize')?.value;
        
        // If MULTI (modal-based selection), check if calculations exist
        if (size === 'MULTI') {
          const calculations = ctrl.get('calculations')?.value;
          const hasSizes = calculations?.sizes && calculations.sizes.length > 0;
          const hasCustomList = calculations?.customList && Array.isArray(calculations.customList) && calculations.customList.length > 0;
          const allCustomValid = hasCustomList && calculations.customList.every((c: any) =>
            Number(c?.weight ?? c?.customWeight ?? 0) > 0 && Number(c?.nos ?? c?.customNos ?? 0) >= 1
          );
          const hasLegacyCustom = calculations && calculations.customNos > 0 && calculations.customWeight > 0;

          const hasProfileRidgeList = calculations?.profileRidgeList && Array.isArray(calculations.profileRidgeList) && calculations.profileRidgeList.length > 0;
          const allProfileRidgeValid = hasProfileRidgeList && calculations.profileRidgeList.every((c: any) =>
            Number(c?.weight ?? c?.profileRidgeWeight ?? 0) > 0 && Number(c?.nos ?? c?.profileRidgeNos ?? 0) >= 1
          );
          const hasLegacyProfileRidge = calculations && calculations.profileRidgeNos > 0 && calculations.profileRidgeWeight > 0;

          const hasData = calculations && (
            hasSizes ||
            (hasCustomList && allCustomValid) ||
            hasLegacyCustom ||
            (hasProfileRidgeList && allProfileRidgeValid) ||
            hasLegacyProfileRidge
          );
          if (!hasData) {
            ctrl.get('quantity')?.setErrors({ required: true });
            valid = false;
          }
        } else {
          // Old validation for non-modal accessories
          const nosVal = Number(ctrl.get('nos')?.value);
          const isSizeValid = !!size;
          const isNosValid = Number.isFinite(nosVal) && nosVal > 0;
          if (!isSizeValid) ctrl.get('accessoriesSize')?.setErrors({ required: true });
          if (!isNosValid) ctrl.get('nos')?.setErrors({ min: true });
          valid = valid && isSizeValid && isNosValid;
        }
      }
    });
    return valid;
  }

  private prepareFormData() {
    const formValue = this.quotationForm.getRawValue(); // Use getRawValue() to include disabled fields
    
    // Process items and expand ACCESSORIES into multiple items
    const expandedItems: any[] = [];
    
    formValue.items.forEach((item: any, index: number) => {
      const itemControl = this.itemsFormArray.at(index);
      
      // For ACCESSORIES with modal data, split into separate items
      if (item.productType === 'ACCESSORIES' && item.accessoriesSize === 'MULTI' && item.calculations) {
        const accessoriesData = item.calculations;
        const baseItem = {
          productId: item.productId,
          unitPrice: itemControl.get('unitPrice')?.value,
          taxPercentage: itemControl.get('taxPercentage')?.value,
          discountPercentage: itemControl.get('discountPercentage')?.value,
          itemRemarks: item.itemRemarks || '',
          productType: 'ACCESSORIES',
          calculationType: '',
          calculationBase: 'W',
          isProduction: item.isProduction || false,
          quotationItemStatus: item.quotationItemStatus || null
        };
        
        // Add standard sizes
        if (accessoriesData.sizes && Array.isArray(accessoriesData.sizes)) {
          accessoriesData.sizes.forEach((sizeItem: any) => {
            if (sizeItem.nos > 0) {
              const quantity = Number((sizeItem.weight * sizeItem.nos).toFixed(3));
              const weight = quantity;
              
              // Calculate price components
              const price = Number((quantity * baseItem.unitPrice).toFixed(2));
              const discountAmount = Number((price * baseItem.discountPercentage / 100).toFixed(2));
              const afterDiscount = Number((price - discountAmount).toFixed(2));
              const taxAmount = Number((afterDiscount * baseItem.taxPercentage / 100).toFixed(2));
              const loadingCharge = Number((weight * 0.10).toFixed(2));
              const finalPrice = Number((afterDiscount + taxAmount + loadingCharge).toFixed(2));
              
              expandedItems.push({
                ...baseItem,
                id: item.id && accessoriesData.sizes.length === 1 ? item.id : undefined,
                quantity,
                weight,
                accessoriesSize: sizeItem.size,
                nos: sizeItem.nos,
                accessoriesWeight: sizeItem.weight,
                itemRemarks: sizeItem.itemRemarks || '',
                price,
                discountAmount,
                taxAmount,
                loadingCharge,
                finalPrice,
                calculations: []
              });
            }
          });
        }
        
        // Add custom accessories (support multiple via customList or single legacy)
        const customList = accessoriesData.customList;
        if (customList && Array.isArray(customList) && customList.length > 0) {
          customList.forEach((customEntry: any) => {
            const weight = Number(customEntry.weight ?? customEntry.customWeight ?? 0);
            const nos = Number(customEntry.nos ?? customEntry.customNos ?? 0);
            if (weight > 0 && nos >= 1) {
              const quantity = Number((weight * nos).toFixed(3));

              const price = Number((quantity * baseItem.unitPrice).toFixed(2));
              const discountAmount = Number((price * baseItem.discountPercentage / 100).toFixed(2));
              const afterDiscount = Number((price - discountAmount).toFixed(2));
              const taxAmount = Number((afterDiscount * baseItem.taxPercentage / 100).toFixed(2));
              const loadingCharge = Number((quantity * 0.10).toFixed(2));
              const finalPrice = Number((afterDiscount + taxAmount + loadingCharge).toFixed(2));

              expandedItems.push({
                ...baseItem,
                quantity,
                weight,
                accessoriesSize: 'C',
                nos,
                accessoriesWeight: weight,
                itemRemarks: customEntry.itemRemarks ?? customEntry.customItemRemarks ?? '',
                price,
                discountAmount,
                taxAmount,
                loadingCharge,
                finalPrice,
                calculations: []
              });
            }
          });
        } else if (accessoriesData.customNos > 0 && accessoriesData.customWeight > 0) {
          const quantity = Number((accessoriesData.customWeight * accessoriesData.customNos).toFixed(3));
          const weight = accessoriesData.customWeight;

          const price = Number((quantity * baseItem.unitPrice).toFixed(2));
          const discountAmount = Number((price * baseItem.discountPercentage / 100).toFixed(2));
          const afterDiscount = Number((price - discountAmount).toFixed(2));
          const taxAmount = Number((afterDiscount * baseItem.taxPercentage / 100).toFixed(2));
          const loadingCharge = Number((quantity * 0.10).toFixed(2));
          const finalPrice = Number((afterDiscount + taxAmount + loadingCharge).toFixed(2));

          expandedItems.push({
            ...baseItem,
            quantity,
            weight,
            accessoriesSize: 'C',
            nos: accessoriesData.customNos,
            accessoriesWeight: accessoriesData.customWeight,
            itemRemarks: accessoriesData.customItemRemarks || '',
            price,
            discountAmount,
            taxAmount,
            loadingCharge,
            finalPrice,
            calculations: []
          });
        }

        // Add profile ridge accessories (support multiple via profileRidgeList or single legacy)
        const profileRidgeList = accessoriesData.profileRidgeList;
        if (profileRidgeList && Array.isArray(profileRidgeList) && profileRidgeList.length > 0) {
          profileRidgeList.forEach((profileRidgeEntry: any) => {
            const weight = Number(profileRidgeEntry.weight ?? profileRidgeEntry.profileRidgeWeight ?? 0);
            const nos = Number(profileRidgeEntry.nos ?? profileRidgeEntry.profileRidgeNos ?? 0);
            if (weight > 0 && nos >= 1) {
              const quantity = Number((weight * nos).toFixed(3));

              const price = Number((quantity * baseItem.unitPrice).toFixed(2));
              const discountAmount = Number((price * baseItem.discountPercentage / 100).toFixed(2));
              const afterDiscount = Number((price - discountAmount).toFixed(2));
              const taxAmount = Number((afterDiscount * baseItem.taxPercentage / 100).toFixed(2));
              const loadingCharge = Number((quantity * 0.10).toFixed(2));
              const finalPrice = Number((afterDiscount + taxAmount + loadingCharge).toFixed(2));

              expandedItems.push({
                ...baseItem,
                quantity,
                weight,
                accessoriesSize: 'P',
                nos,
                accessoriesWeight: weight,
                itemRemarks: profileRidgeEntry.itemRemarks ?? profileRidgeEntry.profileRidgeItemRemarks ?? '',
                price,
                discountAmount,
                taxAmount,
                loadingCharge,
                finalPrice,
                calculations: []
              });
            }
          });
        } else if (accessoriesData.profileRidgeNos > 0 && accessoriesData.profileRidgeWeight > 0) {
          const quantity = Number((accessoriesData.profileRidgeWeight * accessoriesData.profileRidgeNos).toFixed(3));
          const weight = accessoriesData.profileRidgeWeight;

          const price = Number((quantity * baseItem.unitPrice).toFixed(2));
          const discountAmount = Number((price * baseItem.discountPercentage / 100).toFixed(2));
          const afterDiscount = Number((price - discountAmount).toFixed(2));
          const taxAmount = Number((afterDiscount * baseItem.taxPercentage / 100).toFixed(2));
          const loadingCharge = Number((quantity * 0.10).toFixed(2));
          const finalPrice = Number((afterDiscount + taxAmount + loadingCharge).toFixed(2));

          expandedItems.push({
            ...baseItem,
            quantity,
            weight,
            accessoriesSize: 'P',
            nos: accessoriesData.profileRidgeNos,
            accessoriesWeight: accessoriesData.profileRidgeWeight,
            itemRemarks: accessoriesData.profileRidgeItemRemarks || '',
            price,
            discountAmount,
            taxAmount,
            loadingCharge,
            finalPrice,
            calculations: []
          });
        }
      } else {
        // For non-ACCESSORIES or old format, keep as is
        let accessoriesSize = item.accessoriesSize;
        if (item.productType === 'ACCESSORIES' && item.accessoriesSize === 'Custom') {
          accessoriesSize = 'C';
        }
        
        expandedItems.push({
          ...item,
          quantity: itemControl.get('quantity')?.value,
          weight: itemControl.get('weight')?.value,
          accessoriesSize: accessoriesSize,
          finalPrice: itemControl.get('finalPrice')?.value,
          loadingCharge: itemControl.get('loadingCharge')?.value,
          taxAmount: itemControl.get('taxAmount')?.value
        });
      }
    });
    
    return {
      ...formValue,
      quoteDate: formatDate(formValue.quoteDate, 'yyyy-MM-dd', 'en'),
      validUntil: formatDate(formValue.validUntil, 'yyyy-MM-dd', 'en'),
      quotationDiscount: formValue.quotationDiscount || 0,
      items: expandedItems
    };
  }

  onCalculationTypeChange(index: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newCalculationType = select.value;
    const itemGroup = this.itemsFormArray.at(index);
    const currentCalculationType = itemGroup.get('calculationType')?.value;

    // Only reset if calculation type actually changed
    if (currentCalculationType !== newCalculationType) {
      itemGroup.patchValue({
        weight: 0,
        quantity: 0,
        calculations: [] // Reset calculations when type changes
      });
    }

    // Only open dialog if a type is selected
    if (newCalculationType) {
      this.openCalculationDialog(index);
    }
  }

  getTotalPrice(): number {
    return this.itemsFormArray.controls
      .reduce((total, group) => total + (group.get('price')?.value || 0), 0);
  }

  getTotalTax(): number {
    return this.itemsFormArray.controls
      .reduce((total, group) => {
        const price = group.get('price')?.value || 0;
        const taxPercentage = group.get('taxPercentage')?.value || 18;
        return total + ((price * taxPercentage) / 100);
      }, 0);
  }

  getTotalFinalPrice(): number {
    // const loadingCharge = this.itemsFormArray.controls.reduce((total, group) => total + (group.get('weight')?.value || 0), 0) * 0.10
    return this.itemsFormArray.controls
      .reduce((total, group) => total + (group.get('finalPrice')?.value || 0), 0);
  }

  onSelectCalculationType(index:number, type: string): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    
    itemGroup.get('calculationType')?.setValue(type);
    itemGroup.updateValueAndValidity();
    
    // If NOS is selected, enable manual quantity mode
    if (type === 'NOS') {
      itemGroup.get('useManualQuantity')?.setValue(true);
      itemGroup.get('quantity')?.enable();
      itemGroup.patchValue({
        weight: 0,
        calculations: []
      });
      this.calculateItemPrice(index);
    } else {
      // For SQ_FEET or MM, use calculator mode
      itemGroup.get('useManualQuantity')?.setValue(false);
      itemGroup.get('quantity')?.disable();
      this.openCalculationDialog(index);
    }
  }

  private setupItemSubscriptions(): void {
    this.itemsFormArray.controls.forEach((control, index) => {
      this.subscribeToItemChanges(control, index);
    });
  }

  private subscribeToItemChanges(control: AbstractControl, index: number): void {
    const subscription = control.valueChanges.subscribe(() => {
      this.calculateItemPrice(index);
      // Check if any items have production enabled
      this.hasProductionItemsFlag = this.hasProductionItems();
    });
    this.itemSubscriptions[index] = subscription;
  }

  // Add method to get calculation base label
  getCalculationBaseLabel(value: string): string {
    switch (value) {
      case 'W': return 'Weight';
      case 'RF': return 'Running Feet';
      case 'SF': return 'Sq.Feet';
      case 'N': return 'NOS';
      default: return 'Weight';
    }
  }

  // Add method to set calculation base
  setCalculationBase(index: number, value: string): void {
    const itemGroup = this.itemsFormArray.at(index);
    itemGroup.get('calculationBase')?.setValue(value);
  }

  // Add keyboard shortcut listener for Alt+P and Alt+Q
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Check if Alt+P is pressed
    if (event.altKey && event.key.toLowerCase() === 'p') {
      event.preventDefault(); // Prevent default browser behavior
      this.addItem(); // Add new item when Alt+P is pressed
    }
    // Check if Alt+Q is pressed
    if (event.altKey && event.key.toLowerCase() === 'q') {
      event.preventDefault(); // Prevent default browser behavior
      // Only submit if form is valid and not loading
      if (this.quotationForm.valid && !this.loading) {
        this.onSubmit(); // Submit the quotation form when Alt+Q is pressed
      }
    }
  }

  // Add method to check if any items have isProduction set to true
  hasProductionItems(): boolean {
    return this.itemsFormArray.controls.some(control => {
      const isProduction = control.get('isProduction')?.value;
      return isProduction === true;
    });
  }

  // New methods for updating quotation item status and production flag
  updateQuotationItemStatus(index: number, status: 'O' | 'IP' | 'C' | 'B'): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const itemId = itemGroup.get('id')?.value;
    
    if (itemId) {
      this.quotationService.updateQuotationItemStatus(itemId, status).subscribe({
        next: (response: any) => {
          if (response.success) {
            // Update the form control value
            itemGroup.get('quotationItemStatus')?.setValue(status);
            this.snackbar.success('Quotation item status updated successfully');
          } else {
            this.snackbar.error(response.message || 'Failed to update quotation item status');
          }
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to update quotation item status');
        }
      });
    }
  }

  updateQuotationItemProduction(index: number, isProduction: boolean): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const itemId = itemGroup.get('id')?.value;
    
    if (itemId) {
      this.quotationService.updateQuotationItemProduction(itemId, isProduction).subscribe({
        next: (response: any) => {
          if (response.success) {
            // Update the form control value
            itemGroup.get('isProduction')?.setValue(isProduction);
            this.snackbar.success('Quotation item production status updated successfully');
            if(isProduction){
              itemGroup.get('quotationItemStatus')?.setValue('O');
            }
            // Trigger change detection to update the view
            this.cdr.detectChanges();
          } else {
            this.snackbar.error(response.message || 'Failed to update quotation item production status');
          }
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to update quotation item production status');
        }
      });
    }
  }

  // Method to handle NOS dropdown selection for REGULAR and POLY_CARBONATE products
  onSelectQuantityMode(index: number, mode: 'CALCULATOR' | 'NOS'): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const quantityControl = itemGroup.get('quantity');
    
    if (mode === 'NOS') {
      // Enable manual quantity entry
      itemGroup.get('useManualQuantity')?.setValue(true);
      quantityControl?.enable();
      // Clear calculator-based calculations
      itemGroup.patchValue({
        weight: 0,
        calculations: []
      });
    } else {
      // Use calculator mode
      itemGroup.get('useManualQuantity')?.setValue(false);
      // Quantity will be set by the calculator
      // Don't disable yet - let the calculator set the value first
    }
    
    this.calculateItemPrice(index);
  }
}