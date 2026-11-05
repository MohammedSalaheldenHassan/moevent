import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { buildXlsx, downloadXlsx, type Cell } from "@/lib/xlsx";
import { typeLabel, summarizeTypes, type EventCapacities, type TicketKind } from "@/lib/ticketThemes";

interface ExportEventInfo extends EventCapacities {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
}

interface ExportTicket {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  attendee_type: TicketKind | null;
  customer_university: string | null;
  customer_major: string | null;
  is_scanned: boolean | null;
  scanned_at: string | null;
  is_emailed: boolean | null;
  payment_status: string | null;
  created_at: string;
  booking_requests: { company_url: string | null } | { company_url: string | null }[] | null;
}

interface ExportRequest {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  company_url: string;
  quantity: number;
  status: string;
  created_at: string;
}

const STATUS_AR: Record<string, string> = { pending: "بانتظار الموافقة", approved: "تمت الموافقة", rejected: "مرفوض" };
const STATUS_EN: Record<string, string> = { pending: "Awaiting approval", approved: "Approved", rejected: "Rejected" };

/** One workbook for one event: summary by ticket type, every ticket, every organization request. */
export async function exportEventWorkbook(event: ExportEventInfo, isAr: boolean): Promise<{ tickets: number; requests: number }> {
  const [tickets, requests] = await Promise.all([
    fetchAllRows<ExportTicket>((from, to) =>
      supabase
        .from("tickets")
        .select(
          "id, customer_name, customer_phone, customer_email, attendee_type, customer_university, customer_major, is_scanned, scanned_at, is_emailed, payment_status, created_at, booking_requests(company_url)",
        )
        .eq("event_id", event.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: ExportTicket[] | null; error: { message: string } | null }>,
    ),
    fetchAllRows<ExportRequest>((from, to) =>
      supabase
        .from("booking_requests")
        .select("id, customer_name, customer_phone, customer_email, company_url, quantity, status, created_at")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const L = isAr ? "ar" : "en";
  const yes = isAr ? "نعم" : "Yes";
  const no = isAr ? "لا" : "No";
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(isAr ? "ar" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
  const company = (t: ExportTicket) => {
    const r = Array.isArray(t.booking_requests) ? t.booking_requests[0] : t.booking_requests;
    return r?.company_url ?? "";
  };

  const summary = summarizeTypes(tickets, event);
  const summaryRows: Cell[][] = [
    [isAr ? "الفعالية" : "Event", event.title],
    [isAr ? "التاريخ" : "Date", event.event_date ? new Date(event.event_date).toLocaleDateString(isAr ? "ar" : "en-GB", { timeZone: "UTC", dateStyle: "long" }) : ""],
    [isAr ? "المكان" : "Venue", event.location ?? ""],
    [isAr ? "السعر" : "Price", event.price == null ? "" : event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price.toLocaleString("en-US")}`],
    [isAr ? "تاريخ التصدير" : "Exported", when(new Date().toISOString())],
    [],
    [isAr ? "نوع التذكرة" : "Ticket type", isAr ? "العدد" : "Tickets", isAr ? "السعة" : "Capacity", isAr ? "المتبقي" : "Left", isAr ? "دخلوا" : "Checked in"],
    ...summary.rows.map((r): Cell[] => [typeLabel(r.type, L), r.total, r.capacity ?? (isAr ? "بدون حد" : "No limit"), r.left ?? "", r.scanned]),
    [isAr ? "الإجمالي" : "Total", summary.total, "", "", summary.scanned],
  ];

  const ticketRows: Cell[][] = [
    (isAr
      ? ["رقم التذكرة", "الاسم", "الهاتف", "البريد الإلكتروني", "النوع", "الجامعة", "التخصص", "موقع المؤسسة", "دخل", "وقت الدخول", "أُرسلت بالبريد", "حالة الدفع", "تاريخ الحجز"]
      : ["Ticket no.", "Name", "Phone", "Email", "Type", "University", "Major", "Company website", "Checked in", "Checked in at", "Emailed", "Payment", "Booked at"]),
    ...tickets.map((t): Cell[] => [
      t.id.slice(0, 8).toUpperCase(),
      t.customer_name,
      t.customer_phone,
      t.customer_email,
      t.attendee_type ? typeLabel(t.attendee_type, L) : "",
      t.customer_university,
      t.customer_major,
      company(t),
      t.is_scanned ? yes : no,
      when(t.scanned_at),
      t.is_emailed ? yes : no,
      t.payment_status,
      when(t.created_at),
    ]),
  ];

  const requestRows: Cell[][] = [
    (isAr
      ? ["رقم الطلب", "الاسم", "الهاتف", "البريد الإلكتروني", "موقع المؤسسة", "عدد التذاكر", "الحالة", "تاريخ الطلب"]
      : ["Request no.", "Name", "Phone", "Email", "Company website", "Tickets", "Status", "Requested at"]),
    ...requests.map((r): Cell[] => [
      r.id.slice(0, 8).toUpperCase(),
      r.customer_name,
      r.customer_phone,
      r.customer_email,
      r.company_url,
      r.quantity,
      (isAr ? STATUS_AR : STATUS_EN)[r.status] ?? r.status,
      when(r.created_at),
    ]),
  ];

  const bytes = buildXlsx(
    [
      { name: isAr ? "ملخص" : "Summary", rows: summaryRows, widths: [24, 34, 14, 12, 14], plain: true },
      { name: isAr ? "التذاكر" : "Tickets", rows: ticketRows, widths: [13, 26, 18, 30, 14, 28, 24, 30, 10, 20, 10, 12, 20] },
      { name: isAr ? "طلبات المؤسسات" : "Organization requests", rows: requestRows, widths: [13, 26, 18, 30, 30, 10, 18, 20] },
    ],
    { rtl: isAr },
  );

  const safeTitle = event.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, "-").slice(0, 60);
  downloadXlsx(`nexus-youth-${safeTitle}-${new Date().toISOString().slice(0, 10)}.xlsx`, bytes);
  return { tickets: tickets.length, requests: requests.length };
}

