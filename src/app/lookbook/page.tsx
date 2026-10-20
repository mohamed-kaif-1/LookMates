"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { BookOpen, Download, Trash2, Edit3, Eye, Sparkles, X, Check } from "lucide-react";

interface SavedLook {
  id: string;
  session_id: string;
  title: string;
  occasion: string;
  garment_names: string;
  person1_image?: string;
  person2_image?: string;
  couple_image: string;
  created_at: string;
}

export default function LookbookPage() {
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLook, setSelectedLook] = useState<SavedLook | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchLooks();
  }, []);

  async function fetchLooks() {
    try {
      setLoading(true);
      const res = await fetch("/api/lookbook");
      if (res.ok) {
        const data = await res.json();
        setLooks(data.looks || []);
      }
    } catch (e) {
      console.error("Error fetching lookbook:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(id: string) {
    if (!editTitle.trim()) return;
    try {
      const res = await fetch(`/api/saved-looks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      if (res.ok) {
        setLooks(prev => prev.map(l => l.id === id ? { ...l, title: editTitle.trim() } : l));
        setEditingId(null);
        showMessage("success", "Look renamed successfully.");
      } else {
        showMessage("error", "Failed to rename look.");
      }
    } catch {
      showMessage("error", "Network error renaming look.");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/saved-looks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLooks(prev => prev.filter(l => l.id !== id));
        if (selectedLook?.id === id) setSelectedLook(null);
        setDeleteConfirmId(null);
        showMessage("success", "Look deleted from Lookbook.");
      } else {
        showMessage("error", "Failed to delete look.");
      }
    } catch {
      showMessage("error", "Network error deleting look.");
    }
  }

  function downloadImage(dataUrl: string, title: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `lookmates-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-couple.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="min-h-screen flex flex-col grid-background">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Card */}
        <div className="bg-white border-2 border-[#111827] rounded-[4px] p-6 shadow-[4px_4px_0px_#080B10] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-1.5 bg-[#1764FF] inline-block rounded-[1px]"></span>
              <span className="text-[11px] font-mono font-bold tracking-wider text-[#1764FF] uppercase">
                PERSISTENT ARCHIVE
              </span>
              <span className="text-xs font-mono text-[#647084]">({looks.length} Saved Looks)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#080B10] tracking-tight">
              Couple Lookbook
            </h1>
            <p className="text-xs text-[#647084] mt-0.5">
              Saved DuoMatch sessions with individual try-ons and composed high-resolution couple portraits.
            </p>
          </div>

          <Link
            href="/duomatch"
            className="lm-btn-primary !py-2.5 !px-5 !text-xs !font-bold flex items-center gap-2 self-start sm:self-auto shadow-[2px_2px_0px_#080B10]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create New Look</span>
          </Link>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3 border-2 rounded-[4px] font-mono text-xs font-bold flex items-center justify-between shadow-sm ${
              message.type === "success"
                ? "bg-[#DCFCE7] border-[#16803C] text-[#16803C]"
                : "bg-[#FEE2E2] border-[#DC2626] text-[#DC2626]"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-4 border-[#1764FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-mono text-xs text-[#647084]">Loading saved looks from SQLite database...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && looks.length === 0 && (
          <div className="bg-white border-2 border-[#111827] rounded-[4px] p-12 text-center max-w-lg mx-auto shadow-[4px_4px_0px_#080B10]">
            <BookOpen className="w-12 h-12 text-[#647084] mx-auto mb-4 stroke-1" />
            <h3 className="text-lg font-black text-[#080B10] mb-2">No Looks Saved Yet</h3>
            <p className="text-xs text-[#647084] mb-6 leading-relaxed">
              Complete a DuoMatch session, customize your outfits, generate your YouCam try-on, and save your favorite couple image to access it here anytime!
            </p>
            <Link href="/duomatch" className="lm-btn-primary !py-2.5 !px-6 text-xs font-bold shadow-[2px_2px_0px_#080B10]">
              Start Your First DuoMatch
            </Link>
          </div>
        )}

        {/* Looks Grid */}
        {!loading && looks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {looks.map((look) => (
              <div key={look.id} className="bg-white border-2 border-[#111827] rounded-[4px] p-4 flex flex-col justify-between shadow-[3px_3px_0px_#080B10] hover:shadow-[4px_4px_0px_#080B10] transition-all">
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#DCE3EF]">
                    <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase">
                      {look.occasion}
                    </span>
                    <span className="text-[10px] font-mono text-[#647084]">
                      {new Date(look.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div 
                    onClick={() => setSelectedLook(look)}
                    className="relative aspect-[16/10] bg-[#080B10] border-2 border-[#111827] rounded-[2px] overflow-hidden cursor-pointer group mb-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={look.couple_image}
                      alt={look.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="bg-white text-[#080B10] font-bold text-xs px-3 py-1.5 border border-[#111827] flex items-center gap-1.5 shadow-sm">
                        <Eye className="w-3.5 h-3.5 text-[#1764FF]" /> View Composed Look
                      </span>
                    </div>
                  </div>

                  {/* Title & Outfits */}
                  {editingId === look.id ? (
                    <div className="flex items-center gap-1 mb-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="lm-input !py-1 !text-xs font-bold"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(look.id)}
                        className="p-1 bg-[#16803C] text-white border border-[#111827] rounded-[2px] cursor-pointer"
                        title="Save Title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 bg-[#F0F4F8] text-[#101318] border border-[#111827] rounded-[2px] cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-black text-sm text-[#080B10] truncate" title={look.title}>
                        {look.title}
                      </h3>
                      <button
                        onClick={() => { setEditingId(look.id); setEditTitle(look.title); }}
                        className="text-[#647084] hover:text-[#080B10] p-1 cursor-pointer"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <p className="text-[11px] text-[#647084] line-clamp-2 mb-3 leading-relaxed">
                    {look.garment_names}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[#DCE3EF] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedLook(look)}
                    className="lm-btn-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-[#1764FF]" />
                    <span>Open</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadImage(look.couple_image, look.title)}
                      className="lm-btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1"
                      title="Download couple image PNG"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG</span>
                    </button>

                    {deleteConfirmId === look.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(look.id)}
                          className="px-2 py-1 bg-[#DC2626] text-white text-[10px] font-bold border border-[#111827] rounded-[2px] cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-[#F0F4F8] text-xs border border-[#111827] rounded-[2px] cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(look.id)}
                        className="p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] border border-transparent hover:border-[#DC2626] rounded-[2px] cursor-pointer transition-colors"
                        title="Delete look"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for full resolution view */}
        {selectedLook && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white border-2 border-[#111827] rounded-[4px] max-w-4xl w-full p-6 relative max-h-[90vh] flex flex-col shadow-[6px_6px_0px_#080B10]">
              <div className="flex items-center justify-between pb-4 border-b-2 border-[#111827] mb-4">
                <div>
                  <span className="bg-[#1764FF] text-white text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1">
                    {selectedLook.occasion}
                  </span>
                  <h2 className="text-xl font-black text-[#080B10]">
                    {selectedLook.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedLook(null)}
                  className="p-1.5 border-2 border-[#111827] rounded-[2px] hover:bg-[#F7F9FC] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-[#F7F9FC] border-2 border-[#111827] p-2 flex items-center justify-center mb-4 rounded-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedLook.couple_image}
                  alt={selectedLook.title}
                  className="max-h-[60vh] w-auto object-contain border border-[#111827]"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[#DCE3EF]">
                <p className="text-xs text-[#647084] font-mono">
                  Saved on {new Date(selectedLook.created_at).toLocaleString()}
                </p>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => downloadImage(selectedLook.couple_image, selectedLook.title)}
                    className="lm-btn-primary !py-2.5 !px-5 text-xs font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-[2px_2px_0px_#080B10]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Couple Image (PNG)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
