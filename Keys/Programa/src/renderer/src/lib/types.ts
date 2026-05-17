export interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  is_pro: boolean;
  pro_plan: 'monthly' | 'annual' | null;
  pro_expires_at: string | null;
  country: string;
  created_at: string;
}

export interface Game {
  id: number;
  steam_app_id: number;
  title: string;
  short_description: string;
  detailed_description: string;
  developer: string;
  publisher: string;
  release_date: string;
  header_image: string;
  capsule_image: string;
  background_image: string;
  screenshots: string[];
  genres: string[];
  categories: string[];
  pc_requirements_min: string;
  pc_requirements_rec: string;
  price_initial: number;
  price_final: number;
  discount_percent: number;
  currency: string;
  stock: number;
  is_featured: boolean;
  is_active: boolean;
  discount_ends_at?: string | null;
  created_at: string;
}

export interface License {
  id: number;
  game_id: number;
  game_title: string;
  code: string;
  status: 'available' | 'sold' | 'redeemed' | 'revoked';
  user_id: number | null;
  buyer: string | null;
  created_at: string;
  sold_at: string | null;
  redeemed_at: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  username: string;
  total: number;
  currency: string;
  payment_method: string;
  card_last4: string | null;
  card_brand: string | null;
  status: string;
  created_at: string;
}

export interface Stats {
  users: number;
  games: number;
  licenses: { total: number; available: number; sold: number; revoked?: number };
  orders: number;
  revenue: number;
  pro: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopGame {
  id: number;
  title: string;
  capsule_image: string;
  header_image: string;
  units: number;
  revenue: number;
}

export interface UserBreakdown {
  total: number;
  pro: number;
  free: number;
  active: number;
}

export interface AuditEntry {
  id: number;
  admin_id: number;
  username: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  detail: string | null;
  created_at: string;
}

export interface Bundle {
  id: number;
  title: string;
  description: string | null;
  discount_percent: number;
  ends_at: string | null;
  hero_image: string | null;
  games: Game[];
  created_at: string;
}
