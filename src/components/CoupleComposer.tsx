"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Download,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
  Image as ImageIcon,
  Check,
  Layers,
  Crop,
  Maximize2,
  Upload,
  Palette,
  RotateCcw,
  Trash2
} from "lucide-react";

export type BackgroundType =
  | "transparent"
  | "white"
  | "soft_grey"
  | "warm_beige"
  | "midnight_black"
  | "custom"
  | "upload";

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

interface CoupleComposerProps {
  person1ImageUrl: string;
  person2ImageUrl: string;
  referenceImageUrl?: string | null;
  onReferenceChange?: (newUrl: string | null) => void;
  person1Name?: string;
  person2Name?: string;
  person1Garment?: string;
  person2Garment?: string;
  occasion: string;
  onComposed?: (dataUrl: string) => void;
  sessionId?: string | null;
  initialBackground?: BackgroundType;
  initialCustomColorHex?: string;
  initialBackgroundImageUrl?: string | null;
  onBackgroundSaved?: (settings: {
    background: BackgroundType;
    customColorHex?: string;
    backgroundImageUrl?: string | null;
  }) => void;
}

export function CoupleComposer({
  person1ImageUrl,
  person2ImageUrl,
  referenceImageUrl,
  onReferenceChange,
  person1Name = "Person 1",
  person2Name = "Person 2",
  person1Garment = "Outfit 1",
  person2Garment = "Outfit 2",
  occasion,
  onComposed,
  sessionId,
  initialBackground = "transparent",
  initialCustomColorHex = "#1764FF",
  initialBackgroundImageUrl = null,
  onBackgroundSaved
}: CoupleComposerProps) {
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<string>("Initializing segmentation...");
  const [error, setError] = useState<string | null>(null);

  // Background Studio state
  const [background, setBackground] = useState<BackgroundType>(initialBackground);
  const [customColorHex, setCustomColorHex] = useState<string>(initialCustomColorHex);
  const [uploadedBgUrl, setUploadedBgUrl] = useState<string | null>(initialBackgroundImageUrl);
  const bgUploadRef = useRef<HTMLInputElement | null>(null);

  // Cached transparent cutouts from YouCam AI SOD
  const [person1CutoutUrl, setPerson1CutoutUrl] = useState<string | null>(null);
  const [person2CutoutUrl, setPerson2CutoutUrl] = useState<string | null>(null);

  // Inspection & Bounding Box Data
  const [boundingBoxes, setBoundingBoxes] = useState<{ person1: BoundingBox; person2: BoundingBox } | null>(null);
  const [normalization, setNormalization] = useState<NormalizationData | null>(null);
  const [showIndividualResults, setShowIndividualResults] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Spacing & Target Height adjustments
  const [targetHeight, setTargetHeight] = useState<number>(2050);
  const [subjectSpacing, setSubjectSpacing] = useState<number>(130);

  // Persist background settings to session
  const persistBackgroundToSession = useCallback(
    async (bg: BackgroundType, hex: string, bgImg: string | null) => {
      if (!sessionId) return;
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            backgroundSetting: bg,
            customColorHex: hex,
            customBackgroundImage: bgImg
          })
        });
        if (onBackgroundSaved) {
          onBackgroundSaved({
            background: bg,
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
      bgChoice: BackgroundType = background,
      tHeight = targetHeight,
      sp = subjectSpacing,
      customHex = customColorHex,
      uploadUrl = uploadedBgUrl
    ) => {
      if (!person1ImageUrl || !person2ImageUrl) return;

      try {
        setLoading(true);
        setError(null);
        if (!person1CutoutUrl || !person2CutoutUrl) {
          setLoadingStage("Removing backgrounds with YouCam AI SOD...");
        } else {
          setLoadingStage("Rendering custom background layer in Background Studio...");
        }

        const response = await fetch("/api/compose-portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person1ImageUrl,
            person2ImageUrl,
            person1CutoutUrl: person1CutoutUrl || undefined,
            person2CutoutUrl: person2CutoutUrl || undefined,
            background: bgChoice,
            customColorHex: customHex,
            backgroundImageUrl: uploadUrl || undefined,
            canvasWidth: 2400,
            canvasHeight: 2400,
            targetPersonHeight: tHeight,
            spacing: sp
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Composition failed on image processing server.");
        }

        setComposedUrl(data.dataUrl);
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
      person1CutoutUrl,
      person2CutoutUrl,
      background,
      targetHeight,
      subjectSpacing,
      customColorHex,
      uploadedBgUrl,
      onComposed
    ]
  );

  // Trigger on initial mount or when input try-on URLs change
  useEffect(() => {
    runCompositionPipeline(background, targetHeight, subjectSpacing, customColorHex, uploadedBgUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person1ImageUrl, person2ImageUrl]);

  // Handle background type change
  const handleBackgroundChange = (newBg: BackgroundType) => {
    setBackground(newBg);
    runCompositionPipeline(newBg, targetHeight, subjectSpacing, customColorHex, uploadedBgUrl);
    persistBackgroundToSession(newBg, customColorHex, uploadedBgUrl);
  };

  // Handle custom hex color change
  const handleCustomColorChange = (newHex: string) => {
    setCustomColorHex(newHex);
    setBackground("custom");
    runCompositionPipeline("custom", targetHeight, subjectSpacing, newHex, uploadedBgUrl);
    persistBackgroundToSession("custom", newHex, uploadedBgUrl);
  };

  // Handle background file upload (JPG, JPEG, PNG, WebP)
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
      setBackground("upload");
      runCompositionPipeline("upload", targetHeight, subjectSpacing, customColorHex, dataUrl);
      persistBackgroundToSession("upload", customColorHex, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Remove uploaded background
  const handleRemoveUploadedBg = () => {
    setUploadedBgUrl(null);
    setBackground("transparent");
    if (bgUploadRef.current) bgUploadRef.current.value = "";
    runCompositionPipeline("transparent", targetHeight, subjectSpacing, customColorHex, null);
    persistBackgroundToSession("transparent", customColorHex, null);
  };

  // Reset to default
  const handleResetToDefault = () => {
    setBackground("transparent");
    setCustomColorHex("#1764FF");
    setUploadedBgUrl(null);
    if (bgUploadRef.current) bgUploadRef.current.value = "";
    runCompositionPipeline("transparent", targetHeight, subjectSpacing, "#1764FF", null);
    persistBackgroundToSession("transparent", "#1764FF", null);
  };

  // Download composed 2400 × 2400 PNG
  const handleDownload = () => {
    if (!composedUrl) return;

    const link = document.createElement("a");
    const bgTag = background === "transparent" ? "transparent" : background.replace("_", "-");
    link.download = `lookmates-couple-portrait-${bgTag}-2400x2400.png`;
    link.href = composedUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Background Options Definition
  const bgOptions: Array<{
    id: BackgroundType;
    label: string;
    sublabel: string;
    colorSwatch?: string;
    isCheckerboard?: boolean;
    isUpload?: boolean;
  }> = [
    {
      id: "transparent",
      label: "Transparent",
      sublabel: "Alpha PNG",
      isCheckerboard: true
    },
    {
      id: "white",
      label: "Pure White",
      sublabel: "#FFFFFF",
      colorSwatch: "#FFFFFF"
    },
    {
      id: "soft_grey",
      label: "Soft Grey",
      sublabel: "#F3F4F6",
      colorSwatch: "#F3F4F6"
    },
    {
      id: "warm_beige",
      label: "Warm Beige",
      sublabel: "#F5F0E6",
      colorSwatch: "#F5F0E6"
    },
    {
      id: "midnight_black",
      label: "Midnight Black",
      sublabel: "#0A0A0C",
      colorSwatch: "#0A0A0C"
    },
    {
      id: "custom",
      label: "Custom Color",
      sublabel: customColorHex.toUpperCase(),
      colorSwatch: customColorHex
    },
    {
      id: "upload",
      label: "Upload Image",
      sublabel: uploadedBgUrl ? "Custom Image" : "JPG/PNG/WebP",
      isUpload: true
    }
  ];

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Background Upload */}
      <input
        ref={bgUploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleBgFileUpload}
        className="hidden"
      />

      {/* MASTER CARD: NEO-BRUTALIST CONTAINER */}
      <div className="bg-white border-2 border-[#111827] rounded-[4px] p-5 sm:p-7 shadow-[4px_4px_0px_#080B10]">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b-2 border-[#111827] mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase tracking-wide">
                2400 × 2400 px • Height-Matched Duo
              </span>
              <span className="bg-[#DCFCE7] text-[#16803C] border border-[#16803C] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                <span>YouCam AI Cutout Active</span>
              </span>
              <span className="border border-[#111827] bg-white text-[#080B10] text-[9px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">
                {background === "transparent"
                  ? "Transparent Alpha"
                  : background === "custom"
                  ? `Custom (${customColorHex})`
                  : background === "upload"
                  ? "Custom Image Backdrop"
                  : `${background.replace("_", " ")} Backdrop`}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
              Height-Matched Couple Composition
            </h2>
            <p className="text-xs text-[#647084] mt-0.5">
              Individual backgrounds removed via YouCam AI SOD. Both people normalized to identical visible height and aligned to the exact same floor baseline.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => runCompositionPipeline(background, targetHeight, subjectSpacing, customColorHex, uploadedBgUrl)}
              disabled={loading}
              className="lm-btn-secondary !py-2.5 !px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Re-run composition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Regenerate</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!composedUrl || loading}
              className="lm-btn-primary !py-2.5 !px-6 text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_#080B10] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Couple Portrait</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PHASE 1: BACKGROUND STUDIO                                */}
        {/* ========================================================= */}
        <div className="mb-6 p-4 sm:p-5 bg-[#F7F9FC] border-2 border-[#111827] rounded-[4px] shadow-[2px_2px_0px_#080B10] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EF]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#1764FF] text-white flex items-center justify-center rounded-[2px] font-mono font-bold text-xs">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#080B10] tracking-tight uppercase font-mono">
                  Background Studio
                </h3>
                <p className="text-[11px] text-[#647084]">
                  Render backdrop layer beneath both models. Live preview updates locally without re-running YouCam VTO.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="self-start sm:self-auto text-[11px] font-mono font-bold text-[#647084] hover:text-[#080B10] flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#111827] rounded-[2px] cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-[#1764FF]" />
              <span>Reset to Default</span>
            </button>
          </div>

          {/* 7 Background Option Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {bgOptions.map((opt) => {
              const isSelected = background === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === "upload" && !uploadedBgUrl) {
                      bgUploadRef.current?.click();
                    } else {
                      handleBackgroundChange(opt.id);
                    }
                  }}
                  className={`p-2.5 border-2 rounded-[3px] text-left transition-all cursor-pointer flex flex-col justify-between min-h-[76px] ${
                    isSelected
                      ? "border-[#1764FF] bg-white shadow-[2px_2px_0px_#1764FF]"
                      : "border-[#111827] bg-white hover:bg-[#F0F4FF]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    {opt.isCheckerboard ? (
                      <div className="w-6 h-6 rounded-[2px] border border-[#111827] bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[size:6px_6px] bg-white" />
                    ) : opt.isUpload ? (
                      <div className="w-6 h-6 rounded-[2px] border border-[#111827] bg-[#EFF6FF] flex items-center justify-center text-[#1764FF]">
                        {uploadedBgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={uploadedBgUrl} alt="uploaded" className="w-full h-full object-cover rounded-[1px]" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                      </div>
                    ) : (
                      <div
                        style={{ backgroundColor: opt.colorSwatch }}
                        className="w-6 h-6 rounded-[2px] border border-[#111827]"
                      />
                    )}

                    {isSelected && (
                      <span className="w-3.5 h-3.5 bg-[#1764FF] text-white rounded-full flex items-center justify-center text-[9px]">
                        ✓
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-mono font-bold text-xs text-[#080B10] truncate leading-tight">
                      {opt.label}
                    </div>
                    <div className="font-mono text-[9px] text-[#647084] truncate mt-0.5">
                      {opt.sublabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sub-Panel: Custom Color Controls */}
          {background === "custom" && (
            <div className="p-3 bg-white border border-[#111827] rounded-[3px] flex flex-wrap items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#080B10] uppercase flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#1764FF]" />
                  Pick Color:
                </span>
                <input
                  type="color"
                  value={customColorHex}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="w-9 h-8 border border-[#111827] rounded-[2px] cursor-pointer bg-white p-0.5"
                  title="Choose custom background color"
                />
                <div className="flex items-center gap-1 border border-[#111827] rounded-[2px] px-2 py-1 bg-[#F7F9FC]">
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
                    placeholder="1764FF"
                    className="w-20 text-xs font-mono font-bold text-[#080B10] uppercase bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* Quick curated palettes */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-[#647084] uppercase mr-1">Presets:</span>
                {[
                  { name: "Electric Blue", hex: "#1764FF" },
                  { name: "Slate Navy", hex: "#0F172A" },
                  { name: "Rose Champagne", hex: "#EAD7CD" },
                  { name: "Emerald Green", hex: "#064E3B" },
                  { name: "Warm Terracotta", hex: "#9A3412" },
                  { name: "Minimal Concrete", hex: "#E2E8F0" }
                ].map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => handleCustomColorChange(preset.hex)}
                    style={{ backgroundColor: preset.hex }}
                    className="w-5 h-5 rounded-[2px] border border-[#111827] hover:scale-110 transition-transform cursor-pointer"
                    title={`${preset.name} (${preset.hex})`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sub-Panel: Uploaded Background Controls */}
          {background === "upload" && (
            <div className="p-3 bg-white border border-[#111827] rounded-[3px] flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                {uploadedBgUrl ? (
                  <div className="w-12 h-12 rounded-[2px] border border-[#111827] overflow-hidden bg-[#F7F9FC] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedBgUrl} alt="Backdrop Thumbnail" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-[2px] border border-dashed border-[#111827] flex items-center justify-center bg-[#F7F9FC] text-[#647084]">
                    <Upload className="w-4 h-4 text-[#1764FF]" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-mono font-bold text-[#080B10]">
                    {uploadedBgUrl ? "Custom Background Image Active" : "No Background Image Uploaded"}
                  </div>
                  <div className="text-[10px] text-[#647084]">
                    Scaled proportionally with center cover. Both participants remain in the foreground.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bgUploadRef.current?.click()}
                  className="lm-btn-secondary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#1764FF]" />
                  <span>{uploadedBgUrl ? "Replace Background" : "Upload Image"}</span>
                </button>

                {uploadedBgUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveUploadedBg}
                    className="text-[#DC2626] hover:bg-[#FEE2E2] border border-[#DC2626] rounded-[2px] px-2.5 py-1.5 text-xs font-bold font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    title="Remove uploaded background"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Telemetry Quick Bar */}
          {normalization && (
            <div className="flex items-center justify-between text-[11px] font-mono text-[#647084] pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Maximize2 className="w-3 h-3 text-[#1764FF]" />
                  Normalized Height: <strong className="text-[#080B10] font-bold">{normalization.targetHeight}px</strong>
                </span>
                <span>•</span>
                <span>
                  Baseline: <strong className="text-[#080B10] font-bold">{normalization.baselineY}px</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTechDetails(!showTechDetails)}
                className="font-bold text-[#1764FF] hover:underline cursor-pointer"
              >
                {showTechDetails ? "Hide Metrics" : "View Metrics"}
              </button>
            </div>
          )}
        </div>

        {/* Technical Bounding Box Metrics Drawer (Expandable) */}
        {showTechDetails && boundingBoxes && normalization && (
          <div className="mb-6 p-4 bg-[#EFF6FF] border border-[#1764FF] rounded-[4px] text-xs font-mono space-y-2">
            <div className="flex items-center justify-between border-b border-[#BFDBFE] pb-1.5">
              <span className="font-bold text-[#1764FF] uppercase">
                Pixel-Level Foreground Bounding Box & Normalization Telemetry
              </span>
              <span className="text-[10px] text-[#647084]">Canvas: 2400 × 2400 px</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-2.5 bg-white border border-[#BFDBFE] rounded-[2px]">
                <div className="font-bold text-[#080B10] mb-1">{person1Name} (Left Subject)</div>
                <div className="text-[11px] text-[#647084] space-y-0.5">
                  <div>Visible Bounds: [{boundingBoxes.person1.minX}, {boundingBoxes.person1.minY}] to [{boundingBoxes.person1.maxX}, {boundingBoxes.person1.maxY}]</div>
                  <div>Detected Visible Size: {boundingBoxes.person1.width}px (W) × {boundingBoxes.person1.height}px (H)</div>
                  <div>Normalization Scale: ×{normalization.person1Scale} → Scaled: {normalization.scaledPerson1.width}px × {normalization.scaledPerson1.height}px</div>
                  <div>Position: Left {normalization.scaledPerson1.left}px, Top {normalization.scaledPerson1.top}px, Baseline {normalization.baselineY}px</div>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-[#BFDBFE] rounded-[2px]">
                <div className="font-bold text-[#080B10] mb-1">{person2Name} (Right Subject)</div>
                <div className="text-[11px] text-[#647084] space-y-0.5">
                  <div>Visible Bounds: [{boundingBoxes.person2.minX}, {boundingBoxes.person2.minY}] to [{boundingBoxes.person2.maxX}, {boundingBoxes.person2.maxY}]</div>
                  <div>Detected Visible Size: {boundingBoxes.person2.width}px (W) × {boundingBoxes.person2.height}px (H)</div>
                  <div>Normalization Scale: ×{normalization.person2Scale} → Scaled: {normalization.scaledPerson2.width}px × {normalization.scaledPerson2.height}px</div>
                  <div>Position: Left {normalization.scaledPerson2.left}px, Top {normalization.scaledPerson2.top}px, Baseline {normalization.baselineY}px</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner State */}
        {loading && (
          <div className="max-w-xl mx-auto aspect-square bg-[#F7F9FC] border-2 border-[#111827] rounded-[4px] flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-12 h-12 border-4 border-[#1764FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-mono text-sm font-bold text-[#080B10]">
              Updating 2400 × 2400 Couple Composition...
            </p>
            <p className="font-mono text-xs text-[#647084]">{loadingStage}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-[#FEE2E2] border-2 border-[#DC2626] text-[#DC2626] font-mono text-xs space-y-2 rounded-[4px]">
            <p className="font-bold">Composition Warning: {error}</p>
            <button
              onClick={() => runCompositionPipeline(background, targetHeight, subjectSpacing, customColorHex, uploadedBgUrl)}
              className="lm-btn-secondary !py-1 !px-3 !text-xs cursor-pointer"
            >
              Retry Composition
            </button>
          </div>
        )}

        {/* FINAL COMPOSED COUPLE IMAGE DISPLAY (LIVE PREVIEW) */}
        {!loading && composedUrl && (
          <div className="relative border-2 border-[#111827] rounded-[4px] overflow-hidden max-w-2xl mx-auto shadow-md">
            {/* Transparent checkerboard background pattern */}
            <div
              className={`w-full aspect-square flex items-center justify-center ${
                background === "transparent"
                  ? "bg-[linear-gradient(45deg,#E2E8F0_25%,transparent_25%),linear-gradient(-45deg,#E2E8F0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E2E8F0_75%),linear-gradient(-45deg,transparent_75%,#E2E8F0_75%)] bg-[size:24px_24px] bg-[#FFFFFF]"
                  : background === "white"
                  ? "bg-white"
                  : background === "soft_grey"
                  ? "bg-[#F3F4F6]"
                  : background === "warm_beige"
                  ? "bg-[#F5F0E6]"
                  : background === "midnight_black"
                  ? "bg-[#0A0A0C]"
                  : "bg-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={composedUrl}
                alt="Composed Couple"
                className="w-full h-full object-contain select-none"
              />
            </div>
          </div>
        )}

        {/* Image Spec Legend */}
        <div className="mt-4 text-center">
          <p className="text-[11px] font-mono text-[#647084]">
            Export dimensions: <strong>2400 × 2400 pixels</strong> (1:1 High-Resolution Master) •{" "}
            {background === "transparent"
              ? "Transparent Alpha Background (Pure PNG)"
              : background === "custom"
              ? `Custom Hex (${customColorHex}) Background`
              : background === "upload"
              ? "Custom Uploaded Image Background"
              : `${background.replace("_", " ")} Background`}{" "}
            • Clean photographic export with no UI or borders.
          </p>
        </div>

        {/* EXPANDABLE DRAWER: ORIGINAL YOUCAM VTO INPUTS & CUTOUTS */}
        <div className="mt-6 border-t border-[#DCE3EF] pt-4">
          <button
            type="button"
            onClick={() => setShowIndividualResults(!showIndividualResults)}
            className="w-full flex items-center justify-between p-3 bg-[#F7F9FC] border border-[#111827] rounded-[4px] hover:bg-[#EAF1FF] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#16803C]" />
              <span className="font-mono text-xs font-bold text-[#080B10]">
                Original Individual Virtual Try-On Results & AI Cutouts (YouCam API)
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-mono text-[#1764FF]">
              <span>{showIndividualResults ? "Hide Details" : "Inspect Individual Results"}</span>
              {showIndividualResults ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showIndividualResults && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-[#F7F9FC] border border-[#111827] rounded-[4px]">
              {/* Person 1 Box */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#080B10] uppercase">
                    {person1Name}: {person1Garment}
                  </span>
                  <span className="text-[10px] font-mono text-[#16803C] font-bold">
                    ✓ YouCam Try-On + SOD
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#647084]">1. Try-On Output</span>
                    <div className="aspect-[3/4] bg-white border border-[#111827] rounded-[2px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={person1ImageUrl} alt="P1 Tryon" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#647084]">2. Segmented Cutout</span>
                    <div className="aspect-[3/4] bg-[linear-gradient(45deg,#E2E8F0_25%,transparent_25%),linear-gradient(-45deg,#E2E8F0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E2E8F0_75%),linear-gradient(-45deg,transparent_75%,#E2E8F0_75%)] bg-[size:12px_12px] bg-[#FFFFFF] border border-[#111827] rounded-[2px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={person1CutoutUrl || person1ImageUrl} alt="P1 Cutout" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Person 2 Box */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#080B10] uppercase">
                    {person2Name}: {person2Garment}
                  </span>
                  <span className="text-[10px] font-mono text-[#16803C] font-bold">
                    ✓ YouCam Try-On + SOD
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#647084]">1. Try-On Output</span>
                    <div className="aspect-[3/4] bg-white border border-[#111827] rounded-[2px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={person2ImageUrl} alt="P2 Tryon" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#647084]">2. Segmented Cutout</span>
                    <div className="aspect-[3/4] bg-[linear-gradient(45deg,#E2E8F0_25%,transparent_25%),linear-gradient(-45deg,#E2E8F0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E2E8F0_75%),linear-gradient(-45deg,transparent_75%,#E2E8F0_75%)] bg-[size:12px_12px] bg-[#FFFFFF] border border-[#111827] rounded-[2px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={person2CutoutUrl || person2ImageUrl} alt="P2 Cutout" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
