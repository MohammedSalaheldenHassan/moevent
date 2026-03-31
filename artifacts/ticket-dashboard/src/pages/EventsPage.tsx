import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import {
  Plus, CalendarDays, MapPin, Loader2, AlertCircle,
  Pencil, Trash2, Ticket, ChevronRight, ChevronLeft,
  RefreshCw, DollarSign, Clock, X, ImageIcon, Upload, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  event_date?: string | null;
  location?: string | null;
  price?: number | null;
  image_url?: string | null;
  created_at: string;
  [key: string]: unknown;
}

type ModalMode = "add" | "edit";

const CARD_ACCENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-green-600",
  "from-orange-500 to-amber-500",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-violet-600",
];

function getAccent(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return CARD_ACCENTS[n % CARD_ACCENTS.length];
}

export default function EventsPage() {
  const { t, isRTL, lang } = useLocale();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isAr = lang === "ar";

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", location: "", price: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Image upload ─────────────────────────────────────────────
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError(isAr ? "يرجى اختيار ملف صورة صالح" : "Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError(isAr ? "حجم الصورة أكبر من 5 ميغابايت" : "Image exceeds 5 MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const uploadImageFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from("event-images").upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(
      error.message.includes("bucket") || error.message.includes("not found")
        ? (isAr
          ? 'يرجى إنشاء bucket اسمه "event-images" في Supabase Storage وتفعيل الوصول العام.'
          : 'Please create a public bucket named "event-images" in Supabase Storage first.')
        : error.message
    );
    const { data: { publicUrl } } = supabase.storage.from("event-images").getPublicUrl(data.path);
    return publicUrl;
  };

  const isAdmin = !profile || profile.role === "admin";

  const fetchEvents = async () => {
    try {
      let eventIds: string[] | null = null;

      if (!isAdmin && profile?.id) {
        const { data: accessData, error: accessErr } = await supabase
          .from("event_access")
          .select("event_id")
          .eq("profile_id", profile.id);
        if (accessErr) throw accessErr;
        eventIds = (accessData ?? []).map((a: { event_id: string }) => a.event_id);
        if (eventIds.length === 0) {
          setEvents([]);
          setError(null);
          setLoading(false);
          return;
        }
      }

      let query = supabase.from("events").select("*").order("created_at", { ascending: false });
      if (eventIds) query = query.in("id", eventIds);
      const { data, error } = await query;
      if (error) throw error;
      setEvents(data ?? []);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.failedLoadEvents;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const openAddModal = () => {
    setModalMode("add");
    setEditingEvent(null);
    setForm({ title: "", date: "", location: "", price: "" });
    setFormError(null);
    setImageFile(null);
    setImagePreview(null);
    setCurrentImageUrl(null);
    setModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setModalMode("edit");
    setEditingEvent(event);
    setForm({
      title: event.title,
      date: event.event_date ?? "",
      location: event.location ?? "",
      price: event.price != null ? String(event.price) : "",
    });
    setFormError(null);
    setImageFile(null);
    setImagePreview(null);
    setCurrentImageUrl((event.image_url as string | null) ?? null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!imageFile && !currentImageUrl) {
      setFormError(isAr ? "صورة الفعالية مطلوبة" : "Event image is required");
      return;
    }
    if (!form.title.trim()) {
      setFormError(isAr ? "عنوان الفعالية مطلوب" : "Event title is required");
      return;
    }
    if (!form.date) {
      setFormError(isAr ? "تاريخ الفعالية مطلوب" : "Event date is required");
      return;
    }
    if (!form.location.trim()) {
      setFormError(isAr ? "موقع الفعالية مطلوب" : "Event location is required");
      return;
    }
    const priceVal = form.price.trim() ? parseFloat(form.price) : null;
    if (form.price.trim() && (isNaN(priceVal!) || priceVal! < 0)) {
      setFormError(isAr ? "السعر يجب أن يكون رقماً صحيحاً" : "Price must be a valid number");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(form.date) < today) {
      setFormError(isAr ? "لا يمكن اختيار تاريخ في الماضي" : "Event date cannot be in the past");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let resolvedImageUrl = currentImageUrl;
      if (imageFile) {
        setImageUploading(true);
        resolvedImageUrl = await uploadImageFile(imageFile);
        setImageUploading(false);
      }
      const payload = {
        title: form.title.trim(),
        event_date: form.date || null,
        location: form.location.trim() || null,
        price: priceVal,
        image_url: resolvedImageUrl,
      };

      if (modalMode === "add") {
        const { data, error } = await supabase.from("events").insert(payload).select();
        if (error) throw error;
        const inserted = data?.[0];
        if (inserted) setEvents((prev) => [inserted as Event, ...prev]);
        else await fetchEvents();
        logActivity("event_created", `Event: "${form.title.trim()}"`, profile?.email ?? undefined);
        toast({
          title: isAr ? "تم إنشاء الحدث" : "Event Created",
          description: isAr
            ? `تم إضافة "${form.title.trim()}" بنجاح`
            : `"${form.title.trim()}" has been added successfully.`,
        });
      } else if (editingEvent) {
        const { data: updated, error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEvent.id)
          .select("id");
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error(
          isAr ? "تم رفض التحديث بواسطة قاعدة البيانات. اذهب إلى الإعدادات وأصلح الصلاحيات."
                : "Update blocked by database permissions. Go to Settings → Fix Permissions."
        );
        setEvents((prev) => prev.map((e) => e.id === editingEvent.id ? { ...e, ...payload } : e));
        logActivity("event_updated", `Event: "${form.title.trim()}"`, profile?.email ?? undefined);
        toast({
          title: isAr ? "تم تحديث الحدث" : "Event Updated",
          description: isAr
            ? `تم حفظ التغييرات على "${form.title.trim()}"`
            : `Changes to "${form.title.trim()}" saved.`,
        });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (modalMode === "add" ? t.failedAddEvent : t.failedUpdateEvent);
      // RLS / permission errors
      const isRlsError =
        msg.toLowerCase().includes("row-level security") ||
        msg.toLowerCase().includes("policy") ||
        msg.toLowerCase().includes("permission denied") ||
        msg.toLowerCase().includes("violates row");
      // Missing column hint
      const isPriceColMissing = msg.includes("price") && msg.includes("column");
      const friendly = isRlsError
        ? (isAr
            ? 'مرفوض بسبب سياسة الأمان (RLS). في Supabase → Table Editor → events → RLS، أضف سياسة INSERT تسمح للمستخدمين المسجلين بالإدراج.'
            : 'Blocked by Row Level Security. In Supabase → Table Editor → events → RLS, add an INSERT policy that allows authenticated users.')
        : isPriceColMissing
          ? (isAr ? 'عمود "price" غير موجود. شغّل: ALTER TABLE public.events ADD COLUMN price numeric;'
                  : 'Column "price" missing. Run in Supabase SQL Editor: ALTER TABLE public.events ADD COLUMN price numeric;')
          : msg;
      setFormError(friendly);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      logActivity("event_deleted", `Event: "${deleteTarget.title}"`, profile?.email ?? undefined);
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.failedDeleteEvent;
      const isRls = msg.toLowerCase().includes("row-level security") ||
        msg.toLowerCase().includes("policy") ||
        msg.toLowerCase().includes("permission denied");
      toast({
        variant: "destructive",
        title: isAr ? "فشل الحذف" : "Delete Failed",
        description: isRls
          ? (isAr
              ? "مرفوض بسبب RLS. تحقق من سياسة DELETE في Supabase."
              : "Blocked by Row Level Security. Check the DELETE policy in Supabase.")
          : msg,
      });
    } finally {
      setDeleting(false);
    }
  };

  const isUpcoming = (dateStr?: string | null) => dateStr ? new Date(dateStr) >= new Date() : false;
  const isPast = (dateStr?: string | null) => dateStr ? new Date(dateStr) < new Date() : false;
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const formatPrice = (price: number | null | undefined) => {
    if (price == null) return null;
    return price === 0
      ? (isAr ? "مجاني" : "Free")
      : `RWF ${price.toLocaleString()}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.eventsTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.eventsSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchEvents(); }} disabled={loading} className="rounded-xl">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
          <Button onClick={openAddModal} className="h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/25 font-semibold">
            <Plus className="w-4 h-4" />
            {t.addEvent}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{t.failedLoadEvents}</p>
            <p className="text-xs opacity-70 mt-0.5 font-mono break-all">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-2xl overflow-hidden animate-pulse">
              <div className="h-2 bg-muted" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-muted rounded-lg w-3/4" />
                <div className="h-4 bg-muted rounded-lg w-1/2" />
                <div className="h-4 bg-muted rounded-lg w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 && !error ? (
        <div className="text-center py-24 bg-card border border-card-border rounded-2xl">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <CalendarDays className="w-10 h-10 text-violet-500" />
          </div>
          <p className="text-foreground font-bold text-lg">{t.noEvents}</p>
          <p className="text-muted-foreground text-sm mt-1 mb-5">{t.noEventsDesc}</p>
          <Button onClick={openAddModal} className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 shadow-md shadow-violet-500/20">
            <Plus className="w-4 h-4" />
            {t.addEvent}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => {
            const upcoming = isUpcoming(event.event_date);
            const past = isPast(event.event_date);
            const accent = getAccent(event.id);
            const price = formatPrice(event.price as number | null);

            return (
              <div
                key={event.id}
                className="group bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5 hover:border-primary/20 transition-all duration-200 cursor-pointer"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                {/* Image banner or gradient accent bar */}
                {event.image_url ? (
                  <div className="h-36 overflow-hidden relative">
                    <img
                      src={event.image_url as string}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className={`absolute bottom-0 start-0 end-0 h-1 bg-gradient-to-r ${accent}`} />
                  </div>
                ) : (
                  <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
                )}

                <div className="p-5">
                  {/* Status + Price row */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full",
                      upcoming
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : past
                        ? "bg-muted text-muted-foreground"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", upcoming ? "bg-emerald-500 animate-pulse" : past ? "bg-gray-400" : "bg-blue-500")} />
                      {upcoming ? (isAr ? "قادم" : "Upcoming") : past ? (isAr ? "منتهي" : "Past") : (isAr ? "اليوم" : "Today")}
                    </span>
                    {price != null && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2.5 py-1 rounded-full">
                        {event.price === 0 ? "🎁" : <DollarSign className="w-3 h-3" />}
                        {price}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-foreground text-base leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {event.title}
                  </h3>

                  {/* Meta */}
                  <div className="space-y-1.5 mb-4">
                    {event.event_date ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0 text-primary/50" />
                        <span>{(() => { try { return format(new Date(event.event_date as string), "PPP"); } catch { return String(event.event_date); } })()}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="italic text-xs">{isAr ? "لا يوجد تاريخ" : "No date set"}</span>
                      </div>
                    )}
                    {event.location ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/50" />
                        <span className="truncate">{event.location as string}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="italic text-xs">{isAr ? "لا يوجد موقع" : "No location"}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="flex items-center gap-2 pt-3 border-t border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      {t.viewTickets}
                      <ChevronIcon className="w-3 h-3" />
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => openEditModal(event)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      title={t.editEvent}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(event)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      title={t.deleteEvent}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl flex flex-col max-h-[90dvh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-bold">
              {modalMode === "add" ? t.addNewEvent : t.editEventTitle}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {modalMode === "add"
                ? (isAr ? "أضف حدثاً جديداً مع تفاصيله وسعر التذكرة." : "Add a new event with details and ticket price.")
                : (isAr ? "تعديل تفاصيل الحدث وسعر التذكرة." : "Edit the event details and ticket price.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 px-0.5">
            {/* Event Image */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                {isAr ? "صورة الفعالية" : "Event Image"}
                <span className="text-destructive">*</span>
              </Label>
              <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              {(imagePreview || currentImageUrl) ? (
                <div className="relative rounded-xl overflow-hidden border border-border h-36">
                  <img
                    src={imagePreview ?? currentImageUrl!}
                    alt="Event preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => imgInputRef.current?.click()}
                      className="bg-white/90 text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isAr ? "تغيير" : "Change"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); setCurrentImageUrl(null); }}
                      className="bg-destructive/90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      {isAr ? "حذف" : "Remove"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary/70 hover:bg-primary/5 transition-all"
                >
                  <ImageIcon className="w-7 h-7 opacity-50" />
                  <span className="text-xs font-medium">{isAr ? "اضغط لإضافة صورة" : "Click to add an image"}</span>
                  <span className="text-[10px] opacity-60">PNG, JPG, WebP · max 5 MB</span>
                </button>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">{t.eventTitle} <span className="text-destructive">*</span></Label>
              <Input
                placeholder={t.eventTitlePlaceholder}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                {isAr ? "سعر التذكرة" : "Ticket Price"}
                <span className="text-xs text-muted-foreground font-normal">({isAr ? "اختياري — 0 للمجاني" : "optional — 0 for free"})</span>
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-muted-foreground text-sm font-medium">RWF</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="h-11 rounded-xl ps-12"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Date + Location in two columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">
                  {t.date} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">
                  {t.location} <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder={t.locationPlaceholder}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 shrink-0 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
              <X className="w-4 h-4" />
              {t.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/20"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{imageUploading ? (isAr ? "جاري رفع الصورة…" : "Uploading image…") : t.saving}</>
              ) : modalMode === "add" ? (
                <><CheckCircle2 className="w-4 h-4" />{t.addEvent}</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" />{t.saveSettings}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">{t.confirmDelete}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{t.confirmDeleteDesc}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {deleteTarget && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAccent(deleteTarget.id)} flex items-center justify-center shrink-0`}>
                  <CalendarDays className="w-4 h-4 text-white" />
                </div>
                <p className="font-semibold text-foreground text-sm truncate">"{deleteTarget.title}"</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">{t.cancel}</Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive" className="rounded-xl">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />{t.deleting}</> : t.confirmDeleteBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
