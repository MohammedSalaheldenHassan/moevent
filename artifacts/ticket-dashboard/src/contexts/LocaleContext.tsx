import React, { createContext, useContext, useState, useEffect } from "react";

type Lang = "en" | "ar";

const translations = {
  en: {
    dir: "ltr" as const,
    lang: "en",
    font: "'Montserrat Variable', 'Cairo Variable', system-ui, sans-serif",

    // App
    appName: "Nexus Youth",
    appTagline: "Event operations",

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
    settings: "Settings",
    activityLogs: "Activity Logs",
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
    editEventTitle: "Edit Event",
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
    failedUpdateEvent: "Failed to update event",
    failedDeleteEvent: "Failed to delete event",
    deleteEvent: "Delete Event",
    confirmDelete: "Confirm Delete",
    confirmDeleteDesc: "This will permanently delete this event and cannot be undone.",
    confirmDeleteBtn: "Yes, Delete",
    deleting: "Deleting...",
    viewTickets: "View Tickets",
    editEvent: "Edit",

    // Event Detail
    backToEvents: "Back to Events",
    eventTickets: "Event Tickets",
    searchTickets: "Search by name or phone...",
    filterAll: "All",
    scanned: "Scanned",
    notScanned: "Not Scanned",
    noTickets: "No tickets yet",
    noTicketsDesc: "Issue tickets for this event to see them here",
    issuedOn: "Issued",
    ticketCount: "tickets",

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
    noStaffDesc: "Add admins and gate staff to give them access",
    staffNote: "Note:",
    staffNoteDesc: "Staff sign in to the gate app and see only the events assigned to them. Only users with the",
    staffNoteDesc2: "role can access this dashboard.",
    rlsHint: "This may be due to Row Level Security (RLS) policies on the profiles table. Ensure your RLS policy allows admins to read all profiles.",
    unnamedUser: "Unnamed User",
    admin: "Admin",

    // Settings
    settingsTitle: "Settings",
    settingsSubtitle: "Manage your application preferences and configuration",
    appSettingsSection: "Application",
    appNameLabel: "App Name",
    appTaglineLabel: "App Tagline",
    languagePref: "Language",
    saveSettings: "Save Changes",
    settingsSaved: "Settings saved successfully",
    resetToDefault: "Reset to Defaults",
    connectionSection: "Supabase Connection",
    connectionStatus: "Status",
    connected: "Connected",
    testConnection: "Test Connection",
    testing: "Testing...",
    connectionOk: "Connection successful",
    connectionFailed: "Connection failed",
    dataSection: "Data Management",
    clearLogsBtn: "Clear Activity Logs",
    clearLogsConfirm: "This will erase all activity history. Are you sure?",
    logsCleared: "Activity logs cleared",

    // Activity Logs
    logsTitle: "Activity Logs",
    logsSubtitle: "Track all actions performed in the system",
    clearLogs: "Clear All",
    noLogs: "No activity yet",
    noLogsDesc: "Actions will be recorded here as you use the system",
    allActions: "All",
    actionEventCreated: "Event Created",
    actionEventUpdated: "Event Updated",
    actionEventDeleted: "Event Deleted",
    actionTicketIssued: "Ticket Issued",
    actionUserLogin: "Login",
    actionUserLogout: "Logout",
    actionSettingsChanged: "Settings Changed",
    justNow: "Just now",
    minutesAgo: "m ago",
    hoursAgo: "h ago",
    daysAgo: "d ago",

    // General
    loading: "Loading...",
    tryAgain: "Try again",
    somethingWrong: "Something went wrong",
  },
  ar: {
    dir: "rtl" as const,
    lang: "ar",
    font: "'Cairo Variable', 'Montserrat Variable', system-ui, sans-serif",

    // App
    appName: "Nexus Youth",
    appTagline: "إدارة الفعاليات",

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
    settings: "الإعدادات",
    activityLogs: "سجل النشاط",
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
    editEventTitle: "تعديل الفعالية",
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
    failedUpdateEvent: "فشل تحديث الفعالية",
    failedDeleteEvent: "فشل حذف الفعالية",
    deleteEvent: "حذف الفعالية",
    confirmDelete: "تأكيد الحذف",
    confirmDeleteDesc: "سيتم حذف هذه الفعالية نهائيًا ولا يمكن التراجع عن هذا الإجراء.",
    confirmDeleteBtn: "نعم، احذف",
    deleting: "جارٍ الحذف...",
    viewTickets: "عرض التذاكر",
    editEvent: "تعديل",

    // Event Detail
    backToEvents: "العودة للفعاليات",
    eventTickets: "تذاكر الفعالية",
    searchTickets: "البحث بالاسم أو الهاتف...",
    filterAll: "الكل",
    scanned: "تم المسح",
    notScanned: "لم يُمسح",
    noTickets: "لا توجد تذاكر بعد",
    noTicketsDesc: "أصدر تذاكر لهذه الفعالية لتظهر هنا",
    issuedOn: "صدرت",
    ticketCount: "تذاكر",

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
    noStaffDesc: "أضف المسؤولين وموظفي البوابة لمنحهم صلاحية الوصول",
    staffNote: "ملاحظة:",
    staffNoteDesc: "يسجّل الموظفون الدخول إلى تطبيق البوابة ويرون الفعاليات المسندة إليهم فقط. فقط المستخدمون الذين لديهم دور",
    staffNoteDesc2: "يمكنهم الوصول إلى هذه اللوحة.",
    rlsHint: "قد يكون هذا بسبب سياسات أمان الصفوف (RLS) على جدول الملفات الشخصية. تأكد من أن سياسة RLS تسمح للمشرفين بقراءة جميع الملفات.",
    unnamedUser: "مستخدم بدون اسم",
    admin: "مشرف",

    // Settings
    settingsTitle: "الإعدادات",
    settingsSubtitle: "إدارة تفضيلات التطبيق والإعدادات",
    appSettingsSection: "التطبيق",
    appNameLabel: "اسم التطبيق",
    appTaglineLabel: "وصف التطبيق",
    languagePref: "اللغة",
    saveSettings: "حفظ التغييرات",
    settingsSaved: "تم حفظ الإعدادات بنجاح",
    resetToDefault: "إعادة إلى الافتراضي",
    connectionSection: "اتصال Supabase",
    connectionStatus: "الحالة",
    connected: "متصل",
    testConnection: "اختبار الاتصال",
    testing: "جارٍ الاختبار...",
    connectionOk: "الاتصال ناجح",
    connectionFailed: "فشل الاتصال",
    dataSection: "إدارة البيانات",
    clearLogsBtn: "مسح سجل النشاط",
    clearLogsConfirm: "سيتم حذف جميع سجلات النشاط. هل أنت متأكد؟",
    logsCleared: "تم مسح سجل النشاط",

    // Activity Logs
    logsTitle: "سجل النشاط",
    logsSubtitle: "تتبع جميع الإجراءات المنفذة في النظام",
    clearLogs: "مسح الكل",
    noLogs: "لا يوجد نشاط بعد",
    noLogsDesc: "ستُسجَّل الإجراءات هنا أثناء استخدامك للنظام",
    allActions: "الكل",
    actionEventCreated: "فعالية أُنشئت",
    actionEventUpdated: "فعالية عُدِّلت",
    actionEventDeleted: "فعالية حُذفت",
    actionTicketIssued: "تذكرة صدرت",
    actionUserLogin: "تسجيل دخول",
    actionUserLogout: "تسجيل خروج",
    actionSettingsChanged: "تغيير إعدادات",
    justNow: "الآن",
    minutesAgo: "د",
    hoursAgo: "س",
    daysAgo: "ي",

    // General
    loading: "جارٍ التحميل...",
    tryAgain: "حاول مرة أخرى",
    somethingWrong: "حدث خطأ ما",
  },
};

export type Translations = Omit<typeof translations.en, "dir"> & { dir: "ltr" | "rtl" };

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
