export type UserRole = 'buyer' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  bio: string;
  store_name: string;
  store_description: string;
  store_location: string;
  badges: string[];
  is_suspended: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_store_name: string;
  seller_location: string;
  seller_badges: string[];
  title: string;
  brand: string;
  category: string;
  size: string;
  condition: string;
  description: string;
  price: number;
  original_price: number;
  stock: number;
  allow_barter: boolean;
  barter_preferences: string;
  images: string[];
  status: 'active' | 'flagged' | 'sold_out' | 'archived';
  featured: boolean;
  rating_avg: number;
  review_count: number;
  created_at: string;
}

export interface BarterOffer {
  id: string;
  proposer_id: string;
  proposer_name: string;
  proposer_store_name: string;
  recipient_id: string;
  recipient_name: string;
  recipient_store_name: string;
  requested_product_id: string;
  requested_product_title: string;
  requested_product_image: string;
  requested_product_price: number;
  offered_product_id: string | null;
  offered_item_title: string;
  offered_item_image: string;
  cash_topup: number;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  seller_name: string;
  seller_store_name: string;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  product_price: number | null;
  last_message_at: string;
  last_message_preview: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  offer_amount: number | null;
  offer_status: 'none' | 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string;
  seller_store_name: string;
  title: string;
  image: string;
  unit_price: number;
  quantity: number;
  negotiated_from: number | null;
  has_review: boolean;
}

export interface Order {
  id: string;
  buyer_id: string;
  buyer_name: string;
  status: 'Placed' | 'Authenticated' | 'Shipped' | 'Delivered' | 'Cancelled';
  total_amount: number;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal: string;
  payment_method: string;
  tracking_code: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface Review {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string;
  reviewer_id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'message' | 'offer' | 'barter' | 'order' | 'review' | 'admin';
  title: string;
  body: string;
  link_tab: string;
  is_read: boolean;
  created_at: string;
}

export interface Lookbook {
  id: string;
  author_id: string;
  author_name: string;
  author_store_name: string;
  title: string;
  season: string;
  story: string;
  cover_image: string;
  product_ids: string[];
  products?: Product[];
  likes_count: number;
  created_at: string;
}

export interface ReportItem {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: 'product' | 'user';
  target_id: string;
  target_label: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  admin_notes: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  agreedPrice?: number;
}
