"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Download,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  Maximize2,
  Upload,
  Palette,
  RotateCcw,
  Trash2,
  X,
  AlertCircle,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  getBackgroundsForOccasion,
  BackgroundPresetItem,
  normalizeOccasionKey
} from "@/lib/backgrounds";

export type BackgroundType =
  | "preset"
  | "transparent"
  | "white"
  | "soft_grey"
  | "warm_beige"
  | "midnight_black"
  | "custom"
  | "upload"
  | string;

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface NormalizationData {
  targetHeight: number;
  person1Scale: number;
  person2Scale: number;
  scaledPerson1: { width: number; height: number; left: number; top: number };
  scaledPerson2: { width: number; height: number; left: number; top: number };
  baselineY: number;
  spacing: number;
}

export interface CoupleComposerProps {
  person1ImageUrl?: string | null;
  person2ImageUrl?: string | null;
  person1SourcePhoto?: string | null;
  person2SourcePhoto?: string | null;
  person1Name?: string;
  person2Name?: string;
  person1Garment?: string;
  person2Garment?: string;
  person1Categories?: string[];
  person2Categories?: string[];
  person1Status?: string;
  person2Status?: string;
  person1ErrorMessage?: string;
  person2ErrorMessage?: string;
  onRetryPerson1?: () => void;
  onRetryPerson2?: () => void;
  isRetryingPerson1?: boolean;
  isRetryingPerson2?: boolean;
  referenceImageUrl?: string | null;
  onReferenceChange?: (newUrl: string | null) => void;
  occasion: string;
  onComposed?: (dataUrl: string) => void;
  sessionId?: string | null;
  initialBackground?: string;
  initialCustomColorHex?: string;
  initialBackgroundImageUrl?: string | null;
  onBackgroundSaved?: (settings: {
    background: string;
    customColorHex?: string;
    backgroundImageUrl?: string | null;
  }) => void;
}

