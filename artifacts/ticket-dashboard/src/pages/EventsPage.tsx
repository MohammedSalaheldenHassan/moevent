import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { logActivity } from "@/lib/activityLogger";
import {
  Plus,
  CalendarDays,
  MapPin,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Ticket,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  created_at: string;
}

type ModalMode = "add" | "edit";

export default function EventsPage() {
  const { t, isRTL } = useLocale();
  const { profile } = useAuth();
  const [, navigate] = useLocation();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", location: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });
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

  useEffect(() => {
    fetchEvents();
  }, []);

  const openAddModal = () => {
    setModalMode("add");
    setEditingEvent(null);
    setForm({ title: "", date: "", location: "" });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setModalMode("edit");
    setEditingEvent(event);
    setForm({
      title: event.title,
      date: event.date,
      location: event.location,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date || !form.location.trim()) {
      setFormError(t.allFieldsRequired);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (modalMode === "add") {
        const { error } = await supabase.from("events").insert({
          title: form.title.trim(),
          date: form.date,
          location: form.location.trim(),
        });
        if (error) throw error;
        logActivity("event_created", `Event: "${form.title.trim()}"`, profile?.email ?? undefined);
      } else if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update({
            title: form.title.trim(),
            date: form.date,
            location: form.location.trim(),
          })
          .eq("id", editingEvent.id);
        if (error) throw error;
        logActivity("event_updated", `Event: "${form.title.trim()}"`, profile?.email ?? undefined);
      }
      setModalOpen(false);
      fetchEvents();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : modalMode === "add"
          ? t.failedAddEvent
          : t.failedUpdateEvent
      );
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
      setDeleteTarget(null);
      fetchEvents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.failedDeleteEvent);
    } finally {
      setDeleting(false);
    }
  };

  const isUpcoming = (dateStr: string) => new Date(dateStr) >= new Date();
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.eventsTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.eventsSubtitle}</p>
        </div>
        <Button
          onClick={openAddModal}
          className="h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/25 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {t.addEvent}
        </Button>
      </div>

      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t.failedLoadEvents}</p>
              <p className="text-xs opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl text-sm text-amber-800 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{t.rlsHint}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-muted rounded-lg w-3/4 mb-4" />
              <div className="h-4 bg-muted rounded-lg w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded-lg w-2/3" />
            </div>
          ))}
        </div>
      ) : events.length === 0 && !error ? (
        <div className="text-center py-20 bg-card border border-card-border rounded-2xl">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold text-base">{t.noEvents}</p>
          <p className="text-muted-foreground text-sm mt-1">{t.noEventsDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => {
            const upcoming = isUpcoming(event.date);
            return (
              <div
                key={event.id}
                className="group bg-card border border-card-border rounded-2xl p-5 hover:shadow-lg hover:shadow-black/5 hover:border-primary/20 transition-all duration-200"
              >
                {/* Header: title + badge */}
                <div className="flex items-start justify-between mb-3">
                  <h3
                    className="font-semibold text-foreground text-base line-clamp-2 leading-snug flex-1 me-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    {event.title}
                  </h3>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    upcoming
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {upcoming ? "●" : "○"}
                  </span>
                </div>

                {/* Date + Location */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <span className="font-medium">{format(new Date(event.date), "PPP")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <span className="truncate">{event.location}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
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
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {modalMode === "add" ? t.addNewEvent : t.editEventTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-medium">{t.eventTitle}</Label>
              <Input
                placeholder={t.eventTitlePlaceholder}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium">{t.date}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium">{t.location}</Label>
              <Input
                placeholder={t.locationPlaceholder}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            {formError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{formError}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
              {t.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.saving}
                </>
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
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">{t.confirmDelete}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">{t.confirmDeleteDesc}</p>
            {deleteTarget && (
              <p className="mt-2 font-semibold text-foreground text-sm">"{deleteTarget.title}"</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">
              {t.cancel}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
              className="rounded-xl"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.deleting}
                </>
              ) : (
                t.confirmDeleteBtn
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
