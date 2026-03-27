export const MOBILE_BRANDS = [
  "Samsung", "Apple", "Xiaomi", "Oppo", "Vivo", "OnePlus", "Realme", "Tecno", "Infinix", "Nokia"
];

export const MOBILE_CATEGORIES = ["Flagship", "Mid-Range", "Budget"] as const;

export const ACCESSORY_CATEGORIES = [
  "Headphones/Earbuds",
  "Speakers",
  "Chargers & Cables",
  "Cases & Covers",
  "Screen Protectors",
  "Power Banks",
  "Mouse & Keyboards",
  "Smartwatches",
  "Memory Cards",
  "Other",
];

export const STORAGE_OPTIONS = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];
export const RAM_OPTIONS = ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB"];

export const PAYMENT_METHODS = ["Cash", "Card", "JazzCash", "EasyPaisa", "Bank Transfer"];

export const CITIES = [
  "Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi",
  "Peshawar", "Multan", "Quetta", "Sialkot", "Gujranwala"
];

export const CONDITIONS = ["New", "Refurbished", "Used"] as const;

export const LOYALTY_TIERS = {
  Bronze: { min: 0, max: 49999, color: "#CD7F32", bg: "#FDF3E7" },
  Silver: { min: 50000, max: 199999, color: "#94A3B8", bg: "#F1F5F9" },
  Gold: { min: 200000, max: 499999, color: "#F59E0B", bg: "#FFFBEB" },
  Platinum: { min: 500000, max: Infinity, color: "#7C3AED", bg: "#F5F3FF" },
};

export const MOBILE_COLORS = ["Black", "White", "Blue", "Green", "Purple", "Gold", "Silver", "Red", "Pink"];
