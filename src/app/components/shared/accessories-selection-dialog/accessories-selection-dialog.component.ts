import { Component, Inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

interface AccessorySizeEntry {
  size: string;
  weight: number;
  nos: number;
  quantity: number;
  isCustom: boolean;
}

@Component({
  selector: 'app-accessories-selection-dialog',
  templateUrl: './accessories-selection-dialog.component.html',
  styleUrls: ['./accessories-selection-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule]
})
export class AccessoriesSelectionDialogComponent implements OnInit, OnDestroy {
  product: any = null;
  accessoriesForm!: FormGroup;
  availableSizes: string[] = ['6', '8', '12', '16', '24', '32', '48'];
  accessoriesWeight: { [size: string]: number } = {};
  totalQuantity: number = 0;

  private customArraySubscription: any;
  private profileRidgeArraySubscription: any;

  constructor(
    private fb: FormBuilder,
    private dialogRef: DialogRef<any>,
    @Inject(DIALOG_DATA) public data: {
      product: any;
      savedAccessories?: any;
    }
  ) {
    this.product = data.product;

    // Extract accessories weight from product data
    this.accessoriesWeight = this.getAccessoriesMap(this.product);
  }

  ngOnInit(): void {
    this.initForm();

    // Setup value change listeners BEFORE loading saved data
    this.setupValueChangeListeners();

    // Load saved accessories if available
    if (this.data.savedAccessories) {
      this.loadSavedAccessories(this.data.savedAccessories);
    }
  }

  ngOnDestroy(): void {
    if (this.customArraySubscription) {
      this.customArraySubscription.unsubscribe();
    }
    if (this.profileRidgeArraySubscription) {
      this.profileRidgeArraySubscription.unsubscribe();
    }
  }

  private getAccessoriesMap(product: any): { [size: string]: number } {
    return (
      product?.accessoriesWeight ||
      product?.accessories_size_rate ||
      product?.accessories_weight ||
      {}
    );
  }

  private createCustomGroup(weight: number = 0, nos: number = 0, itemRemarks: string = ''): FormGroup {
    return this.fb.group({
      customWeight: [weight, [Validators.min(0)]],
      customNos: [nos, [Validators.min(0)]],
      customItemRemarks: [itemRemarks]
    });
  }

  private createProfileRidgeGroup(weight: number = 0, nos: number = 0, itemRemarks: string = ''): FormGroup {
    return this.fb.group({
      profileRidgeWeight: [weight, [Validators.min(0)]],
      profileRidgeNos: [nos, [Validators.min(0)]],
      profileRidgeItemRemarks: [itemRemarks]
    });
  }

  private initForm(): void {
    const sizeControls = this.availableSizes.map(size =>
      this.fb.group({
        size: [size],
        weight: [this.accessoriesWeight[size] || 0],
        nos: [0, [Validators.min(0)]],
        quantity: [{ value: 0, disabled: true }],
        selected: [false],
        itemRemarks: ['']
      })
    );

    this.accessoriesForm = this.fb.group({
      sizes: this.fb.array(sizeControls),
      customAccessories: this.fb.array([this.createCustomGroup()]),
      profileRidgeAccessories: this.fb.array([this.createProfileRidgeGroup()])
    });
  }

  get sizesArray(): FormArray {
    return this.accessoriesForm.get('sizes') as FormArray;
  }

  get customAccessoriesArray(): FormArray {
    return this.accessoriesForm.get('customAccessories') as FormArray;
  }

  get profileRidgeAccessoriesArray(): FormArray {
    return this.accessoriesForm.get('profileRidgeAccessories') as FormArray;
  }

  getCustomRowQuantity(index: number): number {
    const row = this.customAccessoriesArray.at(index);
    if (!row) return 0;
    const w = Number(row.get('customWeight')?.value || 0);
    const n = Number(row.get('customNos')?.value || 0);
    return Number((w * n).toFixed(3));
  }

  hasAnyCustomData(): boolean {
    return this.customAccessoriesArray.controls.some(control => {
      const w = Number(control.get('customWeight')?.value || 0);
      const n = Number(control.get('customNos')?.value || 0);
      return w > 0 || n > 0;
    });
  }

  addCustomAccessory(): void {
    this.customAccessoriesArray.push(this.createCustomGroup());
  }

  removeCustomAccessory(index: number): void {
    if (this.customAccessoriesArray.length <= 1) {
      this.customAccessoriesArray.at(0).patchValue({
        customWeight: 0,
        customNos: 0,
        customItemRemarks: ''
      });
      return;
    }
    this.customAccessoriesArray.removeAt(index);
  }

  getProfileRidgeRowQuantity(index: number): number {
    const row = this.profileRidgeAccessoriesArray.at(index);
    if (!row) return 0;
    const w = Number(row.get('profileRidgeWeight')?.value || 0);
    const n = Number(row.get('profileRidgeNos')?.value || 0);
    return Number((w * n).toFixed(3));
  }

  hasAnyProfileRidgeData(): boolean {
    return this.profileRidgeAccessoriesArray.controls.some(control => {
      const w = Number(control.get('profileRidgeWeight')?.value || 0);
      const n = Number(control.get('profileRidgeNos')?.value || 0);
      return w > 0 || n > 0;
    });
  }

  addProfileRidgeAccessory(): void {
    this.profileRidgeAccessoriesArray.push(this.createProfileRidgeGroup());
  }

  removeProfileRidgeAccessory(index: number): void {
    if (this.profileRidgeAccessoriesArray.length <= 1) {
      this.profileRidgeAccessoriesArray.at(0).patchValue({
        profileRidgeWeight: 0,
        profileRidgeNos: 0,
        profileRidgeItemRemarks: ''
      });
      return;
    }
    this.profileRidgeAccessoriesArray.removeAt(index);
  }

  private setupValueChangeListeners(): void {
    this.sizesArray.controls.forEach((control, index) => {
      control.get('nos')?.valueChanges.subscribe(() => {
        this.calculateSizeQuantity(index);
        this.calculateTotalQuantity();
      });

      control.get('selected')?.valueChanges.subscribe((selected: boolean) => {
        if (!selected) {
          control.get('nos')?.setValue(0, { emitEvent: false });
          this.calculateSizeQuantity(index);
          this.calculateTotalQuantity();
        }
      });
    });

    this.customArraySubscription = this.customAccessoriesArray.valueChanges.subscribe(() => {
      this.calculateTotalQuantity();
    });

    this.profileRidgeArraySubscription = this.profileRidgeAccessoriesArray.valueChanges.subscribe(() => {
      this.calculateTotalQuantity();
    });
  }

  private calculateSizeQuantity(index: number): void {
    const sizeControl = this.sizesArray.at(index);
    const weight = sizeControl.get('weight')?.value || 0;
    const nos = sizeControl.get('nos')?.value || 0;
    const quantity = Number((weight * nos).toFixed(3));

    sizeControl.patchValue({ quantity }, { emitEvent: false });

    if (nos > 0 && !sizeControl.get('selected')?.value) {
      sizeControl.patchValue({ selected: true }, { emitEvent: false });
    }
  }

  private calculateTotalQuantity(): void {
    const sizesTotal = this.sizesArray.controls.reduce((total, control) => {
      const quantity = control.get('quantity')?.value || 0;
      return total + quantity;
    }, 0);

    const customTotal = this.customAccessoriesArray.controls.reduce((total, _, i) => {
      return total + this.getCustomRowQuantity(i);
    }, 0);

    const profileRidgeTotal = this.profileRidgeAccessoriesArray.controls.reduce((total, _, i) => {
      return total + this.getProfileRidgeRowQuantity(i);
    }, 0);

    this.totalQuantity = Number((sizesTotal + customTotal + profileRidgeTotal).toFixed(3));
  }

  private loadSavedAccessories(savedData: any): void {
    if (!savedData) return;

    if (savedData.sizes && Array.isArray(savedData.sizes)) {
      savedData.sizes.forEach((saved: any) => {
        const index = this.availableSizes.indexOf(saved.size);
        if (index >= 0) {
          const sizeControl = this.sizesArray.at(index);
          sizeControl.patchValue({
            nos: saved.nos || 0,
            selected: saved.nos > 0,
            itemRemarks: saved.itemRemarks || ''
          });
        }
      });
    }

    const customList = savedData.customList;
    if (customList && Array.isArray(customList) && customList.length > 0) {
      while (this.customAccessoriesArray.length) {
        this.customAccessoriesArray.removeAt(0);
      }
      customList.forEach((entry: any) => {
        const weight = entry.weight ?? entry.customWeight ?? 0;
        const nos = entry.nos ?? entry.customNos ?? 0;
        const itemRemarks = entry.itemRemarks ?? entry.customItemRemarks ?? '';
        this.customAccessoriesArray.push(this.createCustomGroup(weight, nos, itemRemarks));
      });
    } else {
      const customWeight = savedData.custom?.weight || savedData.customWeight || 0;
      const customNos = savedData.custom?.nos || savedData.customNos || 0;
      const customItemRemarks = savedData.custom?.itemRemarks || savedData.customItemRemarks || '';
      if (customWeight > 0 || customNos > 0) {
        this.customAccessoriesArray.at(0).patchValue({
          customWeight: customWeight,
          customNos: customNos,
          customItemRemarks: customItemRemarks
        });
      }
    }

    const profileRidgeList = savedData.profileRidgeList;
    if (profileRidgeList && Array.isArray(profileRidgeList) && profileRidgeList.length > 0) {
      while (this.profileRidgeAccessoriesArray.length) {
        this.profileRidgeAccessoriesArray.removeAt(0);
      }
      profileRidgeList.forEach((entry: any) => {
        const weight = entry.weight ?? entry.profileRidgeWeight ?? 0;
        const nos = entry.nos ?? entry.profileRidgeNos ?? 0;
        const itemRemarks = entry.itemRemarks ?? entry.profileRidgeItemRemarks ?? '';
        this.profileRidgeAccessoriesArray.push(this.createProfileRidgeGroup(weight, nos, itemRemarks));
      });
    } else {
      const profileRidgeWeight = savedData.profileRidge?.weight || savedData.profileRidgeWeight || 0;
      const profileRidgeNos = savedData.profileRidge?.nos || savedData.profileRidgeNos || 0;
      const profileRidgeItemRemarks = savedData.profileRidge?.itemRemarks || savedData.profileRidgeItemRemarks || '';
      if (profileRidgeWeight > 0 || profileRidgeNos > 0) {
        this.profileRidgeAccessoriesArray.at(0).patchValue({
          profileRidgeWeight: profileRidgeWeight,
          profileRidgeNos: profileRidgeNos,
          profileRidgeItemRemarks: profileRidgeItemRemarks
        });
      }
    }

    this.calculateTotalQuantity();
  }

  onSave(): void {
    const selectedSizes = this.sizesArray.controls
      .filter(control => (control.get('nos')?.value || 0) > 0)
      .map(control => ({
        size: control.get('size')?.value,
        weight: control.get('weight')?.value,
        nos: control.get('nos')?.value,
        quantity: control.get('quantity')?.value,
        itemRemarks: control.get('itemRemarks')?.value || ''
      }));

    const customList: { weight: number; nos: number; quantity: number; itemRemarks: string }[] = [];
    this.customAccessoriesArray.controls.forEach((control) => {
      const weight = Number(control.get('customWeight')?.value || 0);
      const nos = Number(control.get('customNos')?.value || 0);
      if (weight > 0 && nos >= 1) {
        const quantity = Number((weight * nos).toFixed(3));
        customList.push({
          weight,
          nos,
          quantity,
          itemRemarks: control.get('customItemRemarks')?.value || ''
        });
      }
    });

    const profileRidgeList: { weight: number; nos: number; quantity: number; itemRemarks: string }[] = [];
    this.profileRidgeAccessoriesArray.controls.forEach((control) => {
      const weight = Number(control.get('profileRidgeWeight')?.value || 0);
      const nos = Number(control.get('profileRidgeNos')?.value || 0);
      if (weight > 0 && nos >= 1) {
        const quantity = Number((weight * nos).toFixed(3));
        profileRidgeList.push({
          weight,
          nos,
          quantity,
          itemRemarks: control.get('profileRidgeItemRemarks')?.value || ''
        });
      }
    });

    const singleCustom = customList.length === 1 ? {
      weight: customList[0].weight,
      nos: customList[0].nos,
      quantity: customList[0].quantity,
      itemRemarks: customList[0].itemRemarks
    } : null;

    const singleProfileRidge = profileRidgeList.length === 1 ? {
      weight: profileRidgeList[0].weight,
      nos: profileRidgeList[0].nos,
      quantity: profileRidgeList[0].quantity,
      itemRemarks: profileRidgeList[0].itemRemarks
    } : null;

    const accessoriesData: any = {
      sizes: selectedSizes,
      customList,
      profileRidgeList,
      totalQuantity: this.totalQuantity
    };
    if (customList.length >= 1) {
      accessoriesData.customWeight = customList[0].weight;
      accessoriesData.customNos = customList[0].nos;
      accessoriesData.customItemRemarks = customList[0].itemRemarks;
    } else {
      accessoriesData.customWeight = 0;
      accessoriesData.customNos = 0;
      accessoriesData.customItemRemarks = '';
    }

    if (profileRidgeList.length >= 1) {
      accessoriesData.profileRidgeWeight = profileRidgeList[0].weight;
      accessoriesData.profileRidgeNos = profileRidgeList[0].nos;
      accessoriesData.profileRidgeItemRemarks = profileRidgeList[0].itemRemarks;
    } else {
      accessoriesData.profileRidgeWeight = 0;
      accessoriesData.profileRidgeNos = 0;
      accessoriesData.profileRidgeItemRemarks = '';
    }

    const result = {
      sizes: selectedSizes,
      custom: singleCustom,
      profileRidge: singleProfileRidge,
      totalQuantity: this.totalQuantity,
      accessoriesData
    };

    this.dialogRef.close(result);
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (this.canSave()) {
        this.onSave();
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog();
    }
  }

  canSave(): boolean {
    const hasStandardSize = this.sizesArray.controls.some(control => {
      const nos = control.get('nos')?.value || 0;
      return nos >= 1;
    });

    const customRows = this.customAccessoriesArray.controls;
    const customWithData = customRows.filter(control => {
      const w = Number(control.get('customWeight')?.value || 0);
      const n = Number(control.get('customNos')?.value || 0);
      return w > 0 || n > 0;
    });
    const allCustomValid = customWithData.length === 0 || customWithData.every(control => {
      const w = Number(control.get('customWeight')?.value || 0);
      const n = Number(control.get('customNos')?.value || 0);
      return w > 0 && n >= 1;
    });
    const hasValidCustom = customWithData.length > 0 && allCustomValid;

    const profileRidgeRows = this.profileRidgeAccessoriesArray.controls;
    const profileRidgeWithData = profileRidgeRows.filter(control => {
      const w = Number(control.get('profileRidgeWeight')?.value || 0);
      const n = Number(control.get('profileRidgeNos')?.value || 0);
      return w > 0 || n > 0;
    });
    const allProfileRidgeValid = profileRidgeWithData.length === 0 || profileRidgeWithData.every(control => {
      const w = Number(control.get('profileRidgeWeight')?.value || 0);
      const n = Number(control.get('profileRidgeNos')?.value || 0);
      return w > 0 && n >= 1;
    });
    const hasValidProfileRidge = profileRidgeWithData.length > 0 && allProfileRidgeValid;

    return hasStandardSize || hasValidCustom || hasValidProfileRidge;
  }

  getSizeLabel(size: string): string {
    return `${size}"`;
  }

  clearSize(index: number): void {
    const sizeControl = this.sizesArray.at(index);
    sizeControl.patchValue({
      nos: 0,
      selected: false
    });
    this.calculateSizeQuantity(index);
    this.calculateTotalQuantity();
  }

  clearCustom(): void {
    while (this.customAccessoriesArray.length) {
      this.customAccessoriesArray.removeAt(0);
    }
    this.customAccessoriesArray.push(this.createCustomGroup());
    this.calculateTotalQuantity();
  }

  clearProfileRidge(): void {
    while (this.profileRidgeAccessoriesArray.length) {
      this.profileRidgeAccessoriesArray.removeAt(0);
    }
    this.profileRidgeAccessoriesArray.push(this.createProfileRidgeGroup());
    this.calculateTotalQuantity();
  }

  clearAll(): void {
    this.sizesArray.controls.forEach((control) => {
      control.patchValue({
        nos: 0,
        selected: false
      });
    });
    this.clearCustom();
    this.clearProfileRidge();
  }
}
