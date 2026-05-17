export interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  is_pro: boolean;
  pro_plan: 'monthly' | 'annual' | null;
  pro_expires_at: string | null;
  avatar: string | null;
  country: string;
  ref_code: string | null;
  ref_used: string | null;
  steam_id: string | null;
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
  release_at: string | null;
  header_image: string;
  capsule_image: string;
  background_image: string;
  screenshots: string[];
  trailer_url: string | null;
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
  is_dlc: boolean;
  is_demo: boolean;
  is_preorder: boolean;
  parent_game_id: number | null;
  drm_platform: string;
  steam_review_count: number | null;
  metacritic_score: number | null;
  languages: string | null;
  discount_ends_at?: string | null;
  created_at: string;
}

export interface LibraryGame extends Game {
  license_code: string;
  license_id: number;
  acquired_at: string;
  redeemed: boolean;
  order_id: number | null;
  order_item_id: number | null;
}

export interface CartItem {
  gameId: number;
  title: string;
  price: number;
  capsule_image: string;
}

export interface Order {
  id: number;
  user_id: number;
  total: number;
  currency: string;
  payment_method: string;
  card_last4: string | null;
  card_brand: string | null;
  status: string;
  points_earned: number;
  points_used: number;
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
}

export interface Promotion {
  id: number;
  title: string;
  subtitle: string | null;
  hero_image: string | null;
  accent_color: string;
  cta_text: string | null;
  cta_target: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  is_active: boolean;
  games: Game[];
}

export interface DailyDeal {
  flash_id: number;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  max_units: number | null;
  units_left: number | null;
  effective_price: number;
  game: Game;
}

export interface PriceHistoryPoint {
  price: number;
  discount_percent: number;
  recorded_at: string;
}

export interface UserLevel {
  level: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  cashback: number;
  nextAt: number | null;
}

export interface ProfileStats {
  total_spent: number;
  games: number;
  redeemed: number;
  unlocked: number;
  total_achievements: number;
  wishlist: number;
  points: number;
  level: UserLevel;
}

export interface Review {
  id: number;
  user_id: number;
  username: string;
  game_id: number;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
}

export interface ReviewSummary {
  count: number;
  average: number | null;
}

export interface PointsLedgerEntry {
  id: number;
  user_id: number;
  delta: number;
  reason: string;
  target_id: number | null;
  created_at: string;
}

export interface GiftCard {
  id: number;
  code: string;
  amount: number;
  currency: string;
  buyer_id: number | null;
  redeemer_id: number | null;
  status: 'unsold' | 'sold' | 'redeemed';
  created_at: string;
  sold_at: string | null;
  redeemed_at: string | null;
}

export interface CurrencyRate {
  code: string;
  rate_from_pen: number;
  symbol: string;
  label: string;
  updated_at: string;
}

export interface Collection {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  hero_image: string | null;
  curator_name: string | null;
  is_published: boolean;
  games: Game[];
}

export interface RefundRequest {
  id: number;
  user_id: number;
  order_id: number;
  order_item_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decision: string | null;
  decided_at: string | null;
  created_at: string;
  game_title?: string;
  price?: number;
}

export interface ComparePriceResult {
  dreitz_pen: number;
  steam_pen: number;
  steam_usd: number;
  savings_pct: number;
}

export interface ReferralSummary {
  code: string | null;
  referred: number;
  points_earned: number;
}

export interface Wallet {
  user_id: number;
  balance: number;
  currency: string;
}
