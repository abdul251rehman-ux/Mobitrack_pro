export interface PhoneModel {
  model: string
}

export interface BrandEntry {
  name: string
  type: "android" | "both" // "both" = works for accessories too; apple handled separately
  models: string[]
}

// Master brand list — always present, never deletable
// User-added brands from DB are merged on top
export const MASTER_BRANDS: BrandEntry[] = [
  {
    name: "Samsung",
    type: "android",
    models: [
      "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25",
      "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24",
      "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23",
      "Galaxy S22 Ultra", "Galaxy S22+", "Galaxy S22",
      "Galaxy A55", "Galaxy A54", "Galaxy A35", "Galaxy A34",
      "Galaxy A25", "Galaxy A15 5G", "Galaxy A15", "Galaxy A14",
      "Galaxy A05s", "Galaxy A05", "Galaxy A04e", "Galaxy A04",
      "Galaxy M15", "Galaxy M14", "Galaxy M13", "Galaxy F15",
      "Galaxy Z Fold 6", "Galaxy Z Fold 5", "Galaxy Z Fold 4",
      "Galaxy Z Flip 6", "Galaxy Z Flip 5", "Galaxy Z Flip 4",
    ],
  },
  {
    name: "Oppo",
    type: "android",
    models: [
      "Reno 12 Pro", "Reno 12", "Reno 11 Pro", "Reno 11",
      "Reno 10 Pro+", "Reno 10 Pro", "Reno 10",
      "Reno 8T", "Reno 8 Pro", "Reno 8",
      "A3 Pro", "A3x", "A60", "A58", "A57", "A38", "A18", "A17", "A16",
      "Find X8 Pro", "Find X8", "Find X7 Ultra", "Find X6 Pro",
    ],
  },
  {
    name: "Vivo",
    type: "android",
    models: [
      "V40 Pro", "V40", "V30 Pro", "V30e", "V30",
      "V29 Pro", "V29e", "V29", "V27 Pro", "V27e",
      "Y200 Pro", "Y200", "Y100", "Y36", "Y35",
      "Y27s", "Y27", "Y17s", "Y16",
      "X200 Pro", "X100 Pro", "X100", "X90 Pro",
    ],
  },
  {
    name: "Tecno",
    type: "android",
    models: [
      "Camon 30 Premier", "Camon 30 Pro", "Camon 30",
      "Camon 20 Premier", "Camon 20 Pro", "Camon 20",
      "Camon 19 Pro", "Camon 19",
      "Spark 20 Pro+", "Spark 20 Pro", "Spark 20",
      "Spark 10 Pro", "Spark 10", "Spark Go 2024",
      "Pova 6 Pro", "Pova 6", "Pova 5 Pro", "Pova 5",
      "Pop 8", "Pop 7 Pro",
      "Phantom X2 Pro", "Phantom X2", "Phantom V Fold2", "Phantom V Fold",
    ],
  },
  {
    name: "Infinix",
    type: "android",
    models: [
      "Note 40 Pro+", "Note 40 Pro", "Note 40", "Note 30 Pro", "Note 30", "Note 30 VIP",
      "Hot 40 Pro", "Hot 40", "Hot 40i", "Hot 30 Play", "Hot 30",
      "Smart 8 Pro", "Smart 8", "Smart 8 HD",
      "Zero 40 5G", "Zero 30 5G", "Zero 30",
      "GT 20 Pro", "GT 10 Pro",
    ],
  },
  {
    name: "Xiaomi",
    type: "android",
    models: [
      "14 Ultra", "14 Pro", "14", "13 Ultra", "13 Pro", "13",
      "Redmi Note 14 Pro+", "Redmi Note 14 Pro", "Redmi Note 14",
      "Redmi Note 13 Pro+", "Redmi Note 13 Pro", "Redmi Note 13",
      "Redmi Note 12 Pro+", "Redmi Note 12 Pro", "Redmi Note 12",
      "Redmi 14C", "Redmi 13C", "Redmi 13", "Redmi 12C", "Redmi 12",
      "POCO X6 Pro", "POCO X6", "POCO X5 Pro", "POCO X5",
      "POCO M6 Pro", "POCO M6", "POCO C75", "POCO C65", "POCO C55",
    ],
  },
  {
    name: "Realme",
    type: "android",
    models: [
      "GT 6 Pro", "GT 6", "GT 5 Pro", "GT 5",
      "13 Pro+", "13 Pro", "13+", "13",
      "12 Pro+", "12 Pro", "12+", "12",
      "11 Pro+", "11 Pro", "11",
      "C67", "C65", "C63", "C55", "C53", "C51", "C35",
      "Narzo 70 Pro", "Narzo 70", "Narzo 60 Pro", "Narzo 60",
    ],
  },
  {
    name: "OnePlus",
    type: "android",
    models: [
      "13 Pro", "13", "12 Pro", "12", "11 Pro", "11",
      "Nord 4", "Nord CE 4 Lite", "Nord CE 4", "Nord CE 3 Lite", "Nord CE 3", "Nord 3",
      "Open",
    ],
  },
  {
    name: "Huawei",
    type: "android",
    models: [
      "Mate 60 Pro+", "Mate 60 Pro", "Mate 60", "Mate 50 Pro",
      "P60 Pro", "P60", "P50 Pro",
      "Nova 12 Ultra", "Nova 12 Pro", "Nova 12", "Nova 11 Pro", "Nova 11", "Nova 10 Pro",
      "Y9s", "Y7a", "Y6p",
    ],
  },
  {
    name: "Nokia",
    type: "android",
    models: [
      "G42", "G22", "G21", "G20", "C32", "C22", "C21 Plus", "C12", "C02",
      "105 (2023)", "110 4G", "150 (2023)",
    ],
  },
  {
    name: "Motorola",
    type: "android",
    models: [
      "Edge 50 Ultra", "Edge 50 Pro", "Edge 50", "Edge 40 Pro", "Edge 40",
      "Moto G85", "Moto G84", "Moto G54 5G", "Moto G34", "Moto G14",
      "Razr 50 Ultra", "Razr 50",
    ],
  },
  {
    name: "Google",
    type: "android",
    models: [
      "Pixel 9 Pro XL", "Pixel 9 Pro Fold", "Pixel 9 Pro", "Pixel 9",
      "Pixel 8 Pro", "Pixel 8a", "Pixel 8",
      "Pixel 7 Pro", "Pixel 7a", "Pixel 7",
      "Pixel 6 Pro", "Pixel 6a", "Pixel 6",
    ],
  },
  {
    name: "Tecno (Itel)",
    type: "android",
    models: [],
  },
  {
    name: "Itel",
    type: "android",
    models: [
      "S24", "S23+", "S23",
      "A70", "A60s", "A60",
      "P40", "P38 Pro", "P36 Pro",
    ],
  },
  // Pakistani local brands
  {
    name: "Q-Mobile",
    type: "android",
    models: [
      "Noir Z14", "Noir Z12 Pro", "Noir Z10", "Noir Z9",
      "LT900", "LT800", "LT700",
      "CS1 Pro", "CS1",
    ],
  },
  {
    name: "Voice",
    type: "android",
    models: [
      "V8 Ultra", "V7 Pro", "V7", "V6 Pro",
      "Xtreme X1 Pro", "Xtreme X1",
    ],
  },
  {
    name: "Rivo",
    type: "android",
    models: [
      "Rhythm RX80", "Rhythm RX70", "Rhythm RX60",
      "Phantom PH1", "Phantom PH",
    ],
  },
  {
    name: "Ufone (UFone)",
    type: "android",
    models: ["UTab 7.1", "UTab 8"],
  },
  {
    name: "GFive",
    type: "android",
    models: ["President G9", "G5 4G", "G5i"],
  },
  {
    name: "ZTE",
    type: "android",
    models: [
      "Blade V50 Design", "Blade V40 Pro", "Blade V40",
      "Nubia Z60 Ultra", "Nubia Z50 Ultra",
    ],
  },
  {
    name: "Sony",
    type: "android",
    models: [
      "Xperia 1 VI", "Xperia 5 VI", "Xperia 10 VI",
      "Xperia 1 V", "Xperia 5 V", "Xperia 10 V",
    ],
  },
]

// Apple models — used when deviceType === "iphone"
export const APPLE_MODELS: string[] = [
  "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
  "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
  "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
  "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 Mini",
  "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 Mini",
  "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
  "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
  "iPhone 8 Plus", "iPhone 8",
  "iPhone SE (2022)", "iPhone SE (2020)",
]

// All brand names (master) for use in accessories & global filters
export const MASTER_BRAND_NAMES: string[] = [
  "Apple",
  ...MASTER_BRANDS.map((b) => b.name),
]
