/**
 * LookMates — Occasion-Aware AI Styling Engine
 * Delivers structured complementary outfit recommendations for two people.
 */

export interface StylingRequest {
  occasion: string;
  stylePreferences: string;
  combinedBudget: number;
  currency: string;
  preferredColors?: string;
  excludedColors?: string;
  venue?: string;
  weatherOrSeason?: string;
  dressCode?: string;
  person1Preference?: string;
  person2Preference?: string;
  lockedItems?: Record<string, string>; // e.g. { person1_top: "Navy Blazer" }
}export interface RecommendedOutfitItem {
  id: string;
  name: string;
  category: "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "accessories";
  color: string;
  description: string;
  estimatedPrice: number;
  isLocked?: boolean;
  garmentId?: string;
  imageUrl?: string;
}

export interface StylingRecommendation {
  id: string;
  title: string;
  occasionSummary: string;
  coordinationRationale: string;
  colorPalette: string[];
  person1Outfit: {
    title: string;
    items: RecommendedOutfitItem[];
    stylingTips: string;
  };
  person2Outfit: {
    title: string;
    items: RecommendedOutfitItem[];
    stylingTips: string;
  };
  budgetBreakdown: {
    person1Total: number;
    person2Total: number;
    combinedTotal: number;
    currency: string;
  };
}

export class StylingEngine {
  public static async generateRecommendations(req: StylingRequest): Promise<StylingRecommendation[]> {
    // If GEMINI_API_KEY is available, we could query the Gemini API with structured JSON schema
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim() !== "") {
      try {
        const aiResult = await this.callGeminiStylist(req, geminiKey);
        if (aiResult && aiResult.length > 0) return aiResult;
      } catch (e) {
        console.warn("[StylingEngine] Gemini API call failed, falling back to SmartMatch rules:", e);
      }
    }

