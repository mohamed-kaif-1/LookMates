import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), "lookmates.db");

// Singleton database instance
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new DatabaseSync(dbPath);
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      occasion TEXT NOT NULL,
      style_preferences TEXT NOT NULL,
      combined_budget REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      preferred_colors TEXT,
      excluded_colors TEXT,
      venue TEXT,
      weather_or_season TEXT,
      dress_code TEXT,
      person1_preference TEXT,
      person2_preference TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT,
      photo_data TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS garments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      price REAL,
      currency TEXT DEFAULT 'INR',
      gender_target TEXT DEFAULT 'unisex',
      style_tag TEXT,
      occasion_tag TEXT,
      is_demo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS garment_assignments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      garment_id TEXT NOT NULL,
      status TEXT DEFAULT 'assigned',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS styling_recommendations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      recommendation_data TEXT NOT NULL,
      provider TEXT DEFAULT 'SmartMatch Engine',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tryon_jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      garment_id TEXT NOT NULL,
      provider_job_id TEXT,
      status TEXT NOT NULL,
      result_image_url TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS couple_compositions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      person1_job_id TEXT,
      person2_job_id TEXT,
      image_data TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_looks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      occasion TEXT NOT NULL,
      garment_names TEXT NOT NULL,
      person1_image TEXT,
      person2_image TEXT,
      couple_image TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migrations for reference couple photo & background studio
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN reference_photo_data TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN locked_recommendation_id TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN locked_recommendation_data TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN background_setting TEXT DEFAULT 'transparent';`);
  } catch {}

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN custom_background_image TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN custom_color_hex TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE couple_compositions ADD COLUMN reference_image_data TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE garments ADD COLUMN subcategory TEXT;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE garments ADD COLUMN is_vto_compatible INTEGER DEFAULT 1;`);
  } catch {}

  try {
    db.exec(`ALTER TABLE garments ADD COLUMN vto_category TEXT DEFAULT 'upper_body';`);
  } catch {}

  // Seed / update expanded curated garments
  seedGarments(db);
}

