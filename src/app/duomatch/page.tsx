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
  Palette
} from "lucide-react";

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
}

interface TryOnJob {
  id: string;
  session_id: string;
  participant_id: string;
  garment_id: string;
  status: "queued" | "submitting" | "processing" | "succeeded" | "failed";
  result_image_url?: string;
  error_message?: string;
  role?: string;
  display_name?: string;
  garment_name?: string;
  garment_image?: string;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Progressive Disclosure for Occasion Form
  const [showAdvancedPreferences, setShowAdvancedPreferences] = useState(false);

  // Form State (Phase 3)
  const [occasion, setOccasion] = useState("Wedding guest");
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

  // Dynamic Stepper definition reflecting locked recommendation flow
  const STEPS = [
    { id: "occasion", label: "Occasion" },
    { id: "photos", label: "Photos" },
    { id: "styling", label: "Styling" },
    {
      id: "garments",
      label: lockedRecommendationId && !isRecommendationModified ? "Garments (Direct)" : "Garments",
      isSkipped: !!lockedRecommendationId && !isRecommendationModified
    },
    { id: "tryon", label: "Try-On" },
    { id: "composer", label: "Couple Image" },
    { id: "compare", label: "Compare" },
    { id: "save", label: "Save" },
  ];

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

      if (data.participants && Array.isArray(data.participants)) {
        const p1 = data.participants.find((p: any) => p.role === "person1");
        const p2 = data.participants.find((p: any) => p.role === "person2");
        setParticipants({
          person1: p1 ? { id: p1.id, role: "person1", displayName: p1.display_name, photoData: p1.photo_data } : null,
          person2: p2 ? { id: p2.id, role: "person2", displayName: p2.display_name, photoData: p2.photo_data } : null
        });
        if (p1?.photo_data) setPerson1Photo(p1.photo_data);
        if (p2?.photo_data) setPerson2Photo(p2.photo_data);
      }

