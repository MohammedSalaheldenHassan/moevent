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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, CalendarDays, MapPin, Loader2, AlertCircle,
  Pencil, Trash2, RefreshCw, X, ImageIcon, Upload, Search, MoreHorizontal,
} from "lucide-react";
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
type StatusFilter = "all" | "upcoming" | "past";

interface TicketStats {
  sold: number;
  scanned: number;
}

export default function EventsPage() {
  const { t, isRTL, lang } = useLocale();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isAr = lang === "ar";

  const [events, setEvents] = useState<Event[]>([]);
  const [ticketStats, setTicketStats] = useState<Record<string, TicketStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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

      // Sold / checked-in counts per event (one query for all events)
      const ids = (data ?? []).map((e: Event) => e.id);
      if (ids.length > 0) {
        const { data: tickets } = await supabase.from("tickets").select("event_id, is_scanned").in("event_id", ids);
        const stats: Record<string, TicketStats> = {};
        for (const tk of (tickets ?? []) as { event_id: string; is_scanned: boolean | null }[]) {
          const st = (stats[tk.event_id] ??= { sold: 0, scanned: 0 });
          st.sold += 1;
          if (tk.is_scanned) st.scanned += 1;
        }
        setTicketStats(stats);
      }
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
    const dateChanged = modalMode === "add" || form.date !== (editingEvent?.event_date ?? "");
    if (dateChanged && new Date(form.date) < today) {
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
      const payload: Record<string, unknown> = {
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
          isAr ? "ليست لديك صلاحية تعديل هذه الفعالية." : "You don't have permission to change this event."
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
      const isRlsError = /row-level security|policy|permission denied|violates row/i.test(msg);
      const friendly = isRlsError
        ? (isAr ? "ليست لديك صلاحية تعديل الفعاليات." : "You don't have permission to change events.")
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
      const isRls = /row-level security|policy|permission denied/i.test(msg);
      toast({
        variant: "destructive",
        title: isAr ? "فشل الحذف" : "Delete failed",
        description: isRls
          ? (isAr ? "ليست لديك صلاحية حذف الفعاليات." : "You don't have permission to delete events.")
          : msg,
      });
    } finally {
      setDeleting(false);
    }
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const statusOf = (dateStr?: string | null): "upcoming" | "today" | "past" | "undated" => {
    if (!dateStr) return "undated";
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === startOfToday.getTime()) return "today";
    return d > startOfToday ? "upcoming" : "past";
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price == null) return null;
    return price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${price.toLocaleString()}`;
  };

  const locale = isAr ? "ar" : "en-GB";
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    try { return new Date(iso).toLocaleDateString(locale, opts); } catch { return iso; }
  };

  const counts = {
    all: events.length,
    upcoming: events.filter((e) => ["upcoming", "today", "undated"].includes(statusOf(e.event_date))).length,
    past: events.filter((e) => statusOf(e.event_date) === "past").length,
  };

  const query = search.trim().toLowerCase();
  const visible = events
    .filter((e) => {
      const st = statusOf(e.event_date);
      if (statusFilter === "upcoming" && st === "past") return false;
      if (statusFilter === "past" && st !== "past") return false;
      if (!query) return true;
      return e.title.toLowerCase().includes(query) || (e.location ?? "").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      // Upcoming soonest first, then past most recent first, undated last
      const sa = statusOf(a.event_date), sb = statusOf(b.event_date);
      const rank = (st: string) => (st === "today" ? 0 : st === "upcoming" ? 1 : st === "past" ? 2 : 3);
      if (rank(sa) !== rank(sb)) return rank(sa) - rank(sb);
      const ta = a.event_date ? new Date(a.event_date).getTime() : 0;
      const tb = b.event_date ? new Date(b.event_date).getTime() : 0;
      return sa === "past" ? tb - ta : ta - tb;
    });

  const statusLabel = {
    upcoming: isAr ? "قادمة" : "Upcoming",
    today: isAr ? "اليوم" : "Today",
    past: isAr ? "منتهية" : "Past",
    undated: isAr ? "بلا تاريخ" : "No date",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.eventsTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.eventsSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => { setLoading(true); fetchEvents(); }}
            disabled={loading}
            title={isAr ? "تحديث" : "Refresh"}
            aria-label={isAr ? "تحديث" : "Refresh"}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            {t.addEvent}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {events.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center p-0.5 rounded-md border border-border bg-card w-fit" role="tablist">
            {(["all", "upcoming", "past"] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={statusFilter === key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "h-8 px-3 rounded text-sm transition-colors flex items-center gap-1.5",
                  statusFilter === key ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key === "all" ? (isAr ? "الكل" : "All") : key === "upcoming" ? statusLabel.upcoming : statusLabel.past}
                <span className="text-xs text-muted-foreground tabular-nums">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث بالاسم أو المكان" : "Search by name or venue"}
              className="h-9 ps-9"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/25 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t.failedLoadEvents}</p>
            <p className="text-xs opacity-80 mt-0.5 break-all">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-muted" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3.5 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 && !error ? (
        <div className="text-center py-20 bg-card border border-card-border rounded-lg">
          <div className="w-12 h-12 rounded-md border border-border bg-muted flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <p className="text-foreground font-semibold">{t.noEvents}</p>
          <p className="text-muted-foreground text-sm mt-1 mb-5">{t.noEventsDesc}</p>
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            {t.addEvent}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-14 bg-card border border-card-border rounded-lg">
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد فعاليات مطابقة." : "No events match your filters."}</p>
          <Button variant="link" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
            {isAr ? "مسح عوامل التصفية" : "Clear filters"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((event) => {
            const status = statusOf(event.event_date);
            const price = formatPrice(event.price as number | null);
            const stats = ticketStats[event.id] ?? { sold: 0, scanned: 0 };
            const open = () => navigate(`/events/${event.id}`);

            return (
              <article
                key={event.id}
                className="group relative bg-card border border-card-border rounded-lg overflow-hidden transition-colors hover:border-foreground/20 focus-within:ring-2 focus-within:ring-ring"
              >
                {/* Image with date block */}
                <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                  {event.image_url ? (
                    <img
                      src={event.image_url as string}
                      alt=""
                      loading="lazy"
                      className={cn("w-full h-full object-cover", status === "past" && "grayscale-[60%]")}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                  )}
                  {event.event_date && (
                    <div className="absolute top-3 start-3 w-12 rounded-md bg-card/95 border border-card-border text-center overflow-hidden shadow-xs">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                        {fmt(event.event_date, { month: "short" })}
                      </p>
                      <p className="text-lg font-semibold text-foreground leading-none pb-1.5 tabular-nums">
                        {fmt(event.event_date, { day: "numeric" })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground leading-snug line-clamp-2">
                      {/* Stretched link: the whole card opens the event */}
                      <button onClick={open} className="text-start after:absolute after:inset-0 focus:outline-none">
                        {event.title}
                      </button>
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="relative z-10 -me-1.5 -mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          aria-label={isAr ? "خيارات الفعالية" : "Event options"}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEditModal(event)}>
                          <Pencil className="w-4 h-4" />
                          {t.editEvent}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteTarget(event)} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4" />
                          {t.deleteEvent}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-1.5 space-y-1 text-[13px] text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          status === "today" ? "bg-amber-500" : status === "upcoming" ? "bg-emerald-600" : "bg-muted-foreground/40"
                        )}
                      />
                      <span className={cn(status === "today" && "text-amber-700 dark:text-amber-500 font-medium")}>
                        {statusLabel[status]}
                      </span>
                      {event.event_date && (
                        <span>· {fmt(event.event_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{(event.location as string) || "—"}</span>
                    </p>
                  </div>

                  {/* Figures */}
                  <dl className="mt-4 grid grid-cols-3 border-t border-border pt-3 text-[13px]">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">{isAr ? "مباعة" : "Sold"}</dt>
                      <dd className="font-medium text-foreground tabular-nums">{stats.sold}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">{isAr ? "دخلوا" : "Checked in"}</dt>
                      <dd className="font-medium text-foreground tabular-nums">{stats.scanned}</dd>
                    </div>
                    <div className="text-end">
                      <dt className="text-[11px] text-muted-foreground">{isAr ? "السعر" : "Price"}</dt>
                      <dd className="font-medium text-foreground tabular-nums truncate">{price ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90dvh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-semibold">
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
              <Label className="text-sm font-medium">
                {isAr ? "صورة الفعالية" : "Event image"}
              </Label>
              <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              {(imagePreview || currentImageUrl) ? (
                <div className="relative rounded-md overflow-hidden border border-border aspect-[16/9]">
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
                  className="w-full aspect-[16/9] border border-dashed border-input rounded-md flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Upload className="w-5 h-5" strokeWidth={1.75} />
                  <span className="text-sm font-medium text-foreground">{isAr ? "اضغط لإضافة صورة" : "Upload an image"}</span>
                  <span className="text-xs">{isAr ? "PNG أو JPG أو WebP، حتى 5 ميغابايت، بنسبة 16:9" : "PNG, JPG or WebP, up to 5 MB, 16:9 works best"}</span>
                </button>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t.eventTitle}</Label>
              <Input
                placeholder={t.eventTitlePlaceholder}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-10"
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isAr ? "سعر التذكرة" : "Ticket price"}
                <span className="text-xs text-muted-foreground font-normal ms-1.5">{isAr ? "اختياري، 0 للمجاني" : "Optional, 0 for free"}</span>
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
                  className="h-10 ps-12"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Date + Location in two columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t.date}</Label>
                <Input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t.location}</Label>
                <Input
                  placeholder={t.locationPlaceholder}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 shrink-0 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{imageUploading ? (isAr ? "جاري رفع الصورة…" : "Uploading image…") : t.saving}</>
              ) : modalMode === "add" ? (
                t.addEvent
              ) : (
                t.saveSettings
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t.confirmDelete}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{t.confirmDeleteDesc}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {deleteTarget && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <p className="font-medium text-foreground text-sm truncate">{deleteTarget.title}</p>
                {(ticketStats[deleteTarget.id]?.sold ?? 0) > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {isAr
                      ? `سيتم أيضًا حذف ${ticketStats[deleteTarget.id].sold} تذكرة.`
                      : `${ticketStats[deleteTarget.id].sold} issued ticket(s) will also be deleted.`}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t.cancel}</Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />{t.deleting}</> : t.confirmDeleteBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