function seedGarments(db: DatabaseSync) {
  const seedItems = [
    // ==========================================
    // 1. TOPS
    // ==========================================
    {
      id: "garm-top-white-tee",
      name: "Minimalist Heavyweight White Tee",
      category: "tops",
      subcategory: "Basic T-shirts",
      image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
      color: "White",
      description: "280 GSM combed organic cotton basic crewneck tee with reinforced rib collar.",
      price: 1999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Minimal / Casual",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-top-oversized-tee",
      name: "Tokyo Boxy Oversized Graphic Tee",
      category: "tops",
      subcategory: "Oversized T-shirts",
      image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "Dropped-shoulder heavyweight streetwear t-shirt with subtle tonal typography.",
      price: 2799,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Streetwear",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-c1-linen-shirt",
      name: "Santorini Sky Blue Resort Linen Shirt",
      category: "tops",
      subcategory: "Shirts",
      image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
      color: "Sky Blue",
      description: "100% French flax linen camp-collar shirt with relaxed drape and mother-of-pearl buttons.",
      price: 3999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Casual / Minimal",
      occasion_tag: "Vacation",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-d1-black-oxford",
      name: "Pitch Black Mercerized Cotton Oxford",
      category: "tops",
      subcategory: "Formal shirts",
      image_url: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "Crisp spread-collar tailored shirt with matte horn buttons in high-thread-count cotton.",
      price: 4499,
      currency: "INR",
      gender_target: "male",
      style_tag: "Minimal / Formal",
      occasion_tag: "Date night",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-top-silk-blouse",
      name: "Champagne Silk Chiffon Tie-Neck Blouse",
      category: "tops",
      subcategory: "Blouses",
      image_url: "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=800&q=80",
      color: "Champagne / Ivory",
      description: "Sheer silk chiffon blouse with draped pussy-bow necktie and gathered billow sleeves.",
      price: 5499,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-d2-burgundy-knit",
      name: "Deep Merlot Cashmere Knit Sweater",
      category: "tops",
      subcategory: "Sweaters",
      image_url: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80",
      color: "Burgundy",
      description: "Plush 12-gauge Mongolian cashmere crewneck sweater in rich deep merlot.",
      price: 9499,
      currency: "INR",
      gender_target: "female",
      style_tag: "Casual / Luxury-inspired",
      occasion_tag: "Date night",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-top-fleece-hoodie",
      name: "Architectural Boxy Fleece Hoodie",
      category: "tops",
      subcategory: "Hoodies",
      image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
      color: "Heather Grey",
      description: "Structured double-face cotton fleece pullover hoodie with seamless kangaroo pocket.",
      price: 4999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Streetwear / Minimal",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-top-camel-blazer",
      name: "Double-Breasted Italian Camel Blazer",
      category: "tops",
      subcategory: "Blazers",
      image_url: "https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=800&q=80",
      color: "Camel",
      description: "Sharp sartorial six-button blazer in fine brushed virgin wool with tort buttons.",
      price: 13999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Formal / Modern & Elegant",
      occasion_tag: "Formal",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-top-textured-cardigan",
      name: "Textured Cable-Knit Mohair Cardigan",
      category: "tops",
      subcategory: "Cardigans",
      image_url: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80",
      color: "Olive Green",
      description: "Chunky tactile mohair-blend V-neck cardigan with horn buttons.",
      price: 5999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Casual / Preppy",
      occasion_tag: "Date night",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },

    // ==========================================
    // 2. BOTTOMS
    // ==========================================
    {
      id: "garm-bot-selvedge-jeans",
      name: "Vintage Indigo Straight Selvedge Denim",
      category: "bottoms",
      subcategory: "Jeans",
      image_url: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80",
      color: "Indigo Blue",
      description: "14oz Japanese raw shuttle-loom selvedge denim in a timeless mid-rise straight leg.",
      price: 5499,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Classic / Casual",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-w1-cream-trousers",
      name: "Tailored Cream Pleated Trousers",
      category: "bottoms",
      subcategory: "Straight-fit trousers",
      image_url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80",
      color: "Cream / Ivory",
      description: "Crisp double-pleated tailored trousers in premium breathable wool-blend twill.",
      price: 6499,
      currency: "INR",
      gender_target: "male",
      style_tag: "Minimal / Formal",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-bot-charcoal-trousers",
      name: "Charcoal Slim Italian Wool Trousers",
      category: "bottoms",
      subcategory: "Formal trousers",
      image_url: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80",
      color: "Charcoal Grey",
      description: "Flat-front tailored evening trousers with concealed tab closure and satin waistband.",
      price: 6999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Formal",
      occasion_tag: "Formal",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-bot-wide-palazzo",
      name: "Fluid Noir Pleated Wide-Leg Trousers",
      category: "bottoms",
      subcategory: "Wide-leg trousers",
      image_url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "High-waisted fluid crepe palazzo trousers with architectural front pleats.",
      price: 7499,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Party",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-bot-british-chinos",
      name: "Classic British Khaki Cotton Chinos",
      category: "bottoms",
      subcategory: "Chinos",
      image_url: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80",
      color: "Khaki / Tan",
      description: "Sturdy garment-dyed stretch cotton twill chinos with clean tapered fit.",
      price: 3999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Smart Casual",
      occasion_tag: "Work / Casual",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-bot-olive-cargo",
      name: "Tactical Relaxed Olive Cargo Pants",
      category: "bottoms",
      subcategory: "Cargo pants",
      image_url: "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=800&q=80",
      color: "Olive Green",
      description: "Durable ripstop cargo trousers with low-profile bellow pockets and adjustable hems.",
      price: 4499,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Streetwear",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-bot-linen-shorts",
      name: "Tailored Ivory Linen Pleated Shorts",
      category: "bottoms",
      subcategory: "Shorts",
      image_url: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=800&q=80",
      color: "Ivory",
      description: "Mid-thigh resort tailored shorts with double forward pleats in washed European linen.",
      price: 3499,
      currency: "INR",
      gender_target: "male",
      style_tag: "Resort / Casual",
      occasion_tag: "Vacation",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },
    {
      id: "garm-bot-satin-skirt",
      name: "Forest Green Bias-Cut Satin Midi Skirt",
      category: "bottoms",
      subcategory: "Skirts",
      image_url: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80",
      color: "Forest Green",
      description: "Liquid heavy-silk satin midi skirt cut on the bias for an effortless silhouette.",
      price: 5999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Date night",
      is_vto_compatible: 1,
      vto_category: "lower_body"
    },

    // ==========================================
    // 3. DRESSES AND ONE-PIECE OUTFITS
    // ==========================================
    {
      id: "garm-c2-wrap-sundress",
      name: "Mediterranean Azure Linen Wrap Dress",
      category: "dresses",
      subcategory: "Casual dresses",
      image_url: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80",
      color: "Azure Blue",
      description: "Breezy tiered wrap sundress with flutter sleeves and waist tie.",
      price: 5999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Casual / Vacation",
      occasion_tag: "Vacation",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-w2-silk-gown",
      name: "Sapphire Draped Silk Halter Gown",
      category: "dresses",
      subcategory: "Evening dresses",
      image_url: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80",
      color: "Navy / Sapphire",
      description: "Flowing bias-cut mulberry silk gown with architectural drape and side slit.",
      price: 16999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-w2-ivory-lehenga",
      name: "Champagne Ivory Organza Lehenga Set",
      category: "dresses",
      subcategory: "Maxi dresses",
      image_url: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80",
      color: "Ivory / Champagne",
      description: "Hand-embroidered organza skirt with tonal sequin accents and matching dupatta.",
      price: 24500,
      currency: "INR",
      gender_target: "female",
      style_tag: "Traditional / Luxury-inspired",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-p2-metallic-dress",
      name: "Silver Liquid Lamé Cocktail Dress",
      category: "dresses",
      subcategory: "Cocktail dresses",
      image_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
      color: "Silver",
      description: "Statement cocktail dress with structured shoulders and metallic reflective gleam.",
      price: 13500,
      currency: "INR",
      gender_target: "female",
      style_tag: "Experimental / Party",
      occasion_tag: "Party",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-dress-crepe-jumpsuit",
      name: "Tailored Obsidian Crepe Tuxedo Jumpsuit",
      category: "dresses",
      subcategory: "Jumpsuits",
      image_url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "Architectural halter jumpsuit with satin lapel accents and sleek tapered trousers.",
      price: 11999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Party",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-w2-emerald-slip",
      name: "Emerald Green Satin Column Slip Dress",
      category: "dresses",
      subcategory: "Evening dresses",
      image_url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80",
      color: "Emerald Green",
      description: "Minimalist floor-skimming cowl-neck slip dress in lustrous satin.",
      price: 12499,
      currency: "INR",
      gender_target: "female",
      style_tag: "Minimal / Modern & Elegant",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },

    // ==========================================
    // 4. OUTERWEAR
    // ==========================================
    {
      id: "garm-out-denim-trucker",
      name: "Classic Washed Indigo Denim Trucker",
      category: "outerwear",
      subcategory: "Denim jackets",
      image_url: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80",
      color: "Denim Blue",
      description: "Heavyweight 13.5oz vintage-wash denim jacket with copper shank buttons.",
      price: 6999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Streetwear / Casual",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-out-leather-biker",
      name: "Noir Asymmetrical Biker Leather Jacket",
      category: "outerwear",
      subcategory: "Leather-style jackets",
      image_url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "Supple full-grain calfskin moto jacket with matte gunmetal zippers.",
      price: 15999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Streetwear / Edgy",
      occasion_tag: "Party",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-out-trench-coat",
      name: "Double-Breasted Honey Gabardine Trench",
      category: "outerwear",
      subcategory: "Trench coats",
      image_url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80",
      color: "Honey Tan",
      description: "Water-repellent weatherproof cotton gabardine trench coat with storm flap and buckled belt.",
      price: 18999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Timeless / Editorial",
      occasion_tag: "Formal",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-out-cashmere-overcoat",
      name: "Tailored Charcoal Cashmere Overcoat",
      category: "outerwear",
      subcategory: "Overcoats",
      image_url: "https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80",
      color: "Charcoal Grey",
      description: "Knee-length structured overcoat in virgin wool and cashmere blend with notched lapels.",
      price: 22999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Luxury-inspired",
      occasion_tag: "Formal",
      is_vto_compatible: 1,
      vto_category: "full_body"
    },
    {
      id: "garm-w1-navy-blazer",
      name: "Midnight Navy Peak-Lapel Blazer",
      category: "outerwear",
      subcategory: "Blazers",
      image_url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
      color: "Navy Blue",
      description: "Tailored Italian wool peak-lapel blazer with cobalt interior contrast lining.",
      price: 14999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Formal / Modern & Elegant",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-w1-bandhgala",
      name: "Imperial Cobalt Velvet Bandhgala",
      category: "outerwear",
      subcategory: "Blazers",
      image_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80",
      color: "Cobalt Blue",
      description: "Structured Nehru-collar bandhgala jacket with hand-carved brass buttons.",
      price: 18500,
      currency: "INR",
      gender_target: "male",
      style_tag: "Traditional / Luxury-inspired",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },
    {
      id: "garm-p1-velvet-tux",
      name: "Royal Cobalt Velvet Dinner Jacket",
      category: "outerwear",
      subcategory: "Jackets",
      image_url: "https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=800&q=80",
      color: "Electric Cobalt",
      description: "Showstopping shawl-collar dinner jacket in rich plush velvet.",
      price: 19999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Luxury-inspired / Formal",
      occasion_tag: "Party",
      is_vto_compatible: 1,
      vto_category: "upper_body"
    },

    // ==========================================
    // 5. FOOTWEAR
    // ==========================================
    {
      id: "garm-foot-white-sneakers",
      name: "Minimalist Leather Low-Top Court Sneakers",
      category: "footwear",
      subcategory: "Sneakers",
      image_url: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80",
      color: "White",
      description: "Full-grain Italian nappa leather court sneakers with stitched Margom rubber soles.",
      price: 7999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Minimal / Casual",
      occasion_tag: "Casual",
      is_vto_compatible: 1,
      vto_category: "shoes"
    },
    {
      id: "garm-foot-penny-loafers",
      name: "Hand-Burnished Cognac Calfskin Penny Loafers",
      category: "footwear",
      subcategory: "Loafers",
      image_url: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=800&q=80",
      color: "Cognac Brown",
      description: "Goodyear-welted apron-toe penny loafers in vegetable-tanned French calfskin.",
      price: 9999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Smart Casual",
      occasion_tag: "Formal",
      is_vto_compatible: 1,
      vto_category: "shoes"
    },
    {
      id: "garm-foot-captoe-oxfords",
      name: "Black Polished Calfskin Cap-Toe Oxfords",
      category: "footwear",
      subcategory: "Formal shoes",
      image_url: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "Closed-lacing formal black cap-toe shoes with hand-painted leather soles.",
      price: 11999,
      currency: "INR",
      gender_target: "male",
      style_tag: "Formal",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "shoes"
    },
    {
      id: "garm-foot-patent-heels",
      name: "Nude Patent Pointed-Toe Stiletto Pumps",
      category: "footwear",
      subcategory: "Heels",
      image_url: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80",
      color: "Nude / Blush",
      description: "90mm architectural stiletto heel with sculpted arch and glossy mirror finish.",
      price: 8999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Party",
      is_vto_compatible: 1,
      vto_category: "shoes"
    },
    {
      id: "garm-foot-chelsea-boots",
      name: "Espresso Suede Blake-Stitched Chelsea Boots",
      category: "footwear",
      subcategory: "Boots",
      image_url: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=800&q=80",
      color: "Espresso Brown",
      description: "Snuff suede ankle boots with tonal elastic gussets and pull tabs.",
      price: 10999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Minimal / Casual",
      occasion_tag: "Date night",
      is_vto_compatible: 1,
      vto_category: "shoes"
    },
    {
      id: "garm-foot-strappy-sandals",
      name: "Metallic Gold Strappy Block-Heel Sandals",
      category: "footwear",
      subcategory: "Sandals",
      image_url: "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?auto=format&fit=crop&w=800&q=80",
      color: "Gold",
      description: "Barely-there metallic leather tubular straps with supportive block heel.",
      price: 6999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Party",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 1,
      vto_category: "shoes"
    },

    // ==========================================
    // 6. ACCESSORIES (Marked is_vto_compatible: 0)
    // ==========================================
    {
      id: "garm-acc-heritage-watch",
      name: "Heritage Chronograph Automatic Steel Watch",
      category: "accessories",
      subcategory: "Watches",
      image_url: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80",
      color: "Silver / Steel",
      description: "39mm brushed stainless steel chronograph with sapphire crystal and exhibition caseback.",
      price: 18999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Luxury-inspired",
      occasion_tag: "Formal",
      is_vto_compatible: 0,
      vto_category: "accessory"
    },
    {
      id: "garm-acc-leather-belt",
      name: "Full-Grain Italian Calfskin Dress Belt",
      category: "accessories",
      subcategory: "Belts",
      image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
      color: "Dark Brown",
      description: "32mm feathered edge dress belt with solid brushed brass pin buckle.",
      price: 2999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Classic",
      occasion_tag: "Formal",
      is_vto_compatible: 0,
      vto_category: "accessory"
    },
    {
      id: "garm-acc-leather-duffel",
      name: "Obsidian Full-Grain Leather Weekender Duffel",
      category: "accessories",
      subcategory: "Bags",
      image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
      color: "Black",
      description: "Handcrafted weekend travel duffel with reinforced base studs and padded shoulder strap.",
      price: 14999,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Luxury-inspired",
      occasion_tag: "Vacation",
      is_vto_compatible: 0,
      vto_category: "accessory"
    },
    {
      id: "garm-acc-white-minaudiere",
      name: "Structured Architectural Cylinder Minaudière",
      category: "accessories",
      subcategory: "Handbags",
      image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
      color: "Pearl White",
      description: "Rigid resin micro cylinder evening bag with silver chain crossbody strap.",
      price: 8499,
      currency: "INR",
      gender_target: "female",
      style_tag: "Modern & Elegant",
      occasion_tag: "Wedding guest",
      is_vto_compatible: 0,
      vto_category: "accessory"
    },
    {
      id: "garm-acc-silk-scarf",
      name: "Featherlight Silk Modal Ombré Scarf",
      category: "accessories",
      subcategory: "Scarves",
      image_url: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=800&q=80",
      color: "Dove Grey / Silver",
      description: "Ethereal semi-sheer mulberry silk blend wrap with hand-rolled hems.",
      price: 3499,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Minimal",
      occasion_tag: "Formal",
      is_vto_compatible: 0,
      vto_category: "accessory"
    },
    {
      id: "garm-acc-gold-choker",
      name: "Sculptural 18k Gold-Plated Chunky Choker",
      category: "accessories",
      subcategory: "Jewelry",
      image_url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
      color: "Gold",
      description: "Heavy polished organic ribbon collar necklace in recycled brass with 18k gold plating.",
      price: 4999,
      currency: "INR",
      gender_target: "female",
      style_tag: "Experimental / Party",
      occasion_tag: "Party",
      is_vto_compatible: 0,
      vto_category: "accessory"
    },
    {
      id: "garm-acc-hex-sunglasses",
      name: "Hexagonal Wireframe Acetate Sunglasses",
      category: "accessories",
      subcategory: "Sunglasses",
      image_url: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80",
      color: "Tortoiseshell",
      description: "Italian Mazzucchelli acetate sunglasses with category 3 UV400 amber tint lenses.",
      price: 5499,
      currency: "INR",
      gender_target: "unisex",
      style_tag: "Streetwear",
      occasion_tag: "Vacation",
      is_vto_compatible: 0,
      vto_category: "accessory"
    }
  ];

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO garments (
      id, name, category, subcategory, image_url, color, description, price, currency,
      gender_target, style_tag, occasion_tag, is_demo, is_vto_compatible, vto_category
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const item of seedItems) {
    stmt.run(
      item.id,
      item.name,
      item.category,
      item.subcategory || item.category,
      item.image_url,
      item.color,
      item.description,
      item.price,
      item.currency,
      item.gender_target,
      item.style_tag,
      item.occasion_tag,
      item.is_vto_compatible ?? 1,
      item.vto_category || "upper_body"
    );
  }
}

