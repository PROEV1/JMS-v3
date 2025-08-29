
export type StockRequestStatus = 'submitted' | 'approved' | 'rejected' | 'in_pick' | 'in_transit' | 'cancelled' | 'amend' | 'received';
export type StockRequestPriority = 'low' | 'medium' | 'high';

export interface StockRequest {
  id: string;
  engineer_id: string;
  destination_location_id: string;
  order_id?: string;
  needed_by?: string;
  priority: StockRequestPriority;
  status: StockRequestStatus;
  notes?: string;
  photo_url?: string;
  idempotency_key?: string;
  purchase_order_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StockRequestLine {
  id: string;
  request_id: string;
  item_id: string;
  qty: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StockRequestWithDetails extends StockRequest {
  lines: (StockRequestLine & {
    item: {
      name: string;
      sku: string;
      unit: string;
    };
  })[];
  engineer: {
    name: string;
  };
  destination_location: {
    name: string;
  };
  order?: {
    order_number: string;
    client_id: string;
  };
}

export interface CreateStockRequestData {
  destination_location_id: string;
  order_id?: string;
  needed_by?: string;
  priority: StockRequestPriority;
  notes?: string;
  photo_url?: string;
  lines: {
    item_id: string;
    qty: number;
    notes?: string;
  }[];
}
