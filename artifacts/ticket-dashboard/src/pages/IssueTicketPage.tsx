import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Printer, CheckCircle2, Ticket } from "lucide-react";
import QRCode from "qrcode";

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
}

interface IssuedTicket {
  id: string;
  customer_name: string;
  customer_phone: string;
  event: Event;
  qrDataUrl: string;
}

export default function IssueTicketPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [form, setForm] = useState({ eventId: "", customerName: "", customerPhone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<IssuedTicket | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, title, date, location")
          .order("date", { ascending: true });
        if (error) throw error;
        setEvents(data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleIssue = async () => {
    if (!form.eventId || !form.customerName.trim() || !form.customerPhone.trim()) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          event_id: form.eventId,
          customer_name: form.customerName.trim(),
          customer_phone: form.customerPhone.trim(),
          is_scanned: false,
        })
        .select("id, customer_name, customer_phone, event_id")
        .single();

      if (error) throw error;

      const event = events.find((e) => e.id === form.eventId)!;
      const qrContent = JSON.stringify({
        ticketId: data.id,
        event: event.title,
        customer: data.customer_name,
      });
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      setIssuedTicket({
        id: data.id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        event,
        qrDataUrl,
      });
      setForm({ eventId: "", customerName: "", customerPhone: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to issue ticket");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Ticket - ${issuedTicket?.id}</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; padding: 40px; background: #f9fafb; }
            .ticket { background: white; border: 2px solid #e5e7eb; border-radius: 16px; padding: 32px; max-width: 400px; width: 100%; text-align: center; }
            .ticket-header { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
            .event-name { font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 4px; }
            .meta { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
            .divider { border-top: 1px dashed #d1d5db; margin: 20px 0; }
            .customer-name { font-size: 16px; font-weight: 600; color: #111827; }
            .customer-phone { font-size: 14px; color: #6b7280; margin-top: 4px; }
            .qr-container { margin: 24px auto; }
            .qr-container img { width: 200px; height: 200px; }
            .ticket-id { font-size: 11px; color: #9ca3af; margin-top: 12px; word-break: break-all; }
            @media print { body { padding: 0; background: white; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="ticket-header">🎫 Ticket</div>
            <div class="event-name">${issuedTicket?.event.title}</div>
            <div class="meta">${new Date(issuedTicket?.event.date ?? "").toLocaleDateString()} • ${issuedTicket?.event.location}</div>
            <div class="divider"></div>
            <div class="customer-name">${issuedTicket?.customer_name}</div>
            <div class="customer-phone">${issuedTicket?.customer_phone}</div>
            <div class="qr-container">
              <img src="${issuedTicket?.qrDataUrl}" alt="QR Code" />
            </div>
            <div class="ticket-id">Ticket ID: ${issuedTicket?.id}</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Issue Ticket</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and print tickets for your customers</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Event</Label>
          {eventsLoading ? (
            <div className="h-9 bg-muted animate-pulse rounded-md" />
          ) : (
            <Select
              value={form.eventId}
              onValueChange={(v) => setForm(f => ({ ...f, eventId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an event..." />
              </SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <SelectItem value="none" disabled>No events available</SelectItem>
                ) : (
                  events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} — {new Date(e.date).toLocaleDateString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customer-name">Customer Name</Label>
          <Input
            id="customer-name"
            placeholder="John Doe"
            value={form.customerName}
            onChange={(e) => setForm(f => ({ ...f, customerName: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customer-phone">Customer Phone</Label>
          <Input
            id="customer-phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={form.customerPhone}
            onChange={(e) => setForm(f => ({ ...f, customerPhone: e.target.value }))}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button onClick={handleIssue} disabled={saving} className="w-full">
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Issuing Ticket...</>
          ) : (
            <><Ticket className="w-4 h-4" /> Issue Ticket</>
          )}
        </Button>
      </div>

      {issuedTicket && (
        <div className="bg-card border border-green-200 dark:border-green-900 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-foreground">Ticket Issued Successfully</h2>
          </div>

          <div ref={printRef} className="bg-white border border-border rounded-xl p-6 text-center mb-4">
            <div className="text-lg font-bold text-gray-900 mb-1">🎫 Ticket</div>
            <div className="text-base font-semibold text-gray-800">{issuedTicket.event.title}</div>
            <div className="text-sm text-gray-500 mb-4">
              {new Date(issuedTicket.event.date).toLocaleDateString()} · {issuedTicket.event.location}
            </div>
            <div className="border-t border-dashed border-gray-200 pt-4 mb-4">
              <div className="font-semibold text-gray-800">{issuedTicket.customer_name}</div>
              <div className="text-sm text-gray-500">{issuedTicket.customer_phone}</div>
            </div>
            <div className="flex justify-center">
              <img src={issuedTicket.qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <div className="text-xs text-gray-400 mt-3 break-all px-2">
              Ticket ID: {issuedTicket.id}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="w-4 h-4" />
              Print Ticket
            </Button>
            <Button variant="outline" onClick={() => setIssuedTicket(null)} className="flex-1">
              Issue Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
