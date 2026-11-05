import { useEffect } from "react";
import { useLocale, type Lang } from "@/lib/i18n";
import { siteConfig } from "@/config/site";

/**
 * Privacy policy for the booking site and the MES staff app (the gate
 * scanner published on Google Play, which links here). Kept in this file
 * rather than i18n.tsx: it is long, read on one page only, and is revised as
 * a whole.
 *
 * Keep it true to the code: if what we collect, who processes it, or how long
 * it is kept changes, update this page and LAST_UPDATED.
 */
const LAST_UPDATED = "2026-11-05";

type Section = { id: string; title: string; body: (string | string[])[] };

function content(lang: Lang, email: string): { title: string; intro: string; updated: string; sections: Section[] } {
  const contact = email || (lang === "ar" ? "وسائل التواصل المذكورة أسفل الصفحة" : "the contact details at the bottom of this page");

  if (lang === "ar") {
    return {
      title: "سياسة الخصوصية",
      updated: "آخر تحديث",
      intro:
        "توضّح هذه السياسة البيانات التي تجمعها MoEvent وكيف نستخدمها، سواء عند حجز التذاكر على هذا الموقع أو عند استخدام فريق العمل لتطبيق MES لمسح التذاكر عند المدخل.",
      sections: [
        {
          id: "booking",
          title: "عند حجز التذاكر على الموقع",
          body: [
            "نطلب منك عند الحجز:",
            [
              "الاسم، ورقم الهاتف، والبريد الإلكتروني.",
              "نوع التذكرة (طالب، عادي، مؤسسة) وعدد التذاكر.",
              "لحجوزات المؤسسات: رابط موقع المؤسسة، ليراجع فريقنا الطلب قبل الموافقة عليه.",
            ],
            "نستخدم هذه البيانات لإصدار تذاكرك وإرسالها إلى بريدك الإلكتروني مع رمز QR، وللتواصل معك بشأن الحجز، وللتحقق من التذكرة عند الدخول. لا نستخدمها للتسويق.",
            "لمنع إساءة الاستخدام، يُستخدم عنوان IP الخاص بك مؤقتاً للحدّ من عدد الحجوزات، وقد يُطلب منك اجتياز تحقّق Cloudflare Turnstile. لا يُحفظ عنوان IP مع حجزك.",
          ],
        },
        {
          id: "device",
          title: "ما يُحفظ على جهازك",
          body: [
            "يحفظ الموقع في متصفحك (localStorage) لغة العرض والمظهر الفاتح أو الداكن، وبيانات التواصل التي أدخلتها لتسهيل حجزك القادم. تبقى هذه البيانات على جهازك فقط، ويمكنك حذفها بمسح بيانات الموقع من المتصفح. لا نستخدم ملفات تعريف الارتباط للتتبّع أو الإعلانات.",
          ],
        },
        {
          id: "app",
          title: "تطبيق فريق العمل MES",
          body: [
            "تطبيق MES مخصّص لفريق عمل الفعاليات فقط، ولا يمكن إنشاء حساب من داخله؛ إذ ينشئ المنظّم الحسابات من لوحة التحكم.",
            [
              "الحساب: البريد الإلكتروني والاسم لتسجيل الدخول.",
              "تسجيل الحضور: عند مسح تذكرة نسجّل أنها استُخدمت، ومن قام بمسحها، ووقت المسح.",
              "يعرض التطبيق لعضو الفريق اسم الضيف ونوع تذكرته للتحقّق منها عند المدخل.",
              "الكاميرا: تُستخدم فقط أثناء فتح شاشة المسح لقراءة رمز QR. تُعالَج الصور على الجهاز ولا تُحفظ ولا تُرفع إلى أي خادم.",
            ],
          ],
        },
        {
          id: "processors",
          title: "من يعالج البيانات نيابةً عنّا",
          body: [
            "لا نبيع بياناتك ولا نشاركها مع المعلنين، ولا يحتوي الموقع أو التطبيق على إعلانات أو أدوات تحليل من أطراف ثالثة. نستعين بمزوّدي الخدمات التالية لتشغيل الخدمة فقط:",
            [
              "Supabase: قاعدة البيانات وتسجيل دخول فريق العمل.",
              "Railway: استضافة الموقع والخادم.",
              "مزوّد البريد الإلكتروني (Brevo): لإرسال التذاكر إلى بريدك.",
              "Cloudflare Turnstile: للتحقّق من أن الحجز ليس آلياً.",
              "OpenStreetMap وGoogle Fonts: لعرض خريطة موقع الفعالية والخطوط، ويتلقّيان عنوان IP الخاص بك عند تحميلها.",
            ],
          ],
        },
        {
          id: "retention",
          title: "مدة الاحتفاظ بالبيانات",
          body: [
            "تُحذف التذاكر وطلبات حجز المؤسسات وبيانات الحضور المرتبطة بها تلقائياً بعد ثلاثة أيام من موعد الفعالية. تبقى حسابات فريق العمل حتى يحذفها المنظّم.",
          ],
        },
        {
          id: "rights",
          title: "حقوقك",
          body: [
            `يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها، بما في ذلك حذف حساب فريق العمل، بالتواصل معنا عبر ${contact}. سنردّ خلال 30 يوماً.`,
          ],
        },
        {
          id: "security",
          title: "الأمان",
          body: [
            "تُنقل جميع البيانات عبر اتصالات مشفّرة (HTTPS). لا يستطيع الزوّار قراءة بيانات الحجوزات، ولا يرى عضو الفريق إلا تذاكر الفعاليات المُسندة إليه.",
          ],
        },
        {
          id: "children",
          title: "الأطفال",
          body: [
            "الخدمة غير موجّهة للأطفال دون 13 عاماً، وتطبيق MES مخصّص للبالغين من فريق العمل. إذا حجز طفل تذكرة دون علم وليّ أمره، تواصل معنا لحذف بياناته.",
          ],
        },
        {
          id: "changes",
          title: "التغييرات على هذه السياسة",
          body: ["سننشر أي تغيير على هذه الصفحة ونحدّث تاريخ «آخر تحديث» أعلاه."],
        },
      ],
    };
  }

  return {
    title: "Privacy Policy",
    updated: "Last updated",
    intro:
      "This policy explains what MoEvent collects and how we use it, both when you book tickets on this website and when event staff use the MES app to scan tickets at the door.",
    sections: [
      {
        id: "booking",
        title: "Booking tickets on this website",
        body: [
          "When you book, we ask for:",
          [
            "Your name, phone number and email address.",
            "The ticket type (student, regular or organization) and how many tickets.",
            "For organization bookings: the organization's website, so our team can review the request before approving it.",
          ],
          "We use these details to issue your tickets and email them to you with a QR code, to contact you about your booking, and to check your ticket at the door. We do not use them for marketing.",
          "To prevent abuse, your IP address is used briefly to limit how many bookings can be made, and you may be asked to pass a Cloudflare Turnstile check. Your IP address is not stored with your booking.",
        ],
      },
      {
        id: "device",
        title: "What is stored on your device",
        body: [
          "The website saves your language, light or dark theme, and the contact details you entered (to speed up your next booking) in your browser's local storage. This stays on your device; clear the site's data in your browser to remove it. We do not use cookies for tracking or advertising.",
        ],
      },
      {
        id: "app",
        title: "The MES staff app",
        body: [
          "MES is for event staff only. Accounts can't be created in the app; the organizer creates them in the dashboard.",
          [
            "Account: your email address and name, to sign you in.",
            "Check-ins: when you scan a ticket, we record that it was used, which staff account scanned it, and when.",
            "The app shows staff the guest's name and ticket type so they can check the ticket at the door.",
            "Camera: used only while the scanner screen is open, to read QR codes. Images are processed on the device and are never stored or uploaded.",
          ],
        ],
      },
      {
        id: "processors",
        title: "Who processes data for us",
        body: [
          "We don't sell your data or share it with advertisers, and neither the website nor the app contains ads or third-party analytics. We use these service providers only to run the service:",
          [
            "Supabase: database and staff sign-in.",
            "Railway: hosting for the website and server.",
            "Our email provider (Brevo): sending tickets to your inbox.",
            "Cloudflare Turnstile: checking that a booking isn't automated.",
            "OpenStreetMap and Google Fonts: the venue map and fonts. They receive your IP address when these load.",
          ],
        ],
      },
      {
        id: "retention",
        title: "How long we keep data",
        body: [
          "Tickets, organization booking requests and their check-in records are deleted automatically three days after the event date. Staff accounts are kept until the organizer removes them.",
        ],
      },
      {
        id: "rights",
        title: "Your rights",
        body: [
          `You can ask to see, correct or delete your data, including deleting a staff account, by contacting us at ${contact}. We reply within 30 days.`,
        ],
      },
      {
        id: "security",
        title: "Security",
        body: [
          "All data travels over encrypted (HTTPS) connections. Visitors can't read booking data, and staff only see tickets for the events they're assigned to.",
        ],
      },
      {
        id: "children",
        title: "Children",
        body: [
          "The service is not directed at children under 13, and the MES app is for adult staff. If a child booked a ticket without a parent's knowledge, contact us and we'll delete their data.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        body: ["We'll post any changes on this page and update the \"Last updated\" date above."],
      },
    ],
  };
}

export default function PrivacyPage() {
  const { lang, formatDate } = useLocale();
  const { email } = siteConfig.contact;
  const c = content(lang, email);

  useEffect(() => {
    document.title = `${c.title} · MoEvent`;
    return () => {
      document.title = "MoEvent — Events & Tickets";
    };
  }, [c.title]);

  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 sm:pt-16">
      <header className="border-b border-line pb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{c.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {c.updated}: <time dateTime={LAST_UPDATED}>{formatDate(LAST_UPDATED, "long")}</time>
        </p>
        <p className="mt-5 leading-relaxed text-ink-soft">{c.intro}</p>
      </header>

      <nav aria-label={c.title} className="mt-8 rounded-xl border border-line bg-surface p-5">
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {c.sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-9 items-center gap-2 text-ink-soft hover:text-ink hover:underline underline-offset-4">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {c.sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 pt-10">
          <h2 id={`${s.id}-title`} className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
            <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
            {s.title}
          </h2>
          {s.body.map((part, j) =>
            Array.isArray(part) ? (
              <ul key={j} className="mt-3 list-disc space-y-1.5 ps-5 leading-relaxed text-ink-soft marker:text-muted">
                {part.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={j} className="mt-3 leading-relaxed text-ink-soft">
                {part}
              </p>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