      if (data.assignments && Array.isArray(data.assignments) && data.assignments.length > 0) {
        const p1Assignments = data.assignments.filter((a: any) => a.role === "person1");
        const p2Assignments = data.assignments.filter((a: any) => a.role === "person2");
        if (p1Assignments.length > 0 || p2Assignments.length > 0) {
          setAssignedGarments({
            person1: p1Assignments.map((a: any) => ({
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
            person2: p2Assignments.map((a: any) => ({
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
      const savedSid = sessionStorage.getItem("lookmates_session_id");
      if (savedSid) {
        setSessionId(savedSid);
        loadSession(savedSid);
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

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion,
          stylePreferences: stylePreference,
          combinedBudget,
          currency,
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

  function loadDemoPhotos() {
    const demoP1 = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80";
    const demoP2 = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80";
    setPerson1Photo(demoP1);
    setPerson2Photo(demoP2);

    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "person1", photoData: demoP1 })
      });
      fetch(`/api/sessions/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "person2", photoData: demoP2 })
      });
    }
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
  // Step 4: Garment Assignment & Selection
  // -------------------------------------------------------------
  async function handleAssignGarment(garment: Garment, role: "person1" | "person2") {
    if (!sessionId) return;

    // Guard accessories from being assigned as primary VTO apparel
    if (garment.category === "accessories" || garment.is_vto_compatible === 0) {
      setErrorMessage(
        `"${garment.name}" is an accessory item for styling & lookbook display. The YouCam virtual try-on API requires wearable clothing (tops, bottoms, dresses, or outerwear).`
      );
      return;
    }

    try {
      const participantId = role === "person1" ? participants.person1?.id : participants.person2?.id;

      const res = await fetch(`/api/sessions/${sessionId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          garmentId: garment.id,
          role
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

      const res = await fetch(`/api/sessions/${sessionId}/tryon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetParticipantId })
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
    try {
      setLoading(true);
      const res = await fetch(`/api/tryon/${jobId}/retry`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTryOnJobs(prev => prev.map(j => j.id === jobId ? data.job : j));
        setPollingActive(true);
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setLoading(false);
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

  // Get try-on result images
  const person1Result = tryOnJobs.find(j => j.participant_id === participants.person1?.id || j.role === "person1")?.result_image_url || person1Photo;
  const person2Result = tryOnJobs.find(j => j.participant_id === participants.person2?.id || j.role === "person2")?.result_image_url || person2Photo;
  const person1GarmentName = assignedGarments.person1[0]?.name || "Person 1 Look";
  const person2GarmentName = assignedGarments.person2[0]?.name || "Person 2 Look";

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

          {/* Stepper Buttons (8 Steps) */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
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
        {/* STEP 1: OCCASION & PREFERENCES (PHASE 3)                   */}
        {/* ========================================================= */}
        {currentStepIndex === 0 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="pb-4 border-b-2 border-[#111827]">
              <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                STEP 1 • OCCASION SETUP
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                Occasion & Couple Preferences
              </h2>
              <p className="text-xs text-[#647084] mt-0.5">
                Tell us where you are going. LookMates will coordinate your outfits so you look harmonious without dressing identically.
              </p>
            </div>

            <div className="space-y-5">
              {/* Row 1: Occasion & Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1.5">
                    Select Occasion *
                  </label>
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    className="lm-input"
                  >
                    <option value="Wedding guest">Wedding guest</option>
                    <option value="Date night">Date night</option>
                    <option value="Party">Party / Cocktail</option>
                    <option value="Festival">Festival & Cultural</option>
                    <option value="Formal event">Formal event / Gala</option>
                    <option value="Vacation">Vacation & Resort</option>
                    <option value="College event">College event</option>
                    <option value="Photoshoot">Couple Photoshoot</option>
                    <option value="Casual outing">Casual outing</option>
                    <option value="Custom occasion">Custom occasion</option>
                  </select>
                </div>

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
              </div>

              {/* Row 2: Budget & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px]">
                <div className="md:col-span-2">
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1.5">
                    Combined Couple Budget *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={combinedBudget}
                      onChange={(e) => setCombinedBudget(Number(e.target.value))}
                      className="lm-input font-mono font-bold"
                      min={100}
                    />
                    <span className="text-xs font-mono font-bold px-3 py-2 bg-white border border-[#111827] rounded-[4px]">
                      {currency}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#647084] mt-1 block">
                    Total budget to be divided across both outfits.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#080B10] uppercase mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="lm-input font-mono"
                  >
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="GBP">GBP (£) — British Pound</option>
                  </select>
                </div>
              </div>

              {/* Progressive Disclosure Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPreferences(!showAdvancedPreferences)}
                  className="flex items-center gap-2 text-xs font-mono font-bold text-[#1764FF] hover:text-[#0D47D9] py-1 cursor-pointer"
                >
                  {showAdvancedPreferences ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{showAdvancedPreferences ? "Hide Additional Preferences" : "+ Show Additional Preferences (Colors, Venue, Individual Notes)"}</span>
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
                  Upload one front-facing portrait or full-body photo for each person. Photos are stored independently and strictly private.
                </p>
              </div>

              <button
                onClick={loadDemoPhotos}
                className="lm-btn-secondary !py-2 !px-3.5 !text-xs flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#080B10]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1764FF]" />
                <span>Use Demo Couple Photos</span>
              </button>
            </div>

            {/* Two Equal Cards */}
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
                        ✓ Photo Ready
                      </span>
                    )}
                  </div>

                  {person1Photo ? (
                    <div className="relative aspect-[3/4] bg-white border border-[#111827] rounded-[2px] overflow-hidden mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={person1Photo}
                        alt="Person 1 Preview"
                        className="w-full h-full object-cover object-top"
                      />
                      <button
                        onClick={() => setPerson1Photo(null)}
                        className="absolute top-2 right-2 p-1.5 bg-[#DC2626] text-white border border-[#111827] rounded-[2px] cursor-pointer shadow-sm"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => p1FileRef.current?.click()}
                      className="aspect-[3/4] border-2 border-dashed border-[#111827] bg-white rounded-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-[#EAF1FF] transition-colors mb-3 group"
                    >
                      <Upload className="w-8 h-8 text-[#1764FF] mb-2 group-hover:-translate-y-1 transition-transform" />
                      <p className="font-bold text-xs text-[#080B10]">Upload Person 1 Photo</p>
                      <p className="text-[11px] text-[#647084] mt-0.5">Click to browse or drop image</p>
                      <span className="text-[9px] font-mono text-[#647084] mt-2 px-2 py-0.5 bg-[#F0F4F8] border border-[#DCE3EF]">
                        PNG, JPG up to 10MB
                      </span>
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

                <p className="text-[10px] text-[#647084] font-mono">
                  Participant ID: {participants.person1?.id || "p1-pending"}
                </p>
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
                        ✓ Photo Ready
                      </span>
                    )}
                  </div>

                  {person2Photo ? (
                    <div className="relative aspect-[3/4] bg-white border border-[#111827] rounded-[2px] overflow-hidden mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={person2Photo}
                        alt="Person 2 Preview"
                        className="w-full h-full object-cover object-top"
                      />
                      <button
                        onClick={() => setPerson2Photo(null)}
                        className="absolute top-2 right-2 p-1.5 bg-[#DC2626] text-white border border-[#111827] rounded-[2px] cursor-pointer shadow-sm"
                        title="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => p2FileRef.current?.click()}
                      className="aspect-[3/4] border-2 border-dashed border-[#111827] bg-white rounded-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-[#EAF1FF] transition-colors mb-3 group"
                    >
                      <Upload className="w-8 h-8 text-[#1764FF] mb-2 group-hover:-translate-y-1 transition-transform" />
                      <p className="font-bold text-xs text-[#080B10]">Upload Person 2 Photo</p>
                      <p className="text-[11px] text-[#647084] mt-0.5">Click to browse or drop image</p>
                      <span className="text-[9px] font-mono text-[#647084] mt-2 px-2 py-0.5 bg-[#F0F4F8] border border-[#DCE3EF]">
                        PNG, JPG up to 10MB
                      </span>
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

                <p className="text-[10px] text-[#647084] font-mono">
                  Participant ID: {participants.person2?.id || "p2-pending"}
                </p>
              </div>
            </div>

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
                  Curated outfit pairing for {occasion} with {currency} {combinedBudget.toLocaleString()} budget.
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
                                    <span className="text-[10px] font-mono text-[#1764FF] font-bold">
                                      {currency} {item.estimatedPrice.toLocaleString()}
                                    </span>
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
                                    <span className="text-[10px] font-mono text-[#1764FF] font-bold">
                                      {currency} {item.estimatedPrice.toLocaleString()}
                                    </span>
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
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 shadow-[4px_4px_0px_#080B10] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
                <div>
                  <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                    STEP 4 • GARMENT ASSIGNMENT
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                    Assign Garments to Each Person
                  </h2>
                  <p className="text-xs text-[#647084] mt-0.5">
                    Choose actual garment images for Person 1 and Person 2, or upload your own reference garment.
                  </p>
                </div>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="lm-btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#080B10]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Custom Garment</span>
                </button>
              </div>

              {/* Assignment Summary Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px]">
                {/* Person 1 Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-[#080B10] uppercase">
                      PERSON 1 SELECTION ({assignedGarments.person1.length})
                    </span>
                    {assignedGarments.person1.length > 0 && (
                      <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px]">
                        ✓ Assigned
                      </span>
                    )}
                  </div>
                  {assignedGarments.person1.length === 0 ? (
                    <p className="text-xs text-[#647084] italic">No garment assigned yet. Pick one below.</p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {assignedGarments.person1.map(g => (
                        <div key={g.id} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#111827] rounded-[2px] text-xs">
                          <span className="font-bold truncate max-w-[140px]">{g.name}</span>
                          <button
                            onClick={() => handleAssignGarment(g, "person1")}
                            className="text-[#DC2626] font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Person 2 Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-[#080B10] uppercase">
                      PERSON 2 SELECTION ({assignedGarments.person2.length})
                    </span>
                    {assignedGarments.person2.length > 0 && (
                      <span className="bg-[#EAF1FF] text-[#1764FF] border border-[#1764FF] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px]">
                        ✓ Assigned
                      </span>
                    )}
                  </div>
                  {assignedGarments.person2.length === 0 ? (
                    <p className="text-xs text-[#647084] italic">No garment assigned yet. Pick one below.</p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {assignedGarments.person2.map(g => (
                        <div key={g.id} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#111827] rounded-[2px] text-xs">
                          <span className="font-bold truncate max-w-[140px]">{g.name}</span>
                          <button
                            onClick={() => handleAssignGarment(g, "person2")}
                            className="text-[#DC2626] font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* PHASE 2: EXPANDED CATALOGUE FILTER CONTROLS */}
              <div className="space-y-3 pt-1">
                {/* Category Pills (All 6 categories) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
                  {[
                    { id: "all", label: "All Items" },
                    { id: "tops", label: "Tops" },
                    { id: "bottoms", label: "Bottoms" },
                    { id: "dresses", label: "Dresses & One-Piece" },
                    { id: "outerwear", label: "Outerwear" },
                    { id: "shoes", label: "Footwear" },
                    { id: "accessories", label: "Accessories" }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedSubcategory("all");
                      }}
                      className={`px-3 py-1.5 uppercase font-bold border-2 rounded-[2px] cursor-pointer whitespace-nowrap transition-colors ${
                        selectedCategory === cat.id
                          ? "bg-[#1764FF] text-white border-[#111827] shadow-[2px_2px_0px_#080B10]"
                          : "bg-white text-[#080B10] border-[#111827] hover:bg-[#F7F9FC]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Secondary Filters Bar: Subcategory, Color, Occasion, Sort, Search */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-3 bg-[#F7F9FC] border border-[#111827] rounded-[4px] text-xs font-mono">
                  {/* Subcategory Dropdown */}
                  <div>
                    <label className="block text-[9px] font-bold text-[#647084] uppercase mb-1">
                      Subcategory
                    </label>
                    <select
                      value={selectedSubcategory}
                      onChange={(e) => setSelectedSubcategory(e.target.value)}
                      className="w-full bg-white border border-[#111827] rounded-[2px] px-2 py-1.5 text-xs text-[#080B10] font-mono outline-none"
                    >
                      <option value="all">All Subcategories</option>
                      {selectedCategory === "all" || selectedCategory === "tops" ? (
                        <optgroup label="Tops">
                          <option value="Basic T-shirts">Basic T-shirts</option>
                          <option value="Oversized T-shirts">Oversized T-shirts</option>
                          <option value="Shirts">Shirts</option>
                          <option value="Formal shirts">Formal shirts</option>
                          <option value="Blouses">Blouses</option>
                          <option value="Sweaters">Sweaters</option>
                          <option value="Hoodies">Hoodies</option>
                          <option value="Blazers">Blazers</option>
                          <option value="Cardigans">Cardigans</option>
                        </optgroup>
                      ) : null}
                      {selectedCategory === "all" || selectedCategory === "bottoms" ? (
                        <optgroup label="Bottoms">
                          <option value="Jeans">Jeans</option>
                          <option value="Straight-fit trousers">Straight-fit trousers</option>
                          <option value="Formal trousers">Formal trousers</option>
                          <option value="Wide-leg trousers">Wide-leg trousers</option>
                          <option value="Chinos">Chinos</option>
                          <option value="Cargo pants">Cargo pants</option>
                          <option value="Shorts">Shorts</option>
                          <option value="Skirts">Skirts</option>
                        </optgroup>
                      ) : null}
                      {selectedCategory === "all" || selectedCategory === "dresses" ? (
                        <optgroup label="Dresses & Jumpsuits">
                          <option value="Casual dresses">Casual dresses</option>
                          <option value="Evening dresses">Evening dresses</option>
                          <option value="Maxi dresses">Maxi dresses</option>
                          <option value="Cocktail dresses">Cocktail dresses</option>
                          <option value="Jumpsuits">Jumpsuits</option>
                        </optgroup>
                      ) : null}
                      {selectedCategory === "all" || selectedCategory === "outerwear" ? (
                        <optgroup label="Outerwear">
                          <option value="Denim jackets">Denim jackets</option>
                          <option value="Leather-style jackets">Leather-style jackets</option>
                          <option value="Trench coats">Trench coats</option>
                          <option value="Overcoats">Overcoats</option>
                          <option value="Lightweight jackets">Lightweight jackets</option>
                        </optgroup>
                      ) : null}
                      {selectedCategory === "all" || selectedCategory === "shoes" ? (
                        <optgroup label="Footwear">
                          <option value="Sneakers">Sneakers</option>
                          <option value="Loafers">Loafers</option>
                          <option value="Formal shoes">Formal shoes</option>
                          <option value="Heels">Heels</option>
                          <option value="Boots">Boots</option>
                          <option value="Sandals">Sandals</option>
                        </optgroup>
                      ) : null}
                      {selectedCategory === "all" || selectedCategory === "accessories" ? (
                        <optgroup label="Accessories">
                          <option value="Watches">Watches</option>
                          <option value="Belts">Belts</option>
                          <option value="Bags">Bags</option>
                          <option value="Handbags">Handbags</option>
                          <option value="Scarves">Scarves</option>
                          <option value="Jewelry">Jewelry</option>
                          <option value="Sunglasses">Sunglasses</option>
                        </optgroup>
                      ) : null}
                    </select>
                  </div>

                  {/* Color Filter */}
                  <div>
                    <label className="block text-[9px] font-bold text-[#647084] uppercase mb-1">
                      Color
                    </label>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full bg-white border border-[#111827] rounded-[2px] px-2 py-1.5 text-xs text-[#080B10] font-mono outline-none"
                    >
                      <option value="all">All Colors</option>
                      <option value="Black">Black</option>
                      <option value="White">White</option>
                      <option value="Blue">Blue / Navy / Sky</option>
                      <option value="Ivory">Ivory / Cream</option>
                      <option value="Emerald">Emerald / Green</option>
                      <option value="Brown">Brown / Tan</option>
                      <option value="Gold">Gold</option>
                      <option value="Silver">Silver</option>
                    </select>
                  </div>

                  {/* Occasion Filter */}
                  <div>
                    <label className="block text-[9px] font-bold text-[#647084] uppercase mb-1">
                      Occasion
                    </label>
                    <select
                      value={selectedOccasion}
                      onChange={(e) => setSelectedOccasion(e.target.value)}
                      className="w-full bg-white border border-[#111827] rounded-[2px] px-2 py-1.5 text-xs text-[#080B10] font-mono outline-none"
                    >
                      <option value="all">All Occasions</option>
                      <option value="Wedding guest">Wedding guest</option>
                      <option value="Date night">Date night</option>
                      <option value="Vacation">Vacation</option>
                      <option value="Casual">Casual</option>
                      <option value="Formal">Formal</option>
                      <option value="Streetwear">Streetwear</option>
                    </select>
                  </div>

                  {/* Price / Name Sort */}
                  <div>
                    <label className="block text-[9px] font-bold text-[#647084] uppercase mb-1">
                      Sort By
                    </label>
                    <select
                      value={priceSort}
                      onChange={(e) => setPriceSort(e.target.value as any)}
                      className="w-full bg-white border border-[#111827] rounded-[2px] px-2 py-1.5 text-xs text-[#080B10] font-mono outline-none"
                    >
                      <option value="default">Default Order</option>
                      <option value="price_asc">Price: Low to High (₹)</option>
                      <option value="price_desc">Price: High to Low (₹)</option>
                      <option value="name_asc">Garment Name: A to Z</option>
                    </select>
                  </div>

                  {/* Search */}
                  <div>
                    <label className="block text-[9px] font-bold text-[#647084] uppercase mb-1">
                      Search Name / Tag
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#647084] absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={catalogueSearch}
                        onChange={(e) => setCatalogueSearch(e.target.value)}
                        placeholder="Search..."
                        className="w-full bg-white border border-[#111827] rounded-[2px] pl-8 pr-2 py-1.5 text-xs text-[#080B10] font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Catalogue Items Counter Banner */}
            {(() => {
              const filteredList = catalogue
                .filter(g => selectedCategory === "all" || g.category.toLowerCase() === selectedCategory.toLowerCase())
                .filter(g => selectedSubcategory === "all" || (g.subcategory || "").toLowerCase() === selectedSubcategory.toLowerCase())
                .filter(g => {
                  if (selectedColor === "all") return true;
                  return g.color.toLowerCase().includes(selectedColor.toLowerCase());
                })
                .filter(g => {
                  if (selectedOccasion === "all") return true;
                  const occ = (g.occasion_tag || "").toLowerCase();
                  const style = (g.style_tag || "").toLowerCase();
                  return occ.includes(selectedOccasion.toLowerCase()) || style.includes(selectedOccasion.toLowerCase());
                })
                .filter(g => {
                  if (!catalogueSearch.trim()) return true;
                  const q = catalogueSearch.toLowerCase();
                  return (
                    g.name.toLowerCase().includes(q) ||
                    g.color.toLowerCase().includes(q) ||
                    (g.subcategory || "").toLowerCase().includes(q) ||
                    g.category.toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => {
                  if (priceSort === "price_asc") return (a.price || 0) - (b.price || 0);
                  if (priceSort === "price_desc") return (b.price || 0) - (a.price || 0);
                  if (priceSort === "name_asc") return a.name.localeCompare(b.name);
                  return 0;
                });

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono text-[#647084] px-1">
                    <span>
                      Showing <strong className="text-[#080B10] font-bold">{filteredList.length}</strong> items in catalogue
                    </span>
                    {(selectedCategory !== "all" || selectedSubcategory !== "all" || selectedColor !== "all" || selectedOccasion !== "all" || catalogueSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory("all");
                          setSelectedSubcategory("all");
                          setSelectedColor("all");
                          setSelectedOccasion("all");
                          setCatalogueSearch("");
                          setPriceSort("default");
                        }}
                        className="text-[#1764FF] font-bold hover:underline cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  {/* Garments Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredList.map(garment => {
                      const isAssignedP1 = assignedGarments.person1.some(g => g.id === garment.id);
                      const isAssignedP2 = assignedGarments.person2.some(g => g.id === garment.id);
                      const isAccessory = garment.category === "accessories" || garment.is_vto_compatible === 0;

                      return (
                        <div
                          key={garment.id}
                          className={`bg-white border-2 rounded-[4px] p-3 flex flex-col justify-between transition-all ${
                            isAssignedP1 || isAssignedP2
                              ? "border-[#1764FF] shadow-[3px_3px_0px_#1764FF]"
                              : "border-[#111827] shadow-[2px_2px_0px_#080B10]"
                          }`}
                        >
                          <div>
                            <div className="relative aspect-[3/4] bg-[#F7F9FC] border border-[#111827] rounded-[2px] overflow-hidden mb-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={garment.image_url}
                                alt={garment.name}
                                className="w-full h-full object-cover object-top"
                              />
                              <span className="absolute top-1 left-1 bg-[#080B10] text-white text-[8px] font-mono px-1 py-0.5 rounded-[2px] uppercase">
                                {garment.category}
                              </span>
                              {garment.subcategory && (
                                <span className="absolute bottom-1 left-1 bg-white/90 text-[#080B10] border border-[#111827] text-[8px] font-mono font-bold px-1 py-0.5 rounded-[2px]">
                                  {garment.subcategory}
                                </span>
                              )}
                              {isAccessory && (
                                <span className="absolute top-1 right-1 bg-[#FEF3C7] text-[#92400E] border border-[#92400E] text-[7.5px] font-mono font-bold px-1 py-0.5 rounded-[2px]">
                                  Styling Only
                                </span>
                              )}
                            </div>

                            <h4 className="font-black text-xs text-[#080B10] line-clamp-1" title={garment.name}>
                              {garment.name}
                            </h4>
                            <p className="text-[10px] text-[#647084] line-clamp-1">{garment.color}</p>

                            <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                              <span className="font-bold text-[#1764FF]">
                                {garment.price ? `${currency} ${garment.price.toLocaleString()}` : "Upon request"}
                              </span>
                              <span className="text-[9px] text-[#647084] uppercase">
                                {garment.gender_target}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-3 pt-2 border-t border-[#DCE3EF] grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAssignGarment(garment, "person1")}
                              className={`py-1 px-1.5 text-[10px] font-mono font-bold border rounded-[2px] transition-colors cursor-pointer text-center ${
                                isAssignedP1
                                  ? "bg-[#080B10] text-white border-[#080B10]"
                                  : isAccessory
                                  ? "bg-[#F7F9FC] text-[#647084] border-[#DCE3EF] hover:bg-[#EAEAEA]"
                                  : "bg-white text-[#080B10] border-[#111827] hover:bg-[#F7F9FC]"
                              }`}
                              title={isAccessory ? "Accessories are styling-only items" : "Assign to Person 1"}
                            >
                              {isAssignedP1 ? "✓ P1 Done" : isAccessory ? "Accessory" : "+ Person 1"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAssignGarment(garment, "person2")}
                              className={`py-1 px-1.5 text-[10px] font-mono font-bold border rounded-[2px] transition-colors cursor-pointer text-center ${
                                isAssignedP2
                                  ? "bg-[#1764FF] text-white border-[#1764FF]"
                                  : isAccessory
                                  ? "bg-[#F7F9FC] text-[#647084] border-[#DCE3EF] hover:bg-[#EAEAEA]"
                                  : "bg-white text-[#080B10] border-[#111827] hover:bg-[#F7F9FC]"
                              }`}
                              title={isAccessory ? "Accessories are styling-only items" : "Assign to Person 2"}
                            >
                              {isAssignedP2 ? "✓ P2 Done" : isAccessory ? "Accessory" : "+ Person 2"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Navigation Footer */}
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-4 flex items-center justify-between shadow-[2px_2px_0px_#080B10]">
              <button
                onClick={() => setCurrentStepIndex(2)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Styling</span>
              </button>

              <button
                onClick={() => {
                  setCurrentStepIndex(4);
                  launchTryOn();
                }}
                disabled={assignedGarments.person1.length === 0 || assignedGarments.person2.length === 0}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
              >
                <span>Launch YouCam Try-On</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
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
        {/* STEP 5: YOUCAM VTO TRY-ON EXECUTION (PHASE 7)              */}
        {/* ========================================================= */}
        {currentStepIndex === 4 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
              <div>
                <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                  STEP 5 • YOUCAM APPAREL VTO
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                  Virtual Try-On Processing
                </h2>
                <p className="text-xs text-[#647084] mt-0.5">
                  Submitting separate apparel try-on jobs to YouCam S2S v2.0 Clothes API.
                </p>
              </div>

              <button
                onClick={() => launchTryOn()}
                disabled={loading}
                className="lm-btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#080B10]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Re-run Try-On</span>
              </button>
            </div>

            {/* Status Banner */}
            <div className="p-3 bg-[#F7F9FC] border border-[#111827] rounded-[4px] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${pollingActive ? "bg-[#1764FF] animate-pulse" : "bg-[#16803C]"}`}></div>
                <span>STATUS: {pollingActive ? "POLLING YOUCAM TASK SERVERS..." : "PROCESSING COMPLETE"}</span>
              </div>
              <span className="text-[#647084]">S2S v2.0 Clothes Endpoint</span>
            </div>

            {/* Two Independent Progress Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
              {/* Person 1 Job Card */}
              {(() => {
                const p1Job = tryOnJobs.find(j => j.participant_id === participants.person1?.id || j.role === "person1");
                const p1Garment = assignedGarments.person1[0];

                return (
                  <div className="border-2 border-[#111827] rounded-[4px] p-5 bg-[#F7F9FC] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EF]">
                      <span className="font-mono font-bold text-xs uppercase text-[#080B10]">
                        PERSON 1 VTO JOB
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] border ${
                        p1Job?.status === "succeeded" ? "bg-[#DCFCE7] text-[#16803C] border-[#16803C]" :
                        p1Job?.status === "failed" ? "bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]" : "bg-[#EAF1FF] text-[#1764FF] border-[#1764FF]"
                      }`}>
                        {p1Job?.status?.toUpperCase() || "QUEUED"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="border border-[#111827] p-1 bg-white rounded-[2px]">
                        <p className="text-[10px] font-mono text-[#647084] mb-1">Source Photo</p>
                        <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={person1Photo || ""} alt="Source" className="w-full h-full object-cover object-top" />
                        </div>
                      </div>

                      <div className="border border-[#111827] p-1 bg-white rounded-[2px]">
                        <p className="text-[10px] font-mono text-[#647084] mb-1">Garment Input</p>
                        <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p1Garment?.image_url || ""} alt="Garment" className="w-full h-full object-cover object-top" />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-[#111827] rounded-[2px] min-h-[140px] flex flex-col items-center justify-center text-center">
                      {p1Job?.status === "succeeded" && p1Job.result_image_url ? (
                        <div className="space-y-2 w-full">
                          <div className="aspect-[3/4] max-h-56 mx-auto overflow-hidden border border-[#111827] rounded-[2px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p1Job.result_image_url} alt="Result" className="w-full h-full object-cover object-top" />
                          </div>
                          <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] inline-block">
                            ✓ Try-On Generated
                          </span>
                        </div>
                      ) : p1Job?.status === "failed" ? (
                        <div className="space-y-2">
                          <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
                          <p className="text-xs text-[#DC2626] font-mono font-bold">Try-On Failed</p>
                          <p className="text-[10px] text-[#647084]">{p1Job.error_message || "Provider error"}</p>
                          <button
                            onClick={() => handleRetryJob(p1Job.id)}
                            className="lm-btn-primary !py-1.5 !px-4 text-xs font-bold"
                          >
                            Retry Person 1
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 py-4">
                          <div className="w-6 h-6 border-2 border-[#1764FF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="text-xs font-mono font-bold text-[#080B10]">Generating AI Try-On...</p>
                          <p className="text-[10px] text-[#647084]">Rendering texture & garment drape</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Person 2 Job Card */}
              {(() => {
                const p2Job = tryOnJobs.find(j => j.participant_id === participants.person2?.id || j.role === "person2");
                const p2Garment = assignedGarments.person2[0];

                return (
                  <div className="border-2 border-[#111827] rounded-[4px] p-5 bg-[#F7F9FC] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EF]">
                      <span className="font-mono font-bold text-xs uppercase text-[#080B10]">
                        PERSON 2 VTO JOB
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] border ${
                        p2Job?.status === "succeeded" ? "bg-[#DCFCE7] text-[#16803C] border-[#16803C]" :
                        p2Job?.status === "failed" ? "bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]" : "bg-[#EAF1FF] text-[#1764FF] border-[#1764FF]"
                      }`}>
                        {p2Job?.status?.toUpperCase() || "QUEUED"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="border border-[#111827] p-1 bg-white rounded-[2px]">
                        <p className="text-[10px] font-mono text-[#647084] mb-1">Source Photo</p>
                        <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={person2Photo || ""} alt="Source" className="w-full h-full object-cover object-top" />
                        </div>
                      </div>

                      <div className="border border-[#111827] p-1 bg-white rounded-[2px]">
                        <p className="text-[10px] font-mono text-[#647084] mb-1">Garment Input</p>
                        <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p2Garment?.image_url || ""} alt="Garment" className="w-full h-full object-cover object-top" />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-[#111827] rounded-[2px] min-h-[140px] flex flex-col items-center justify-center text-center">
                      {p2Job?.status === "succeeded" && p2Job.result_image_url ? (
                        <div className="space-y-2 w-full">
                          <div className="aspect-[3/4] max-h-56 mx-auto overflow-hidden border border-[#111827] rounded-[2px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p2Job.result_image_url} alt="Result" className="w-full h-full object-cover object-top" />
                          </div>
                          <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] inline-block">
                            ✓ Try-On Generated
                          </span>
                        </div>
                      ) : p2Job?.status === "failed" ? (
                        <div className="space-y-2">
                          <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
                          <p className="text-xs text-[#DC2626] font-mono font-bold">Try-On Failed</p>
                          <p className="text-[10px] text-[#647084]">{p2Job.error_message || "Provider error"}</p>
                          <button
                            onClick={() => handleRetryJob(p2Job.id)}
                            className="lm-btn-primary !py-1.5 !px-4 text-xs font-bold"
                          >
                            Retry Person 2
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 py-4">
                          <div className="w-6 h-6 border-2 border-[#1764FF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="text-xs font-mono font-bold text-[#080B10]">Generating AI Try-On...</p>
                          <p className="text-[10px] text-[#647084]">Rendering texture & garment drape</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between">
              {lockedRecommendationId && !isRecommendationModified ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStepIndex(2)}
                    className="lm-btn-secondary !py-2.5 !px-4 text-xs font-bold flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Recommendations</span>
                  </button>
                  <button
                    onClick={() => setCurrentStepIndex(3)}
                    className="lm-btn-secondary !py-2.5 !px-4 text-xs font-bold flex items-center gap-1.5 text-[#1764FF]"
                  >
                    <span>Customize Garments</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCurrentStepIndex(3)}
                  className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Change Garments</span>
                </button>
              )}

              <button
                onClick={() => setCurrentStepIndex(5)}
                disabled={loading}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
              >
                <span>Compose Couple Image</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 6: COUPLE IMAGE COMPOSER (PHASE 8)                   */}
        {/* ========================================================= */}
        {currentStepIndex === 5 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <CoupleComposer
              person1ImageUrl={person1Result || ""}
              person2ImageUrl={person2Result || ""}
              referenceImageUrl={referencePhoto}
              sessionId={sessionId}
              initialBackground={backgroundSetting}
              initialCustomColorHex={customColorHex}
              initialBackgroundImageUrl={customBackgroundImage}
              onBackgroundSaved={(settings) => {
                setBackgroundSetting(settings.background);
                if (settings.customColorHex) setCustomColorHex(settings.customColorHex);
                if (settings.backgroundImageUrl !== undefined) setCustomBackgroundImage(settings.backgroundImageUrl);
              }}
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
              person1Name={participants.person1?.displayName || "Person 1"}
              person2Name={participants.person2?.displayName || "Person 2"}
              person1Garment={person1GarmentName}
              person2Garment={person2GarmentName}
              occasion={occasion}
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

            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-4 flex items-center justify-between shadow-[2px_2px_0px_#080B10]">
              <button
                onClick={() => setCurrentStepIndex(4)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Try-On</span>
              </button>

              <button
                onClick={() => setCurrentStepIndex(6)}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
              >
                <span>Continue to Compare</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 7: COMPARE LOOKS (PHASE 9)                           */}
        {/* ========================================================= */}
        {currentStepIndex === 6 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
              <div>
                <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                  STEP 7 • COMPARE LOOKS
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                  Compare Completed Outfits
                </h2>
                <p className="text-xs text-[#647084] mt-0.5">
                  Verify individual virtual try-ons and inspect the combined couple result.
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
                Person 1&apos;s {person1GarmentName} and Person 2&apos;s {person2GarmentName} align across formality, fabric texture, and color warmth without identical duplication.
              </p>
            </div>

            {/* Side-by-Side Review Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Person 1 Box */}
              <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10]">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#DCE3EF]">
                  <span className="text-xs font-mono font-bold text-[#080B10]">PERSON 1 LOOK</span>
                  <span className="text-xs font-mono text-[#1764FF] font-bold">{person1GarmentName}</span>
                </div>
                <div className="aspect-[3/4] max-h-72 mx-auto overflow-hidden border border-[#111827] bg-[#F7F9FC] rounded-[2px] mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={person1Result || ""} alt="Person 1" className="w-full h-full object-cover object-top" />
                </div>
                <button
                  onClick={() => setCurrentStepIndex(3)}
                  className="w-full py-1.5 text-xs font-mono font-bold border border-[#111827] rounded-[2px] hover:bg-[#F7F9FC] cursor-pointer"
                >
                  Change Person 1 Garment
                </button>
              </div>

              {/* Person 2 Box */}
              <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10]">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#DCE3EF]">
                  <span className="text-xs font-mono font-bold text-[#080B10]">PERSON 2 LOOK</span>
                  <span className="text-xs font-mono text-[#1764FF] font-bold">{person2GarmentName}</span>
                </div>
                <div className="aspect-[3/4] max-h-72 mx-auto overflow-hidden border border-[#111827] bg-[#F7F9FC] rounded-[2px] mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={person2Result || ""} alt="Person 2" className="w-full h-full object-cover object-top" />
                </div>
                <button
                  onClick={() => setCurrentStepIndex(3)}
                  className="w-full py-1.5 text-xs font-mono font-bold border border-[#111827] rounded-[2px] hover:bg-[#F7F9FC] cursor-pointer"
                >
                  Change Person 2 Garment
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between">
              <button
                onClick={() => setCurrentStepIndex(5)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Image</span>
              </button>

              <button
                onClick={() => setCurrentStepIndex(7)}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
              >
                <span>Continue to Save</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 8: SAVE TO LOOKBOOK (PHASE 10)                        */}
        {/* ========================================================= */}
        {currentStepIndex === 7 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10] max-w-4xl mx-auto space-y-6">
            <div className="pb-4 border-b-2 border-[#111827]">
              <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1.5">
                STEP 8 • SAVE TO LOOKBOOK
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
                Save & Export Couple Look
              </h2>
              <p className="text-xs text-[#647084] mt-0.5">
                Save this coordinated look to your persistent Lookbook to revisit or download anytime.
              </p>
            </div>

            {/* Composed Thumbnail Preview */}
            {composedImageData && (
              <div className="p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-20 aspect-[4/5] border border-[#111827] rounded-[2px] overflow-hidden shrink-0 shadow-[2px_2px_0px_#080B10]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={composedImageData} alt="Composed" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="bg-[#1764FF] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] uppercase inline-block mb-1">
                      {occasion}
                    </span>
                    <p className="text-xs font-black text-[#080B10]">Full-Size Couple Editorial Portrait</p>
                    <p className="text-[11px] text-[#647084] font-mono">2400 × 3000 px High-Res PNG (4:5 Editorial)</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = composedImageData;
                    link.download = `lookmates-duomatch-couple-portrait-2400x3000.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="lm-btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Portrait</span>
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t-2 border-[#111827] flex items-center justify-between">
              <button
                onClick={() => setCurrentStepIndex(6)}
                className="lm-btn-secondary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Compare</span>
              </button>

              <button
                onClick={handleSaveLook}
                disabled={loading || savedLookSuccess}
                className="lm-btn-primary !py-2.5 !px-8 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#080B10]"
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
