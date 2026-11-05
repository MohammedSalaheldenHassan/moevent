import { useEffect, useRef, useState } from "react";
import { ticketTheme, type TicketKind } from "@/lib/ticketThemes";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { getApiBase, getApiAuthHeaders } from "@/lib/apiBase";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ChevronRight, ChevronLeft, CalendarDays, MapPin, Ticket,
  Search, CheckCircle2, AlertCircle, Loader2,
  Printer, Users, UserPlus, Trash2, MessageCircle, Mail, Plus, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printTicket, isImageUrl, shortTicketId } from "@/lib/printTicket";
import QRCode from "qrcode";
import { generateTicketPdf } from "@/lib/ticketPdf";
import { BookingRequestsPanel } from "@/components/BookingRequestsPanel";
import { TicketTypeBreakdown } from "@/components/TicketTypeBreakdown";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { exportEventWorkbook } from "@/lib/exportEvent";

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
  image_url: string | null;
  capacity_student: number | null;
  capacity_regular: number | null;
  capacity_organization: number | null;
}

interface TicketRow {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  // Set by the public booking site; null for tickets issued here.
  customer_email: string | null;
  attendee_type: TicketKind | null;
  // Student tickets only.
  customer_university: string | null;
  customer_major: string | null;
  is_scanned: boolean;
  created_at: string;
}

const ATTENDEE_TYPE_LABELS = {
  student: { en: "Student", ar: "طالب" },
  regular: { en: "Regular", ar: "عادي" },
  organization: { en: "Organization", ar: "مؤسسة" },
  vip: { en: "VIP", ar: "VIP" },
  vvip: { en: "VVIP", ar: "VVIP" },
} as const;

interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

interface AccessRow {
  id: string;
  profile_id: string;
  profiles: StaffProfile;
}

type Filter = "all" | "scanned" | "not_scanned";

