export interface Chain {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Restaurant {
  id: string;
  chain_id: string;
  name: string;
  city: string | null;
  uber_store_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UberConnection {
  id: string;
  restaurant_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  expires_at: string | null;
  scopes: string | null;
  raw_payload: any;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  uber_order_id: string;
  status: string | null;
  order_datetime: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  service_fee: number | null;
  currency: string | null;
  raw_payload: any;
  created_at: string;
}

export interface Promotion {
  id: string;
  restaurant_id: string;
  title: string;
  type: string | null;
  start_at: string | null;
  end_at: string | null;
  raw_payload: any;
  created_at: string;
}

export interface RestaurantWithConnection extends Restaurant {
  uber_connections?: UberConnection[];
}

export interface DashboardKPIs {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalOrders: number;
  averageTicket: number;
}

export interface RestaurantPerformance {
  restaurant: Restaurant;
  grossRevenue: number;
  netRevenue: number;
  ordersCount: number;
  activePromotions: number;
  hasConnection: boolean;
}

export type DateRange = '1' | '7' | '30' | 'custom';

// ============= Uber Eats Menu Types =============

export interface MultiLanguageText {
  translations: Record<string, string>;
}

export interface TimePeriod {
  start_time: string;
  end_time: string;
}

export interface ServiceAvailability {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  time_periods: TimePeriod[];
}

export interface Menu {
  id: string;
  title: MultiLanguageText;
  subtitle?: MultiLanguageText;
  service_availability: ServiceAvailability[];
  category_ids: string[];
}

export interface MenuEntity {
  id: string;
  type: 'ITEM' | 'MODIFIER_GROUP';
}

export interface MenuCategory {
  id: string;
  title: MultiLanguageText;
  subtitle?: MultiLanguageText;
  entities: MenuEntity[];
}

export interface PriceOverride {
  context_type: 'MENU' | 'ITEM' | 'MODIFIER_GROUP';
  context_value: string;
  price: number;
  core_price?: number;
}

export interface PriceRules {
  price: number;
  core_price?: number;
  container_deposit?: number;
  overrides?: PriceOverride[];
  priced_by_unit?: MeasurementUnit;
}

export interface QuantityConstraint {
  min_permitted?: number;
  max_permitted?: number;
  is_min_permitted_optional?: boolean;
  charge_above?: number;
  refund_under?: number;
  min_permitted_unique?: number;
  max_permitted_unique?: number;
}

export interface QuantityConstraintOverride {
  context_type: 'MENU' | 'ITEM' | 'MODIFIER_GROUP';
  context_value: string;
  quantity: QuantityConstraint;
}

export interface QuantityConstraintRules {
  quantity?: QuantityConstraint;
  overrides?: QuantityConstraintOverride[];
}

export interface Suspension {
  suspend_until?: number;
  reason?: string;
}

export interface SuspensionOverride {
  context_type: 'MENU' | 'ITEM' | 'MODIFIER_GROUP';
  context_value: string;
  suspension?: Suspension;
}

export interface SuspensionRules {
  suspension?: Suspension;
  overrides?: SuspensionOverride[];
}

export interface ModifierGroupsOverride {
  context_type: 'MENU' | 'ITEM' | 'MODIFIER_GROUP';
  context_value: string;
  ids: string[];
}

export interface ModifierGroupsRules {
  ids: string[];
  overrides?: ModifierGroupsOverride[];
}

export interface TaxInfo {
  tax_rate?: number;
  vat_rate_percentage?: number;
}

export interface Interval {
  lower?: number;
  upper?: number;
}

export interface Weight {
  unit_type: string;
}

export interface Volume {
  unit_type: string;
}

export interface Count {
  unit_type: string;
  custom_unit?: string;
}

export interface WeightInterval {
  interval: Interval;
  weight: Weight;
}

export interface VolumeInterval {
  interval: Interval;
  volume: Volume;
}

export interface CountInterval {
  interval: Interval;
  count: Count;
}

export interface MeasurementInterval {
  measurement_type: 'MEASUREMENT_TYPE_WEIGHT' | 'MEASUREMENT_TYPE_VOLUME' | 'MEASUREMENT_TYPE_COUNT';
  weight_interval?: WeightInterval;
  volume_interval?: VolumeInterval;
  count_interval?: CountInterval;
}

export interface NutrientInfo {
  amount: WeightInterval;
}

export interface EnergyInfo {
  energy_interval?: Interval;
  lower_range?: number;
  upper_range?: number;
  display_type?: 'single_item' | 'double_items' | 'additive_item' | 'multiple_items';
}

export interface NutritionalInfo {
  calories?: EnergyInfo;
  kilojoules?: EnergyInfo;
  serving_size?: MeasurementInterval;
  number_of_servings?: number;
  number_of_servings_interval?: Interval;
  net_quantity?: MeasurementInterval;
  calories_per_serving?: EnergyInfo;
  kilojoules_per_serving?: EnergyInfo;
  fat?: NutrientInfo;
  saturated_fatty_acids?: NutrientInfo;
  carbohydrates?: NutrientInfo;
  sugar?: NutrientInfo;
  protein?: NutrientInfo;
  salt?: NutrientInfo;
  allergens?: string[];
}

export interface DietaryLabelInfo {
  labels?: ('VEGAN' | 'VEGETARIAN' | 'GLUTEN_FREE')[];
}

export interface FoodBusinessOperator {
  name: string;
  address: string;
}

export interface Classifications {
  can_serve_alone?: boolean;
  is_vegetarian?: boolean;
  alcoholic_items?: number;
  dietary_label_info?: DietaryLabelInfo;
  instructions_for_use?: string;
  ingredients?: string[];
  additives?: string[];
  preparation_type?: string;
  food_business_operator?: FoodBusinessOperator;
  is_high_fat_salt_sugar?: boolean;
}

export interface DishInfo {
  classifications?: Classifications;
}

export interface HoursOfWeek {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  time_periods: TimePeriod[];
}

export interface VisibilityHours {
  start_date?: string;
  end_date?: string;
  hours_of_week: HoursOfWeek[];
}

export interface VisibilityInfo {
  hours: VisibilityHours;
}

export interface TaxLabelsInfo {
  labels: string[];
  source: 'MANUAL';
}

export interface TaxLabelsRuleSet {
  default_value: TaxLabelsInfo;
}

export interface ProductInfo {
  target_market?: number;
  gtin?: string;
  plu?: string;
  merchant_id?: string;
  product_type?: string;
  product_traits?: string[];
  countries_of_origin?: string[];
}

export interface BundledItems {
  item_id: string;
  core_price: number;
  included_quantity: number;
}

export interface CoffeeInfo {
  coffee_bean_origin?: string[];
}

export interface BeverageInfo {
  caffeine_amount?: number;
  alcohol_by_volume?: number;
  coffee_info?: CoffeeInfo;
}

export interface PhysicalPropertiesInfo {
  reusable_packaging?: boolean;
}

export interface MedicationInfo {
  medical_prescription_required?: boolean;
}

export interface MeasurementUnit {
  measurement_type: 'MEASUREMENT_TYPE_COUNT' | 'MEASUREMENT_TYPE_WEIGHT' | 'MEASUREMENT_TYPE_VOLUME' | 'MEASUREMENT_TYPE_LENGTH';
  length_unit?: 'LENGTH_UNIT_TYPE_METRIC_METER' | 'LENGTH_UNIT_TYPE_METRIC_MILLIMETER' | 'LENGTH_UNIT_TYPE_METRIC_CENTIMETER';
  weight_unit?: string;
  volume_unit?: string;
}

export interface SellingQuantityConstraint {
  min_permitted?: number;
  max_permitted?: number;
  increment?: number;
  default_quantity?: number;
}

export interface PricedByToSoldByUnitConversionInfo {
  conversion_rate?: number;
}

export interface SellingOption {
  sold_by_unit?: MeasurementUnit;
  quantity_constraints?: SellingQuantityConstraint;
  priced_by_to_sold_by_unit_conversion_info?: PricedByToSoldByUnitConversionInfo;
}

export interface SellingInfo {
  selling_options: SellingOption[];
}

export interface MenuItem {
  id: string;
  external_data?: string;
  title: MultiLanguageText;
  description?: MultiLanguageText;
  image_url?: string;
  price_info: PriceRules;
  quantity_info?: QuantityConstraintRules;
  suspension_info?: SuspensionRules;
  modifier_group_ids?: ModifierGroupsRules;
  tax_info: TaxInfo;
  nutritional_info?: NutritionalInfo;
  dish_info?: DishInfo;
  visibility_info?: VisibilityInfo;
  tax_label_info?: TaxLabelsRuleSet;
  product_info?: ProductInfo;
  bundled_items?: BundledItems[];
  beverage_info?: BeverageInfo;
  physical_properties_info?: PhysicalPropertiesInfo;
  medication_info?: MedicationInfo;
  selling_info?: SellingInfo;
}

export interface ModifierGroup {
  id: string;
  external_data?: string;
  title: MultiLanguageText;
  quantity_info?: QuantityConstraintRules;
  modifier_options: MenuEntity[];
  display_type?: 'expanded' | 'collapsed';
}

export interface MenuConfiguration {
  menus: Menu[];
  categories: MenuCategory[];
  items: MenuItem[];
  modifier_groups: ModifierGroup[];
}
