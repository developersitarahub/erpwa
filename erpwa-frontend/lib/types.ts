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
  templateType?: "standard" | "catalog" | "carousel";
  status: "draft" | "active" | "completed" | "paused";
  recipientCount: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  companyName: string;
  phone: string;
  status?: "new" | "contacted" | "qualified" | "converted" | "lost";
  leadId?: number;

  lastMessage: string;
  lastActivity: string;

  lastMessageDirection?: "inbound" | "outbound";
  lastMessageStatus?: "sent" | "delivered" | "read" | "received" | "failed";
  unreadCount?: number;
  hasUnread?: boolean;

  sessionStarted?: boolean; // ✅ ADD
  sessionActive?: boolean; // ✅ ADD
  sessionExpiresAt?: string | null;
  templateRequired?: boolean;
}

export interface Message {
  id: string;
  whatsappMessageId?: string;
  replyToMessageId?: string;

  replyTo?: {
    sender: "customer" | "executive";
    text?: string;
    mediaUrl?: string;
    mimeType?: string;
    caption?: string;
  };

  text?: string;
  mediaUrl?: string;
  mimeType?: string;
  caption?: string;

  sender: "customer" | "executive";
  timestamp: string;
  status?: "sent" | "delivered" | "read" | "failed" | "received";

  template?: {
    templateType?: "standard" | "catalog" | "carousel";
    header?: {
      type: string;
      text?: string;
      mediaUrl?: string;
    };
    body?: {
      text?: string;
    };
    footer?: string;
    buttons?: Array<{ text: string; type: string; value?: string }>;
    carouselCards?: {
      id: string; // or number? usually strings in frontend types here
      title?: string;
      subtitle?: string;
      mediaUrl?: string; // s3Url
      s3Url?: string; // Fallback for backend spread
      mimeType?: string;
      buttonText?: string;
      buttonValue?: string;
      buttonType?: string;
    }[];
    catalogProducts?: {
      id: string;
      productId: string;
      position: number;
    }[];
  };
  optimistic?: boolean;
  clientTempId?: string;
  carouselCards?: {
    id: string;
    title?: string;
    subtitle?: string; // or body
    mediaUrl?: string; // s3Url
    s3Url?: string;
    mimeType?: string;
    buttonText?: string;
    buttonValue?: string;
    buttonType?: string;
  }[];
  outboundPayload?: any;
  messageType?: string;
}

export interface Template {
  id: string;
  metaTemplateName: string;
  displayName: string;
  category: string;
  templateType: "standard" | "catalog" | "carousel";
  status: string;
  languages: {
    language: string;
    body: string;
    headerType: string;
    footerText?: string;
    headerText?: string;
  }[];
  media?: {
    id: string;
    mediaType: string;
    s3Url: string;
    language: string;
  }[];
  buttons?: {
    type: string;
    text: string;
    value?: string;
  }[];
  carouselCards?: {
    id: string;
    title?: string;
    subtitle?: string;
    s3Url?: string;
    mimeType?: string;
    buttonText?: string;
    buttonValue?: string;
    buttonType?: string;
    position: number;
    mediaHandle?: string;
  }[];
  catalogProducts?: {
    id: string;
    productId: string;
    position: number;
  }[];
}
