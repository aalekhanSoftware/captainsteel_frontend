import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderTakenByService } from '../../../services/order-taken-by.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

@Component({
  selector: 'app-order-taken-by-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, LoaderComponent],
  templateUrl: './order-taken-by-form.component.html',
  styleUrls: ['./order-taken-by-form.component.scss']
})
export class OrderTakenByFormComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  isLoading = false;
  isEditMode = false;
  recordId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private service: OrderTakenByService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.recordId = +id;
      this.loadRecord();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      status: ['A', [Validators.required]],
      remarks: ['']
    });
  }

  private loadRecord(): void {
    if (!this.recordId) return;
    
    this.isLoading = true;
    this.service.getDetail(this.recordId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.form.patchValue({
              name: response.data.name,
              status: response.data.status,
              remarks: response.data.remarks || ''
            });
          } else {
            this.snackbar.error('Could not load record details');
            this.router.navigate(['/order-taken-by']);
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to load record details');
          this.isLoading = false;
          this.router.navigate(['/order-taken-by']);
        }
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    const payload = this.form.value;

    if (this.isEditMode && this.recordId) {
      payload.id = this.recordId;
      this.service.update(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.snackbar.success('Record updated successfully');
              this.router.navigate(['/order-taken-by']);
            } else {
              this.snackbar.error(response.message || 'Failed to update record');
            }
            this.isLoading = false;
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || 'Error occurred while updating');
            this.isLoading = false;
          }
        });
    } else {
      this.service.create(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.snackbar.success('Record created successfully');
              this.router.navigate(['/order-taken-by']);
            } else {
              this.snackbar.error(response.message || 'Failed to create record');
            }
            this.isLoading = false;
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || 'Error occurred while creating');
            this.isLoading = false;
          }
        });
    }
  }
}
