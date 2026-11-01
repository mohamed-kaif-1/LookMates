"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { CoupleComposer, type BackgroundType } from "@/components/CoupleComposer";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Upload,
  Check,
  RefreshCw,
  AlertCircle,
  Lock,
  Unlock,
  Download,
  BookOpen,
  Search,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  SlidersHorizontal,
  CheckCircle,
  Layers,
  Palette,
  Heart,
  Award,
  Flame,
  PartyPopper,
  Briefcase,
  Coffee,
  Palmtree
} from "lucide-react";

const OCCASION_CARDS = [
  { id: "Wedding", label: "Wedding", subtitle: "Ceremony, Reception, Gala", icon: Heart },
  { id: "Formal Event", label: "Formal Event", subtitle: "Black Tie, Charity, Red Carpet", icon: Award },
  { id: "Date Night", label: "Date Night", subtitle: "Dinner, Rooftop, Cocktails", icon: Flame },
  { id: "Party", label: "Party", subtitle: "Cocktail, Celebration, Festival", icon: PartyPopper },
  { id: "Business", label: "Business", subtitle: "Corporate, Summit, Networking", icon: Briefcase },
  { id: "Casual", label: "Casual", subtitle: "Day Outing, Cafe, Weekend", icon: Coffee },
  { id: "Vacation", label: "Vacation", subtitle: "Resort, Beach, Travel", icon: Palmtree },
  { id: "Other", label: "Other", subtitle: "Custom Event or Theme", icon: Sparkles }
];

import { OutfitBuilder, type OutfitSelectionsMap, type SelectedGarmentItem } from "@/components/OutfitBuilder";
import { SelectedGarmentsSummary } from "@/components/SelectedGarmentsSummary";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import {
  GarmentCategory,
  PrimaryCategoryId,
  getCategoryDef,
  getPrimaryCategoryForSubtype,
  type CategoryProvenanceRecord
} from "@/lib/categories";
import { detectCategoryConflicts } from "@/lib/garmentLayers";
import { DEMO_MODELS, type DemoModel } from "@/lib/demoModels";

interface Participant {
  id: string;
  role: "person1" | "person2";
  displayName: string;
  photoData?: string;
}

interface Garment {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  image_url: string;
  color: string;
  description: string;
  price: number | null;
  currency: string;
  gender_target: string;
  style_tag: string;
  occasion_tag: string;
  is_demo: number;
  is_vto_compatible?: number;
  vto_category?: string;
  fabric?: string;
  culture_tag?: string;
}

interface TryOnJob {
  id: string;
  session_id: string;
  participant_id: string;
  garment_id: string;
  status: "queued" | "submitting" | "processing" | "succeeded" | "failed" | "partially_completed";
  result_image_url?: string;
  error_message?: string;
  role?: string;
  display_name?: string;
  garment_name?: string;
  garment_image?: string;
  selected_categories?: string;
  processed_categories?: string;
  unsupported_categories?: string;
  intermediate_results?: string;
  garment_data?: string;
  category_provenance?: string;
  metrics?: string;
}

interface RecommendationItem {
  id: string;
  name: string;
  category: string;
  color: string;
  description: string;
  estimatedPrice: number;
  isLocked?: boolean;
  garmentId?: string;
  imageUrl?: string;
}

interface Recommendation {
  id: string;
  title: string;
  occasionSummary: string;
  coordinationRationale: string;
  colorPalette: string[];
  person1Outfit: {
    title: string;
    items: RecommendationItem[];
    stylingTips: string;
  };
  person2Outfit: {
    title: string;
    items: RecommendationItem[];
    stylingTips: string;
  };
  budgetBreakdown: {
    person1Total: number;
    person2Total: number;
    combinedTotal: number;
    currency: string;
  };
}

