export interface OrderTakenBy {
  id?: number;
  name: string;
  status: string;
  remarks?: string;
}

export interface OrderTakenBySearchRequest {
  search?: string;
  currentPage: number;
  perPageRecord: number;
}

export interface OrderTakenByResponse {
  success: boolean;
  message: string;
  data: {
    content: OrderTakenBy[];
    totalElements: number;
    pageSize: number;
    totalPages: number;
  };
}
