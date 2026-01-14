export interface Category {
  id: number;
  name: string;
  parent?: number;
  subcategories?: Category[];
  get_subcategories_count?: number;
  get_contacts_count?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
  success?: boolean;
}

export interface Contact {
  id: number;
  company_name: string;
  mobile_number: string;
  category?: number;
  category_name?: string;
  sub_category?: number;
  sub_category_name?: string;
  sales_person_name?: string;
  status: "active" | "inactive" | "pending" | "closed";
  assigned_to?: number;
  created_at?: string;
}

export interface WhatsAppRecipient extends Contact {
  conversationId: string; // REQUIRED for sending messages
  sessionExpiresAt: string; // ISO date string
  sessionActive: boolean; // always true here, but explicit
}

export interface Lead {
  id: number;
  company_name: string;
  mobile_number: string;
  email?: string;
  city?: string;
  category?: number;
  category_name?: string;
  sub_category?: number;
  sub_category_name?: string;
  sales_person_name?: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  assigned_to?: number;
  created_at?: string;
}

export interface GalleryImage {
  id: number;
  image_url?: string;
  url?: string;
  s3_url?: string;
  image?: { url: string };
  title?: string;
  description?: string;
  price?: number;
  price_currency?: string;
  price_display?: string;
  get_display_price?: string;
  category?: number;
  category_name?: string;
  sub_category?: number;
  sub_category_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: "image" | "template";
  status: "draft" | "active" | "completed" | "paused";
  recipientCount: number;
  createdAt: string;
}
