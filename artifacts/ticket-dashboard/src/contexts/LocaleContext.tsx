import React, { createContext, useContext, useState, useEffect } from "react";

type Lang = "en" | "ar";

const translations = {
  en: {
    dir: "ltr" as const,
    lang: "en",
    font: "'Inter', system-ui, sans-serif",

    // App
    appName: "TicketHub",
    appTagline: "Event Management Platform",

    // Auth
    signIn: "Sign In",
    signingIn: "Signing in...",
    emailAddress: "Email address",
    password: "Password",
    emailPlaceholder: "admin@example.com",
    passwordPlaceholder: "••••••••",
    signInToAdmin: "Sign in to your admin account",
    accessDenied: "Access Denied: You do not have admin privileges.",
    connectionError: "Connection error. Please try again.",

    // Nav
    dashboard: "Dashboard",
    events: "Events",
    issueTicket: "Issue Ticket",
    staff: "Staff",
    signOut: "Sign Out",

    // Dashboard
    dashboardTitle: "Dashboard",
    dashboardSubtitle: "Overview of your event management system",
    totalEvents: "Total Events",
    totalTickets: "Total Tickets",
    liveAttendance: "Live Attendance",
    liveTracking: "Live Attendance Tracking",
    liveTrackingDesc: "The attendance counter updates automatically in real-time as tickets are scanned at your events.",
    attendanceRate: "Attendance rate",
    failedStats: "Failed to load stats. Retrying...",

    // Events
    eventsTitle: "Events",
    eventsSubtitle: "Manage all your events",
    addEvent: "Add Event",
    addNewEvent: "Add New Event",
    eventTitle: "Event Title",
    eventTitlePlaceholder: "e.g. Annual Gala 2025",
    date: "Date",
    location: "Location",
    locationPlaceholder: "e.g. Grand Ballroom, Downtown Hotel",
    noEvents: "No events yet",
    noEventsDesc: "Create your first event to get started",
    saving: "Saving...",
    cancel: "Cancel",
    allFieldsRequired: "All fields are required.",
    failedLoadEvents: "Failed to load events",
    failedAddEvent: "Failed to add event",

    // Issue Ticket
    issueTicketTitle: "Issue Ticket",
    issueTicketSubtitle: "Generate and print tickets for your customers",
    event: "Event",
    selectEvent: "Select an event...",
    noEventsAvailable: "No events available",
    customerName: "Customer Name",
    customerNamePlaceholder: "John Doe",
    customerPhone: "Customer Phone",
    customerPhonePlaceholder: "+1 (555) 000-0000",
    issuingTicket: "Issuing Ticket...",
    issueTicketBtn: "Issue Ticket",
    ticketIssuedSuccessfully: "Ticket Issued Successfully",
    printTicket: "Print Ticket",
    issueAnother: "Issue Another",
    ticketId: "Ticket ID",
    failedLoadEventsForTicket: "Failed to load events",
    failedIssueTicket: "Failed to issue ticket",

    // Staff
    staffTitle: "Staff",
    staffSubtitle: "Manage your team members and their roles",
    noStaff: "No staff found",
    noStaffDesc: "Staff profiles will appear here once created in Supabase",
    staffNote: "Note:",
    staffNoteDesc: "To manage staff roles, edit user profiles directly in your Supabase dashboard. Only users with the",
    staffNoteDesc2: "role can access this dashboard.",
    unnamedUser: "Unnamed User",
    admin: "Admin",

    // General
    loading: "Loading...",
    tryAgain: "Try again",
    somethingWrong: "Something went wrong",
  },
  ar: {
    dir: "rtl" as const,
    lang: "ar",
    font: "'Cairo', 'Noto Sans Arabic', system-ui, sans-serif",

    // App
    appName: "تذكرتي",
    appTagline: "منصة إدارة الفعاليات",

    // Auth
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول...",
    emailAddress: "البريد الإلكتروني",
    password: "كلمة المرور",
    emailPlaceholder: "admin@example.com",
    passwordPlaceholder: "••••••••",
    signInToAdmin: "تسجيل الدخول إلى حساب المشرف",
    accessDenied: "وصول مرفوض: لا تملك صلاحيات المشرف.",
    connectionError: "خطأ في الاتصال. الرجاء المحاولة مرة أخرى.",

    // Nav
    dashboard: "لوحة التحكم",
    events: "الفعاليات",
    issueTicket: "إصدار تذكرة",
    staff: "الموظفون",
    signOut: "تسجيل الخروج",

    // Dashboard
    dashboardTitle: "لوحة التحكم",
    dashboardSubtitle: "نظرة عامة على نظام إدارة الفعاليات",
    totalEvents: "إجمالي الفعاليات",
    totalTickets: "إجمالي التذاكر",
    liveAttendance: "الحضور المباشر",
    liveTracking: "تتبع الحضور المباشر",
    liveTrackingDesc: "يتحدث عداد الحضور تلقائيًا في الوقت الفعلي عند مسح التذاكر في فعالياتك.",
    attendanceRate: "نسبة الحضور",
    failedStats: "فشل تحميل الإحصائيات. جارٍ إعادة المحاولة...",

    // Events
    eventsTitle: "الفعاليات",
    eventsSubtitle: "إدارة جميع فعالياتك",
    addEvent: "إضافة فعالية",
    addNewEvent: "إضافة فعالية جديدة",
    eventTitle: "عنوان الفعالية",
    eventTitlePlaceholder: "مثال: الحفل السنوي 2025",
    date: "التاريخ",
    location: "الموقع",
    locationPlaceholder: "مثال: القاعة الكبرى، فندق وسط المدينة",
    noEvents: "لا توجد فعاليات بعد",
    noEventsDesc: "أنشئ فعاليتك الأولى للبدء",
    saving: "جارٍ الحفظ...",
    cancel: "إلغاء",
    allFieldsRequired: "جميع الحقول مطلوبة.",
    failedLoadEvents: "فشل تحميل الفعاليات",
    failedAddEvent: "فشل إضافة الفعالية",

    // Issue Ticket
    issueTicketTitle: "إصدار تذكرة",
    issueTicketSubtitle: "إنشاء وطباعة التذاكر لعملائك",
    event: "الفعالية",
    selectEvent: "اختر فعالية...",
    noEventsAvailable: "لا توجد فعاليات متاحة",
    customerName: "اسم العميل",
    customerNamePlaceholder: "محمد أحمد",
    customerPhone: "هاتف العميل",
    customerPhonePlaceholder: "+966 5XX XXX XXXX",
    issuingTicket: "جارٍ إصدار التذكرة...",
    issueTicketBtn: "إصدار تذكرة",
    ticketIssuedSuccessfully: "تم إصدار التذكرة بنجاح",
    printTicket: "طباعة التذكرة",
    issueAnother: "إصدار تذكرة أخرى",
    ticketId: "رقم التذكرة",
    failedLoadEventsForTicket: "فشل تحميل الفعاليات",
    failedIssueTicket: "فشل إصدار التذكرة",

    // Staff
    staffTitle: "الموظفون",
    staffSubtitle: "إدارة أعضاء الفريق وأدوارهم",
    noStaff: "لا يوجد موظفون",
    noStaffDesc: "ستظهر ملفات الموظفين هنا بعد إنشائها في Supabase",
    staffNote: "ملاحظة:",
    staffNoteDesc: "لإدارة أدوار الموظفين، قم بتعديل ملفات المستخدمين مباشرةً في لوحة Supabase. فقط المستخدمون الذين لديهم دور",
    staffNoteDesc2: "يمكنهم الوصول إلى هذه اللوحة.",
    unnamedUser: "مستخدم بدون اسم",
    admin: "مشرف",

    // General
    loading: "جارٍ التحميل...",
    tryAgain: "حاول مرة أخرى",
    somethingWrong: "حدث خطأ ما",
  },
};

export type Translations = typeof translations.en;

interface LocaleContextType {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("lang") as Lang) || "en";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t = translations[lang];
  const isRTL = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = t.lang;
    document.documentElement.style.setProperty("--app-font-sans", t.font);
  }, [lang, t]);

  return (
    <LocaleContext.Provider value={{ lang, t, setLang, isRTL }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
