import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderTakenByService } from '../../../services/order-taken-by.service';
import { OrderTakenBy } from '../../../models/order-taken-by.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-order-taken-by-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, LoaderComponent, PaginationComponent],
  templateUrl: './order-taken-by-list.component.html',
  styleUrls: ['./order-taken-by-list.component.scss']
})
export class OrderTakenByListComponent implements OnInit, OnDestroy {
  items: OrderTakenBy[] = [];
  searchForm!: FormGroup;
  isLoading = false;
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private service: OrderTakenByService,
    private fb: FormBuilder,
    private snackbar: SnackbarService
  ) {
    this.searchForm = this.fb.group({
      search: ['']
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading = true;
    const params = {
      search: this.searchForm.value.search || '',
      currentPage: this.currentPage,
      perPageRecord: this.pageSize
    };

    this.service.search(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.items = response.data.content;
            this.totalPages = response.data.totalPages;
            this.totalElements = response.data.totalElements;
            this.startIndex = this.currentPage * this.pageSize;
            this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
          } else {
            this.items = [];
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to load records');
          this.isLoading = false;
        }
      });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadData();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadData();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadData();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadData();
  }

  deleteItem(id: number): void {
    if (confirm('Are you sure you want to delete this record?')) {
      this.isLoading = true;
      this.service.delete(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.snackbar.success('Record deleted successfully');
              this.loadData();
            } else {
              this.snackbar.error(response.message || 'Failed to delete record');
              this.isLoading = false;
            }
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || 'Failed to delete record');
            this.isLoading = false;
          }
        });
    }
  }
}
