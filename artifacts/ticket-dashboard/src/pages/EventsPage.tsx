import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, CalendarDays, MapPin, Loader2, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  created_at: string;
}

export default function EventsPage() {
  const { t } = useLocale();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", location: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });
      if (error) throw error;
      setEvents(data ?? []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.failedLoadEvents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleAddEvent = async () => {
    if (!form.title.trim() || !form.date || !form.location.trim()) {
      setFormError(t.allFieldsRequired);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { error } = await supabase.from("events").insert({
        title: form.title.trim(),
        date: form.date,
        location: form.location.trim(),
      });
      if (error) throw error;
      setForm({ title: "", date: "", location: "" });
      setModalOpen(false);
      fetchEvents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t.failedAddEvent);
    } finally {
      setSaving(false);
    }
  };

  const isUpcoming = (dateStr: string) => new Date(dateStr) >= new Date();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.eventsTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.eventsSubtitle}</p>
        </div>
        <Button
          onClick={() => { setModalOpen(true); setFormError(null); }}
          className="h-10 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/25 font-semibold"
        >
          <Plus className="w-4 h-4" />
          {t.addEvent}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
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
      ) : events.length === 0 ? (
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
                className="group bg-card border border-card-border rounded-2xl p-5 hover:shadow-lg hover:shadow-black/5 hover:border-primary/20 transition-all duration-200 cursor-default"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-foreground text-base line-clamp-2 leading-snug flex-1 me-2">
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <span className="font-medium">{format(new Date(event.date), "PPP")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <span className="truncate">{event.location}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t.addNewEvent}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-medium">{t.eventTitle}</Label>
              <Input
                placeholder={t.eventTitlePlaceholder}
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium">{t.date}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium">{t.location}</Label>
              <Input
                placeholder={t.locationPlaceholder}
                value={form.location}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
              {t.cancel}
            </Button>
            <Button
              onClick={handleAddEvent}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/20"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{t.saving}</> : t.addEvent}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
