"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Users,
  Sparkles,
  Plus,
  Trash2,
  Upload,
  Check,
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  Download,
  Shirt,
  X,
} from "lucide-react";
import { MIN_CREW_SIZE, MAX_CREW_SIZE } from "@/lib/crew-validation";

interface Participant {
  id: string;
  role: string;
  display_name: string;
  photo_data?: string;
}

interface Garment {
  id: string;
  name: string;
  category: string;
  image_url: string;
  color: string;
  description: string;
  price: number | null;
  currency: string;
  occasion_tag?: string;
}

interface TryOnJob {
  id: string;
  session_id: string;
  participant_id: string;
  garment_id: string;
  status: "queued" | "submitting" | "processing" | "succeeded" | "failed";
  result_image_url?: string | null;
  error_message?: string | null;
}

interface SavedCrewSession {
  id: string;
  occasion: string;
  style_preferences: string;
  dress_code?: string;
  created_at: string;
  updated_at: string;
  participant_count: number;
}

export default function CrewMatchPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [occasion, setOccasion] = useState<string>("Wedding Guest Celebration");
  const [stylePreferences, setStylePreferences] = useState<string>("Modern & Coordinated");
  const [dressCode, setDressCode] = useState<string>("Formal / Semi-Formal");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Garment>>({});
  const [jobs, setJobs] = useState<Record<string, TryOnJob>>({});
  const [compositionUrl, setCompositionUrl] = useState<string | null>(null);

  const [savedSessions, setSavedSessions] = useState<SavedCrewSession[]>([]);
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [garmentFilterCategory, setGarmentFilterCategory] = useState<string>("all");
  const [garmentSearch, setGarmentSearch] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [pollingActive, setPollingActive] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Initial load: garments catalogue & saved sessions
  useEffect(() => {
    async function loadCatalogue() {
      try {
        const [garmentRes, crewRes] = await Promise.all([
          fetch("/api/garments"),
          fetch("/api/crew-sessions"),
        ]);
        if (garmentRes.ok) {
          const gData = await garmentRes.json();
          setGarments(gData.garments || []);
        }
        if (crewRes.ok) {
          const cData = await crewRes.json();
          setSavedSessions(cData.sessions || []);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    }
    void loadCatalogue();
  }, []);

  // Polling for try-on jobs when active
  useEffect(() => {
    if (!sessionId || !pollingActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/crew-tryon`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          const updated: Record<string, TryOnJob> = {};
          let stillProcessing = false;
          for (const j of data.jobs) {
            updated[j.participant_id] = j;
            if (j.status === "processing" || j.status === "submitting" || j.status === "queued") {
              stillProcessing = true;
            }
          }
          setJobs(updated);
          if (!stillProcessing) {
            setPollingActive(false);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, pollingActive]);

  // Load existing session details
  const loadSession = useCallback(async (sid: string) => {
    try {
      setLoading(true);
      setStatusMessage(null);
      const res = await fetch(`/api/sessions/${sid}`);
      if (!res.ok) {
        setStatusMessage({ type: "error", text: "Could not load the specified session." });
        return;
      }
      const data = await res.json();
      setSessionId(sid);
      if (data.session) {
        setOccasion(data.session.occasion || "Coordinated Group Look");
        setStylePreferences(data.session.style_preferences || "Coordinated");
        setDressCode(data.session.dress_code || "Formal");
      }
      if (Array.isArray(data.participants)) {
        setParticipants(data.participants);
      }
      if (Array.isArray(data.assignments)) {
        const asgnMap: Record<string, Garment> = {};
        for (const a of data.assignments) {
          asgnMap[a.participant_id] = {
            id: a.garment_id,
            name: a.garment_name,
            category: a.category,
            image_url: a.image_url,
            color: a.color,
            description: "",
            price: a.price,
            currency: "INR",
          };
        }
        setAssignments(asgnMap);
      }
      if (Array.isArray(data.tryonJobs)) {
        const jobMap: Record<string, TryOnJob> = {};
        for (const j of data.tryonJobs) {
          jobMap[j.participant_id] = j;
        }
        setJobs(jobMap);
      }
      if (data.composition && data.composition.image_data) {
        setCompositionUrl(data.composition.image_data);
      } else {
        setCompositionUrl(null);
      }
      setStatusMessage({ type: "success", text: `Loaded session ${sid}` });
    } catch (err) {
      console.error("Load session error:", err);
      setStatusMessage({ type: "error", text: "Error loading session." });
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new crew session
  async function handleCreateCrew() {
    if (!occasion.trim()) {
      setStatusMessage({ type: "error", text: "Please enter an occasion for the crew." });
      return;
    }

    try {
      setIsBusy(true);
      setStatusMessage(null);
      const initialNames = ["Participant 1", "Participant 2", "Participant 3"];
      const res = await fetch("/api/crew-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: occasion.trim(),
          stylePreferences: stylePreferences.trim(),
          dressCode: dressCode.trim(),
          participants: initialNames.map((name) => ({ name })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initialize crew session.");
      }

      setSessionId(data.sessionId);
      setParticipants(data.participants || []);
      setAssignments({});
      setJobs({});
      setCompositionUrl(null);
      setStatusMessage({ type: "success", text: "Crew session initialized with 3 members. Add photos and assign garments below!" });

      // Refresh saved sessions list
      const crewRes = await fetch("/api/crew-sessions");
      if (crewRes.ok) {
        const cData = await crewRes.json();
        setSavedSessions(cData.sessions || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Add participant
  async function handleAddParticipant() {
    if (!sessionId) return;
    if (participants.length >= MAX_CREW_SIZE) {
      setStatusMessage({ type: "error", text: `Maximum crew size is ${MAX_CREW_SIZE} participants.` });
      return;
    }

    const defaultName = `Participant ${participants.length + 1}`;
    try {
      setIsBusy(true);
      const res = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: defaultName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add participant.");

      setParticipants((prev) => [...prev, data.participant]);
      setStatusMessage({ type: "success", text: `Added ${defaultName}.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Rename participant
  async function handleRenameParticipant(participantId: string, newName: string) {
    if (!sessionId || !newName.trim()) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename participant.");
      }
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, display_name: newName.trim() } : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    }
  }

  // Remove participant
  async function handleRemoveParticipant(participantId: string) {
    if (!sessionId) return;
    if (participants.length <= MIN_CREW_SIZE) {
      setStatusMessage({ type: "error", text: `A crew must have at least ${MIN_CREW_SIZE} participants.` });
      return;
    }

    try {
      setIsBusy(true);
      const res = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove participant.");

      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      setJobs((prev) => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      setCompositionUrl(null);
      setStatusMessage({ type: "info", text: "Participant removed." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Upload photo for participant
  function handlePhotoUpload(participant: Participant, file?: File) {
    if (!file || !sessionId) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatusMessage({ type: "error", text: "Please upload a JPEG, PNG, or WebP image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Image exceeds 10 MB limit." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        setIsBusy(true);
        const res = await fetch(`/api/sessions/${sessionId}/participants`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: participant.id, photoData: base64Data }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to upload photo.");

        setParticipants((prev) =>
          prev.map((p) => (p.id === participant.id ? { ...p, photo_data: base64Data } : p))
        );
        // Reset try-on job and composition since photo changed
        setJobs((prev) => {
          const next = { ...prev };
          delete next[participant.id];
          return next;
        });
        setCompositionUrl(null);
        setStatusMessage({ type: "success", text: `Photo saved for ${participant.display_name}.` });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage({ type: "error", text: msg });
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Remove photo for participant
  async function handleRemovePhoto(participant: Participant) {
    if (!sessionId) return;
    try {
      setIsBusy(true);
      const res = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: participant.id, action: "remove_photo" }),
      });
      if (!res.ok) throw new Error("Failed to remove photo.");

      setParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? { ...p, photo_data: "" } : p))
      );
      setJobs((prev) => {
        const next = { ...prev };
        delete next[participant.id];
        return next;
      });
      setCompositionUrl(null);
      setStatusMessage({ type: "info", text: `Photo removed for ${participant.display_name}.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Assign garment to participant
  async function handleAssignGarment(participant: Participant, garmentId: string) {
    if (!sessionId) return;

    try {
      setIsBusy(true);
      const res = await fetch(`/api/sessions/${sessionId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: participant.id, garmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update garment assignment.");

      if (data.action === "removed") {
        setAssignments((prev) => {
          const next = { ...prev };
          delete next[participant.id];
          return next;
        });
      } else {
        const g = garments.find((item) => item.id === garmentId);
        if (g) {
          setAssignments((prev) => ({ ...prev, [participant.id]: g }));
        }
      }

      // Reset job & composition for this participant
      setJobs((prev) => {
        const next = { ...prev };
        delete next[participant.id];
        return next;
      });
      setCompositionUrl(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Trigger Crew Virtual Try-On
  async function handleGenerateTryOns() {
    if (!sessionId) return;

    // Validate readiness
    const unready = participants.filter((p) => !p.photo_data || !assignments[p.id]);
    if (unready.length > 0) {
      setStatusMessage({
        type: "error",
        text: `Every participant needs a photo and an assigned outfit. Incomplete: ${unready.map((u) => u.display_name).join(", ")}.`,
      });
      return;
    }

    try {
      setIsBusy(true);
      setStatusMessage(null);
      const res = await fetch(`/api/sessions/${sessionId}/crew-tryon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.configured === false || res.status === 503) {
          setStatusMessage({
            type: "error",
            text: data.error || "YOUCAM_API_KEY is not configured on the server. Set YOUCAM_API_KEY and YOUCAM_API_BASE_URL in .env.local to enable real try-ons.",
          });
        } else {
          setStatusMessage({ type: "error", text: data.error || "Failed to submit try-on tasks." });
        }
        return;
      }

      if (data.jobs && Array.isArray(data.jobs)) {
        const jobMap: Record<string, TryOnJob> = {};
        for (const j of data.jobs) {
          jobMap[j.participant_id] = j;
        }
        setJobs(jobMap);
        setPollingActive(true);
        setStatusMessage({
          type: "info",
          text: "Try-on tasks submitted to YouCam AI. Polling for provider completion...",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Compose Group Preview
  async function handleComposeGroup() {
    if (!sessionId) return;

    try {
      setIsBusy(true);
      setStatusMessage(null);
      const res = await fetch(`/api/sessions/${sessionId}/crew-composition`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Group composition failed.");
      }

      setCompositionUrl(data.dataUrl);
      setStatusMessage({ type: "success", text: "Group preview successfully composed!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsBusy(false);
    }
  }

  // Garment catalogue filter
  const filteredGarments = garments.filter((g) => {
    if (garmentFilterCategory !== "all" && g.category.toLowerCase() !== garmentFilterCategory.toLowerCase()) {
      return false;
    }
    if (garmentSearch.trim()) {
      const q = garmentSearch.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.color.toLowerCase().includes(q) ||
        (g.occasion_tag && g.occasion_tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const allReadyForTryOn =
    participants.length >= MIN_CREW_SIZE &&
    participants.every((p) => p.photo_data && assignments[p.id]);

  const allSucceeded =
    participants.length >= MIN_CREW_SIZE &&
    participants.every((p) => jobs[p.id]?.status === "succeeded" && jobs[p.id]?.result_image_url);

  return (
    <div className="min-h-screen flex flex-col grid-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#111827]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F0F4F8] border border-[#111827] rounded-[2px] text-xs font-mono font-bold uppercase tracking-wider text-[#647084] mb-3">
              <Users className="w-3.5 h-3.5 text-[#1764FF]" />
              <span>CrewMatch® — Multi-Person Group Styling</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#080B10] tracking-tight uppercase">
              Style Your Crew
            </h1>
            <p className="text-sm text-[#647084] mt-1 max-w-2xl">
              Coordinate outfits for groups of 3 to 8 participants. Upload individual photos, assign curated looks, generate genuine provider virtual try-ons, and compose a unified group preview.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSavedModal(true)}
              className="lm-btn-secondary text-xs flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Saved Crews ({savedSessions.length})</span>
            </button>
            <button
              onClick={() => {
                setSessionId("");
                setParticipants([]);
                setAssignments({});
                setJobs({});
                setCompositionUrl(null);
              }}
              className="lm-btn-secondary text-xs flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>New Crew</span>
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`mt-4 p-4 rounded-[3px] border text-xs font-mono flex items-start gap-3 ${
              statusMessage.type === "error"
                ? "bg-[#FEF2F2] border-[#EF4444] text-[#991B1B]"
                : statusMessage.type === "success"
                ? "bg-[#F0FDF4] border-[#22C55E] text-[#166534]"
                : "bg-[#EFF6FF] border-[#3B82F6] text-[#1E40AF]"
            }`}
          >
            {statusMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : statusMessage.type === "success" ? (
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
            <button onClick={() => setStatusMessage(null)} className="opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Section 1: Crew Creation / Setup (if no active session) */}
        {!sessionId ? (
          <div className="mt-8 bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-10 shadow-[4px_4px_0px_#080B10] max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-[#080B10] uppercase mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1764FF]" />
              <span>Initialize a New Crew</span>
            </h2>
            <p className="text-xs text-[#647084] mb-6">
              Enter the group occasion and styling direction. You can add or rename participants (3 to 8 members) once the session begins.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[#080B10] mb-1">
                  Occasion *
                </label>
                <input
                  type="text"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  placeholder="e.g. Goa Destination Wedding, Met Gala Theme, Summer Cocktail"
                  className="w-full bg-[#F7F9FC] border border-[#111827] rounded-[2px] px-3 py-2 text-sm text-[#080B10] outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-[#080B10] mb-1">
                    Style Direction
                  </label>
                  <input
                    type="text"
                    value={stylePreferences}
                    onChange={(e) => setStylePreferences(e.target.value)}
                    placeholder="e.g. Modern Minimalist, Vibrant Traditional"
                    className="w-full bg-[#F7F9FC] border border-[#111827] rounded-[2px] px-3 py-2 text-sm text-[#080B10] outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-[#080B10] mb-1">
                    Dress Code
                  </label>
                  <input
                    type="text"
                    value={dressCode}
                    onChange={(e) => setDressCode(e.target.value)}
                    placeholder="e.g. Black Tie, Semi-Formal, Casual"
                    className="w-full bg-[#F7F9FC] border border-[#111827] rounded-[2px] px-3 py-2 text-sm text-[#080B10] outline-none font-medium"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleCreateCrew}
                  disabled={isBusy || !occasion.trim()}
                  className="lm-btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-[2px_2px_0px_#080B10] disabled:opacity-50"
                >
                  {isBusy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Start Crew Session</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Crew Workspace */
          <div className="mt-8 space-y-10">
            {/* Crew Details Bar */}
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-5 shadow-[3px_3px_0px_#080B10] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="px-3 py-1 bg-[#1764FF] text-white text-xs font-mono font-bold uppercase rounded-[2px]">
                  Crew Active ({participants.length} Members)
                </div>
                <div>
                  <span className="text-xs text-[#647084] font-mono uppercase mr-2">Occasion:</span>
                  <span className="text-sm font-bold text-[#080B10]">{occasion}</span>
                </div>
                <div>
                  <span className="text-xs text-[#647084] font-mono uppercase mr-2">Style:</span>
                  <span className="text-sm font-medium text-[#080B10]">{stylePreferences}</span>
                </div>
                <div>
                  <span className="text-xs text-[#647084] font-mono uppercase mr-2">Dress Code:</span>
                  <span className="text-sm font-medium text-[#080B10]">{dressCode}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddParticipant}
                  disabled={isBusy || participants.length >= MAX_CREW_SIZE}
                  className="lm-btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
                  title={participants.length >= MAX_CREW_SIZE ? "Maximum crew size reached" : "Add participant"}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Member ({participants.length}/{MAX_CREW_SIZE})</span>
                </button>
              </div>
            </div>

            {/* Participants Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-[#080B10] uppercase flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1764FF]" />
                  <span>Crew Members & Outfit Assignments</span>
                </h2>
                <span className="text-xs font-mono text-[#647084]">
                  {participants.filter((p) => p.photo_data && assignments[p.id]).length} of {participants.length} Ready for Try-On
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {participants.map((p, idx) => {
                  const assignedGarment = assignments[p.id];
                  const job = jobs[p.id];

                  return (
                    <article
                      key={p.id}
                      className="bg-white border-2 border-[#111827] rounded-[4px] shadow-[4px_4px_0px_#080B10] overflow-hidden flex flex-col"
                    >
                      {/* Card Header */}
                      <div className="p-3 bg-[#F7F9FC] border-b border-[#111827] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="w-6 h-6 flex items-center justify-center bg-[#1764FF] text-white text-xs font-mono font-bold rounded-[2px] shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            defaultValue={p.display_name}
                            onBlur={(e) => {
                              if (e.target.value !== p.display_name) {
                                void handleRenameParticipant(p.id, e.target.value);
                              }
                            }}
                            className="bg-transparent text-sm font-bold text-[#080B10] border-b border-transparent hover:border-[#111827] focus:border-[#1764FF] outline-none px-1 w-full truncate"
                            aria-label={`Participant name for slot ${idx + 1}`}
                          />
                        </div>

                        <button
                          onClick={() => handleRemoveParticipant(p.id)}
                          disabled={participants.length <= MIN_CREW_SIZE}
                          className="text-[#991B1B] hover:text-[#EF4444] disabled:opacity-20 p-1"
                          title={participants.length <= MIN_CREW_SIZE ? `Minimum ${MIN_CREW_SIZE} required` : "Remove member"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex-1 flex flex-col space-y-4">
                        {/* Photo Slot */}
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-[#647084] mb-1.5">
                            Personal Photo
                          </label>
                          <div className="relative aspect-[3/4] bg-[#F0F4F8] border border-dashed border-[#111827] rounded-[2px] overflow-hidden flex flex-col items-center justify-center">
                            {p.photo_data ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.photo_data}
                                  alt={`${p.display_name} source photo`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={() => handleRemovePhoto(p)}
                                  className="absolute top-1.5 right-1.5 p-1 bg-white/90 border border-[#111827] text-[#991B1B] rounded-[2px] hover:bg-white text-xs"
                                  title="Remove photo"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <label className="cursor-pointer flex flex-col items-center justify-center p-3 text-center w-full h-full hover:bg-[#EAF1FF] transition-colors">
                                <Upload className="w-6 h-6 text-[#1764FF] mb-1" />
                                <span className="text-xs font-bold text-[#080B10]">Upload Photo</span>
                                <span className="text-[10px] text-[#647084] mt-0.5">JPEG, PNG or WebP</span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={(e) => handlePhotoUpload(p, e.target.files?.[0])}
                                  className="sr-only"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Garment Slot */}
                        <div className="pt-2 border-t border-[#DCE3EF]">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[10px] font-mono font-bold uppercase text-[#647084]">
                              Assigned Outfit
                            </label>
                            {assignedGarment && (
                              <button
                                onClick={() => handleAssignGarment(p, assignedGarment.id)}
                                className="text-[10px] text-[#991B1B] hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {assignedGarment ? (
                            <div className="flex items-center gap-2 p-2 bg-[#F7F9FC] border border-[#111827] rounded-[2px]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={assignedGarment.image_url}
                                alt={assignedGarment.name}
                                className="w-10 h-12 object-cover rounded-[1px] bg-white border border-[#DCE3EF]"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[#080B10] truncate">{assignedGarment.name}</p>
                                <p className="text-[10px] text-[#647084] capitalize">
                                  {assignedGarment.color} · {assignedGarment.category}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-[#647084] italic mb-2">No garment assigned yet.</p>
                          )}

                          {/* Garment Selector Dropdown */}
                          <select
                            value={assignedGarment?.id || ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                void handleAssignGarment(p, e.target.value);
                              }
                            }}
                            className="mt-2 w-full bg-white border border-[#111827] rounded-[2px] px-2 py-1.5 text-xs text-[#080B10] font-mono outline-none"
                            aria-label={`Select garment for ${p.display_name}`}
                          >
                            <option value="">-- Choose From Catalogue --</option>
                            {garments.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.color} · {g.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Try-on Status / Result */}
                        <div className="pt-2 border-t border-[#DCE3EF] mt-auto">
                          <label className="block text-[10px] font-mono font-bold uppercase text-[#647084] mb-1">
                            Try-On Status
                          </label>

                          {job?.status === "succeeded" && job.result_image_url ? (
                            <div className="space-y-1">
                              <div className="aspect-[3/4] bg-[#F0F4F8] border border-[#111827] rounded-[2px] overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={job.result_image_url}
                                  alt={`${p.display_name} try-on result`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#166534] bg-[#DCFCE7] px-1.5 py-0.5 rounded-[1px]">
                                <Check className="w-3 h-3" /> Genuine AI Try-On Succeeded
                              </span>
                            </div>
                          ) : job?.status === "failed" ? (
                            <div className="p-2 bg-[#FEF2F2] border border-[#EF4444] rounded-[2px] text-[10px] text-[#991B1B] font-mono">
                              <p className="font-bold">Try-On Failed</p>
                              <p className="mt-0.5">{job.error_message || "Provider could not process outfit."}</p>
                            </div>
                          ) : job?.status === "processing" || job?.status === "submitting" || job?.status === "queued" ? (
                            <div className="p-3 bg-[#EFF6FF] border border-[#3B82F6] rounded-[2px] text-xs text-[#1E40AF] font-mono flex items-center gap-2">
                              <LoaderCircle className="w-4 h-4 animate-spin text-[#1764FF]" />
                              <span>Processing on YouCam AI...</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#647084] font-mono">
                              {p.photo_data && assignedGarment
                                ? "Ready for batch try-on generation."
                                : "Upload photo and choose outfit to enable try-on."}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Garment Catalogue Explorer Section */}
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 shadow-[4px_4px_0px_#080B10]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-black text-[#080B10] uppercase flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-[#1764FF]" />
                    <span>Garment Catalogue Explorer</span>
                  </h3>
                  <p className="text-xs text-[#647084]">
                    Browse and inspect styles for each crew member from LookMates curated apparel collection.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={garmentFilterCategory}
                    onChange={(e) => setGarmentFilterCategory(e.target.value)}
                    className="bg-[#F7F9FC] border border-[#111827] rounded-[2px] px-2.5 py-1.5 text-xs font-mono text-[#080B10] outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="tops">Tops & Shirts</option>
                    <option value="bottoms">Bottoms & Pants</option>
                    <option value="dresses">Dresses & Suits</option>
                  </select>

                  <input
                    type="text"
                    value={garmentSearch}
                    onChange={(e) => setGarmentSearch(e.target.value)}
                    placeholder="Search color or name..."
                    className="bg-[#F7F9FC] border border-[#111827] rounded-[2px] px-2.5 py-1.5 text-xs text-[#080B10] outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-72 overflow-y-auto p-1">
                {filteredGarments.map((g) => (
                  <div
                    key={g.id}
                    className="bg-[#F7F9FC] border border-[#111827] rounded-[2px] p-2 flex flex-col justify-between"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.image_url}
                      alt={g.name}
                      className="w-full aspect-[3/4] object-cover bg-white border border-[#DCE3EF] mb-2 rounded-[1px]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#080B10] truncate">{g.name}</p>
                      <p className="text-[10px] text-[#647084] font-mono">{g.color}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Virtual Try-On Generation Section */}
            <div className="p-6 sm:p-8 bg-[#080B10] text-white rounded-[4px] border-2 border-[#111827] shadow-[4px_4px_0px_#1764FF]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#1764FF] text-white text-[10px] font-mono font-bold uppercase rounded-[2px] mb-2">
                    <Sparkles className="w-3 h-3" />
                    <span>Provider Virtual Try-On</span>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">
                    Generate Crew Try-Ons
                  </h3>
                  <p className="text-xs text-white/70 max-w-xl mt-1">
                    Submits each participant&apos;s photo and assigned garment to the official YouCam Clothes API. Results are fetched asynchronously and displayed as genuine generated outputs.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleGenerateTryOns}
                    disabled={isBusy || !allReadyForTryOn}
                    className="lm-btn-primary !bg-[#1764FF] !text-white hover:!bg-[#1150D0] !py-3 !px-6 text-sm font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0px_#FFFFFF] w-full sm:w-auto disabled:opacity-40"
                  >
                    {isBusy || pollingActive ? (
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>{pollingActive ? "Polling Provider..." : "Run Batch Try-On"}</span>
                  </button>
                </div>
              </div>

              {!allReadyForTryOn && (
                <div className="mt-4 p-3 bg-white/10 border border-white/20 rounded-[2px] text-xs font-mono flex items-center gap-2 text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Ready check: Each participant must have an uploaded photo and an assigned garment before generating try-ons.
                  </span>
                </div>
              )}
            </div>

            {/* Group Preview & Composition Section */}
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 sm:p-8 shadow-[4px_4px_0px_#080B10]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE3EF]">
                <div>
                  <span className="text-xs font-mono font-bold uppercase text-[#1764FF]">The Final Frame</span>
                  <h3 className="text-2xl font-black text-[#080B10] uppercase">
                    Unified Group Preview
                  </h3>
                  <p className="text-xs text-[#647084] mt-0.5">
                    Composes the individual virtual try-on results into a unified group presentation.
                  </p>
                </div>

                <button
                  onClick={handleComposeGroup}
                  disabled={isBusy || !allSucceeded}
                  className="lm-btn-primary !py-2.5 !px-5 text-xs font-bold flex items-center gap-2 disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Compose Group Preview</span>
                </button>
              </div>

              {!allSucceeded && (
                <div className="mt-6 p-4 bg-[#F7F9FC] border border-dashed border-[#DCE3EF] rounded-[4px] text-center text-xs font-mono text-[#647084]">
                  Group composition requires completed genuine virtual try-on results for all {participants.length} crew members.
                </div>
              )}

              {compositionUrl && (
                <div className="mt-6 space-y-4">
                  <div className="border-2 border-[#111827] rounded-[2px] overflow-hidden bg-[#080B10] p-4 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={compositionUrl}
                      alt="LookMates CrewMatch Group Composition"
                      className="max-h-[600px] w-auto object-contain rounded-[2px]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#F7F9FC] border border-[#111827] rounded-[2px]">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#1764FF]" />
                      <span className="text-xs font-mono text-[#647084]">
                        <strong>Composition Specification:</strong> Tiled presentation of individual AI virtual try-on results.
                      </span>
                    </div>

                    <a
                      href={compositionUrl}
                      download={`crewmatch_${occasion.replace(/\s+/g, "_").toLowerCase()}_final.png`}
                      className="lm-btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Composition</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved Sessions Modal */}
        {showSavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 max-w-lg w-full shadow-[6px_6px_0px_#080B10]">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#DCE3EF]">
                <h3 className="text-lg font-black uppercase text-[#080B10] flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#1764FF]" />
                  <span>Saved Crew Sessions</span>
                </h3>
                <button onClick={() => setShowSavedModal(false)} className="text-[#647084] hover:text-[#080B10]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {savedSessions.length === 0 ? (
                <p className="text-xs text-[#647084] py-8 text-center font-mono">No saved crew sessions found in the database.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {savedSessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-[#F7F9FC] border border-[#111827] rounded-[2px] flex items-center justify-between hover:bg-[#EAF1FF] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#080B10]">{s.occasion}</p>
                        <p className="text-[10px] text-[#647084] font-mono">
                          {s.participant_count} members · {new Date(s.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowSavedModal(false);
                          void loadSession(s.id);
                        }}
                        className="lm-btn-secondary text-xs flex items-center gap-1 !py-1 !px-2.5"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
