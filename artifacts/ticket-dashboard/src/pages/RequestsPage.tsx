import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { BookingRequestsPanel } from "@/components/BookingRequestsPanel";

/** Organization booking requests across every event, pending first. */
export default function RequestsPage() {
  const { lang } = useLocale();
  const { profile } = useAuth();
  const isAr = lang === "ar";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{isAr ? "طلبات المؤسسات" : "Organization requests"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "حجوزات المؤسسات تنتظر موافقتك. عند الموافقة تُنشأ التذاكر وتُرسل إلى بريد صاحب الطلب."
            : "Organization bookings wait for your approval. Approving creates the tickets and emails them to the requester."}
        </p>
      </div>
      <BookingRequestsPanel isAr={isAr} userEmail={profile?.email ?? undefined} />
    </div>
  );
}