    return this.generateSmartMatchCombinations(req);
  }

  private static async callGeminiStylist(req: StylingRequest, apiKey: string): Promise<StylingRecommendation[] | null> {
    const prompt = `
You are LookMates Master AI Stylist. Generate 2 distinct, highly coordinated outfit combinations for a couple attending this event.
Occasion: ${req.occasion}
Style: ${req.stylePreferences}
Combined Budget: ${req.combinedBudget} ${req.currency}
Colors preferred: ${req.preferredColors || "Harmonious palette"}
Colors to avoid: ${req.excludedColors || "None"}
Dress code: ${req.dressCode || "Not specified"}
Person 1 preference: ${req.person1Preference || "Coordinated"}
Person 2 preference: ${req.person2Preference || "Complementary"}

Return ONLY a JSON array with 2 objects conforming to:
[
  {
    "id": "rec-1",
    "title": "Look title",
    "occasionSummary": "Short summary",
    "coordinationRationale": "Why these 2 outfits complement each other without looking like twins",
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "person1Outfit": {
      "title": "Person 1 Look",
      "items": [
        {"id": "p1-1", "name": "...", "category": "outerwear|tops|bottoms|dresses|shoes|accessories", "color": "...", "description": "...", "estimatedPrice": 1000}
      ],
      "stylingTips": "..."
    },
    "person2Outfit": {
      "title": "Person 2 Look",
      "items": [
        {"id": "p2-1", "name": "...", "category": "outerwear|tops|bottoms|dresses|shoes|accessories", "color": "...", "description": "...", "estimatedPrice": 1000}
      ],
      "stylingTips": "..."
    },
    "budgetBreakdown": {
      "person1Total": 500,
      "person2Total": 500,
      "combinedTotal": 1000,
      "currency": "${req.currency}"
    }
  }
]
`;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!res.ok) return null;
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  }

  private static generateSmartMatchCombinations(req: StylingRequest): StylingRecommendation[] {
    const isINR = req.currency === "INR";
    const budget = req.combinedBudget || (isINR ? 25000 : 350);
    const p1Budget = Math.round(budget * 0.48);
    const p2Budget = Math.round(budget * 0.52);
    const occ = req.occasion.toLowerCase();

    if (occ.includes("wedding")) {
      return [
        {
          id: `rec-wedding-cobalt-cream`,
          title: "The Regal Complement: Midnight Cobalt & Champagne Ivory",
          occasionSummary: `Tailored for formal wedding guest attendance with opulent yet balanced color resonance.`,
          coordinationRationale: `Person 1 wears a structured Midnight Navy blazer paired with crisp cream trousers, while Person 2 wears a flowing Champagne Ivory gown with sapphire accent jewels. They share the cobalt blue harmonic thread without wearing matching uniforms.`,
          colorPalette: ["#0D47D9", "#F7F9FC", "#D4AF37", "#111827"],
          person1Outfit: {
            title: "Midnight Peak-Lapel Tailored Ensemble",
            items: [
              {
                id: "p1-blazer",
                garmentId: "garm-w1-navy-blazer",
                name: req.lockedItems?.["p1-blazer"] || "Midnight Navy Peak-Lapel Blazer",
                category: "outerwear",
                color: "Midnight Navy",
                description: "Structured wool blazer with cobalt interior accents.",
                imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.55),
                isLocked: !!req.lockedItems?.["p1-blazer"]
              },
              {
                id: "p1-trousers",
                garmentId: "garm-bot-straight-trousers",
                name: req.lockedItems?.["p1-trousers"] || "Cream Tailored Pleated Trousers",
                category: "bottoms",
                color: "Cream / Ivory",
                description: "Straight-cut twill trousers with sharp pleats.",
                imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.3),
                isLocked: !!req.lockedItems?.["p1-trousers"]
              },
              {
                id: "p1-shoes",
                garmentId: "garm-sho-leather-loafers",
                name: "Burnished Espresso Oxford Loafers",
                category: "shoes",
                color: "Espresso Brown",
                description: "Hand-finished leather slip-on loafers.",
                imageUrl: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.15)
              }
            ],
            stylingTips: "Keep pocket square in crisp cream silk to echo Person 2's ivory gown."
          },
          person2Outfit: {
            title: "Champagne Ivory & Sapphire Draped Gown",
            items: [
              {
                id: "p2-dress",
                garmentId: "garm-w2-ivory-gown",
                name: req.lockedItems?.["p2-dress"] || "Champagne Ivory Organza Silhouette",
                category: "dresses",
                color: "Champagne Ivory",
                description: "Flowing floor-length silhouette with delicate sequined embroidery.",
                imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.65),
                isLocked: !!req.lockedItems?.["p2-dress"]
              },
              {
                id: "p2-acc",
                garmentId: "garm-acc-leather-handbag",
                name: "Sapphire Teardrop Earrings & Clutch",
                category: "accessories",
                color: "Cobalt Sapphire",
                description: "Jewelry accents echoing Person 1's navy blazer.",
                imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.2)
              },
              {
                id: "p2-heels",
                garmentId: "garm-sho-stiletto-heels",
                name: "Metallic Champagne Ankle-Strap Stilettos",
                category: "shoes",
                color: "Champagne Gold",
                description: "Sleek stiletto heels in soft metallic sheen.",
                imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.15)
              }
            ],
            stylingTips: "The sapphire accessories create the visual bridge with Person 1."
          },
          budgetBreakdown: {
            person1Total: p1Budget,
            person2Total: p2Budget,
            combinedTotal: budget,
            currency: req.currency
          }
        },
        {
          id: `rec-wedding-emerald-gold`,
          title: "Emerald Elegance & Obsidian Contrast",
          occasionSummary: `Dramatic high-contrast formal aesthetic suited for evening wedding receptions.`,
          coordinationRationale: `Person 1 wears a sharp Obsidian Black Bandhgala or Dinner Jacket with antique gold trim, complementing Person 2's rich Emerald Green satin column gown.`,
          colorPalette: ["#080B10", "#059669", "#D97706", "#F3F4F6"],
          person1Outfit: {
            title: "Obsidian Black Formal Suiting",
            items: [
              {
                id: "p1-tux",
                garmentId: "garm-out-leather-blazer",
                name: req.lockedItems?.["p1-tux"] || "Obsidian Black Tailored Blazer",
                category: "outerwear",
                color: "Obsidian Black",
                description: "Tailored plush jacket with micro gold piping.",
                imageUrl: "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.6),
                isLocked: !!req.lockedItems?.["p1-tux"]
              },
              {
                id: "p1-chinos",
                garmentId: "garm-bot-formal-trousers",
                name: "Slim Obsidian Dress Trousers",
                category: "bottoms",
                color: "Black",
                description: "Tapered dress trousers in super-120s wool.",
                imageUrl: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.4)
              }
            ],
            stylingTips: "A subtle emerald boutonniere creates an effortless couple connection."
          },
          person2Outfit: {
            title: "Lustrous Emerald Velvet Evening Gown",
            items: [
              {
                id: "p2-gown",
                garmentId: "garm-dre-velvet-evening",
                name: req.lockedItems?.["p2-gown"] || "Emerald Green Velvet Evening Dress",
                category: "dresses",
                color: "Emerald Green",
                description: "Architectural cowl-neck gown with side slit.",
                imageUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.7),
                isLocked: !!req.lockedItems?.["p2-gown"]
              },
              {
                id: "p2-wrap",
                garmentId: "garm-acc-gold-necklace",
                name: "Gold Leaf Chandelier Earrings & Minaudière",
                category: "accessories",
                color: "Gold",
                description: "Reflective accessories that harmonize with black velvet.",
                imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.3)
              }
            ],
            stylingTips: "Sleek updo hairstyle to highlight the gown neckline."
          },
          budgetBreakdown: {
            person1Total: p1Budget,
            person2Total: p2Budget,
            combinedTotal: budget,
            currency: req.currency
          }
        }
      ];
    } else if (occ.includes("date")) {
      return [
        {
          id: `rec-date-merlot-noir`,
          title: "Intimate Modernism: Deep Merlot & Pitch Black",
          occasionSummary: "Understated, sleek date-night pairing with complementary textures.",
          coordinationRationale: "Person 1 wears a tailored charcoal jacket over a matte black oxford, while Person 2 wears a flowing Noir Asymmetrical midi dress paired with subtle merlot lipstick and bag.",
          colorPalette: ["#101318", "#7F1D1D", "#4B5563", "#F9FAFB"],
          person1Outfit: {
            title: "Charcoal Minimalist Silhouette",
            items: [
              {
                id: "p1-coat",
                garmentId: "garm-out-bomber-jacket",
                name: "Charcoal Minimalist Bomber Jacket",
                category: "outerwear",
                color: "Charcoal Grey",
                description: "Clean zip jacket in textured wool blend.",
                imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.6)
              },
              {
                id: "p1-shirt",
                garmentId: "garm-d1-black-oxford",
                name: "Pitch Black Mercerized Cotton Oxford",
                category: "tops",
                color: "Black",
                description: "Subtle sheen tailored shirt.",
                imageUrl: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p1Budget * 0.4)
              }
            ],
            stylingTips: "Leave the jacket lightly unzipped to show the black texture contrast."
          },
          person2Outfit: {
            title: "Noir Silk Charmeuse Bias-Cut Slip Dress",
            items: [
              {
                id: "p2-slip",
                garmentId: "garm-dre-slip-dress",
                name: "Noir Silk Charmeuse Bias-Cut Slip Dress",
                category: "dresses",
                color: "Black",
                description: "Sleek fluid dress with modern geometric neckline.",
                imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.7)
              },
              {
                id: "p2-bag",
                garmentId: "garm-acc-leather-handbag",
                name: "Deep Merlot Leather Crossbody Bag",
                category: "accessories",
                color: "Merlot / Wine",
                description: "Rich pop of color breaking the monochrome palette.",
                imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
                estimatedPrice: Math.round(p2Budget * 0.3)
              }
            ],
            stylingTips: "Pair with delicate silver or titanium jewelry."
          },
          budgetBreakdown: {
            person1Total: p1Budget,
            person2Total: p2Budget,
            combinedTotal: budget,
            currency: req.currency
          }
        }
      ];
    }

    // Default / General Occasions (Festival, Party, Vacation, Casual, Custom)
    return [
      {
        id: `rec-gen-azure-monochrome`,
        title: "Electric Cobalt & Architectural Monochrome",
        occasionSummary: `Curated for ${req.occasion} with vibrant modern contrast and clean silhouettes.`,
        coordinationRationale: `Person 1 wears a structured cobalt blue statement piece grounded by black, while Person 2 balances with a coordinated cobalt or crisp monochromatic counterpart.`,
        colorPalette: ["#1764FF", "#080B10", "#FFFFFF", "#667085"],
        person1Outfit: {
          title: "Person 1 Modern Coordinated Look",
          items: [
            {
              id: "p1-item-1",
              garmentId: "garm-w1-navy-blazer",
              name: "Electric Cobalt Structured Blazer",
              category: "outerwear",
              color: "Cobalt Blue",
              description: "Sharp contemporary tailoring with electric cobalt dye.",
              imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80",
              estimatedPrice: Math.round(p1Budget * 0.6)
            },
            {
              id: "p1-item-2",
              garmentId: "garm-bot-straight-trousers",
              name: "Monochrome Tapered Trousers",
              category: "bottoms",
              color: "Black",
              description: "High-comfort stretch twill trousers.",
              imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80",
              estimatedPrice: Math.round(p1Budget * 0.4)
            }
          ],
          stylingTips: "Roll cuffs slightly for a modern streetwear edge."
        },
        person2Outfit: {
          title: "Person 2 Coordinated Statement Ensemble",
          items: [
            {
              id: "p2-item-1",
              garmentId: "garm-dre-cocktail-dress",
              name: "Architectural Cutout Midi Cocktail Dress",
              category: "dresses",
              color: "Electric Blue / Black",
              description: "Modern fluid dress with cobalt contrast paneling.",
              imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80",
              estimatedPrice: Math.round(p2Budget * 0.7)
            },
            {
              id: "p2-item-2",
              garmentId: "garm-acc-leather-handbag",
              name: "Geometric Lucite & Silver Handbag",
              category: "accessories",
              color: "Silver",
              description: "Minimalist neo-brutalist accessory.",
              imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
              estimatedPrice: Math.round(p2Budget * 0.3)
            }
          ],
          stylingTips: "Clean lines to match the structured geometry of Person 1."
        },
        budgetBreakdown: {
          person1Total: p1Budget,
          person2Total: p2Budget,
          combinedTotal: budget,
          currency: req.currency
        }
      }
    ];
  }
}
