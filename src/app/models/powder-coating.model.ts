export interface PowderCoatingProcess {
  id: number;
  productId: number;
  productName: string;
  customerId: number;
  customerName: string;
  quantity: number;
  remainingQuantity: number;
  totalBags?: number;
  totalAmount?: number;
  createdAt: string;
  showReturns?: boolean;
  returns?: PowderCoatingReturn[];
  isLoadingReturns?: boolean;
}

export interface PowderCoatingSearchRequest {
  search?: string;
  currentPage: number;
  perPageRecord: number;
  customerId?: number;
  productId?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface PowderCoatingResponse {
  success: boolean;
  message: string;
  data: {
    content: PowderCoatingProcess[];
    totalPages: number;
    totalElements: number;
    size: number;
    number: number;
  };
}

export interface PowderCoatingReturn {
  id: number;
  returnQuantity: number;
  createdAt: string;
}

export interface PowderCoatingReturnResponse {
  success: boolean;
  message: string;
  data: PowderCoatingReturn[];
}

export interface PowderCoatingReturnRequest {
  id: number;
  returnQuantity: number;
  returnDate?: string;
} 