export function CoupleComposer({
  person1ImageUrl,
  person2ImageUrl,
  person1SourcePhoto,
  person2SourcePhoto,
  person1Name = "Person 1",
  person2Name = "Person 2",
  person1Garment = "Outfit 1",
  person2Garment = "Outfit 2",
  person1Categories = [],
  person2Categories = [],
  person1Status = "succeeded",
  person2Status = "succeeded",
  person1ErrorMessage,
  person2ErrorMessage,
  onRetryPerson1,
  onRetryPerson2,
  isRetryingPerson1 = false,
  isRetryingPerson2 = false,
  occasion,
  onComposed,
  sessionId,
  initialBackground,
  initialCustomColorHex = "#1764FF",
  initialBackgroundImageUrl = null,
  onBackgroundSaved
}: CoupleComposerProps) {
  // Occasion-aware backgrounds
  const occasionData = getBackgroundsForOccasion(occasion);
  const defaultBgId = initialBackground || occasionData.recommendedPreset.id;

  const [selectedBgId, setSelectedBgId] = useState<string>(defaultBgId);
  const [selectedBgUrl, setSelectedBgUrl] = useState<string | null>(
    initialBackgroundImageUrl || occasionData.recommendedPreset.imageUrl || null
  );
  const [customColorHex, setCustomColorHex] = useState<string>(initialCustomColorHex);
  const [uploadedBgUrl, setUploadedBgUrl] = useState<string | null>(
    initialBackground === "upload" ? initialBackgroundImageUrl : null
  );
  const bgUploadRef = useRef<HTMLInputElement | null>(null);

  // Active Tab for Backgrounds: "presets" | "studio"
  const [bgTab, setBgTab] = useState<"presets" | "studio">("presets");

  // Composition state
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("Initializing composition...");
  const [error, setError] = useState<string | null>(null);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  // Cached transparent cutouts from YouCam AI SOD
  const [person1CutoutUrl, setPerson1CutoutUrl] = useState<string | null>(null);
  const [person2CutoutUrl, setPerson2CutoutUrl] = useState<string | null>(null);

  // Normalization Telemetry
  const [boundingBoxes, setBoundingBoxes] = useState<{ person1: BoundingBox; person2: BoundingBox } | null>(null);
  const [normalization, setNormalization] = useState<NormalizationData | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Modal for full-size viewing
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);
  const [modalZoom, setModalZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalImage) {
        setModalImage(null);
        setModalZoom(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalImage]);

  // Invalidate stale cutouts and composed image if individual outfit results change
  const prevP1Ref = useRef(person1ImageUrl);
  const prevP2Ref = useRef(person2ImageUrl);
  useEffect(() => {
    let changed = false;
    if (prevP1Ref.current !== person1ImageUrl) {
      prevP1Ref.current = person1ImageUrl;
      setPerson1CutoutUrl(null);
      changed = true;
    }
    if (prevP2Ref.current !== person2ImageUrl) {
      prevP2Ref.current = person2ImageUrl;
      setPerson2CutoutUrl(null);
      changed = true;
    }
    if (changed) {
      setComposedUrl(null);
      setHasGeneratedOnce(false);
    }
  }, [person1ImageUrl, person2ImageUrl]);

  // Keep background in sync if occasion changes and no manual override
  useEffect(() => {
    if (!initialBackground) {
      const updated = getBackgroundsForOccasion(occasion);
      setSelectedBgId(updated.recommendedPreset.id);
      setSelectedBgUrl(updated.recommendedPreset.imageUrl || null);
    }
  }, [occasion, initialBackground]);

  // Persist background settings to session
  const persistBackgroundToSession = useCallback(
    async (bgId: string, hex: string, bgImg: string | null) => {
      if (!sessionId) return;
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            backgroundSetting: bgId,
            customColorHex: hex,
            customBackgroundImage: bgImg
          })
        });
        if (onBackgroundSaved) {
          onBackgroundSaved({
            background: bgId,
            customColorHex: hex,
            backgroundImageUrl: bgImg
          });
        }
      } catch (e) {
        console.warn("[CoupleComposer] Could not persist background setting:", e);
      }
    },
    [sessionId, onBackgroundSaved]
  );

  // Master composition runner
  const runCompositionPipeline = useCallback(
    async (
      bgId: string = selectedBgId,
      bgUrl: string | null = selectedBgUrl,
      customHex: string = customColorHex
    ) => {
      const p1 = person1ImageUrl || person1SourcePhoto;
      const p2 = person2ImageUrl || person2SourcePhoto;

      if (!p1 || !p2) {
        setError("Both Person 1 and Person 2 photos are required to generate couple image.");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        if (!person1CutoutUrl || !person2CutoutUrl) {
          setLoadingStage("Removing backgrounds with YouCam AI SOD...");
        } else {
          setLoadingStage("Normalizing heights and compositing onto selected background...");
        }

        const isStudioType = ["transparent", "white", "soft_grey", "warm_beige", "midnight_black", "custom"].includes(bgId);
        const bgParam = isStudioType ? bgId : bgId === "upload" ? "upload" : "preset";
        const bgImageParam = isStudioType ? undefined : bgId === "upload" ? uploadedBgUrl : bgUrl;

        const response = await fetch("/api/compose-portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person1ImageUrl: p1,
            person2ImageUrl: p2,
            person1CutoutUrl: person1CutoutUrl || undefined,
            person2CutoutUrl: person2CutoutUrl || undefined,
            background: bgParam,
            customColorHex: customHex,
            backgroundImageUrl: bgImageParam || undefined,
            canvasWidth: 2400,
            canvasHeight: 2400,
            targetPersonHeight: 2050,
            spacing: 130
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Composition failed on image processing server.");
        }

        setComposedUrl(data.dataUrl);
        setHasGeneratedOnce(true);
        if (data.person1CutoutUrl) setPerson1CutoutUrl(data.person1CutoutUrl);
        if (data.person2CutoutUrl) setPerson2CutoutUrl(data.person2CutoutUrl);
        if (data.boundingBoxes) setBoundingBoxes(data.boundingBoxes);
        if (data.normalization) setNormalization(data.normalization);

        if (onComposed) {
          onComposed(data.dataUrl);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[CoupleComposer] Composition pipeline failed:", msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [
      person1ImageUrl,
      person2ImageUrl,
      person1SourcePhoto,
      person2SourcePhoto,
      person1CutoutUrl,
      person2CutoutUrl,
      selectedBgId,
      selectedBgUrl,
      customColorHex,
      uploadedBgUrl,
      onComposed
    ]
  );

  // Auto-generate on initial mount when both photos are present and haven't generated yet
  useEffect(() => {
    const p1 = person1ImageUrl || person1SourcePhoto;
    const p2 = person2ImageUrl || person2SourcePhoto;
    if (p1 && p2 && !composedUrl && !loading && !hasGeneratedOnce) {
      const timer = setTimeout(() => {
        runCompositionPipeline(selectedBgId, selectedBgUrl, customColorHex);
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person1ImageUrl, person2ImageUrl]);

  // Handle Preset selection
  const handleSelectPreset = (preset: BackgroundPresetItem) => {
    setSelectedBgId(preset.id);
    setSelectedBgUrl(preset.imageUrl || null);
    runCompositionPipeline(preset.id, preset.imageUrl || null, customColorHex);
    persistBackgroundToSession(preset.id, customColorHex, preset.imageUrl || null);
  };

  // Handle Studio selection
  const handleSelectStudio = (item: BackgroundPresetItem) => {
    setSelectedBgId(item.id);
    if (item.type === "studio") {
      setSelectedBgUrl(null);
      runCompositionPipeline(item.id, null, customColorHex);
      persistBackgroundToSession(item.id, customColorHex, null);
    } else if (item.type === "custom") {
      setSelectedBgUrl(null);
      runCompositionPipeline("custom", null, customColorHex);
      persistBackgroundToSession("custom", customColorHex, null);
    } else if (item.type === "upload") {
      if (uploadedBgUrl) {
        setSelectedBgUrl(uploadedBgUrl);
        runCompositionPipeline("upload", uploadedBgUrl, customColorHex);
        persistBackgroundToSession("upload", customColorHex, uploadedBgUrl);
      } else {
        bgUploadRef.current?.click();
      }
    }
  };

  // Handle custom hex color change
  const handleCustomColorChange = (newHex: string) => {
    setCustomColorHex(newHex);
    setSelectedBgId("custom");
    setSelectedBgUrl(null);
    runCompositionPipeline("custom", null, newHex);
    persistBackgroundToSession("custom", newHex, null);
  };

  // Handle background file upload
  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
      setError("Please select a supported image file (JPG, JPEG, PNG, or WebP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("Background image exceeds 15MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedBgUrl(dataUrl);
      setSelectedBgId("upload");
      setSelectedBgUrl(dataUrl);
      runCompositionPipeline("upload", dataUrl, customColorHex);
      persistBackgroundToSession("upload", customColorHex, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Remove uploaded background
  const handleRemoveUploadedBg = () => {
    setUploadedBgUrl(null);
    const fallback = occasionData.recommendedPreset;
    setSelectedBgId(fallback.id);
    setSelectedBgUrl(fallback.imageUrl || null);
    if (bgUploadRef.current) bgUploadRef.current.value = "";
    runCompositionPipeline(fallback.id, fallback.imageUrl || null, customColorHex);
    persistBackgroundToSession(fallback.id, customColorHex, fallback.imageUrl || null);
  };

  // Reset to default recommended background
  const handleResetToDefault = () => {
    const fallback = occasionData.recommendedPreset;
    setSelectedBgId(fallback.id);
    setSelectedBgUrl(fallback.imageUrl || null);
    setCustomColorHex("#1764FF");
    setUploadedBgUrl(null);
    if (bgUploadRef.current) bgUploadRef.current.value = "";
    runCompositionPipeline(fallback.id, fallback.imageUrl || null, "#1764FF");
    persistBackgroundToSession(fallback.id, "#1764FF", fallback.imageUrl || null);
  };

  // Download composed 2400 × 2400 PNG
  const handleDownload = () => {
    if (!composedUrl) return;
    const link = document.createElement("a");
    const bgTag = selectedBgId.replace("_", "-");
    link.download = `lookmates-couple-portrait-${bgTag}-2400x2400.png`;
    link.href = composedUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentBgLabel =
    occasionData.presets.find((p) => p.id === selectedBgId)?.name ||
    occasionData.studioOptions.find((s) => s.id === selectedBgId)?.name ||
    (selectedBgId === "custom" ? `Custom (${customColorHex})` : selectedBgId);

  return (
    <div className="space-y-8">
      {/* Hidden File Input for Background Upload */}
      <input
        ref={bgUploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleBgFileUpload}
        className="hidden"
      />

      {/* ========================================================= */}
      {/* STEP 5 WORKSPACE: GENERATE COUPLE IMAGE                   */}
      {/* ========================================================= */}
      <div className="bg-white border-2 border-[#111827] rounded-[4px] p-5 sm:p-8 shadow-[4px_4px_0px_#080B10] space-y-6">
        {/* Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#111827]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase tracking-wide">
                STEP 5 • GENERATE COUPLE IMAGE
              </span>
              <span className="bg-[#080B10] text-[#1764FF] text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase border border-[#1764FF] flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>AI POWERED</span>
              </span>
              <span className="border border-[#111827] bg-[#F7F9FC] text-[#080B10] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                {currentBgLabel}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight uppercase">
              GENERATE COUPLE IMAGE
            </h2>
            <p className="text-xs text-[#647084] mt-0.5">
              Create a stunning couple image based on your style and occasion.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => runCompositionPipeline(selectedBgId, selectedBgUrl, customColorHex)}
              disabled={loading}
              className="lm-btn-secondary !py-2.5 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#080B10]"
              title="Regenerate Couple Portrait"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Regenerate</span>
            </button>

            {composedUrl && (
              <button
                onClick={handleDownload}
                disabled={loading}
                className="lm-btn-primary !py-2.5 !px-5 text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#080B10] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TWO-COLUMN WORKSPACE: PREVIEW (LEFT) + CONTROLS (RIGHT)    */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* MAIN LEFT PANEL: COUPLE IMAGE PREVIEW (7 COLUMNS) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative border-2 border-[#111827] rounded-[4px] overflow-hidden bg-[#F7F9FC] shadow-[3px_3px_0px_#080B10] min-h-[460px] flex items-center justify-center">
              {/* Empty State before Generation */}
              {!loading && !composedUrl && !error && (
                <div className="p-8 text-center space-y-4 max-w-md">
                  <div className="w-16 h-16 bg-[#EFF6FF] border-2 border-[#1764FF] rounded-full mx-auto flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-[#1764FF]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#080B10] uppercase font-mono">
                      Ready to Generate Couple Image
                    </h3>
                    <p className="text-xs text-[#647084] mt-1 leading-relaxed">
                      LookMates combines {person1Name}&apos;s and {person2Name}&apos;s looks, normalizes heights to the exact same floor baseline, and sets the scene against your selected {occasion} background.
                    </p>
                  </div>
                  <button
                    onClick={() => runCompositionPipeline(selectedBgId, selectedBgUrl, customColorHex)}
                    className="lm-btn-primary !py-2.5 !px-6 text-xs font-black shadow-[2px_2px_0px_#080B10] cursor-pointer"
                  >
                    Generate Couple Image Now
                  </button>
                </div>
              )}

              {/* Real Loading State */}
              {loading && (
                <div className="p-8 text-center space-y-4">
                  <div className="w-14 h-14 border-4 border-[#1764FF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <div>
                    <p className="font-mono text-sm font-bold text-[#080B10]">
                      Generating Couple Portrait...
                    </p>
                    <p className="font-mono text-xs text-[#647084] mt-1">{loadingStage}</p>
                  </div>
                  <div className="inline-block px-3 py-1 bg-white border border-[#111827] text-[10px] font-mono text-[#647084] rounded-[2px]">
                    YouCam AI Salient Object Detection • 2400 × 2400 Resolution
                  </div>
                </div>
              )}

              {/* Error State */}
              {!loading && error && (
                <div className="p-6 text-center space-y-3 max-w-md">
                  <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto" />
                  <p className="font-mono text-xs font-bold text-[#DC2626]">
                    Generation Failed: {error}
                  </p>
                  <p className="text-[11px] text-[#647084]">
                    Verify that source photos are clear and valid garment selections are applied.
                  </p>
                  <button
                    onClick={() => runCompositionPipeline(selectedBgId, selectedBgUrl, customColorHex)}
                    className="lm-btn-secondary !py-2 !px-4 text-xs font-bold cursor-pointer"
                  >
                    Retry Generation
                  </button>
                </div>
              )}

              {/* Completed Generated Couple Image */}
              {!loading && composedUrl && (
                <div
                  className={`w-full h-full min-h-[460px] max-h-[580px] flex items-center justify-center p-2 ${
                    selectedBgId === "transparent"
                      ? "bg-[linear-gradient(45deg,#E2E8F0_25%,transparent_25%),linear-gradient(-45deg,#E2E8F0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E2E8F0_75%),linear-gradient(-45deg,transparent_75%,#E2E8F0_75%)] bg-[size:20px_20px] bg-white"
                      : "bg-[#080B10]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={composedUrl}
                    alt="Generated Couple Portrait"
                    className="w-full h-full object-contain max-h-[560px] select-none"
                  />

                  {/* Expand Full Size Control */}
                  <button
                    type="button"
                    onClick={() => setModalImage({ url: composedUrl, title: "Full Couple Portrait (2400 × 2400)" })}
                    className="absolute bottom-3 right-3 bg-white/95 hover:bg-white border border-[#111827] text-[#080B10] px-2.5 py-1.5 rounded-[2px] font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#080B10] cursor-pointer transition-colors"
                    title="View Full Size (2400 × 2400)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#1764FF]" />
                    <span>Expand Full Size</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quality & Preservation Badges below preview */}
            <div className="flex items-center justify-between text-[11px] font-mono text-[#647084] px-1 flex-wrap gap-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16803C]" />
                <span>Identities, faces & unselected garments 100% pixel-preserved</span>
              </span>
              {normalization && (
                <button
                  type="button"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="font-bold text-[#1764FF] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>{showTechDetails ? "Hide Metrics" : "View Height Matching Metrics"}</span>
                  {showTechDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Technical Height Matching Metrics (Expandable) */}
            {showTechDetails && boundingBoxes && normalization && (
              <div className="p-3 bg-[#EFF6FF] border border-[#1764FF] rounded-[4px] text-xs font-mono space-y-2">
                <div className="flex items-center justify-between border-b border-[#BFDBFE] pb-1 text-[10px]">
                  <span className="font-bold text-[#1764FF] uppercase">
                    Pixel-Level Normalization & Baseline Alignment Telemetry
                  </span>
                  <span>Target Height: {normalization.targetHeight}px</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] text-[#475569]">
                  <div>
                    <strong className="text-[#080B10]">{person1Name}:</strong> Scale ×{normalization.person1Scale} • Size: {normalization.scaledPerson1.width}×{normalization.scaledPerson1.height}px
                  </div>
                  <div>
                    <strong className="text-[#080B10]">{person2Name}:</strong> Scale ×{normalization.person2Scale} • Size: {normalization.scaledPerson2.width}×{normalization.scaledPerson2.height}px
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MAIN RIGHT PANEL: GENERATION CONTROLS (5 COLUMNS) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Occasion Summary Box */}
            <div className="p-3.5 bg-[#F7F9FC] border-2 border-[#111827] rounded-[4px] shadow-[2px_2px_0px_#080B10]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-[#647084] uppercase">
                  Selected Occasion
                </span>
                <span className="bg-[#1764FF] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] uppercase">
                  {occasion}
                </span>
              </div>
              <p className="text-xs text-[#080B10] font-bold">
                Curated AI backdrops optimized for {occasion}.
              </p>
            </div>

            {/* Background Selector Container */}
            <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-white shadow-[2px_2px_0px_#080B10] space-y-3">
              <div className="flex items-center justify-between border-b border-[#DCE3EF] pb-2">
                <span className="text-xs font-mono font-bold text-[#080B10] uppercase tracking-wide">
                  Select Background
                </span>

                {/* Tabs: Occasion Presets vs Solid Studio */}
                <div className="flex items-center gap-1 bg-[#F7F9FC] p-0.5 border border-[#111827] rounded-[2px]">
                  <button
                    type="button"
                    onClick={() => setBgTab("presets")}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] cursor-pointer transition-colors ${
                      bgTab === "presets" ? "bg-[#1764FF] text-white" : "text-[#647084] hover:text-[#080B10]"
                    }`}
                  >
                    Occasion Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgTab("studio")}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] cursor-pointer transition-colors ${
                      bgTab === "studio" ? "bg-[#1764FF] text-white" : "text-[#647084] hover:text-[#080B10]"
                    }`}
                  >
                    Studio Backdrops
                  </button>
                </div>
              </div>

              {/* TAB 1: OCCASION PRESETS */}
              {bgTab === "presets" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {occasionData.presets.map((preset) => {
                      const isSelected = selectedBgId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`relative text-left p-1.5 rounded-[3px] border-2 transition-all cursor-pointer group flex flex-col gap-1.5 ${
                            isSelected
                              ? "border-[#1764FF] bg-[#EFF6FF] shadow-[2px_2px_0px_#1764FF]"
                              : "border-[#DCE3EF] hover:border-[#111827] bg-white"
                          }`}
                        >
                          {/* Real Background Thumbnail */}
                          <div className="relative w-full aspect-[4/3] rounded-[2px] overflow-hidden border border-[#111827] bg-[#E2E8F0]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preset.imageUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            {preset.recommended && (
                              <span className="absolute top-1 left-1 bg-[#1764FF] text-white text-[8px] font-mono font-black px-1.5 py-0.2 rounded-[1px] shadow-sm uppercase">
                                Recommended
                              </span>
                            )}
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 bg-[#1764FF] rounded-full flex items-center justify-center text-white">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="text-[11px] font-bold text-[#080B10] line-clamp-1">
                              {preset.name}
                            </div>
                            <div className="text-[9px] text-[#647084] line-clamp-1 font-mono">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: STUDIO & CUSTOM BACKDROPS */}
              {bgTab === "studio" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {occasionData.studioOptions.map((item) => {
                      const isSelected = selectedBgId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectStudio(item)}
                          className={`text-left p-2 rounded-[3px] border-2 transition-all cursor-pointer flex flex-col gap-1.5 ${
                            isSelected
                              ? "border-[#1764FF] bg-[#EFF6FF] shadow-[2px_2px_0px_#1764FF]"
                              : "border-[#DCE3EF] hover:border-[#111827] bg-white"
                          }`}
                        >
                          <div
                            className={`w-full aspect-[16/9] rounded-[2px] border border-[#111827] flex items-center justify-center ${
                              item.id === "transparent"
                                ? "bg-[linear-gradient(45deg,#E2E8F0_25%,transparent_25%),linear-gradient(-45deg,#E2E8F0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E2E8F0_75%),linear-gradient(-45deg,transparent_75%,#E2E8F0_75%)] bg-[size:10px_10px] bg-white"
                                : item.id === "upload"
                                ? "bg-[#F7F9FC]"
                                : ""
                            }`}
                            style={
                              item.colorHex && item.colorHex !== "transparent"
                                ? { backgroundColor: item.colorHex }
                                : undefined
                            }
                          >
                            {item.id === "upload" && <Upload className="w-4 h-4 text-[#1764FF]" />}
                            {item.id === "custom" && <Palette className="w-4 h-4 text-white" />}
                            {isSelected && item.id !== "custom" && (
                              <Check className="w-3.5 h-3.5 text-[#1764FF]" />
                            )}
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-[#080B10] leading-tight">
                              {item.name}
                            </div>
                            <div className="text-[9px] text-[#647084] font-mono leading-tight">
                              {item.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Hex Picker Input */}
                  {selectedBgId === "custom" && (
                    <div className="p-3 bg-[#F7F9FC] border border-[#111827] rounded-[3px] space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColorHex}
                          onChange={(e) => handleCustomColorChange(e.target.value)}
                          className="w-8 h-8 border border-[#111827] rounded-[2px] cursor-pointer bg-white"
                        />
                        <div className="flex items-center gap-1 border border-[#111827] rounded-[2px] px-2 py-1 bg-white">
                          <span className="text-xs font-mono font-bold text-[#647084]">#</span>
                          <input
                            type="text"
                            value={customColorHex.replace(/^#/, "")}
                            onChange={(e) => {
                              const val = `#${e.target.value.replace(/[^0-9a-fA-F]/g, "")}`;
                              if (val.length <= 7) {
                                setCustomColorHex(val);
                                if (val.length === 7) handleCustomColorChange(val);
                              }
                            }}
                            className="w-16 text-xs font-mono font-bold text-[#080B10] uppercase outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload Image Details */}
                  {selectedBgId === "upload" && (
                    <div className="p-3 bg-[#F7F9FC] border border-[#111827] rounded-[3px] flex items-center justify-between gap-2">
                      <div className="text-[11px] font-mono text-[#080B10]">
                        {uploadedBgUrl ? "Custom backdrop image loaded" : "No file selected"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => bgUploadRef.current?.click()}
                          className="text-[11px] font-mono font-bold text-[#1764FF] hover:underline cursor-pointer"
                        >
                          {uploadedBgUrl ? "Change File" : "Choose File"}
                        </button>
                        {uploadedBgUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveUploadedBg}
                            className="text-[11px] font-mono text-[#DC2626] hover:underline cursor-pointer ml-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reset to Recommended Preset */}
              <div className="pt-2 border-t border-[#DCE3EF] flex justify-end">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[10px] font-mono font-bold text-[#647084] hover:text-[#080B10] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5 text-[#1764FF]" />
                  <span>Reset to Recommended ({occasionData.recommendedPreset.name})</span>
                </button>
              </div>
            </div>

            {/* Primary Generation CTA */}
            <button
              onClick={() => runCompositionPipeline(selectedBgId, selectedBgUrl, customColorHex)}
              disabled={loading}
              className="w-full lm-btn-primary !py-3.5 !px-6 text-sm font-black flex items-center justify-center gap-2 shadow-[3px_3px_0px_#080B10] cursor-pointer uppercase tracking-wide"
            >
              <Sparkles className="w-4 h-4" />
              <span>{composedUrl ? "Regenerate Couple Portrait" : "Generate Couple Portrait"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 6: INDIVIDUAL OUTFIT RESULTS                      */}
      {/* ========================================================= */}
      <div className="bg-white border-2 border-[#111827] rounded-[4px] p-5 sm:p-7 shadow-[4px_4px_0px_#080B10] space-y-5">
        <div className="pb-3 border-b-2 border-[#111827]">
          <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase tracking-wide inline-block mb-1">
            VERIFIED OUTFIT RESULTS
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-[#080B10] tracking-tight uppercase">
            INDIVIDUAL OUTFIT RESULTS
          </h3>
          <p className="text-xs text-[#647084] mt-0.5">
            Review each look used to create your couple image.
          </p>
        </div>

        {/* Two Individual Result Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PERSON 1 CARD */}
          <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-[#F7F9FC] shadow-[2px_2px_0px_#080B10] flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE3EF]">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#647084] uppercase">
                  PARTICIPANT 1
                </span>
                <h4 className="text-sm font-black text-[#080B10]">{person1Name}</h4>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5">
                {person1Status === "succeeded" || person1ImageUrl ? (
                  <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>Try-On Complete</span>
                  </span>
                ) : person1Status === "failed" ? (
                  <span className="bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                    Failed
                  </span>
                ) : (
                  <span className="bg-[#FEF3C7] text-[#B45309] border border-[#B45309] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                    Processing
                  </span>
                )}
              </div>
            </div>

            {/* Individual Image Preview */}
            <div className="relative aspect-[3/4] max-h-[380px] bg-white border border-[#111827] rounded-[2px] overflow-hidden flex items-center justify-center">
              {person1ImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person1ImageUrl}
                  alt={`${person1Name} Outfit Result`}
                  className="w-full h-full object-contain"
                />
              ) : person1SourcePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person1SourcePhoto}
                  alt={`${person1Name} Source Photo`}
                  className="w-full h-full object-contain opacity-70"
                />
              ) : (
                <div className="text-center p-4 text-xs font-mono text-[#647084]">
                  No photo available for {person1Name}
                </div>
              )}

              {/* Full Size Button Overlay */}
              {(person1ImageUrl || person1SourcePhoto) && (
                <button
                  type="button"
                  onClick={() =>
                    setModalImage({
                      url: (person1ImageUrl || person1SourcePhoto)!,
                      title: `${person1Name} Individual Outfit`
                    })
                  }
                  className="absolute bottom-2 right-2 bg-white/95 hover:bg-white border border-[#111827] text-[#080B10] px-2 py-1 rounded-[2px] font-mono text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-[#1764FF]" />
                  <span>Full Size</span>
                </button>
              )}
            </div>

            {/* Applied Garment Tags & Error State */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-[#647084] uppercase">Categories:</span>
                {person1Categories.length > 0 ? (
                  person1Categories.map((cat) => (
                    <span
                      key={cat}
                      className="bg-white border border-[#111827] text-[#080B10] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] uppercase"
                    >
                      {cat}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] font-mono text-[#080B10]">{person1Garment}</span>
                )}
              </div>

              {person1Status === "failed" && (
                <div className="p-2 bg-[#FEE2E2] border border-[#DC2626] rounded-[2px] text-[10px] font-mono text-[#DC2626] flex items-center justify-between">
                  <span>{person1ErrorMessage || "Virtual try-on error"}</span>
                  {onRetryPerson1 && (
                    <button
                      onClick={onRetryPerson1}
                      disabled={isRetryingPerson1}
                      className="underline font-bold cursor-pointer"
                    >
                      {isRetryingPerson1 ? "Retrying..." : "Retry"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PERSON 2 CARD */}
          <div className="border-2 border-[#111827] rounded-[4px] p-4 bg-[#F7F9FC] shadow-[2px_2px_0px_#080B10] flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE3EF]">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#647084] uppercase">
                  PARTICIPANT 2
                </span>
                <h4 className="text-sm font-black text-[#080B10]">{person2Name}</h4>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5">
                {person2Status === "succeeded" || person2ImageUrl ? (
                  <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>Try-On Complete</span>
                  </span>
                ) : person2Status === "failed" ? (
                  <span className="bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                    Failed
                  </span>
                ) : (
                  <span className="bg-[#FEF3C7] text-[#B45309] border border-[#B45309] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                    Processing
                  </span>
                )}
              </div>
            </div>

            {/* Individual Image Preview */}
            <div className="relative aspect-[3/4] max-h-[380px] bg-white border border-[#111827] rounded-[2px] overflow-hidden flex items-center justify-center">
              {person2ImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person2ImageUrl}
                  alt={`${person2Name} Outfit Result`}
                  className="w-full h-full object-contain"
                />
              ) : person2SourcePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person2SourcePhoto}
                  alt={`${person2Name} Source Photo`}
                  className="w-full h-full object-contain opacity-70"
                />
              ) : (
                <div className="text-center p-4 text-xs font-mono text-[#647084]">
                  No photo available for {person2Name}
                </div>
              )}

              {/* Full Size Button Overlay */}
              {(person2ImageUrl || person2SourcePhoto) && (
                <button
                  type="button"
                  onClick={() =>
                    setModalImage({
                      url: (person2ImageUrl || person2SourcePhoto)!,
                      title: `${person2Name} Individual Outfit`
                    })
                  }
                  className="absolute bottom-2 right-2 bg-white/95 hover:bg-white border border-[#111827] text-[#080B10] px-2 py-1 rounded-[2px] font-mono text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-[#1764FF]" />
                  <span>Full Size</span>
                </button>
              )}
            </div>

            {/* Applied Garment Tags & Error State */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-[#647084] uppercase">Categories:</span>
                {person2Categories.length > 0 ? (
                  person2Categories.map((cat) => (
                    <span
                      key={cat}
                      className="bg-white border border-[#111827] text-[#080B10] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] uppercase"
                    >
                      {cat}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] font-mono text-[#080B10]">{person2Garment}</span>
                )}
              </div>

              {person2Status === "failed" && (
                <div className="p-2 bg-[#FEE2E2] border border-[#DC2626] rounded-[2px] text-[10px] font-mono text-[#DC2626] flex items-center justify-between">
                  <span>{person2ErrorMessage || "Virtual try-on error"}</span>
                  {onRetryPerson2 && (
                    <button
                      onClick={onRetryPerson2}
                      disabled={isRetryingPerson2}
                      className="underline font-bold cursor-pointer"
                    >
                      {isRetryingPerson2 ? "Retrying..." : "Retry"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FULL-SIZE IMAGE PREVIEW MODAL                             */}
      {/* ========================================================= */}
      {modalImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-[#080B10] border-2 border-white rounded-[4px] p-3 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between pb-2 px-2 border-b border-gray-700">
              <span className="text-xs font-mono font-bold text-white uppercase">
                {modalImage.title}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalZoom(modalZoom === 1 ? 1.5 : 1)}
                  className="text-white hover:text-[#1764FF] p-1 bg-white/10 rounded-[2px] cursor-pointer"
                  title={modalZoom === 1 ? "Zoom in (1.5x)" : "Reset zoom"}
                >
                  {modalZoom === 1 ? <ZoomIn className="w-4 h-4" /> : <ZoomOut className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalImage(null);
                    setModalZoom(1);
                  }}
                  className="text-white hover:text-red-400 p-1 cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modalImage.url}
                alt={modalImage.title}
                style={{
                  transform: `scale(${modalZoom})`,
                  transition: "transform 0.2s ease-out"
                }}
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
            <div className="pt-2 px-2 flex items-center justify-between border-t border-gray-800">
              <span className="text-[10px] font-mono text-gray-400">
                Press ESC or click &times; to exit. Entire portrait silhouette is uncropped.
              </span>
              <a
                href={modalImage.url}
                download="lookmates-image.png"
                className="lm-btn-primary !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
