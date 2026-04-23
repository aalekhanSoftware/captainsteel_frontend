export enum QuotationStatus {
  Q = 'Quote',
  A = 'Accepted',
  D = 'Declined',
  P = 'Processing',
  C = 'Completed'
}

export interface QuotationItem {
  id?: number; // Add ID field for updating status and production
  productId: number;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  discountPercentage: number;
  itemRemarks?: string;
  finalPrice?: number;
  status?: string;
  // Accessories specific fields
  productType?: string;
  calculationType?: string;
  weight?: number;
  calculations?: any[];
  accessoriesSize?: string;
  nos?: number;
  loadingCharge?: number;
  price?: number;
  taxAmount?: number;
  // New fields
  isProduction?: boolean; // default false
  quotationItemStatus?: 'O' | 'IP' | 'C' | 'B' | null; // 'O'-Open,'IP'-In Process,'C'-Completed,'B'-Billed
}

export interface QuotationDetailData {
  id: number;
  customerId?: number;
  customerName?: string;
  contactNumber?: string;
  orderTakenById?: number;
  orderTakenByName?: string;
  quoteDate: string;
  validUntil: string;
  remarks?: string;
  termsConditions?: string;
  address?: string;
  quotationDiscount?: number;
  status?: string;
  items: QuotationItem[];
}

export interface CreateQuotationRequest {
  customerId?: number;
  customerName?: string;
  contactNumber?: string;
  quoteDate: string;
  validUntil: string;
  remarks?: string;
  termsConditions?: string;
  quotationDiscount?: number; // Add quotation discount field
  orderTakenById?: number;
  items: QuotationItem[];
  address?: string;
}

export interface QuotationResponse {
  success: boolean;
  message: string;
}

export interface QuotationDetailResponse {
  success: boolean;
  data?: QuotationDetailData;
  message?: string;
}

export interface StatusOption {
  label: string;
  value: string;
  disabled: boolean;
}