const DIAL_CODES = [
  { code: "+93",  flag: "🇦🇫", name: "Afghanistan" },
  { code: "+355", flag: "🇦🇱", name: "Albania" },
  { code: "+213", flag: "🇩🇿", name: "Algeria" },
  { code: "+376", flag: "🇦🇩", name: "Andorra" },
  { code: "+244", flag: "🇦🇴", name: "Angola" },
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+374", flag: "🇦🇲", name: "Armenia" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+43",  flag: "🇦🇹", name: "Austria" },
  { code: "+994", flag: "🇦🇿", name: "Azerbaijan" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+32",  flag: "🇧🇪", name: "Belgium" },
  { code: "+229", flag: "🇧🇯", name: "Benin" },
  { code: "+975", flag: "🇧🇹", name: "Bhutan" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+387", flag: "🇧🇦", name: "Bosnia" },
  { code: "+267", flag: "🇧🇼", name: "Botswana" },
  { code: "+55",  flag: "🇧🇷", name: "Brazil" },
  { code: "+226", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "+257", flag: "🇧🇮", name: "Burundi" },
  { code: "+855", flag: "🇰🇭", name: "Cambodia" },
  { code: "+237", flag: "🇨🇲", name: "Cameroon" },
  { code: "+1",   flag: "🇨🇦", name: "Canada" },
  { code: "+236", flag: "🇨🇫", name: "Central African Rep." },
  { code: "+235", flag: "🇹🇩", name: "Chad" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+269", flag: "🇰🇲", name: "Comoros" },
  { code: "+242", flag: "🇨🇬", name: "Congo" },
  { code: "+243", flag: "🇨🇩", name: "Congo (DRC)" },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "+225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "+385", flag: "🇭🇷", name: "Croatia" },
  { code: "+53",  flag: "🇨🇺", name: "Cuba" },
  { code: "+357", flag: "🇨🇾", name: "Cyprus" },
  { code: "+420", flag: "🇨🇿", name: "Czech Republic" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+253", flag: "🇩🇯", name: "Djibouti" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "+20",  flag: "🇪🇬", name: "Egypt" },
  { code: "+503", flag: "🇸🇻", name: "El Salvador" },
  { code: "+240", flag: "🇬🇶", name: "Equatorial Guinea" },
  { code: "+291", flag: "🇪🇷", name: "Eritrea" },
  { code: "+372", flag: "🇪🇪", name: "Estonia" },
  { code: "+268", flag: "🇸🇿", name: "Eswatini" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+679", flag: "🇫🇯", name: "Fiji" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+241", flag: "🇬🇦", name: "Gabon" },
  { code: "+220", flag: "🇬🇲", name: "Gambia" },
  { code: "+995", flag: "🇬🇪", name: "Georgia" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+30",  flag: "🇬🇷", name: "Greece" },
  { code: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "+224", flag: "🇬🇳", name: "Guinea" },
  { code: "+245", flag: "🇬🇼", name: "Guinea-Bissau" },
  { code: "+592", flag: "🇬🇾", name: "Guyana" },
  { code: "+509", flag: "🇭🇹", name: "Haiti" },
  { code: "+504", flag: "🇭🇳", name: "Honduras" },
  { code: "+36",  flag: "🇭🇺", name: "Hungary" },
  { code: "+354", flag: "🇮🇸", name: "Iceland" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "+98",  flag: "🇮🇷", name: "Iran" },
  { code: "+964", flag: "🇮🇶", name: "Iraq" },
  { code: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "+1876",flag: "🇯🇲", name: "Jamaica" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+962", flag: "🇯🇴", name: "Jordan" },
  { code: "+7",   flag: "🇰🇿", name: "Kazakhstan" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+996", flag: "🇰🇬", name: "Kyrgyzstan" },
  { code: "+856", flag: "🇱🇦", name: "Laos" },
  { code: "+371", flag: "🇱🇻", name: "Latvia" },
  { code: "+961", flag: "🇱🇧", name: "Lebanon" },
  { code: "+266", flag: "🇱🇸", name: "Lesotho" },
  { code: "+231", flag: "🇱🇷", name: "Liberia" },
  { code: "+218", flag: "🇱🇾", name: "Libya" },
  { code: "+370", flag: "🇱🇹", name: "Lithuania" },
  { code: "+352", flag: "🇱🇺", name: "Luxembourg" },
  { code: "+261", flag: "🇲🇬", name: "Madagascar" },
  { code: "+265", flag: "🇲🇼", name: "Malawi" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+960", flag: "🇲🇻", name: "Maldives" },
  { code: "+223", flag: "🇲🇱", name: "Mali" },
  { code: "+356", flag: "🇲🇹", name: "Malta" },
  { code: "+222", flag: "🇲🇷", name: "Mauritania" },
  { code: "+230", flag: "🇲🇺", name: "Mauritius" },
  { code: "+52",  flag: "🇲🇽", name: "Mexico" },
  { code: "+373", flag: "🇲🇩", name: "Moldova" },
  { code: "+976", flag: "🇲🇳", name: "Mongolia" },
  { code: "+382", flag: "🇲🇪", name: "Montenegro" },
  { code: "+212", flag: "🇲🇦", name: "Morocco" },
  { code: "+258", flag: "🇲🇿", name: "Mozambique" },
  { code: "+264", flag: "🇳🇦", name: "Namibia" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+505", flag: "🇳🇮", name: "Nicaragua" },
  { code: "+227", flag: "🇳🇪", name: "Niger" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+507", flag: "🇵🇦", name: "Panama" },
  { code: "+675", flag: "🇵🇬", name: "Papua New Guinea" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+51",  flag: "🇵🇪", name: "Peru" },
  { code: "+63",  flag: "🇵🇭", name: "Philippines" },
  { code: "+48",  flag: "🇵🇱", name: "Poland" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+40",  flag: "🇷🇴", name: "Romania" },
  { code: "+7",   flag: "🇷🇺", name: "Russia" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "+381", flag: "🇷🇸", name: "Serbia" },
  { code: "+232", flag: "🇸🇱", name: "Sierra Leone" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+421", flag: "🇸🇰", name: "Slovakia" },
  { code: "+386", flag: "🇸🇮", name: "Slovenia" },
  { code: "+252", flag: "🇸🇴", name: "Somalia" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+211", flag: "🇸🇸", name: "South Sudan" },
  { code: "+34",  flag: "🇪🇸", name: "Spain" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+249", flag: "🇸🇩", name: "Sudan" },
  { code: "+597", flag: "🇸🇷", name: "Suriname" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+963", flag: "🇸🇾", name: "Syria" },
  { code: "+886", flag: "🇹🇼", name: "Taiwan" },
  { code: "+992", flag: "🇹🇯", name: "Tajikistan" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+228", flag: "🇹🇬", name: "Togo" },
  { code: "+216", flag: "🇹🇳", name: "Tunisia" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+993", flag: "🇹🇲", name: "Turkmenistan" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+380", flag: "🇺🇦", name: "Ukraine" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "+1",   flag: "🇺🇸", name: "United States" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+998", flag: "🇺🇿", name: "Uzbekistan" },
  { code: "+58",  flag: "🇻🇪", name: "Venezuela" },
  { code: "+84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "+967", flag: "🇾🇪", name: "Yemen" },
  { code: "+260", flag: "🇿🇲", name: "Zambia" },
  { code: "+263", flag: "🇿🇼", name: "Zimbabwe" },
];

const fetchEventTickets = (eventId: string) =>
  fetchAllRows<TicketRow>((from, to) =>
    supabase
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [, navigate] = useLocation();
  const { t, isRTL, lang } = useLocale();
  const { systemName, systemLogo } = useBranding();
  const { profile: currentProfile } = useAuth();
  const isAr = lang === "ar";
  const isAdmin = !currentProfile || currentProfile.role === "admin";

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!event) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportEventWorkbook(event, isAr);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t.somethingWrong);
    } finally {
      setExporting(false);
    }
  };

  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ── WhatsApp Send ─────────────────────────────────────────────
  const [waTicket, setWaTicket] = useState<TicketRow | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waDialCode, setWaDialCode] = useState("+250");
  const [waPdfLoading, setWaPdfLoading] = useState(false);
  const [waPdfError, setWaPdfError] = useState<string | null>(null);

  const openWhatsApp = (tk: TicketRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setWaTicket(tk);
    setWaPdfError(null);
    const raw = (tk.customer_phone ?? "").replace(/^\+?\d{1,4}[\s-]?/, "").replace(/\D/g, "");
    setWaPhone(raw || (tk.customer_phone ?? "").replace(/\D/g, ""));
  };

  const sendWhatsApp = async () => {
    if (!waTicket || !event) return;
    const digits = waPhone.replace(/\D/g, "").replace(/^0+/, "");
    if (!digits) return;
    const dialDigits = waDialCode.replace(/\D/g, "");
    const full = dialDigits + digits;

    setWaPdfLoading(true);
    setWaPdfError(null);

    const dateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const priceStr = event.price != null
      ? (event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price.toLocaleString()}`)
      : "";

    try {
      // 1. Generate QR code for this ticket
      const qrContent = JSON.stringify({ ticketId: waTicket.id, event: event.title, customer: waTicket.customer_name });
      const ticketQr = await QRCode.toDataURL(qrContent, { width: 300, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" } });

      // 2. Generate PDF blob (html2canvas renders Arabic correctly)
      const pdfBlob = await generateTicketPdf({
        ticketId: waTicket.id,
        customerName: waTicket.customer_name,
        customerPhone: waTicket.customer_phone,
        isScanned: waTicket.is_scanned,
        eventTitle: event.title,
        eventDate: event.event_date,
        eventLocation: event.location,
        eventPrice: event.price,
        qrDataUrl: ticketQr,
        systemName: systemName || "Nexus Youth",
        systemLogo: systemLogo || "",
        isAr,
      });

      const fileName = `ticket-${waTicket.id.slice(0, 8).toUpperCase()}.pdf`;

      // 3. Build WhatsApp text message
      const msg = isAr
        ? [
            `🎫 *تذكرتك جاهزة!*`,
            ``,
            `📅 الفعالية: *${event.title}*`,
            dateStr ? `🗓️ التاريخ: ${dateStr}` : "",
            event.location ? `📍 الموقع: ${event.location}` : "",
            priceStr ? `💰 السعر: ${priceStr}` : "",
            ``,
            `👤 الاسم: ${waTicket.customer_name}`,
            `🔖 رقم التذكرة: #${waTicket.id.slice(0, 8).toUpperCase()}`,
            ``,
            `نتمنى لك وقتاً ممتعاً! 🎉`,
          ].filter(Boolean).join("\n")
        : [
            `🎫 *Your Ticket is Ready!*`,
            ``,
            `📅 Event: *${event.title}*`,
            dateStr ? `🗓️ Date: ${dateStr}` : "",
            event.location ? `📍 Location: ${event.location}` : "",
            priceStr ? `💰 Price: ${priceStr}` : "",
            ``,
            `👤 Name: ${waTicket.customer_name}`,
            `🔖 Ticket #: ${waTicket.id.slice(0, 8).toUpperCase()}`,
            ``,
            `Enjoy the event! 🎉`,
          ].filter(Boolean).join("\n");

      // 4. Try Web Share API first (mobile — opens native share sheet → pick WhatsApp)
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });
      const canShare = typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare({ files: [pdfFile] });

      if (canShare) {
        await navigator.share({ files: [pdfFile], text: msg, title: fileName });
      } else {
        // Desktop fallback: download PDF + open WhatsApp
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        setTimeout(() => {
          window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, "_blank");
        }, 400);
      }

      setWaTicket(null);
    } catch (err: unknown) {
      setWaPdfError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setWaPdfLoading(false);
    }
  };

  // ── Email Ticket ───────────────────────────────────────────────
  const [emailTicket, setEmailTicket] = useState<TicketRow | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const sendTicketEmail = async () => {
    if (!emailTicket || !event || !emailAddress.trim()) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSuccess(false);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/issue-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getApiAuthHeaders()) },
        body: JSON.stringify({
          customerEmail: emailAddress.trim(),
          customerName: emailTicket.customer_name,
          ticketId: emailTicket.id,
          eventName: event.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data?.details?.message ?? data?.error ?? "Failed to send email");
      } else {
        setEmailSuccess(true);
        setTimeout(() => { setEmailTicket(null); setEmailAddress(""); setEmailSuccess(false); }, 1800);
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Network error");
    } finally {
      setEmailSending(false);
    }
  };

  // ── Assigned Staff ────────────────────────────────────────────
  const [staffAccess, setStaffAccess] = useState<AccessRow[]>([]);
  const [allStaff, setAllStaff] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [addingStaffId, setAddingStaffId] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  const fetchStaffAccess = async () => {
    if (!id) return;
    setStaffLoading(true);
    const [accessRes, allStaffRes] = await Promise.all([
      supabase
        .from("event_access")
        .select("id, profile_id, profiles(id, full_name, email, role)")
        .eq("event_id", id),
      isAdmin
        ? supabase.from("profiles").select("id, full_name, email, role").eq("role", "staff")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (!accessRes.error) setStaffAccess((accessRes.data ?? []) as unknown as AccessRow[]);
    if (!allStaffRes.error) setAllStaff((allStaffRes.data ?? []) as StaffProfile[]);
    setStaffLoading(false);
  };

  const handleAddStaff = async () => {
    if (!addingStaffId || !id) return;
    setStaffError(null);
    const { error } = await supabase.from("event_access").insert({ event_id: id, profile_id: addingStaffId });
    if (error) { setStaffError(error.message); return; }
    setAddingStaffId("");
    fetchStaffAccess();
  };

  const handleRemoveStaff = async (accessRowId: string) => {
    setRemovingId(accessRowId);
    await supabase.from("event_access").delete().eq("id", accessRowId);
    setRemovingId(null);
    fetchStaffAccess();
  };

  const assignedIds = new Set(staffAccess.map((a) => a.profile_id));
  const availableStaff = allStaff.filter((s) => !assignedIds.has(s.id));

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [eventRes, ticketsRes] = await Promise.all([
          supabase.from("events").select("id, title, event_date, location, price, image_url, capacity_student, capacity_regular, capacity_organization").eq("id", id).single(),
          fetchEventTickets(id),
        ]);
        if (eventRes.error) throw eventRes.error;
        setEvent(eventRes.data as Event);
        setTickets(ticketsRes);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.somethingWrong);
      } finally {
        setLoading(false);
      }
    };
    load();
    fetchStaffAccess();
  }, [id]);

  // After an organization request is approved, its new tickets appear here.
  const reloadTickets = async () => {
    if (!id) return;
    setTickets(await fetchEventTickets(id).catch(() => tickets));
  };

  const openTicketDetail = async (tk: TicketRow) => {
    setSelectedTicket(tk);
    setQrDataUrl(null);
    setQrLoading(true);
    try {
      const qrContent = JSON.stringify({ ticketId: tk.id, event: event?.title ?? "", customer: tk.customer_name });
      const url = await QRCode.toDataURL(qrContent, { width: 300, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" } });
      setQrDataUrl(url);
    } catch { setQrDataUrl(null); }
    finally { setQrLoading(false); }
  };

  const handlePrint = () => {
    if (!selectedTicket || !event) return;
    printTicket({
      lang, brandName: systemName || t.appName, logoUrl: systemLogo,
      ticket: selectedTicket, event, qrDataUrl: qrDataUrl ?? "",
    });
  };

  const filtered = tickets.filter((tk) => {
    const matchesSearch =
      tk.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (tk.customer_phone || "").includes(search) ||
      (tk.customer_email || "").toLowerCase().includes(search.toLowerCase()) ||
      tk.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "scanned" && tk.is_scanned) ||
      (filter === "not_scanned" && !tk.is_scanned);
    return matchesSearch && matchesFilter;
  });

  const scannedCount = tickets.filter((tk) => tk.is_scanned).length;
  const attendanceRate = tickets.length > 0 ? Math.round((scannedCount / tickets.length) * 100) : 0;
  const totalRevenue = event?.price != null ? tickets.length * event.price : null;
  const totalRevenueStr =
    totalRevenue === null
      ? "—"
      : event?.price === 0
        ? (isAr ? "مجاني" : "Free")
        : `RWF ${totalRevenue.toLocaleString()}`;

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.justNow;
    if (mins < 60) return `${mins}${t.minutesAgo}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t.hoursAgo}`;
    return `${Math.floor(hrs / 24)}${t.daysAgo}`;
  };

  const fmtDate = (d: string | null) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString(isAr ? "ar" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return d; }
  };

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const eventStatus = (() => {
    if (!event?.event_date) return null;
    const d = new Date(event.event_date); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return { label: isAr ? "اليوم" : "Today", dot: "bg-amber-500" };
    return d > today
      ? { label: isAr ? "قادمة" : "Upcoming", dot: "bg-emerald-600" }
      : { label: isAr ? "منتهية" : "Past", dot: "bg-muted-foreground/40" };
  })();

  const filterCounts = { all: tickets.length, scanned: scannedCount, not_scanned: tickets.length - scannedCount };

  const formatPrice = (price: number | null) => {
    if (price == null) return null;
    if (price === 0) return isAr ? "مجاني" : "Free";
    return `RWF ${price.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0" aria-label="Breadcrumb">
        <button onClick={() => navigate("/events")} className="hover:text-foreground transition-colors shrink-0">
          {t.eventsTitle}
        </button>
        <ChevronIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-foreground truncate">{event?.title ?? "…"}</span>
      </nav>

      {loading ? (
        <div className="bg-card border border-card-border rounded-lg p-6 animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-16 bg-muted rounded mt-4" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2.5 p-4 bg-destructive/5 border border-destructive/25 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : event ? (
        <>
          {/* Event header */}
          <div className="bg-card border border-card-border rounded-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt=""
                  className="w-full sm:w-64 aspect-[16/9] sm:aspect-auto object-cover border-b sm:border-b-0 sm:border-e border-border"
                />
              )}
              <div className="flex-1 p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {eventStatus && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", eventStatus.dot)} />
                      {eventStatus.label}
                    </p>
                  )}
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground leading-tight">{event.title}</h1>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 text-sm text-muted-foreground">
                    {event.event_date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                        {fmtDate(event.event_date)}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" strokeWidth={1.75} />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 self-start">
                  {isAdmin && (
                    <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
                      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isAr ? "تصدير Excel" : "Export to Excel"}
                    </Button>
                  )}
                  <Button onClick={() => navigate("/issue-ticket")}>
                    <Plus className="w-4 h-4" />
                    {t.issueTicket}
                  </Button>
                </div>
              </div>
            </div>

            {/* Key figures */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border-t border-border">
              {[
                { label: isAr ? "التذاكر المباعة" : "Tickets sold", value: String(tickets.length) },
                { label: isAr ? "دخلوا" : "Checked in", value: String(scannedCount) },
                { label: isAr ? "نسبة الحضور" : "Attendance", value: `${attendanceRate}%` },
                { label: isAr ? "الإيرادات" : "Revenue", value: totalRevenueStr },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card px-5 py-3.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {exportError && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {isAr ? `تعذّر التصدير: ${exportError}` : `The export failed: ${exportError}`}
            </p>
          )}

          <TicketTypeBreakdown tickets={tickets} event={event} isAr={isAr} />

          {isAdmin && (
            <BookingRequestsPanel
              eventId={event.id}
              isAr={isAr}
              userEmail={currentProfile?.email ?? undefined}
              onTicketsCreated={reloadTickets}
            />
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
            {/* Tickets */}
            <section className="bg-card border border-card-border rounded-lg overflow-hidden" aria-labelledby="tickets-heading">
              <div className="px-5 py-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="tickets-heading" className="text-sm font-semibold text-foreground">{t.eventTickets}</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center p-0.5 rounded-md border border-border w-fit" role="tablist">
                    {(["all", "scanned", "not_scanned"] as Filter[]).map((f) => (
                      <button
                        key={f}
                        role="tab"
                        aria-selected={filter === f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          "h-7 px-2.5 rounded text-xs transition-colors flex items-center gap-1.5",
                          filter === f ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {f === "all" ? t.filterAll : f === "scanned" ? t.scanned : t.notScanned}
                        <span className="text-muted-foreground tabular-nums">{filterCounts[f]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative sm:w-56">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder={t.searchTickets}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 ps-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-14 px-5">
                  <Ticket className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-foreground">{t.noTickets}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.noTicketsDesc}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border bg-muted/40">
                        <th className="text-start font-medium px-5 py-2.5">{isAr ? "الحامل" : "Holder"}</th>
                        <th className="text-start font-medium px-3 py-2.5 hidden md:table-cell">{isAr ? "التذكرة" : "Ticket"}</th>
                        <th className="text-start font-medium px-3 py-2.5">{isAr ? "الحالة" : "Status"}</th>
                        <th className="text-start font-medium px-3 py-2.5 hidden sm:table-cell">{isAr ? "صدرت" : "Issued"}</th>
                        <th className="px-3 py-2.5"><span className="sr-only">{isAr ? "إجراءات" : "Actions"}</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((tk) => (
                        <tr
                          key={tk.id}
                          onClick={() => openTicketDetail(tk)}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3 max-w-[220px]">
                            <p className="font-medium text-foreground truncate">{tk.customer_name}</p>
                            {tk.customer_phone && <p dir="ltr" className="text-xs text-muted-foreground truncate text-start">{tk.customer_phone}</p>}
                            {tk.attendee_type && (
                              <span
                                className="mt-1 inline-block rounded-full px-2 py-px text-[10px] font-semibold"
                                style={{ background: ticketTheme(tk.attendee_type).soft, color: ticketTheme(tk.attendee_type).text }}
                              >
                                {ATTENDEE_TYPE_LABELS[tk.attendee_type][isAr ? "ar" : "en"]}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{shortTicketId(tk.id)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className={cn("w-1.5 h-1.5 rounded-full", tk.is_scanned ? "bg-emerald-600" : "bg-muted-foreground/40")} />
                              <span className={tk.is_scanned ? "text-foreground" : "text-muted-foreground"}>
                                {tk.is_scanned ? t.scanned : t.notScanned}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">{timeAgo(tk.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => openWhatsApp(tk, e)}
                                title={isAr ? "إرسال عبر واتساب" : "Send via WhatsApp"}
                                aria-label={isAr ? "إرسال عبر واتساب" : "Send via WhatsApp"}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                              </button>
                              <ChevronIcon className="w-4 h-4 text-muted-foreground/60" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Assigned staff */}
            <aside className="bg-card border border-card-border rounded-lg overflow-hidden" aria-labelledby="staff-heading">
              <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border">
                <div>
                  <h2 id="staff-heading" className="text-sm font-semibold text-foreground">
                    {isAr ? "موظفو البوابة" : "Gate staff"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAr ? "يمكنهم مسح تذاكر هذه الفعالية" : "Can scan tickets for this event"}
                  </p>
                </div>
                {staffLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="p-4 space-y-3">
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <select
                      value={addingStaffId}
                      onChange={(e) => setAddingStaffId(e.target.value)}
                      aria-label={isAr ? "اختر موظفاً" : "Choose staff member"}
                      className="flex-1 min-w-0 h-9 rounded-md border border-input bg-background text-sm px-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">{isAr ? "اختر موظفاً…" : "Choose staff…"}</option>
                      {availableStaff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.email || s.id}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={handleAddStaff} disabled={!addingStaffId} className="h-9 shrink-0">
                      <UserPlus className="w-4 h-4" />
                      {isAr ? "إضافة" : "Add"}
                    </Button>
                  </div>
                )}
                {staffError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{staffError}
                  </p>
                )}
                {staffAccess.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <Users className="w-5 h-5 mx-auto mb-2 opacity-50" strokeWidth={1.75} />
                    {isAr ? "لم يُسنَد أي موظف بعد" : "No staff assigned yet"}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {staffAccess.map((row) => {
                      const s = row.profiles;
                      const initials = (s.full_name || s.email || "?")
                        .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                      return (
                        <li key={row.id} className="flex items-center gap-3 py-2.5">
                          <div className="w-8 h-8 rounded-full border border-border bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-foreground">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{s.full_name || (isAr ? "بدون اسم" : "No name")}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleRemoveStaff(row.id)}
                              disabled={removingId === row.id}
                              title={isAr ? "إزالة" : "Remove"}
                              aria-label={isAr ? "إزالة" : "Remove"}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              {removingId === row.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" strokeWidth={1.75} />}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {/* Ticket detail */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">
            {selectedTicket?.customer_name} — {isAr ? "تفاصيل التذكرة" : "Ticket details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isAr ? "تفاصيل التذكرة مع رمز QR" : "Ticket details with QR code"}
          </DialogDescription>

          {selectedTicket && event && (
            <>
              <div ref={printRef}>
                <div className="p-5 pe-12">
                  <div className="flex items-center gap-2 mb-4">
                    {systemLogo && isImageUrl(systemLogo) ? (
                      <img src={systemLogo} alt="" className="w-6 h-6 rounded object-contain bg-black shrink-0" />
                    ) : (
                      <Ticket className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-foreground truncate">{systemName || t.appName}</span>
                    <span className={cn(
                      "ms-auto inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
                      selectedTicket.is_scanned ? "text-foreground" : "text-muted-foreground"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", selectedTicket.is_scanned ? "bg-emerald-600" : "bg-muted-foreground/40")} />
                      {selectedTicket.is_scanned ? t.scanned : t.notScanned}
                    </span>
                  </div>
                  <p className="text-lg font-semibold leading-snug tracking-tight text-foreground">{event.title}</p>
                  <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {event.event_date && <p>{fmtDate(event.event_date)}</p>}
                    {event.location && <p>{event.location}</p>}
                  </div>
                </div>

                <div className="mx-5 border-t-[1.5px] border-dashed border-border" />

                <div className="p-5 flex gap-4 items-start">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "اسم الحامل" : "Ticket holder"}</p>
                      <p className="text-sm font-medium text-foreground break-words">{selectedTicket.customer_name}</p>
                    </div>
                    {selectedTicket.customer_phone && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "الهاتف" : "Phone"}</p>
                        <p dir="ltr" className="text-sm font-medium text-foreground text-start">{selectedTicket.customer_phone}</p>
                      </div>
                    )}
                    {selectedTicket.customer_email && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "البريد الإلكتروني" : "Email"}</p>
                        <p dir="ltr" className="text-sm font-medium text-foreground text-start break-all">{selectedTicket.customer_email}</p>
                      </div>
                    )}
                    {selectedTicket.attendee_type && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "نوع التذكرة" : "Ticket type"}</p>
                        <p className="text-sm font-semibold" style={{ color: ticketTheme(selectedTicket.attendee_type).text }}>{ATTENDEE_TYPE_LABELS[selectedTicket.attendee_type][isAr ? "ar" : "en"]}</p>
                      </div>
                    )}
                    {selectedTicket.customer_university && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "الجامعة" : "University"}</p>
                        <p className="text-sm font-medium text-foreground break-words">{selectedTicket.customer_university}</p>
                      </div>
                    )}
                    {selectedTicket.customer_major && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "التخصص" : "Major"}</p>
                        <p className="text-sm font-medium text-foreground break-words">{selectedTicket.customer_major}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "السعر" : "Price"}</p>
                      <p className="text-sm font-medium text-foreground tabular-nums">{formatPrice(event.price) ?? "—"}</p>
                    </div>
                  </div>
                  <div className="w-28 h-28 rounded-md border border-border p-1 bg-white shrink-0 flex items-center justify-center">
                    {qrLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : qrDataUrl ? (
                      <img src={qrDataUrl} alt={isAr ? "رمز QR للتذكرة" : "Ticket QR code"} className="w-full h-full" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground text-center px-1">{isAr ? "تعذّر إنشاء الرمز" : "QR unavailable"}</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-border px-5 py-2.5 text-center font-mono text-[11px] tracking-wider text-muted-foreground">
                  {isAr ? "رقم التذكرة" : "Ticket"} {shortTicketId(selectedTicket.id)}
                </div>
              </div>

              <div className="border-t border-border p-4 grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { if (selectedTicket) openWhatsApp(selectedTicket, { stopPropagation: () => {} } as React.MouseEvent); }}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedTicket) return;
                    setEmailTicket(selectedTicket);
                    setEmailAddress(selectedTicket.customer_email ?? "");
                    setEmailError(null);
                    setEmailSuccess(false);
                    setSelectedTicket(null);
                  }}
                >
                  <Mail className="w-4 h-4" />
                  {isAr ? "بريد" : "Email"}
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="w-4 h-4" />
                  {isAr ? "طباعة" : "Print"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp */}
      <Dialog open={!!waTicket} onOpenChange={(o) => !o && setWaTicket(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? "إرسال التذكرة عبر واتساب" : "Send ticket via WhatsApp"}</DialogTitle>
            <DialogDescription>{waTicket?.customer_name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="wa-phone" className="text-sm font-medium text-foreground">
                {isAr ? "رقم واتساب المستلم" : "Recipient WhatsApp number"}
              </label>
              <div className="flex gap-2" dir="ltr">
                <select
                  value={waDialCode}
                  onChange={(e) => setWaDialCode(e.target.value)}
                  aria-label={isAr ? "رمز الدولة" : "Country code"}
                  className="h-10 rounded-md border border-input bg-background text-sm px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring shrink-0 w-[110px] font-mono"
                >
                  {DIAL_CODES.map((c, i) => (
                    <option key={`${c.code}-${c.name}-${i}`} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <Input
                  id="wa-phone"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="788 123 456"
                  className="h-10 font-mono flex-1"
                  dir="ltr"
                  type="tel"
                  onKeyDown={(e) => e.key === "Enter" && sendWhatsApp()}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const found = DIAL_CODES.find((c) => c.code === waDialCode);
                  return found ? `${found.name} (${found.code})` : waDialCode;
                })()}
                {" · "}
                {isAr ? "بدون الصفر الأول" : "Without the leading zero"}
              </p>
            </div>

            {waPdfLoading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                {isAr ? "جارٍ إنشاء ملف PDF…" : "Preparing the PDF ticket…"}
              </p>
            )}
            {waPdfError && !waPdfLoading && (
              <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {waPdfError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" disabled={waPdfLoading} onClick={() => setWaTicket(null)}>
                {t.cancel}
              </Button>
              <Button
                disabled={!waPhone.replace(/\D/g, "").replace(/^0+/, "") || waPdfLoading}
                onClick={sendWhatsApp}
              >
                {waPdfLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ التحضير…" : "Preparing…"}</>
                  : <><MessageCircle className="w-4 h-4" />{isAr ? "فتح واتساب" : "Open WhatsApp"}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email */}
      <Dialog open={!!emailTicket} onOpenChange={(o) => !o && setEmailTicket(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? "إرسال التذكرة بالبريد" : "Send ticket by email"}</DialogTitle>
            <DialogDescription>{emailTicket?.customer_name}</DialogDescription>
          </DialogHeader>

          {emailSuccess ? (
            <div className="flex items-start gap-2.5 p-3 rounded-md border border-emerald-600/25 bg-emerald-600/5 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-foreground">
                {isAr ? `تم إرسال التذكرة إلى ${emailAddress}` : `Ticket sent to ${emailAddress}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ticket-email" className="text-sm font-medium text-foreground">
                  {isAr ? "البريد الإلكتروني للمستلم" : "Recipient email"}
                </label>
                <Input
                  id="ticket-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendTicketEmail()}
                  className="h-10"
                  dir="ltr"
                  disabled={emailSending}
                />
              </div>

              {emailError && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/25 rounded-md px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {emailError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" disabled={emailSending} onClick={() => setEmailTicket(null)}>
                  {t.cancel}
                </Button>
                <Button disabled={!emailAddress.trim() || emailSending} onClick={sendTicketEmail}>
                  {emailSending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ الإرسال…" : "Sending…"}</>
                    : <><Mail className="w-4 h-4" />{isAr ? "إرسال" : "Send"}</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