export default function DuoMatchPage() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Progressive Disclosure for Occasion Form
  const [showAdvancedPreferences, setShowAdvancedPreferences] = useState(false);

  // Form State (Phase 3)
  const [occasion, setOccasion] = useState("Wedding");
  const [customOccasion, setCustomOccasion] = useState("");
  const [stylePreference, setStylePreference] = useState("Modern & elegant");
  const [combinedBudget, setCombinedBudget] = useState(25000);
  const [currency, setCurrency] = useState("INR");
  const [preferredColors, setPreferredColors] = useState("Navy Blue, Cream, Gold");
  const [excludedColors, setExcludedColors] = useState("");
  const [venue, setVenue] = useState("Outdoor Garden Pavilion");
  const [weatherOrSeason, setWeatherOrSeason] = useState("Autumn Evening");
  const [dressCode, setDressCode] = useState("Formal / Semi-Formal");
  const [person1Preference, setPerson1Preference] = useState("Tailored, structured jacket");
  const [person2Preference, setPerson2Preference] = useState("Flowing dress or lehenga");
  const [notes, setNotes] = useState("Coordinated wedding guest look without identical matching.");

  // Participants & Photos (Phase 4)
  const [participants, setParticipants] = useState<{
    person1: Participant | null;
    person2: Participant | null;
  }>({ person1: null, person2: null });

  const [person1Photo, setPerson1Photo] = useState<string | null>(null);
  const [person2Photo, setPerson2Photo] = useState<string | null>(null);
  const [showModelPickerModal, setShowModelPickerModal] = useState(false);
  const [modelPickerFilter, setModelPickerFilter] = useState<"all" | "indian" | "western" | "fusion">("all");

  // Optional Reference Couple Photo for Composition Guidance
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null);

  // Styling Recommendations (Phase 5)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecIndex, setSelectedRecIndex] = useState(0);
  const [lockedItems, setLockedItems] = useState<Record<string, string>>({});

  // Phase 3: Locked Recommendation State
  const [lockedRecommendationId, setLockedRecommendationId] = useState<string | null>(null);
  const [lockedRecommendationData, setLockedRecommendationData] = useState<Recommendation | null>(null);
  const [isRecommendationModified, setIsRecommendationModified] = useState(false);

  // Garments & Catalogue (Phase 6)
  const [catalogue, setCatalogue] = useState<Garment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [selectedColor, setSelectedColor] = useState("all");
  const [selectedOccasion, setSelectedOccasion] = useState("all");
  const [priceSort, setPriceSort] = useState<"default" | "price_asc" | "price_desc" | "name_asc">("default");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [assignedGarments, setAssignedGarments] = useState<Record<string, Garment[]>>({
    person1: [],
    person2: []
  });

  // Independent Multi-Category Outfit Builder State
  const [activePersonTab, setActivePersonTab] = useState<"person1" | "person2">("person1");
  const [person1OutfitSelections, setPerson1OutfitSelections] = useState<OutfitSelectionsMap>({});
  const [person2OutfitSelections, setPerson2OutfitSelections] = useState<OutfitSelectionsMap>({});
  const [highlightCategory, setHighlightCategory] = useState<PrimaryCategoryId | null>(null);

  // Custom Garment Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [customGarmentName, setCustomGarmentName] = useState("");
  const [customGarmentCat, setCustomGarmentCat] = useState("tops");
  const [customGarmentImg, setCustomGarmentImg] = useState("");
  const [customGarmentColor, setCustomGarmentColor] = useState("");

  // Try-On Jobs (Phase 7)
  const [tryOnJobs, setTryOnJobs] = useState<TryOnJob[]>([]);
  const [pollingActive, setPollingActive] = useState(false);

  // Phase 1: Background Studio State (Phase 8 & 9)
  const [backgroundSetting, setBackgroundSetting] = useState<BackgroundType>("transparent");
  const [customColorHex, setCustomColorHex] = useState("#1764FF");
  const [customBackgroundImage, setCustomBackgroundImage] = useState<string | null>(null);
  const [composedImageData, setComposedImageData] = useState<string | null>(null);
  const [savedLookSuccess, setSavedLookSuccess] = useState(false);

  // Hidden File Inputs for Photos
  const p1FileRef = useRef<HTMLInputElement | null>(null);
  const p2FileRef = useRef<HTMLInputElement | null>(null);
  const refFileRef = useRef<HTMLInputElement | null>(null);

  // Dynamic Stepper definition reflecting 7-step workflow
  const STEPS = [
    { id: "occasion", label: "Occasion" },
    { id: "photos", label: "Photos" },
    { id: "styling", label: "Styling" },
    {
      id: "garments",
      label: lockedRecommendationId && !isRecommendationModified ? "Garments (Direct)" : "Garments",
      isSkipped: !!lockedRecommendationId && !isRecommendationModified
    },
    { id: "couple", label: "Generate Couple" },
    { id: "compare", label: "Compare" },
    { id: "save", label: "Save" },
  ];

  // Escape key listener for Full-Body Model Picker Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModelPickerModal) {
        setShowModelPickerModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModelPickerModal]);

  // Load Session Data
  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/sessions/${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.session) return;

      const s = data.session;
      if (s.occasion) setOccasion(s.occasion);
      if (s.style_preferences) setStylePreference(s.style_preferences);
      if (s.combined_budget) setCombinedBudget(s.combined_budget);
      if (s.currency) setCurrency(s.currency);
      if (s.preferred_colors) setPreferredColors(s.preferred_colors);
      if (s.venue) setVenue(s.venue);
      if (s.reference_photo_data) setReferencePhoto(s.reference_photo_data);

      if (s.locked_recommendation_id) {
        setLockedRecommendationId(s.locked_recommendation_id);
        if (s.locked_recommendation_data) {
          try {
            setLockedRecommendationData(JSON.parse(s.locked_recommendation_data));
          } catch {}
        }
      }
      if (s.background_setting) setBackgroundSetting(s.background_setting as BackgroundType);
      if (s.custom_color_hex) setCustomColorHex(s.custom_color_hex);
      if (s.custom_background_image) setCustomBackgroundImage(s.custom_background_image);

      interface SessionParticipantData {
        id: string;
        role: string;
        display_name: string;
        photo_data?: string;
      }

      interface SessionAssignmentData {
        garment_id: string;
        garment_name: string;
        category: string;
        category_key?: string;
        image_url: string;
        color?: string;
        price: number | null;
        role: string;
      }

      if (data.participants && Array.isArray(data.participants)) {
        const p1 = (data.participants as SessionParticipantData[]).find((p) => p.role === "person1");
        const p2 = (data.participants as SessionParticipantData[]).find((p) => p.role === "person2");
        setParticipants({
          person1: p1 ? { id: p1.id, role: "person1", displayName: p1.display_name, photoData: p1.photo_data } : null,
          person2: p2 ? { id: p2.id, role: "person2", displayName: p2.display_name, photoData: p2.photo_data } : null
        });
        if (p1?.photo_data) setPerson1Photo(p1.photo_data);
        if (p2?.photo_data) setPerson2Photo(p2.photo_data);
      }

      if (data.assignments && Array.isArray(data.assignments) && data.assignments.length > 0) {
        const typedAssignments = data.assignments as SessionAssignmentData[];
        const p1Assignments = typedAssignments.filter((a) => a.role === "person1");
        const p2Assignments = typedAssignments.filter((a) => a.role === "person2");
        if (p1Assignments.length > 0 || p2Assignments.length > 0) {
          setAssignedGarments({
            person1: p1Assignments.map((a) => ({
              id: a.garment_id,
              name: a.garment_name,
              category: a.category,
              image_url: a.image_url,
              color: a.color || "",
              description: "",
              price: a.price,
              currency: s.currency || "INR",
              gender_target: "unisex",
              style_tag: "",
              occasion_tag: "",
              is_demo: 0
            })),
            person2: p2Assignments.map((a) => ({
              id: a.garment_id,
              name: a.garment_name,
              category: a.category,
              image_url: a.image_url,
              color: a.color || "",
              description: "",
              price: a.price,
              currency: s.currency || "INR",
              gender_target: "unisex",
              style_tag: "",
              occasion_tag: "",
              is_demo: 0
            }))
          });

          // Sync into minimal 6-category outfit builder maps
          const p1Map: OutfitSelectionsMap = {};
          p1Assignments.forEach((a) => {
            const subtype = (a.category_key || a.category || "shirt") as GarmentCategory;
            const primary = getPrimaryCategoryForSubtype(subtype);
            p1Map[primary] = {
              primaryCategory: primary,
              subtype: subtype,
              imageUrl: a.image_url,
              name: a.garment_name,
              color: a.color,
              price: a.price,
              currency: s.currency || "INR",
              garmentId: a.garment_id,
              source: "catalogue"
            };
          });
          setPerson1OutfitSelections(p1Map);

          const p2Map: OutfitSelectionsMap = {};
          p2Assignments.forEach((a) => {
            const subtype = (a.category_key || a.category || "dress") as GarmentCategory;
            const primary = getPrimaryCategoryForSubtype(subtype);
            p2Map[primary] = {
              primaryCategory: primary,
              subtype: subtype,
              imageUrl: a.image_url,
              name: a.garment_name,
              color: a.color,
              price: a.price,
              currency: s.currency || "INR",
              garmentId: a.garment_id,
              source: "catalogue"
            };
          });
          setPerson2OutfitSelections(p2Map);
        }
      }

      if (data.tryonJobs && Array.isArray(data.tryonJobs) && data.tryonJobs.length > 0) {
        setTryOnJobs(data.tryonJobs);
      }
    } catch (e) {
      console.warn("Failed to load session:", e);
    }
  }, []);

  // Load Garment Catalogue on Mount & restore active session
  useEffect(() => {
    fetchCatalogue();
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSid = urlParams.get("sessionId");
      const urlStep = urlParams.get("step");
      const savedSid = urlSid || sessionStorage.getItem("lookmates_session_id");
      if (savedSid) {
        try {
          sessionStorage.setItem("lookmates_session_id", savedSid);
        } catch {}
        setTimeout(() => {
          setSessionId(savedSid);
          loadSession(savedSid);
          if (urlStep !== null) {
            const stepNum = parseInt(urlStep, 10);
            if (!isNaN(stepNum) && stepNum >= 0 && stepNum <= 6) {
              setCurrentStepIndex(stepNum);
            }
          }
        }, 0);
      }
    }
  }, [loadSession]);

  async function fetchCatalogue() {
    try {
      const res = await fetch("/api/garments");
      if (res.ok) {
        const data = await res.json();
        setCatalogue(data.garments || []);
      }
    } catch (e) {
      console.error("Failed to load catalogue:", e);
    }
  }

  // -------------------------------------------------------------
  // Step 1: Create Session
  // -------------------------------------------------------------
  async function handleCreateSession() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const finalOccasion = (occasion === "Other" && customOccasion.trim()) ? customOccasion.trim() : occasion;

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: finalOccasion,
          stylePreferences: stylePreference,
          combinedBudget: combinedBudget || 25000,
          currency: currency || "USD",
          preferredColors,
          excludedColors,
          venue,
          weatherOrSeason,
          dressCode,
          person1Preference,
          person2Preference,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      setSessionId(data.sessionId);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("lookmates_session_id", data.sessionId);
      }
      setParticipants({
        person1: data.participants.person1,
        person2: data.participants.person2
      });

      setCurrentStepIndex(1); // Move to Photos
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // Step 2: Upload Participant Photos
  // -------------------------------------------------------------
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>, role: "person1" | "person2") {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPEG, WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Image file exceeds 10MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (role === "person1") setPerson1Photo(base64);
      else setPerson2Photo(base64);

      if (sessionId) {
        try {
          const participantId = role === "person1" ? participants.person1?.id : participants.person2?.id;
          await fetch(`/api/sessions/${sessionId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              participantId,
              role,
              photoData: base64
            })
          });
        } catch (err) {
          console.error("Error saving photo to server:", err);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  function assignDemoModel(model: DemoModel, role: "person1" | "person2") {
    if (role === "person1") {
      setPerson1Photo(model.imageUrl);
      if (sessionId) {
        fetch(`/api/sessions/${sessionId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "person1", photoData: model.imageUrl })
        });
      }
    } else {
      setPerson2Photo(model.imageUrl);
      if (sessionId) {
        fetch(`/api/sessions/${sessionId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "person2", photoData: model.imageUrl })
        });
      }
    }
  }

  function loadDemoCouplePreset(preset: "indian_wedding" | "festive" | "western" | "fusion") {
    let p1Img = "/models/model_female_saree.jpg"; // Ananya — Kanjivaram Silk Saree
    let p2Img = "/models/model_male_sherwani.jpg"; // Kabir — Royal Wedding Sherwani

    if (preset === "festive") {
      p1Img = "/models/model_female_lehenga.jpg"; // Diya — Heritage Bridal Lehenga
      p2Img = "/models/model_male_kurta.jpg"; // Rohan — Raw Silk Kurta Pajama
    } else if (preset === "western") {
      p1Img = "/models/model_female_casual.jpg"; // Maya — Modern Fitted Top & Trousers
      p2Img = "/models/model_male_casual.jpg"; // Aarav — Minimalist White Tee & Trousers
    } else if (preset === "fusion") {
      p1Img = "/models/model_female_fusion.jpg"; // Tara — Indo-Western Saree Gown
      p2Img = "/models/model_male_kurta.jpg"; // Rohan — Raw Silk Kurta Pajama
    }

    setPerson1Photo(p1Img);
    setPerson2Photo(p2Img);

    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "person1", photoData: p1Img })
      });
      fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "person2", photoData: p2Img })
      });
    }
  }

  function loadDemoPhotos() {
    loadDemoCouplePreset("indian_wedding");
  }

  function handleReferencePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
      setErrorMessage("Please select a valid image file (PNG, JPEG, WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Reference photo exceeds 10MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setReferencePhoto(base64);

      if (sessionId) {
        try {
          await fetch(`/api/sessions/${sessionId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "reference",
              photoData: base64
            })
          });
        } catch (err) {
          console.error("Error saving reference photo to server:", err);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSetSampleReferencePhoto() {
    const sampleUrl = "/images/sample-reference-couple.png";
    setReferencePhoto(sampleUrl);
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "reference",
          photoData: sampleUrl
        })
      });
    }
  }

  function handleRemoveReferencePhoto() {
    setReferencePhoto(null);
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "reference",
          action: "remove"
        })
      });
    }
  }

  // -------------------------------------------------------------
  // Step 3: Fetch & Regenerate AI Styling Recommendations
  // -------------------------------------------------------------
  async function fetchRecommendations() {
    if (!sessionId) return;
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/sessions/${sessionId}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedItems })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load styling recommendations");

      setRecommendations(data.recommendations || []);
      setSelectedRecIndex(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  function toggleLockItem(key: string, name: string) {
    setLockedItems(prev => {
      const copy = { ...prev };
      if (copy[key]) delete copy[key];
      else copy[key] = name;
      return copy;
    });
  }

  // -------------------------------------------------------------
  // Phase 3: Lock Recommendation & Direct Try-On Flow
  // -------------------------------------------------------------
  async function handleLockRecommendation(rec: Recommendation) {
    if (!sessionId) {
      setErrorMessage("Please complete the setup step first.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      // Match best apparel item for Person 1 & Person 2 (exclude accessories/shoes for primary VTO slot)
      const findBestGarment = (items: RecommendationItem[]): Garment | undefined => {
        const candidates = items.filter(it => it.category !== "accessories" && it.category !== "shoes");
        const priority = ["dresses", "outerwear", "tops", "bottoms"];
        candidates.sort((a, b) => {
          const pa = priority.indexOf(a.category);
          const pb = priority.indexOf(b.category);
          return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
        });

        for (const it of candidates) {
          if (it.garmentId) {
            const found = catalogue.find(g => g.id === it.garmentId);
            if (found && (found.is_vto_compatible === undefined || found.is_vto_compatible === 1)) {
              return found;
            }
          }
          const nameFound = catalogue.find(g => g.name.toLowerCase() === it.name.toLowerCase() && (g.is_vto_compatible === undefined || g.is_vto_compatible === 1));
          if (nameFound) return nameFound;

          const catFound = catalogue.find(g => g.category.toLowerCase() === it.category.toLowerCase() && (g.is_vto_compatible === undefined || g.is_vto_compatible === 1));
          if (catFound) return catFound;
        }

        return catalogue.find(g => g.is_vto_compatible === undefined || g.is_vto_compatible === 1);
      };

      const p1Garment = findBestGarment(rec.person1Outfit.items);
      const p2Garment = findBestGarment(rec.person2Outfit.items);

      if (!p1Garment || !p2Garment) {
        throw new Error("Could not find matching catalogue garments for both participants in this recommendation.");
      }

      const participantId1 = participants.person1?.id;
      const participantId2 = participants.person2?.id;

      if (participantId1) {
        await fetch(`/api/sessions/${sessionId}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: participantId1,
            garmentId: p1Garment.id,
            role: "person1"
          })
        });
      }

      if (participantId2) {
        await fetch(`/api/sessions/${sessionId}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: participantId2,
            garmentId: p2Garment.id,
            role: "person2"
          })
        });
      }

      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockedRecommendationId: rec.id,
          lockedRecommendationData: JSON.stringify(rec)
        })
      });

      setLockedRecommendationId(rec.id);
      setLockedRecommendationData(rec);
      setIsRecommendationModified(false);
      setAssignedGarments({
        person1: [p1Garment],
        person2: [p2Garment]
      });

      setSuccessMessage(`Locked "${rec.title}"! Outfits assigned for both participants. Ready for try-on.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlockRecommendation() {
    if (sessionId) {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockedRecommendationId: null,
          lockedRecommendationData: null
        })
      });
    }
    setLockedRecommendationId(null);
    setLockedRecommendationData(null);
    setIsRecommendationModified(false);
  }

  function handleGenerateTryOnDirect() {
    if (!person1Photo || !person2Photo) {
      setErrorMessage("Both Person 1 and Person 2 photos are required before generating try-on. Please upload photos first.");
      setCurrentStepIndex(1);
      return;
    }

    if (assignedGarments.person1.length === 0 || assignedGarments.person2.length === 0) {
      setErrorMessage("Garment assignments are missing for one or both people.");
      return;
    }

    // Direct bypass of Step 4 (Garments) to Step 5 (Try-On)
    setCurrentStepIndex(4);
    launchTryOn();
  }

  // -------------------------------------------------------------
  // Step 4: Multi-Category Outfit Builder Handlers
  // -------------------------------------------------------------
  const handleUpdateOutfitSelection = (
    role: "person1" | "person2",
    primaryCategory: PrimaryCategoryId,
    item: SelectedGarmentItem | null
  ) => {
    if (role === "person1") {
      setPerson1OutfitSelections((prev) => {
        const next = { ...prev };
        if (item) next[primaryCategory] = item;
        else delete next[primaryCategory];
        return next;
      });
    } else {
      setPerson2OutfitSelections((prev) => {
        const next = { ...prev };
        if (item) next[primaryCategory] = item;
        else delete next[primaryCategory];
        return next;
      });
    }

    // Keep assignedGarments in sync
    setAssignedGarments((prev) => {
      const currentList = prev[role] || [];
      let updatedList: Garment[];
      if (!item) {
        updatedList = currentList.filter(
          (g) => (g as unknown as { primary_category?: string }).primary_category !== primaryCategory
        );
      } else {
        const mappedGarment: Garment = {
          id: item.garmentId || `custom_${item.subtype}_${Date.now()}`,
          name: item.name || getCategoryDef(item.subtype).name,
          category: item.subtype,
          image_url: item.imageUrl,
          color: item.color || "Multi / Custom",
          description: "",
          price: item.price ?? null,
          currency: item.currency || "INR",
          gender_target: "unisex",
          style_tag: "",
          occasion_tag: "",
          is_demo: 0,
          vto_category: getCategoryDef(item.subtype).youCamCategory
        };
        (mappedGarment as unknown as { primary_category?: string }).primary_category = primaryCategory;
        updatedList = [
          ...currentList.filter(
            (g) => (g as unknown as { primary_category?: string }).primary_category !== primaryCategory
          ),
          mappedGarment
        ];
      }
      return { ...prev, [role]: updatedList };
    });

    // Invalidate stale composed couple image and that person's stale try-on job
    setComposedImageData(null);
    setTryOnJobs((prev) =>
      prev.filter((j) => (role === "person1" ? j.participant_id !== participants.person1?.id && j.role !== "person1" : j.participant_id !== participants.person2?.id && j.role !== "person2"))
    );

    if (lockedRecommendationId) {
      setIsRecommendationModified(true);
    }
  };

  const handleClearPersonOutfit = (role: "person1" | "person2") => {
    if (role === "person1") {
      setPerson1OutfitSelections({});
    } else {
      setPerson2OutfitSelections({});
    }
    setAssignedGarments((prev) => ({
      ...prev,
      [role]: []
    }));
    setComposedImageData(null);
    setTryOnJobs((prev) =>
      prev.filter((j) => (role === "person1" ? j.participant_id !== participants.person1?.id && j.role !== "person1" : j.participant_id !== participants.person2?.id && j.role !== "person2"))
    );
  };

  async function handleAssignGarment(garment: Garment, role: "person1" | "person2") {
    if (!sessionId) return;

    try {
      const participantId = role === "person1" ? participants.person1?.id : participants.person2?.id;

      const res = await fetch(`/api/sessions/${sessionId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          garmentId: garment.id,
          role,
          categoryKey: garment.category
        })
      });

      if (res.ok) {
        setAssignedGarments(prev => {
          const currentList = prev[role] || [];
          const exists = currentList.some(g => g.id === garment.id);
          let updatedList;
          if (exists) {
            updatedList = currentList.filter(g => g.id !== garment.id);
          } else {
            updatedList = [...currentList.filter(g => g.category !== garment.category), garment];
          }
          return { ...prev, [role]: updatedList };
        });

        if (lockedRecommendationId) {
          setIsRecommendationModified(true);
        }
      }
    } catch (err) {
      console.error("Assignment error:", err);
    }
  }

  async function handleCustomGarmentUpload() {
    if (!customGarmentName || !customGarmentImg) {
      setErrorMessage("Name and image URL/data are required.");
      return;
    }
    try {
      const res = await fetch("/api/garments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customGarmentName,
          category: customGarmentCat,
          imageUrl: customGarmentImg,
          color: customGarmentColor || "Custom",
          currency
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCatalogue(prev => [data.garment, ...prev]);
        setShowUploadModal(false);
        setCustomGarmentName("");
        setCustomGarmentImg("");
        setSuccessMessage("Custom garment added to catalogue.");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error creating custom garment:", err);
    }
  }

  // -------------------------------------------------------------
  // Step 5: YouCam Try-On Execution & Status Polling
  // -------------------------------------------------------------
  async function launchTryOn(targetParticipantId?: string) {
    if (!sessionId) return;
    try {
      setLoading(true);
      setErrorMessage(null);

      const p1Items = Object.values(person1OutfitSelections).filter(Boolean);
      const p2Items = Object.values(person2OutfitSelections).filter(Boolean);

      const p1GarmentsPayload = p1Items.length > 0
        ? p1Items.map((item) => ({
            category: item!.subtype,
            imageUrl: item!.imageUrl,
            name: item!.name,
            color: item!.color
          }))
        : (assignedGarments.person1 || []).map((g) => ({
            category: ((g as unknown as { category_key?: string }).category_key || g.category || "shirt") as GarmentCategory,
            imageUrl: g.image_url,
            name: g.name,
            color: g.color
          }));

      const p2GarmentsPayload = p2Items.length > 0
        ? p2Items.map((item) => ({
            category: item!.subtype,
            imageUrl: item!.imageUrl,
            name: item!.name,
            color: item!.color
          }))
        : (assignedGarments.person2 || []).map((g) => ({
            category: ((g as unknown as { category_key?: string }).category_key || g.category || "dress") as GarmentCategory,
            imageUrl: g.image_url,
            name: g.name,
            color: g.color
          }));

      const outfitSelectionsPayload: Record<string, unknown[]> = {};
      if (participants.person1?.id) outfitSelectionsPayload[participants.person1.id] = p1GarmentsPayload;
      if (participants.person2?.id) outfitSelectionsPayload[participants.person2.id] = p2GarmentsPayload;

      const res = await fetch(`/api/sessions/${sessionId}/tryon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetParticipantId,
          outfitSelections: outfitSelectionsPayload
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger try-on");

      setTryOnJobs(data.jobs || []);
      setPollingActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!pollingActive || tryOnJobs.length === 0) return;

    const interval = setInterval(async () => {
      let allDone = true;
      const updatedJobs = [...tryOnJobs];

      for (let i = 0; i < updatedJobs.length; i++) {
        const job = updatedJobs[i];
        if (job.status === "processing" || job.status === "submitting" || job.status === "queued") {
          allDone = false;
          try {
            const res = await fetch(`/api/tryon/${job.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.job) {
                updatedJobs[i] = data.job;
              }
            }
          } catch (e) {
            console.error("Poll error for job:", job.id, e);
          }
        }
      }

      setTryOnJobs(updatedJobs);
      if (allDone) {
        setPollingActive(false);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [pollingActive, tryOnJobs]);

  async function handleRetryJob(jobId: string) {
    if (retryingJobId) return; // Prevent duplicate concurrent submissions
    try {
      setRetryingJobId(jobId);
      setErrorMessage(null);
      const res = await fetch(`/api/tryon/${jobId}/retry`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.job) {
        setTryOnJobs(prev => prev.map(j => j.id === jobId ? data.job : j));
        setPollingActive(true);
        if (data.job.status === "failed") {
          setErrorMessage(data.job.error_message || "Try-on retry failed. Please verify garment selections.");
        }
      } else {
        const errDetail = data.error || `Retry failed with HTTP ${res.status}.`;
        setErrorMessage(errDetail);
        setTryOnJobs(prev =>
          prev.map(j => (j.id === jobId ? { ...j, status: "failed", error_message: errDetail } : j))
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Retry failed:", err);
      setErrorMessage(`Retry failed: ${msg}`);
    } finally {
      setRetryingJobId(null);
    }
  }

  // -------------------------------------------------------------
  // Step 8: Save to Lookbook
  // -------------------------------------------------------------
  async function handleSaveLook() {
    if (!sessionId || !composedImageData) return;
    try {
      setLoading(true);
      const garmentNames = [
        ...assignedGarments.person1.map(g => g.name),
        ...assignedGarments.person2.map(g => g.name)
      ].join(", ") || "Coordinated Couple Outfits";

      const res = await fetch(`/api/sessions/${sessionId}/saved-looks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${occasion} Couple Match`,
          occasion,
          garmentNames,
          coupleImage: composedImageData
        })
      });

      if (res.ok) {
        setSavedLookSuccess(true);
        setSuccessMessage("Look saved successfully to your persistent Lookbook!");
        setTimeout(() => {
          router.push("/lookbook");
        }, 1200);
      }
    } catch (err) {
      console.error("Error saving look:", err);
    } finally {
      setLoading(false);
    }
  }

  function parseCategories(catJson?: string): GarmentCategory[] {
    if (!catJson) return [];
    try {
      const parsed = JSON.parse(catJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseProvenance(provJson?: string): CategoryProvenanceRecord[] {
    if (!provJson) return [];
    try {
      const parsed = JSON.parse(provJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Get try-on jobs and result images strictly separated from source photos (NEVER assign original photo as result fallback)
  const p1Job = tryOnJobs.find(j => j.participant_id === participants.person1?.id || j.role === "person1");
  const p2Job = tryOnJobs.find(j => j.participant_id === participants.person2?.id || j.role === "person2");

  const person1Result = (p1Job && p1Job.status !== "failed" && p1Job.result_image_url) ? p1Job.result_image_url : null;
  const person2Result = (p2Job && p2Job.status !== "failed" && p2Job.result_image_url) ? p2Job.result_image_url : null;

  const p1SelectedCats = Object.values(person1OutfitSelections).map((item) => item.subtype);
  const p2SelectedCats = Object.values(person2OutfitSelections).map((item) => item.subtype);

  const person1GarmentName =
    p1SelectedCats.length > 0
      ? p1SelectedCats.map((c) => getCategoryDef(c).name).join(", ")
      : assignedGarments.person1.map(g => g.name).join(", ") || "Person 1 Look";

  const person2GarmentName =
    p2SelectedCats.length > 0
      ? p2SelectedCats.map((c) => getCategoryDef(c).name).join(", ")
      : assignedGarments.person2.map(g => g.name).join(", ") || "Person 2 Look";

  return (
    <div className="min-h-screen flex flex-col grid-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ========================================================= */}
        {/* STEPPER HEADER                                            */}
        {/* ========================================================= */}
        <div className="bg-white border-2 border-[#111827] rounded-[4px] p-4 shadow-[3px_3px_0px_#080B10]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#DCE3EF]">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1.5 bg-[#1764FF] inline-block rounded-[1px]"></span>
              <span className="text-[11px] font-mono font-bold tracking-wider text-[#1764FF] uppercase">
                DUOMATCH WORKFLOW
              </span>
              <span className="text-xs font-mono text-[#647084]">
                {sessionId ? `• ${sessionId}` : "• Setup"}
              </span>
            </div>
            <span className="text-xs font-mono text-[#080B10]">
              Step <strong>0{currentStepIndex + 1}</strong> of <strong>0{STEPS.length}</strong>:{" "}
              <span className="text-[#1764FF] font-bold">{STEPS[currentStepIndex].label.toUpperCase()}</span>
            </span>
          </div>

          {/* Stepper Buttons (7 Steps) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {STEPS.map((s, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (idx <= currentStepIndex || (sessionId && idx <= currentStepIndex + 1)) {
                      setCurrentStepIndex(idx);
                    }
                  }}
                  disabled={!sessionId && idx > 0}
                  className={`p-2 text-left border rounded-[2px] text-xs font-mono transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#1764FF] text-white border-[#111827] font-bold shadow-[2px_2px_0px_#080B10]"
                      : isCompleted
                      ? "bg-white text-[#080B10] border-[#111827] hover:bg-[#F7F9FC]"
                      : "bg-[#F7F9FC] text-[#647084] border-[#DCE3EF] opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold">0{idx + 1}</span>
                    {isCompleted && <Check className="w-3 h-3 text-[#16803C] stroke-[3]" />}
                  </div>
                  <div className="truncate font-sans font-bold text-[11px]">
                    {s.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="p-3 bg-[#FEE2E2] border-2 border-[#DC2626] text-[#DC2626] font-mono text-xs flex items-center justify-between rounded-[4px] shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-[#DCFCE7] border-2 border-[#16803C] text-[#16803C] font-mono text-xs flex items-center justify-between rounded-[4px] shadow-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* STEP 1: OCCASION ONLY (NO BUDGET / NO DRESS PRICES)       */}
        {/* ========================================================= */}
        {currentStepIndex === 0 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="pb-4 border-b-2 border-[#111827]">
              <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                STEP 1 • OCCASION SETUP
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                Select Your Occasion
              </h2>
              <p className="text-xs text-[#647084] mt-0.5">
                Choose the occasion for your couple look. LookMates will coordinate your outfits and curate matching AI backgrounds.
              </p>
            </div>

            <div className="space-y-6">
              {/* Clean Clickable Occasion Cards (8 Curated Options) */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-2.5">
                  Select Event *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {OCCASION_CARDS.map((item) => {
                    const isSelected = occasion === item.id || (item.id === "Other" && (occasion === "Other" || !OCCASION_CARDS.some(c => c.id === occasion)));
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setOccasion(item.id);
                          if (item.id !== "Other") setCustomOccasion("");
                          setComposedImageData(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOccasion(item.id);
                            if (item.id !== "Other") setCustomOccasion("");
                            setComposedImageData(null);
                          }
                        }}
                        className={`relative p-3.5 rounded-[3px] border-2 text-left cursor-pointer transition-all flex flex-col justify-between min-h-[105px] group ${
                          isSelected
                            ? "border-[#1764FF] bg-[#EFF6FF] shadow-[2px_2px_0px_#1764FF]"
                            : "border-[#DCE3EF] bg-white hover:border-[#111827] hover:bg-[#F7F9FC]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className={`p-2 rounded-[2px] border ${
                            isSelected
                              ? "bg-[#1764FF] text-white border-[#1764FF]"
                              : "bg-[#F7F9FC] text-[#080B10] border-[#111827] group-hover:border-[#1764FF]"
                          }`}>
                            <IconComponent className="w-4 h-4" />
                          </div>

                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#1764FF] text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <h4 className="text-xs font-black text-[#080B10] uppercase tracking-wide">
                            {item.label}
                          </h4>
                          <p className="text-[10px] text-[#647084] font-mono line-clamp-1 mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Occasion Input if "Other" is chosen */}
              {(occasion === "Other" || !OCCASION_CARDS.slice(0, 7).some(c => c.id === occasion)) && (
                <div className="p-4 border border-[#1764FF] bg-[#EFF6FF] rounded-[3px] space-y-2 animate-fadeIn">
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase">
                    Custom Occasion Details
                  </label>
                  <input
                    type="text"
                    value={customOccasion}
                    onChange={(e) => setCustomOccasion(e.target.value)}
                    placeholder="e.g. 10th Anniversary Sunset Yacht Party, Winter Ski Chalet"
                    className="lm-input !bg-white"
                  />
                  <span className="text-[11px] text-[#647084] block font-mono">
                    Describe your unique event to help tailor outfits and scene backgrounds.
                  </span>
                </div>
              )}

              {/* Styling Aesthetic Selection */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1.5">
                  Styling Aesthetic *
                </label>
                <select
                  value={stylePreference}
                  onChange={(e) => setStylePreference(e.target.value)}
                  className="lm-input"
                >
                  <option value="Modern & elegant">Modern & elegant</option>
                  <option value="Minimal">Minimal</option>
                  <option value="Traditional">Traditional / Ethnic</option>
                  <option value="Luxury-inspired">Luxury-inspired</option>
                  <option value="Streetwear">Streetwear</option>
                  <option value="Formal">Formal / Black Tie</option>
                  <option value="Casual">Casual</option>
                  <option value="Experimental">Experimental</option>
                </select>
              </div>

              {/* Progressive Disclosure Toggle for Optional Details */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPreferences(!showAdvancedPreferences)}
                  className="flex items-center gap-2 text-xs font-mono font-bold text-[#1764FF] hover:text-[#0D47D9] py-1 cursor-pointer"
                >
                  {showAdvancedPreferences ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{showAdvancedPreferences ? "Hide Additional Notes" : "+ Show Additional Notes (Colors, Venue, Individual Preferences)"}</span>
                </button>
              </div>

              {/* Advanced Preferences Panel */}
              {showAdvancedPreferences && (
                <div className="space-y-4 p-4 border border-[#DCE3EF] bg-[#F7F9FC] rounded-[4px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                        Preferred Colors
                      </label>
                      <input
                        type="text"
                        value={preferredColors}
                        onChange={(e) => setPreferredColors(e.target.value)}
                        placeholder="e.g. Navy Blue, Cream, Gold"
                        className="lm-input !bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                        Colors to Avoid
                      </label>
                      <input
                        type="text"
                        value={excludedColors}
                        onChange={(e) => setExcludedColors(e.target.value)}
                        placeholder="e.g. Neon Green, Pure Orange"
                        className="lm-input !bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                        Venue Type / Location
                      </label>
                      <input
                        type="text"
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder="e.g. Grand Ballroom, Beach Resort"
                        className="lm-input !bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                        Weather / Season
                      </label>
                      <input
                        type="text"
                        value={weatherOrSeason}
                        onChange={(e) => setWeatherOrSeason(e.target.value)}
                        placeholder="e.g. Autumn Evening, Mild Summer"
                        className="lm-input !bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                        Person 1 Notes
                      </label>
                      <input
                        type="text"
                        value={person1Preference}
                        onChange={(e) => setPerson1Preference(e.target.value)}
                        placeholder="e.g. Structured blazer"
                        className="lm-input !text-xs !bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                        Person 2 Notes
                      </label>
                      <input
                        type="text"
                        value={person2Preference}
                        onChange={(e) => setPerson2Preference(e.target.value)}
                        placeholder="e.g. Flowing gown"
                        className="lm-input !text-xs !bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t-2 border-[#111827] flex justify-end">
              <button
                onClick={handleCreateSession}
                disabled={loading}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
              >
                <span>{loading ? "Creating Session..." : "Continue to Photo Uploads"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: TWO INDIVIDUAL PHOTO UPLOADS (PHASE 4)             */}
        {/* ========================================================= */}
        {currentStepIndex === 1 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
              <div>
                <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                  STEP 2 • PHOTO UPLOADS
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                  Upload Photos for Both People
                </h2>
                <p className="text-xs text-[#647084] mt-0.5">
                  Upload full-body portraits (head to feet with visible shoes and garment hem) or select from our verified studio demo models.
                </p>
              </div>

              {/* Demo Presets Bar */}
              <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => loadDemoCouplePreset("indian_wedding")}
                  className="lm-btn-secondary !py-1.5 !px-3 !text-[11px] font-mono font-bold flex items-center gap-1 shadow-sm"
                  title="Load full-body Indian wedding couple (Saree & Sherwani)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>Saree &amp; Sherwani</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoCouplePreset("festive")}
                  className="lm-btn-secondary !py-1.5 !px-3 !text-[11px] font-mono font-bold flex items-center gap-1 shadow-sm"
                  title="Load full-body festive Indian couple (Lehenga & Kurta)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#059669]" />
                  <span>Lehenga &amp; Kurta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModelPickerModal(true)}
                  className="lm-btn-primary !py-1.5 !px-3 !text-[11px] font-mono font-bold flex items-center gap-1 shadow-sm"
                  title="Browse all 8 verified full-body models"
                >
                  <span>Browse 8 Models</span>
                </button>
              </div>
            </div>

            {/* Two Equal Full-Body Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
              {/* Person 1 Card */}
              <div className="border-2 border-[#111827] rounded-[4px] p-5 bg-[#F7F9FC] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#DCE3EF]">
                    <span className="text-xs font-mono font-black text-[#080B10] uppercase">
                      CARD A: PERSON 1 PHOTO
                    </span>
                    {person1Photo && (
                      <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px]">
                        ✓ Full-Body Photo Ready
                      </span>
                    )}
                  </div>

                  {person1Photo ? (
                    <div className="relative aspect-[2/3] max-h-[480px] w-full bg-[#080B10] border-2 border-[#111827] rounded-[2px] overflow-hidden mb-3 flex items-center justify-center p-1 shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={person1Photo}
                        alt="Person 1 Full-Body Portrait"
                        className="w-full h-full object-contain object-center"
                      />
                      <div className="absolute bottom-2 left-2 pointer-events-none">
                        <span className="bg-[#080B10]/85 text-white text-[9px] font-mono px-2 py-0.5 rounded-[1px] border border-white/20">
                          Full-Body Silhouette • Head to Feet Visible
                        </span>
                      </div>
                      <button
                        onClick={() => setPerson1Photo(null)}
                        className="absolute top-2 right-2 p-1.5 bg-[#DC2626] text-white border border-[#111827] rounded-[2px] cursor-pointer shadow-sm hover:scale-105"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => p1FileRef.current?.click()}
                      className="aspect-[2/3] max-h-[480px] border-2 border-dashed border-[#111827] bg-white rounded-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-[#EAF1FF] transition-colors mb-3 group"
                    >
                      <Upload className="w-8 h-8 text-[#1764FF] mb-2 group-hover:-translate-y-1 transition-transform" />
                      <p className="font-bold text-xs text-[#080B10]">Upload Person 1 Photo</p>
                      <p className="text-[11px] text-[#647084] mt-0.5">Click to browse or drop full-body image</p>
                      <span className="text-[9px] font-mono text-[#647084] mt-2 px-2 py-0.5 bg-[#F0F4F8] border border-[#DCE3EF]">
                        2:3 Aspect Ratio Preferred • PNG, JPG up to 10MB
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowModelPickerModal(true);
                        }}
                        className="mt-3 lm-btn-secondary !py-1 !px-2.5 !text-[11px] font-mono font-bold flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#1764FF]" />
                        <span>Or Pick a Demo Model</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={p1FileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoSelect(e, "person1")}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#647084] font-mono pt-2 border-t border-[#DCE3EF]">
                  <span>Participant: {participants.person1?.displayName || "Person 1"}</span>
                  <button
                    type="button"
                    onClick={() => setShowModelPickerModal(true)}
                    className="text-[#1764FF] hover:underline font-bold"
                  >
                    Change Model
                  </button>
                </div>
              </div>

              {/* Person 2 Card */}
              <div className="border-2 border-[#111827] rounded-[4px] p-5 bg-[#F7F9FC] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#DCE3EF]">
                    <span className="text-xs font-mono font-black text-[#080B10] uppercase">
                      CARD B: PERSON 2 PHOTO
                    </span>
                    {person2Photo && (
                      <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px]">
                        ✓ Full-Body Photo Ready
                      </span>
                    )}
                  </div>

                  {person2Photo ? (
                    <div className="relative aspect-[2/3] max-h-[480px] w-full bg-[#080B10] border-2 border-[#111827] rounded-[2px] overflow-hidden mb-3 flex items-center justify-center p-1 shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={person2Photo}
                        alt="Person 2 Full-Body Portrait"
                        className="w-full h-full object-contain object-center"
                      />
                      <div className="absolute bottom-2 left-2 pointer-events-none">
                        <span className="bg-[#080B10]/85 text-white text-[9px] font-mono px-2 py-0.5 rounded-[1px] border border-white/20">
                          Full-Body Silhouette • Head to Feet Visible
                        </span>
                      </div>
                      <button
                        onClick={() => setPerson2Photo(null)}
                        className="absolute top-2 right-2 p-1.5 bg-[#DC2626] text-white border border-[#111827] rounded-[2px] cursor-pointer shadow-sm hover:scale-105"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => p2FileRef.current?.click()}
                      className="aspect-[2/3] max-h-[480px] border-2 border-dashed border-[#111827] bg-white rounded-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-[#EAF1FF] transition-colors mb-3 group"
                    >
                      <Upload className="w-8 h-8 text-[#1764FF] mb-2 group-hover:-translate-y-1 transition-transform" />
                      <p className="font-bold text-xs text-[#080B10]">Upload Person 2 Photo</p>
                      <p className="text-[11px] text-[#647084] mt-0.5">Click to browse or drop full-body image</p>
                      <span className="text-[9px] font-mono text-[#647084] mt-2 px-2 py-0.5 bg-[#F0F4F8] border border-[#DCE3EF]">
                        2:3 Aspect Ratio Preferred • PNG, JPG up to 10MB
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowModelPickerModal(true);
                        }}
                        className="mt-3 lm-btn-secondary !py-1 !px-2.5 !text-[11px] font-mono font-bold flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#1764FF]" />
                        <span>Or Pick a Demo Model</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={p2FileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoSelect(e, "person2")}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#647084] font-mono pt-2 border-t border-[#DCE3EF]">
                  <span>Participant: {participants.person2?.displayName || "Person 2"}</span>
                  <button
                    type="button"
                    onClick={() => setShowModelPickerModal(true)}
                    className="text-[#1764FF] hover:underline font-bold"
                  >
                    Change Model
                  </button>
                </div>
              </div>
            </div>

            {/* FULL-BODY DEMO MODEL PICKER MODAL */}
            {showModelPickerModal && (
              <div
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setShowModelPickerModal(false)}
              >
                <div
                  className="relative max-w-5xl w-full bg-white border-2 border-[#111827] rounded-[4px] p-5 shadow-2xl flex flex-col max-h-[92vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b-2 border-[#111827]">
                    <div>
                      <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase">
                        VERIFIED STUDIO MODELS
                      </span>
                      <h3 className="text-xl font-black text-[#080B10] tracking-tight mt-1">
                        Select a Full-Body Portrait Model
                      </h3>
                      <p className="text-xs text-[#647084]">
                        Head, hairstyle, arms, complete outfit silhouette, knees, and footwear are 100% visible with natural studio margins.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowModelPickerModal(false)}
                      className="w-8 h-8 bg-white border border-[#111827] rounded-[2px] flex items-center justify-center font-bold text-sm hover:bg-[#080B10] hover:text-white transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Filter Tabs */}
                  <div className="py-2.5 flex items-center gap-2 border-b border-[#DCE3EF] flex-wrap">
                    <button
                      type="button"
                      onClick={() => setModelPickerFilter("all")}
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-[2px] border cursor-pointer ${
                        modelPickerFilter === "all"
                          ? "bg-[#111827] text-white border-[#111827]"
                          : "bg-white text-[#111827] border-[#DCE3EF] hover:border-[#111827]"
                      }`}
                    >
                      All Models (8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelPickerFilter("indian")}
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-[2px] border cursor-pointer ${
                        modelPickerFilter === "indian"
                          ? "bg-[#D97706] text-white border-[#B45309]"
                          : "bg-white text-[#B45309] border-[#FDE68A] hover:border-[#D97706]"
                      }`}
                    >
                      Indian Traditional (4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelPickerFilter("western")}
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-[2px] border cursor-pointer ${
                        modelPickerFilter === "western"
                          ? "bg-[#1764FF] text-white border-[#1764FF]"
                          : "bg-white text-[#111827] border-[#DCE3EF] hover:border-[#1764FF]"
                      }`}
                    >
                      Western Attire (2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelPickerFilter("fusion")}
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-[2px] border cursor-pointer ${
                        modelPickerFilter === "fusion"
                          ? "bg-[#059669] text-white border-[#047857]"
                          : "bg-white text-[#047857] border-[#A7F3D0] hover:border-[#059669]"
                      }`}
                    >
                      Indo-Western Fusion (2)
                    </button>
                  </div>

                  {/* Models Grid */}
                  <div className="overflow-y-auto py-3 max-h-[60vh] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {DEMO_MODELS.filter((m) =>
                      modelPickerFilter === "all" ? true : m.culture === modelPickerFilter
                    ).map((model) => (
                      <div
                        key={model.id}
                        className="border-2 border-[#111827] rounded-[4px] p-2.5 bg-[#F7F9FC] flex flex-col justify-between hover:border-[#1764FF] transition-all"
                      >
                        <div>
                          <div className="relative aspect-[2/3] max-h-[300px] w-full bg-[#080B10] border border-[#111827] rounded-[2px] overflow-hidden mb-2 flex items-center justify-center p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={model.imageUrl}
                              alt={model.name}
                              className="w-full h-full object-contain object-center"
                            />
                            <div className="absolute top-1.5 left-1.5">
                              <span
                                className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-[1px] uppercase text-white ${
                                  model.culture === "indian"
                                    ? "bg-[#B45309]"
                                    : model.culture === "fusion"
                                    ? "bg-[#047857]"
                                    : "bg-[#1764FF]"
                                }`}
                              >
                                {model.culture}
                              </span>
                            </div>
                            <div className="absolute bottom-1.5 left-1.5">
                              <span className="bg-black/80 text-white text-[8px] font-mono px-1 py-0.2 rounded-[1px]">
                                {model.gender.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div className="text-[10px] font-mono space-y-0.5">
                            <p className="font-bold text-[#080B10] text-xs truncate">{model.name}</p>
                            <p className="text-[#1764FF] font-bold">{model.style}</p>
                            <p className="text-[#647084] text-[9px] line-clamp-2 leading-tight">
                              {model.clothingDescription}
                            </p>
                          </div>
                        </div>

                        {/* Assign Buttons */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2 mt-2 border-t border-[#DCE3EF]">
                          <button
                            type="button"
                            onClick={() => {
                              assignDemoModel(model, "person1");
                              setShowModelPickerModal(false);
                            }}
                            className="py-1.5 bg-[#1764FF] hover:bg-[#1250CC] text-white font-mono font-bold text-[10px] rounded-[2px] transition-colors text-center cursor-pointer shadow-sm"
                          >
                            For Person 1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              assignDemoModel(model, "person2");
                              setShowModelPickerModal(false);
                            }}
                            className="py-1.5 bg-[#080B10] hover:bg-[#111827] text-white font-mono font-bold text-[10px] rounded-[2px] transition-colors text-center cursor-pointer shadow-sm"
                          >
                            For Person 2
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-[#DCE3EF] flex items-center justify-between text-xs font-mono text-[#647084]">
                    <span>Press ESC or click ✕ to dismiss.</span>
                    <button
                      type="button"
                      onClick={() => setShowModelPickerModal(false)}
                      className="lm-btn-secondary !py-1 !px-4 text-xs font-mono"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* OPTIONAL REFERENCE COUPLE PHOTO PANEL */}
            <div className="border-2 border-[#111827] rounded-[4px] p-5 bg-[#F7F9FC] shadow-[2px_2px_0px_#080B10] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EF]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#1764FF] text-white text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase">
                      COMPOSITION GUIDE
                    </span>
                    <span className="border border-[#111827] bg-white text-[#080B10] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                      OPTIONAL
                    </span>
                  </div>
                  <h3 className="text-base font-black text-[#080B10] tracking-tight">
                    Reference Couple Photo
                  </h3>
                  <p className="text-xs text-[#647084]">
                    Upload a couple photo to guide the composition of your final portrait.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!referencePhoto ? (
                    <button
                      type="button"
                      onClick={handleSetSampleReferencePhoto}
                      className="lm-btn-secondary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#1764FF]" />
                      <span>Use Sample Reference Photo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRemoveReferencePhoto}
                      className="text-xs font-mono font-bold text-[#DC2626] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Reference</span>
                    </button>
                  )}
                </div>
              </div>

              {referencePhoto ? (
                <div className="p-3 bg-white border border-[#111827] rounded-[2px] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-[2px] overflow-hidden border border-[#111827] bg-[#F7F9FC] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={referencePhoto} alt="Reference Preview" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] inline-block mb-1">
                        ✓ Reference Photo Ready
                      </span>
                      <p className="text-xs font-bold text-[#080B10]">
                        Composition Guide Active
                      </p>
                      <p className="text-[11px] text-[#647084] font-mono mt-0.5">
                        Guides final portrait background color, aspect framing, and stance spacing.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => refFileRef.current?.click()}
                      className="lm-btn-secondary !py-1.5 !px-3 text-xs font-bold cursor-pointer"
                    >
                      Replace Image
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveReferencePhoto}
                      className="p-2 border border-[#DC2626] text-[#DC2626] rounded-[2px] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      title="Remove reference"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => refFileRef.current?.click()}
                  className="border-2 border-dashed border-[#111827] bg-white rounded-[2px] p-5 text-center cursor-pointer hover:bg-[#EAF1FF] transition-colors group"
                >
                  <Upload className="w-6 h-6 text-[#1764FF] mx-auto mb-1.5 group-hover:-translate-y-0.5 transition-transform" />
                  <p className="font-bold text-xs text-[#080B10]">Upload Reference Couple Photo</p>
                  <p className="text-[11px] text-[#647084] mt-0.5">
                    Click to browse JPG, JPEG, PNG, or WebP (up to 10MB)
                  </p>
                  <span className="text-[9px] font-mono text-[#647084] mt-2 inline-block px-2 py-0.5 bg-[#F0F4F8] border border-[#DCE3EF]">
                    Guides stance & backdrop styling • Does not replace participant photos or try-on results
                  </span>
                </div>
              )}

              <input
                ref={refFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleReferencePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between">
              <button
                onClick={() => setCurrentStepIndex(0)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Occasion</span>
              </button>

              <button
                onClick={() => {
                  setCurrentStepIndex(2);
                  fetchRecommendations();
                }}
                disabled={!person1Photo || !person2Photo}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
              >
                <span>Continue to AI Styling</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: OCCASION-AWARE AI STYLING (PHASE 5)                */}
        {/* ========================================================= */}
        {currentStepIndex === 2 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
              <div>
                <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                  STEP 3 • AI STYLING ENGINE
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                  Occasion-Aware Recommendations
                </h2>
                <p className="text-xs text-[#647084] mt-0.5">
                  Curated outfit pairing for {occasion}.
                </p>
              </div>

              <button
                onClick={fetchRecommendations}
                disabled={loading}
                className="lm-btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#080B10]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Regenerate Outfits</span>
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center space-y-3">
                <div className="inline-block w-8 h-8 border-4 border-[#1764FF] border-t-transparent rounded-full animate-spin"></div>
                <p className="font-mono text-xs font-bold text-[#080B10]">Consulting LookMates AI Stylist...</p>
                <p className="font-mono text-[11px] text-[#647084]">Evaluating palette balance and complementary silhouettes</p>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="space-y-6">
                {/* Combination Selector Tabs */}
                {recommendations.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {recommendations.map((rec, i) => (
                      <button
                        key={rec.id}
                        onClick={() => setSelectedRecIndex(i)}
                        className={`px-3.5 py-1.5 text-xs font-mono font-bold border rounded-[2px] cursor-pointer whitespace-nowrap transition-all ${
                          selectedRecIndex === i
                            ? "bg-[#080B10] text-white border-[#080B10] shadow-[2px_2px_0px_#1764FF]"
                            : "bg-white text-[#080B10] border-[#111827] hover:bg-[#F7F9FC]"
                        }`}
                      >
                        Option 0{i + 1}: {rec.title.split(":")[0]}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Recommendation Details */}
                {recommendations[selectedRecIndex] && (() => {
                  const currentRec = recommendations[selectedRecIndex];
                  const isRecLocked = lockedRecommendationId === currentRec.id;

                  return (
                    <div className="space-y-5">
                      {/* Recommendation Header & Lock Button */}
                      <div className="p-4 bg-white border-2 border-[#111827] rounded-[4px] shadow-[2px_2px_0px_#080B10] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase bg-[#1764FF] text-white">
                              OPTION 0{selectedRecIndex + 1}
                            </span>
                            {isRecLocked && (
                              <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase flex items-center gap-1">
                                <CheckCircle className="w-2.5 h-2.5" />
                                <span>Locked Outfit</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-[#080B10]">
                            {currentRec.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          {isRecLocked ? (
                            <button
                              type="button"
                              onClick={handleUnlockRecommendation}
                              className="text-xs font-mono font-bold text-[#DC2626] hover:bg-[#FEE2E2] border border-[#DC2626] px-3 py-1.5 rounded-[2px] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Unlock Outfit</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLockRecommendation(currentRec)}
                              disabled={loading}
                              className="lm-btn-primary !py-2 !px-4 text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_#080B10] cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Lock This Recommendation</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PHASE 3: LOCKED RECOMMENDATION DIRECT ACTION CARD */}
                      {isRecLocked && (
                        <div className="p-4 bg-[#EFF6FF] border-2 border-[#1764FF] rounded-[4px] space-y-3 shadow-[2px_2px_0px_#1764FF] animate-fadeIn">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#BFDBFE] pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#16803C] animate-pulse"></span>
                              <span className="font-mono text-xs font-bold text-[#0D47D9] uppercase">
                                Direct Try-On Flow Active • Garment Assignment Complete
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-[#647084]">
                              {assignedGarments.person1[0]?.name} & {assignedGarments.person2[0]?.name}
                            </span>
                          </div>

                          <p className="text-xs text-[#080B10] font-medium leading-relaxed">
                            This recommendation has coordinated apparel pre-assigned for both participants. You can skip manual garment browsing and launch virtual try-on directly, or customize garments if you wish to adjust selections.
                          </p>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={handleGenerateTryOnDirect}
                              className="lm-btn-primary !py-2.5 !px-6 text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_#080B10] cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4 text-white" />
                              <span>⚡ Generate Couple Try-On</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setCurrentStepIndex(3)}
                              className="lm-btn-secondary !py-2.5 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-[#1764FF]" />
                              <span>Customize Garments</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Rationale Banner */}
                      <div className="p-4 bg-[#EAF1FF] border-2 border-[#1764FF] rounded-[4px] text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-[#0D47D9] uppercase text-[10px]">
                            COORDINATION RATIONALE
                          </span>
                          <div className="flex items-center gap-1.5">
                            {currentRec.colorPalette.map((hex, ci) => (
                              <span
                                key={ci}
                                style={{ backgroundColor: hex }}
                                className="w-4 h-4 rounded-full border border-[#111827] inline-block shadow-sm"
                                title={hex}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-[#080B10] font-medium leading-relaxed">
                          {currentRec.coordinationRationale}
                        </p>
                      </div>

                      {/* Outfits Side-by-Side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Person 1 Box */}
                        <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10]">
                          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#DCE3EF]">
                            <span className="text-xs font-mono font-bold text-[#080B10] uppercase">
                              PERSON 1 OUTFIT
                            </span>
                            <span className="bg-[#080B10] text-white text-[9px] font-mono px-2 py-0.5 rounded-[2px]">
                              {currentRec.person1Outfit.title}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {currentRec.person1Outfit.items.map(item => (
                              <div
                                key={item.id}
                                className="p-2.5 bg-[#F7F9FC] border border-[#111827] rounded-[2px] flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {item.imageUrl && (
                                    <div className="w-10 h-10 rounded-[2px] border border-[#111827] overflow-hidden bg-white shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover object-top" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs text-[#080B10] truncate">{item.name}</p>
                                    <p className="text-[10px] text-[#647084] line-clamp-1">{item.description}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleLockItem(item.id, item.name)}
                                  className={`p-1.5 border border-[#111827] rounded-[2px] cursor-pointer transition-colors shrink-0 ${
                                    lockedItems[item.id]
                                      ? "bg-[#1764FF] text-white"
                                      : "bg-white text-[#647084] hover:text-[#080B10]"
                                  }`}
                                  title={lockedItems[item.id] ? "Item Locked" : "Lock Item for Regeneration"}
                                >
                                  {lockedItems[item.id] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>

                          <p className="text-[11px] text-[#647084] italic mt-3 pt-2 border-t border-[#DCE3EF]">
                            Stylist tip: {currentRec.person1Outfit.stylingTips}
                          </p>
                        </div>

                        {/* Person 2 Box */}
                        <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10]">
                          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#DCE3EF]">
                            <span className="text-xs font-mono font-bold text-[#080B10] uppercase">
                              PERSON 2 OUTFIT
                            </span>
                            <span className="bg-[#1764FF] text-white text-[9px] font-mono px-2 py-0.5 rounded-[2px]">
                              {currentRec.person2Outfit.title}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {currentRec.person2Outfit.items.map(item => (
                              <div
                                key={item.id}
                                className="p-2.5 bg-[#F7F9FC] border border-[#111827] rounded-[2px] flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {item.imageUrl && (
                                    <div className="w-10 h-10 rounded-[2px] border border-[#111827] overflow-hidden bg-white shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover object-top" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs text-[#080B10] truncate">{item.name}</p>
                                    <p className="text-[10px] text-[#647084] line-clamp-1">{item.description}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleLockItem(item.id, item.name)}
                                  className={`p-1.5 border border-[#111827] rounded-[2px] cursor-pointer transition-colors shrink-0 ${
                                    lockedItems[item.id]
                                      ? "bg-[#1764FF] text-white"
                                      : "bg-white text-[#647084] hover:text-[#080B10]"
                                  }`}
                                  title={lockedItems[item.id] ? "Item Locked" : "Lock Item for Regeneration"}
                                >
                                  {lockedItems[item.id] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>

                          <p className="text-[11px] text-[#647084] italic mt-3 pt-2 border-t border-[#DCE3EF]">
                            Stylist tip: {currentRec.person2Outfit.stylingTips}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={() => setCurrentStepIndex(1)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Photos</span>
              </button>

              <div className="flex items-center gap-3">
                {lockedRecommendationId ? (
                  <>
                    <button
                      onClick={() => setCurrentStepIndex(3)}
                      className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#1764FF]" />
                      <span>Customize Garments</span>
                    </button>

                    <button
                      onClick={handleGenerateTryOnDirect}
                      className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>⚡ Generate Couple Try-On</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setCurrentStepIndex(3)}
                    className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
                  >
                    <span>Browse & Assign Garments</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: GARMENT CATALOGUE & ASSIGNMENT (PHASE 6)           */}
        {/* ========================================================= */}
        {currentStepIndex === 3 && (
          <div className="space-y-6">
            {/* Header Card with Unambiguous Person Selector */}
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 shadow-[4px_4px_0px_#080B10] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[#111827]">
                <div>
                  <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                    STEP 4 • MINIMAL 6-CATEGORY OUTFIT BUILDER
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                    Multi-Category Virtual Try-On Studio
                  </h2>
                  <p className="text-xs text-[#647084] mt-0.5">
                    Select what you want to change, leave everything else alone. <strong>Empty categories remain 100% unchanged.</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-[#111827] text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-[2px] uppercase">
                    ISOLATED PERSON PIPELINE
                  </span>
                </div>
              </div>

              {/* Explicit Person Selector Bar: [ PERSON 1 ] [ PERSON 2 ] with thumbnail and active heading */}
              <div className="p-4 bg-[#F7F9FC] border-2 border-[#111827] rounded-[4px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Person Selector Toggle Buttons */}
                  <div className="inline-flex p-1 bg-white border-2 border-[#111827] rounded-[4px] shadow-[2px_2px_0px_#080B10]">
                    <button
                      type="button"
                      onClick={() => setActivePersonTab("person1")}
                      className={`px-4 py-2 font-mono text-xs font-black uppercase rounded-[2px] transition-all cursor-pointer flex items-center gap-2 ${
                        activePersonTab === "person1"
                          ? "bg-[#1764FF] text-white shadow-sm"
                          : "bg-transparent text-[#080B10] hover:bg-[#F0F4F8]"
                      }`}
                    >
                      <span>PERSON 1</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-[2px] font-bold ${
                          activePersonTab === "person1"
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 text-[#080B10]"
                        }`}
                      >
                        {p1SelectedCats.length} items
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePersonTab("person2")}
                      className={`px-4 py-2 font-mono text-xs font-black uppercase rounded-[2px] transition-all cursor-pointer flex items-center gap-2 ${
                        activePersonTab === "person2"
                          ? "bg-[#1764FF] text-white shadow-sm"
                          : "bg-transparent text-[#080B10] hover:bg-[#F0F4F8]"
                      }`}
                    >
                      <span>PERSON 2</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-[2px] font-bold ${
                          activePersonTab === "person2"
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 text-[#080B10]"
                        }`}
                      >
                        {p2SelectedCats.length} items
                      </span>
                    </button>
                  </div>

                  {/* Selected Person Source Thumbnail & Name */}
                  <div className="flex items-center gap-3">
                    <div
                      className="bg-gray-100 border border-[#111827] rounded-[2px] overflow-hidden shrink-0 relative"
                      style={{ width: 44, height: 52, minWidth: 44, minHeight: 52, maxWidth: 44, maxHeight: 52 }}
                    >
                      {activePersonTab === "person1" ? (
                        person1Photo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={person1Photo}
                            alt="Person 1"
                            className="w-full h-full object-cover object-top block"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-gray-400 text-center">
                            No Photo
                          </div>
                        )
                      ) : (
                        person2Photo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={person2Photo}
                            alt="Person 2"
                            className="w-full h-full object-cover object-top block"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-gray-400 text-center">
                            No Photo
                          </div>
                        )
                      )}
                    </div>

                    <div className="text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[#080B10] uppercase">
                          {activePersonTab === "person1"
                            ? participants.person1?.displayName || "Person 1"
                            : participants.person2?.displayName || "Person 2"}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 rounded-[1px] border ${
                            (activePersonTab === "person1" ? person1Photo : person2Photo)
                              ? "bg-[#DCFCE7] text-[#16803C] border-[#16803C]"
                              : "bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]"
                          }`}
                        >
                          {(activePersonTab === "person1" ? person1Photo : person2Photo) ? "Photo Ready" : "Photo Missing"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#647084] mt-0.5">
                        {activePersonTab === "person1"
                          ? `${p1SelectedCats.length} categories selected for Person 1`
                          : `${p2SelectedCats.length} categories selected for Person 2`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Explicit Heading */}
                <div className="border-t md:border-t-0 md:border-l border-[#DCE3EF] pt-2 md:pt-0 md:pl-4">
                  <span className="text-[10px] font-mono font-bold text-[#1764FF] uppercase block">
                    ACTIVE BUILDER
                  </span>
                  <h3 className="text-base font-black text-[#080B10] uppercase tracking-tight">
                    BUILD {activePersonTab === "person1" ? (participants.person1?.displayName || "PERSON 1") : (participants.person2?.displayName || "PERSON 2")}&apos;S OUTFIT
                  </h3>
                </div>
              </div>
            </div>

            {/* Active Person's Minimal 6-Category Outfit Builder */}
            <OutfitBuilder
              personRole={activePersonTab}
              personDisplayName={
                activePersonTab === "person1"
                  ? participants.person1?.displayName || "Person 1"
                  : participants.person2?.displayName || "Person 2"
              }
              selections={activePersonTab === "person1" ? person1OutfitSelections : person2OutfitSelections}
              onUpdateSelection={(category, item) => handleUpdateOutfitSelection(activePersonTab, category, item)}
              onClearAll={() => handleClearPersonOutfit(activePersonTab)}
              catalogueGarments={catalogue}
              highlightCategory={highlightCategory}
            />

            {/* Redesigned Person-Aware Selected Garments Summary */}
            <SelectedGarmentsSummary
              person1Name={participants.person1?.displayName || "Person 1"}
              person2Name={participants.person2?.displayName || "Person 2"}
              person1Photo={person1Photo}
              person2Photo={person2Photo}
              person1Selections={person1OutfitSelections}
              person2Selections={person2OutfitSelections}
              onSelectCategory={(role, category) => {
                setActivePersonTab(role);
                setHighlightCategory(category);
                setTimeout(() => setHighlightCategory(null), 1500);
              }}
              onRemoveSelection={(role, category) => {
                handleUpdateOutfitSelection(role, category, null);
              }}
            />

            {/* Category Conflict Detection & Navigation Footer */}
            {(() => {
              const p1Conflicts = detectCategoryConflicts(p1SelectedCats);
              const p2Conflicts = detectCategoryConflicts(p2SelectedCats);
              const allCritical = [...p1Conflicts, ...p2Conflicts].filter((c) => c.type === "conflict");
              const totalItems = p1SelectedCats.length + p2SelectedCats.length;

              return (
                <div className="space-y-4">
                  {allCritical.length > 0 && (
                    <div className="p-4 bg-[#FEE2E2] border-2 border-[#DC2626] rounded-[4px] space-y-2">
                      <div className="flex items-center gap-2 text-[#DC2626] font-mono font-bold text-xs uppercase">
                        <AlertCircle className="w-4 h-4" />
                        <span>Category Conflict Detected — Please Adjust Selections</span>
                      </div>
                      <div className="space-y-1 text-xs text-[#080B10]">
                        {allCritical.map((c, i) => (
                          <div key={i} className="pl-6 font-mono text-[11px]">
                            • <strong>{c.title}:</strong> {c.message}{" "}
                            <span className="text-[#DC2626] font-bold">({c.recommendation})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {totalItems === 0 && (
                    <div className="p-3 bg-[#FFFBEB] border border-[#F59E0B] rounded-[3px] text-xs font-mono text-[#92400E] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#F59E0B]" />
                      <span>
                        All categories currently empty. Please select at least one garment for Person 1 or Person 2 to launch try-on.
                      </span>
                    </div>
                  )}

                  {/* Navigation Footer */}
                  <div className="bg-white border-2 border-[#111827] rounded-[4px] p-4 flex items-center justify-between shadow-[2px_2px_0px_#080B10]">
                    <button
                      onClick={() => setCurrentStepIndex(2)}
                      className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Styling</span>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentStepIndex(4);
                        launchTryOn();
                      }}
                      disabled={
                        allCritical.length > 0 ||
                        totalItems === 0 ||
                        (p1SelectedCats.length > 0 && !person1Photo) ||
                        (p2SelectedCats.length > 0 && !person2Photo)
                      }
                      className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10] disabled:opacity-50 cursor-pointer"
                      title={
                        totalItems === 0
                          ? "Select at least one garment category above"
                          : allCritical.length > 0
                          ? "Resolve category conflicts above to proceed"
                          : undefined
                      }
                    >
                      <span>
                        Continue to Generate Couple ({totalItems} {totalItems === 1 ? "garment" : "garments"})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Custom Garment Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#111827] rounded-[4px] max-w-md w-full p-6 space-y-4 shadow-[4px_4px_0px_#080B10]">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#111827]">
                <h3 className="font-black text-base text-[#080B10]">Upload Custom Garment</h3>
                <button onClick={() => setShowUploadModal(false)} className="p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                    Garment Name *
                  </label>
                  <input
                    type="text"
                    value={customGarmentName}
                    onChange={(e) => setCustomGarmentName(e.target.value)}
                    placeholder="e.g. Vintage Velvet Tuxedo"
                    className="lm-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={customGarmentCat}
                    onChange={(e) => setCustomGarmentCat(e.target.value)}
                    className="lm-input"
                  >
                    <option value="tops">Tops / Shirts</option>
                    <option value="outerwear">Outerwear / Jackets</option>
                    <option value="dresses">Dresses / Full Body</option>
                    <option value="bottoms">Bottoms / Trousers</option>
                    <option value="shoes">Shoes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                    Garment Image (URL or Base64) *
                  </label>
                  <input
                    type="text"
                    value={customGarmentImg}
                    onChange={(e) => setCustomGarmentImg(e.target.value)}
                    placeholder="https://... or data:image/..."
                    className="lm-input font-mono !text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={customGarmentColor}
                    onChange={(e) => setCustomGarmentColor(e.target.value)}
                    placeholder="e.g. Cobalt Blue"
                    className="lm-input"
                  />
                </div>
              </div>

              <div className="pt-3 border-t-2 border-[#111827] flex justify-end gap-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="lm-btn-secondary !py-2 !px-4 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomGarmentUpload}
                  className="lm-btn-primary !py-2 !px-5 text-xs font-bold shadow-[2px_2px_0px_#080B10]"
                >
                  Add to Catalogue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5: GENERATE COUPLE IMAGE                              */}
        {/* ========================================================= */}
        {currentStepIndex === 4 && (
          <div className="space-y-6">
            <CoupleComposer
              person1ImageUrl={person1Result || ""}
              person2ImageUrl={person2Result || ""}
              person1SourcePhoto={participants.person1?.photoData || person1Photo || ""}
              person2SourcePhoto={participants.person2?.photoData || person2Photo || ""}
              person1Name={participants.person1?.displayName || "Person 1"}
              person2Name={participants.person2?.displayName || "Person 2"}
              person1Garment={person1GarmentName}
              person2Garment={person2GarmentName}
              person1Categories={p1SelectedCats}
              person2Categories={p2SelectedCats}
              person1Status={p1Job?.status || (person1Result ? "succeeded" : (loading || pollingActive ? "processing" : "not_started"))}
              person2Status={p2Job?.status || (person2Result ? "succeeded" : (loading || pollingActive ? "processing" : "not_started"))}
              person1ErrorMessage={p1Job?.error_message}
              person2ErrorMessage={p2Job?.error_message}
              onRetryPerson1={p1Job ? () => handleRetryJob(p1Job.id) : () => launchTryOn(participants.person1?.id)}
              onRetryPerson2={p2Job ? () => handleRetryJob(p2Job.id) : () => launchTryOn(participants.person2?.id)}
              isRetryingPerson1={Boolean(p1Job && retryingJobId === p1Job.id)}
              isRetryingPerson2={Boolean(p2Job && retryingJobId === p2Job.id)}
              referenceImageUrl={referencePhoto}
              onReferenceChange={(newUrl) => {
                setReferencePhoto(newUrl);
                if (sessionId) {
                  fetch(`/api/sessions/${sessionId}/photos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      role: "reference",
                      photoData: newUrl || undefined,
                      action: newUrl ? undefined : "remove"
                    })
                  });
                }
              }}
              occasion={occasion}
              sessionId={sessionId}
              initialBackground={backgroundSetting}
              initialCustomColorHex={customColorHex}
              initialBackgroundImageUrl={customBackgroundImage}
              onBackgroundSaved={(settings) => {
                setBackgroundSetting(settings.background as BackgroundType);
                if (settings.customColorHex) setCustomColorHex(settings.customColorHex);
                if (settings.backgroundImageUrl !== undefined) setCustomBackgroundImage(settings.backgroundImageUrl);
              }}
              onComposed={(dataUrl) => {
                setComposedImageData(dataUrl);
                if (sessionId) {
                  fetch(`/api/sessions/${sessionId}/compositions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      imageData: dataUrl,
                      referenceImageData: referencePhoto || undefined
                    })
                  });
                }
              }}
            />

            {/* Step Navigation */}
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-4 flex items-center justify-between shadow-[2px_2px_0px_#080B10]">
              <button
                onClick={() => setCurrentStepIndex(3)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Garments</span>
              </button>

              <button
                onClick={() => setCurrentStepIndex(5)}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10] cursor-pointer"
              >
                <span>Continue to Compare</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 6: COMPARE LOOKS                                     */}
        {/* ========================================================= */}
        {currentStepIndex === 5 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
              <div>
                <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                  STEP 6 • COMPARE LOOKS
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                  Compare Completed Outfits
                </h2>
                <p className="text-xs text-[#647084] mt-0.5">
                  Inspect before-and-after differences with interactive split slider and side-by-side mode.
                </p>
              </div>
            </div>

            {/* Coordination Verification Box */}
            <div className="p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px] space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1764FF]" />
                <span className="font-mono font-bold text-xs uppercase text-[#080B10]">
                  COORDINATION VERIFICATION
                </span>
              </div>
              <p className="text-xs text-[#080B10] leading-relaxed">
                Both outfits use complementary tones tailored for {occasion}. 
                {participants.person1?.displayName || "Person 1"}&apos;s ({person1GarmentName}) and {participants.person2?.displayName || "Person 2"}&apos;s ({person2GarmentName}) align across formality, fabric texture, and color warmth without identical duplication.
              </p>
            </div>

            {/* Interactive Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Person 1 Box */}
              {(() => {
                const p1Job = tryOnJobs.find(j => j.participant_id === participants.person1?.id || j.role === "person1");
                return (
                  <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10] space-y-3">
                    <BeforeAfterSlider
                      beforeImageUrl={participants.person1?.photoData || person1Photo || ""}
                      afterImageUrl={person1Result || ""}
                      personName={participants.person1?.displayName || "Person 1"}
                      processedCategories={p1SelectedCats}
                      allSelectedCategories={p1SelectedCats}
                      provenanceRecords={parseProvenance(p1Job?.category_provenance)}
                      status={p1Job?.status || (person1Result ? "succeeded" : "failed")}
                      errorMessage={p1Job?.error_message}
                      onRetry={p1Job ? () => handleRetryJob(p1Job.id) : undefined}
                      isRetrying={Boolean(p1Job && retryingJobId === p1Job.id)}
                    />
                    <button
                      onClick={() => {
                        setActivePersonTab("person1");
                        setCurrentStepIndex(3);
                      }}
                      className="w-full py-1.5 text-xs font-mono font-bold border border-[#111827] rounded-[2px] hover:bg-[#F7F9FC] cursor-pointer"
                    >
                      Change Person 1 Garments
                    </button>
                  </div>
                );
              })()}

              {/* Person 2 Box */}
              {(() => {
                const p2Job = tryOnJobs.find(j => j.participant_id === participants.person2?.id || j.role === "person2");
                return (
                  <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10] space-y-3">
                    <BeforeAfterSlider
                      beforeImageUrl={participants.person2?.photoData || person2Photo || ""}
                      afterImageUrl={person2Result || ""}
                      personName={participants.person2?.displayName || "Person 2"}
                      processedCategories={p2SelectedCats}
                      allSelectedCategories={p2SelectedCats}
                      provenanceRecords={parseProvenance(p2Job?.category_provenance)}
                      status={p2Job?.status || (person2Result ? "succeeded" : "failed")}
                      errorMessage={p2Job?.error_message}
                      onRetry={p2Job ? () => handleRetryJob(p2Job.id) : undefined}
                      isRetrying={Boolean(p2Job && retryingJobId === p2Job.id)}
                    />
                    <button
                      onClick={() => {
                        setActivePersonTab("person2");
                        setCurrentStepIndex(3);
                      }}
                      className="w-full py-1.5 text-xs font-mono font-bold border border-[#111827] rounded-[2px] hover:bg-[#F7F9FC] cursor-pointer"
                    >
                      Change Person 2 Garments
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Generated Couple Preview in Compare Mode */}
            {composedImageData && (
              <div className="p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#1764FF]" />
                    <span className="font-mono font-bold text-xs uppercase text-[#080B10]">
                      FINAL GENERATED COUPLE PHOTOGRAPH
                    </span>
                  </div>
                  <span className="bg-[#1764FF] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] uppercase">
                    {occasion}
                  </span>
                </div>
                <div className="max-w-md mx-auto aspect-square border-2 border-[#111827] rounded-[4px] overflow-hidden bg-[#0A0D14] shadow-[2px_2px_0px_#080B10]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={composedImageData}
                    alt="Generated Couple"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between">
              <button
                onClick={() => setCurrentStepIndex(4)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Couple Image</span>
              </button>

              <button
                onClick={() => setCurrentStepIndex(6)}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10] cursor-pointer"
              >
                <span>Continue to Save</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 7: SAVE TO LOOKBOOK                                   */}
        {/* ========================================================= */}
        {currentStepIndex === 6 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="pb-4 border-b-2 border-[#111827]">
              <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                STEP 7 • SAVE TO LOOKBOOK
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                Save & Export Couple Look
              </h2>
              <p className="text-xs text-[#647084] mt-0.5">
                Save this coordinated look to your persistent Lookbook to revisit or download anytime.
              </p>
            </div>

            {/* Composed Thumbnail Preview */}
            {composedImageData ? (
              <div className="p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-24 aspect-square border border-[#111827] rounded-[2px] overflow-hidden shrink-0 shadow-[2px_2px_0px_#080B10] bg-[#0A0D14]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={composedImageData} alt="Composed Couple" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="bg-[#1764FF] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] uppercase inline-block mb-1">
                      {occasion}
                    </span>
                    <p className="text-xs font-black text-[#080B10]">Full-Size Couple Photograph</p>
                    <p className="text-[11px] text-[#647084] font-mono">2400 × 2400 px Coordinated Portrait</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = composedImageData;
                      link.download = `lookmates-duomatch-${occasion.toLowerCase().replace(/\s+/g, "-")}-couple.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="lm-btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Image</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#F7F9FC] border border-dashed border-[#647084] rounded-[4px] text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-[#647084] mx-auto" />
                <p className="text-xs font-mono font-bold text-[#080B10]">No Couple Image Generated Yet</p>
                <p className="text-[11px] text-[#647084] font-mono">
                  Return to Step 5 to generate your couple image before saving.
                </p>
                <button
                  onClick={() => setCurrentStepIndex(4)}
                  className="lm-btn-primary !py-2 !px-4 text-xs font-bold mt-2"
                >
                  Go to Step 5 (Generate Couple)
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between">
              <button
                onClick={() => setCurrentStepIndex(5)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Compare</span>
              </button>

              <button
                onClick={handleSaveLook}
                disabled={loading || savedLookSuccess || !composedImageData}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10] cursor-pointer disabled:opacity-50"
              >
                <BookOpen className="w-4 h-4" />
                <span>{savedLookSuccess ? "✓ Saved to Lookbook" : "Save to Lookbook & Finish"}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
