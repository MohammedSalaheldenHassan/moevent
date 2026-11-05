import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const en = {
  switchLang: "العربية",
  navEvents: "Events",

  pageTitle: "Upcoming events",
  pageIntro: "Reserve tickets in under a minute. No account needed.",
  search: "Search events or venues",
  clearSearch: "Clear search",
  filterAll: "All",
  filterWeek: "This week",
  filterMonth: "This month",
  results: (n: number) => (n === 1 ? "1 event" : `${n} events`),
  noMatches: "No events match these filters.",
  resetFilters: "Reset filters",
  noEvents: "No upcoming events",
  noEventsBody: "New events are announced regularly. Check back soon.",
  loadError: "Events couldn't be loaded.",
  retry: "Try again",
  getTickets: "Get tickets",

  trust1Title: "No account needed",
  trust1Body: "Just your details, once.",
  trust2Title: "Ticket by email",
  trust2Body: "Student and Regular tickets arrive right away.",
  trust3Title: "QR ticket at the door",
  trust3Body: "Show it on your phone to get in.",

  footer: "A career and personal growth summit helping graduates navigate their next steps.",
  rights: "All rights reserved.",

  breadcrumbEvents: "Events",
  date: "Date",
  venue: "Venue",
  price: "Price",
  perTicket: "per ticket",
  free: "Free",
  priceOnRequest: "Price on request",
  dateTba: "Date to be announced",
  venueTba: "Venue to be announced",
  today: "Today",
  ended: "Ended",
  openMaps: "Open in Maps",
  seeOnMap: "See on map",
  locationTitle: "Location",
  yourDetails: "Your details",
  venueMap: "Map of the venue",
  addCalendar: "Add to calendar",
  googleCalendar: "Google Calendar",
  appleCalendar: "Apple / Outlook (.ics)",
  share: "Share",
  linkCopied: "Link copied",
  endedTitle: "This event has ended",
  endedBody: "Booking is closed for this event.",
  seeUpcoming: "See upcoming events",
  notFound: "Event not found",
  notFoundBody: "It may have been removed, or the link is incorrect.",

  bookTitle: "Reserve tickets",
  quantity: "Tickets",
  decrease: "Fewer tickets",
  increase: "More tickets",
  name: "Full name",
  nameHint: "Shown on the ticket",
  phone: "Phone number",
  phoneHint: "We'll only use it if we need to reach you about your booking",
  email: "Email",
  emailHint: "Your QR ticket will be sent here",
  emailInvalid: "Enter a valid email address.",
  attendeeType: "Ticket type",
  attendeeTypeRequired: "Choose a ticket type.",
  attendeeTypes: {
    student: { label: "Student", hint: "For students" },
    regular: { label: "Regular", hint: "General admission" },
    organization: { label: "Organization", hint: "For companies and groups — reviewed before tickets are issued" },
  },
  university: "University",
  universityRequired: "Enter your university.",
  major: "Major",
  majorRequired: "Enter your major.",
  aboutEvent: "About this event",
  seatsLeft: (n: number) => (n === 1 ? "1 left" : `${n} left`),
  soldOut: "Sold out",
  perBooking: (n: number) => `Up to ${n} per booking`,
  soldOutError: "There aren't enough seats left for this ticket type. Choose fewer tickets or another type.",
  endedError: "This event has ended — booking is closed.",
  dailyLimitError: "This email or phone number has reached today's booking limit. Please contact us if you need more tickets.",
  rateLimitError: "Too many attempts from your connection. Please wait a few minutes and try again.",
  captchaError: "We couldn't verify you're human. Please complete the check and try again.",
  captchaPending: "Please complete the check above first.",
  maxPerBookingError: (n: number) => `You can book at most ${n} ticket${n === 1 ? "" : "s"} of this type at once.`,
  companyUrl: "Company website",
  companyUrlHint: "We use it to verify your organization",
  companyUrlInvalid: "Enter your company's website, e.g. acme.com",
  orgNotice: "Organization bookings are reviewed by our team. Tickets are issued only after approval.",
  submitRequest: (n: number) => (n === 1 ? "Request 1 ticket" : `Request ${n} tickets`),
  requestTitle: "Request sent",
  requestBody: (email: string) =>
    `Our team will review your organization's request. Once it's approved, your tickets will be issued and sent to ${email}.`,
  awaitingApproval: "Awaiting approval",
  requestRef: "Request reference",
  ticketsRequested: "Tickets requested",
  company: "Company",
  total: "Total",
  totalOnConfirm: "Price to be confirmed",
  submit: (n: number) => (n === 1 ? "Reserve ticket" : `Reserve ${n} tickets`),
  submitting: "Reserving…",
  nameRequired: "Enter your full name.",
  phoneInvalid: "Enter a valid phone number.",
  bookError: "We couldn't complete your booking. Please try again.",
  bookNote: "Nothing is charged online.",
  freeNote: "This event is free — no payment needed.",
  bookCta: "Get tickets",

  doneTitle: "You're booked!",
  doneBody: "Your ticket is on its way to your email.",
  ticketsEmailed: (email: string, n: number) =>
    `We've emailed your ${n === 1 ? "ticket" : `${n} tickets`} to ${email}. Show the QR code at the door. Can't find it? Check your spam folder.`,
  emailDelayed: "Your booking is saved, but we couldn't email your ticket just now. Our team will send it to you shortly.",
  ticketSent: "Ticket sent by email",
  references: (n: number) => (n === 1 ? "Booking reference" : `Booking references (${n})`),
  status: "Status",
  pending: "Booked · email pending",
  guest: "Name",
  screenshotHint: "Take a screenshot or keep these references.",
  copy: "Copy",
  copied: "Copied",
  bookMore: "Book more tickets",

  pageNotFound: "Page not found",
  goHome: "Back to events",

  // Landing page
  skipToContent: "Skip to content",
  navHow: "How it works",
  navAbout: "About",
  navFaq: "FAQ",
  browseEvents: "Browse events",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  themeToDark: "Switch to dark mode",
  themeToLight: "Switch to light mode",
  language: "Language",

  heroEyebrow: "Navigate next steps after graduation",
  heroTitle: "Your next step starts here.",
  heroSub: "Nexus Youth is a career and personal growth summit designed to help graduates navigate their next steps with the right skills, networks, and opportunities.",
  heroHow: "How it works",
  heroPanelLabel: "How a booking works",
  heroPass: "Your Nexus Youth pass",
  heroScan: "Scan at the gate",
  heroLive: "Live",
  flow: [
    { title: "Choose your event", sub: "Student, Regular or Organization" },
    { title: "Ticket by email", sub: "With your personal QR code" },
    { title: "Checked in", sub: "QR scanned at the gate" },
  ],
  chipNoAccount: "No account needed",
  chipFast: "Booked in under a minute",

  statsLabel: "Nexus Youth in numbers",
  statEventsHeld: "Events held",
  statTickets: "Tickets booked",
  statUpcoming: "Upcoming events",
  statCheckedIn: "Guests checked in",

  availableTitle: "Available now",
  availableSub: "Happening soon — reserve while you can.",
  viewAll: "View all events",

  upcomingSub: "Everything on the calendar, by month.",

  howSub: "From browsing to the door in four steps.",
  howSteps: [
    { title: "Choose an event", body: "Browse upcoming events and open the one you want." },
    { title: "Fill in your details", body: "Your name, phone, email and ticket type. No account or password." },
    { title: "Get your ticket by email", body: "Student and Regular tickets arrive right away. Organization requests are reviewed first." },
    { title: "Show your QR ticket", body: "Your ticket is scanned at the gate and you're in." },
  ],

  aboutEyebrow: "About Nexus Youth",
  aboutTitle: "The right skills, networks, and opportunities.",
  aboutBody: "Nexus Youth helps graduates move from graduation to what comes next. Browse the events, book in under a minute, and receive your QR ticket by email. On the day, staff scan your ticket at the gate and you're in.",
  aboutFeatures: [
    { title: "No account needed", body: "Book with just your details." },
    { title: "Instant tickets", body: "Student and Regular tickets go straight to your email." },
    { title: "QR entry", body: "Each ticket carries a unique QR code." },
    { title: "Fast check-in", body: "Staff scan tickets at the gate in a second." },
  ],

  faqTitle: "Frequently asked questions",
  faqSub: "Can't find your answer? Contact us — we're happy to help.",
  faqs: [
    { q: "How do I pay for my ticket?", a: "Nothing is charged online. If an event is paid, our team will tell you how to pay." },
    { q: "When do I get my ticket?", a: "Student and Regular tickets are emailed right after booking. Organization requests are reviewed first, and tickets are emailed once approved." },
    { q: "Can I cancel my booking?", a: "Yes. Contact us any time before the event with your booking reference." },
    { q: "I lost my ticket. What should I do?", a: "First check your spam folder. If it isn't there, contact us with your booking reference or the email you booked with, and we'll send your ticket again." },
    { q: "Can I book for a group?", a: "Yes — you can reserve several tickets in one booking, up to the limit shown for each ticket type. For larger groups, send an Organization request." },
    { q: "Do I need to create an account?", a: "No. You only need your details and an email address to receive your ticket." },
  ],

  ctaTitle: "Take your next step.",
  ctaBody: "Seats are limited. Find your event and reserve your ticket in under a minute.",

  footerLinks: "Quick links",
  footerContact: "Contact",
  footerFollow: "Follow us",
  privacy: "Privacy Policy",
  whatsapp: "WhatsApp",
};

type Dict = typeof en;

const ar: Dict = {
  switchLang: "English",
  navEvents: "الفعاليات",

  pageTitle: "الفعاليات القادمة",
  pageIntro: "احجز تذاكرك في أقل من دقيقة. بدون حساب.",
  search: "ابحث عن فعالية أو مكان",
  clearSearch: "مسح البحث",
  filterAll: "الكل",
  filterWeek: "هذا الأسبوع",
  filterMonth: "هذا الشهر",
  results: (n: number) => (n === 1 ? "فعالية واحدة" : n === 2 ? "فعاليتان" : n <= 10 ? `${n} فعاليات` : `${n} فعالية`),
  noMatches: "لا توجد فعاليات تطابق هذه الفلاتر.",
  resetFilters: "إعادة ضبط الفلاتر",
  noEvents: "لا توجد فعاليات قادمة",
  noEventsBody: "نعلن عن فعاليات جديدة باستمرار. عُد قريبًا.",
  loadError: "تعذّر تحميل الفعاليات.",
  retry: "إعادة المحاولة",
  getTickets: "احجز تذكرة",

  trust1Title: "بدون حساب",
  trust1Body: "بياناتك فقط، مرة واحدة.",
  trust2Title: "التذكرة عبر البريد",
  trust2Body: "تذاكر الطلاب والعاديين تصلك فورًا.",
  trust3Title: "تذكرة QR عند الدخول",
  trust3Body: "اعرضها على هاتفك للدخول.",

  footer: "قمة للنمو المهني والشخصي تساعد الخريجين على رسم خطواتهم القادمة.",
  rights: "جميع الحقوق محفوظة.",

  breadcrumbEvents: "الفعاليات",
  date: "التاريخ",
  venue: "المكان",
  price: "السعر",
  perTicket: "للتذكرة",
  free: "مجاني",
  priceOnRequest: "السعر عند الطلب",
  dateTba: "سيُعلن التاريخ لاحقًا",
  venueTba: "سيُعلن المكان لاحقًا",
  today: "اليوم",
  ended: "انتهت",
  openMaps: "فتح في الخرائط",
  seeOnMap: "عرض على الخريطة",
  locationTitle: "الموقع",
  yourDetails: "بياناتك",
  venueMap: "خريطة مكان الفعالية",
  addCalendar: "أضف إلى التقويم",
  googleCalendar: "تقويم Google",
  appleCalendar: "Apple / Outlook (.ics)",
  share: "مشاركة",
  linkCopied: "تم نسخ الرابط",
  endedTitle: "انتهت هذه الفعالية",
  endedBody: "الحجز مغلق لهذه الفعالية.",
  seeUpcoming: "عرض الفعاليات القادمة",
  notFound: "الفعالية غير موجودة",
  notFoundBody: "ربما حُذفت، أو أن الرابط غير صحيح.",

  bookTitle: "احجز التذاكر",
  quantity: "عدد التذاكر",
  decrease: "تقليل",
  increase: "زيادة",
  name: "الاسم الكامل",
  nameHint: "يظهر على التذكرة",
  phone: "رقم الهاتف",
  phoneHint: "نستخدمه فقط عند الحاجة للتواصل معك بشأن الحجز",
  email: "البريد الإلكتروني",
  emailHint: "سنرسل تذكرة QR إلى هذا البريد",
  emailInvalid: "أدخل بريدًا إلكترونيًا صحيحًا.",
  attendeeType: "نوع التذكرة",
  attendeeTypeRequired: "اختر نوع التذكرة.",
  attendeeTypes: {
    student: { label: "طالب", hint: "للطلاب" },
    regular: { label: "عادي", hint: "دخول عام" },
    organization: { label: "مؤسسة", hint: "للشركات والمجموعات — يُراجع الطلب قبل إصدار التذاكر" },
  },
  university: "الجامعة",
  universityRequired: "أدخل اسم جامعتك.",
  major: "التخصص",
  majorRequired: "أدخل تخصصك.",
  aboutEvent: "عن الفعالية",
  seatsLeft: (n: number) => (n === 1 ? "متبقٍ 1" : `متبقٍ ${n}`),
  soldOut: "نفدت التذاكر",
  perBooking: (n: number) => `حتى ${n} في الحجز الواحد`,
  soldOutError: "لا توجد مقاعد كافية لهذا النوع من التذاكر. اختر عددًا أقل أو نوعًا آخر.",
  endedError: "انتهت هذه الفعالية — الحجز مغلق.",
  dailyLimitError: "وصل هذا البريد أو رقم الهاتف إلى حد الحجز اليومي. تواصل معنا إن احتجت تذاكر إضافية.",
  rateLimitError: "محاولات كثيرة من اتصالك. انتظر بضع دقائق ثم حاول مجددًا.",
  captchaError: "تعذّر التحقق من أنك لست روبوتًا. أكمل التحقق وحاول مجددًا.",
  captchaPending: "يرجى إكمال التحقق أعلاه أولًا.",
  maxPerBookingError: (n: number) => `يمكنك حجز ${n} تذكرة كحد أقصى من هذا النوع في المرة الواحدة.`,
  companyUrl: "موقع الشركة",
  companyUrlHint: "نستخدمه للتحقق من مؤسستك",
  companyUrlInvalid: "أدخل موقع شركتك، مثل acme.com",
  orgNotice: "يراجع فريقنا حجوزات المؤسسات. لا تُصدر التذاكر إلا بعد الموافقة.",
  submitRequest: (n: number) => (n === 1 ? "اطلب تذكرة واحدة" : n === 2 ? "اطلب تذكرتين" : `اطلب ${n} تذاكر`),
  requestTitle: "تم إرسال الطلب",
  requestBody: (email: string) =>
    `سيراجع فريقنا طلب مؤسستك. بعد الموافقة ستُصدر تذاكرك وتُرسل إلى ${email}.`,
  awaitingApproval: "بانتظار الموافقة",
  requestRef: "رقم الطلب",
  ticketsRequested: "عدد التذاكر المطلوبة",
  company: "الشركة",
  total: "الإجمالي",
  totalOnConfirm: "سيُؤكَّد السعر لاحقًا",
  submit: (n: number) => (n === 1 ? "احجز التذكرة" : n === 2 ? "احجز تذكرتين" : `احجز ${n} تذاكر`),
  submitting: "جارٍ الحجز…",
  nameRequired: "أدخل اسمك الكامل.",
  phoneInvalid: "أدخل رقم هاتف صحيحًا.",
  bookError: "تعذّر إتمام الحجز. حاول مرة أخرى.",
  bookNote: "لا يُخصم أي مبلغ عبر الإنترنت.",
  freeNote: "هذه الفعالية مجانية — لا حاجة لأي دفع.",
  bookCta: "احجز",

  doneTitle: "تم الحجز!",
  doneBody: "تذكرتك في طريقها إلى بريدك الإلكتروني.",
  ticketsEmailed: (email: string, n: number) =>
    `أرسلنا ${n === 1 ? "تذكرتك" : n === 2 ? "تذكرتيك" : `${n} تذاكر`} إلى ${email}. اعرض رمز QR عند الدخول. لم تجدها؟ تحقق من مجلد الرسائل غير المرغوب فيها.`,
  emailDelayed: "تم حفظ حجزك، لكن تعذّر إرسال التذكرة بالبريد الآن. سيرسلها فريقنا إليك قريبًا.",
  ticketSent: "أُرسلت التذكرة بالبريد",
  references: (n: number) => (n === 1 ? "رقم الحجز" : `أرقام الحجز (${n})`),
  status: "الحالة",
  pending: "محجوزة · الإيميل قيد الإرسال",
  guest: "الاسم",
  screenshotHint: "التقط صورة للشاشة أو احتفظ بأرقام الحجز.",
  copy: "نسخ",
  copied: "تم النسخ",
  bookMore: "احجز تذاكر أخرى",

  pageNotFound: "الصفحة غير موجودة",
  goHome: "العودة إلى الفعاليات",

  skipToContent: "انتقل إلى المحتوى",
  navHow: "كيف يعمل",
  navAbout: "عن المنصة",
  navFaq: "الأسئلة الشائعة",
  browseEvents: "تصفّح الفعاليات",
  openMenu: "فتح القائمة",
  closeMenu: "إغلاق القائمة",
  themeToDark: "التبديل إلى الوضع الداكن",
  themeToLight: "التبديل إلى الوضع الفاتح",
  language: "اللغة",

  heroEyebrow: "خطوتك التالية بعد التخرّج",
  heroTitle: "خطوتك القادمة تبدأ من هنا.",
  heroSub: "Nexus Youth قمة للنمو المهني والشخصي، صُممت لمساعدة الخريجين على رسم خطواتهم القادمة بالمهارات والعلاقات والفرص المناسبة.",
  heroHow: "كيف يعمل",
  heroPanelLabel: "كيف يتم الحجز",
  heroPass: "بطاقة Nexus Youth",
  heroScan: "امسحها عند البوابة",
  heroLive: "مباشر",
  flow: [
    { title: "اختر فعاليتك", sub: "طالب أو عادي أو مؤسسة" },
    { title: "التذكرة عبر البريد", sub: "مع رمز QR الخاص بك" },
    { title: "تم تسجيل الدخول", sub: "مُسح رمز QR عند البوابة" },
  ],
  chipNoAccount: "بدون حساب",
  chipFast: "الحجز في أقل من دقيقة",

  statsLabel: "Nexus Youth بالأرقام",
  statEventsHeld: "فعاليات أُقيمت",
  statTickets: "تذاكر محجوزة",
  statUpcoming: "فعاليات قادمة",
  statCheckedIn: "ضيوف سجّلوا الدخول",

  availableTitle: "متاح الآن",
  availableSub: "فعاليات قريبة — احجز قبل نفاد المقاعد.",
  viewAll: "عرض كل الفعاليات",

  upcomingSub: "كل الفعاليات المجدولة، حسب الشهر.",

  howSub: "من التصفّح إلى الدخول في أربع خطوات.",
  howSteps: [
    { title: "اختر فعالية", body: "تصفّح الفعاليات القادمة وافتح الفعالية التي تريدها." },
    { title: "أدخل بياناتك", body: "اسمك وهاتفك وبريدك ونوع التذكرة. بدون حساب أو كلمة مرور." },
    { title: "استلم تذكرتك بالبريد", body: "تذاكر الطلاب والعاديين تصلك فورًا. أما طلبات المؤسسات فتُراجع أولًا." },
    { title: "اعرض تذكرة QR", body: "تُمسح تذكرتك عند البوابة وتدخل مباشرة." },
  ],

  aboutEyebrow: "عن Nexus Youth",
  aboutTitle: "المهارات والعلاقات والفرص المناسبة.",
  aboutBody: "تساعد Nexus Youth الخريجين على الانتقال من التخرّج إلى ما بعده. تصفّح الفعاليات، واحجز في أقل من دقيقة، واستلم تذكرة QR عبر بريدك الإلكتروني. وفي يوم الفعالية، يمسح الفريق تذكرتك عند البوابة وتدخل مباشرة.",
  aboutFeatures: [
    { title: "بدون حساب", body: "احجز ببياناتك فقط." },
    { title: "تذاكر فورية", body: "تذاكر الطلاب والعاديين تصل مباشرة إلى بريدك." },
    { title: "دخول عبر QR", body: "لكل تذكرة رمز QR فريد." },
    { title: "تسجيل دخول سريع", body: "يمسح الموظفون التذكرة عند البوابة في ثانية." },
  ],

  faqTitle: "الأسئلة الشائعة",
  faqSub: "لم تجد إجابتك؟ تواصل معنا — يسعدنا مساعدتك.",
  faqs: [
    { q: "كيف أدفع ثمن التذكرة؟", a: "لا يُخصم أي مبلغ عبر الإنترنت. إذا كانت الفعالية مدفوعة، سيخبرك فريقنا بطريقة الدفع." },
    { q: "متى أستلم تذكرتي؟", a: "تُرسل تذاكر الطلاب والعاديين إلى بريدك فور الحجز. أما طلبات المؤسسات فتُراجع أولًا، وتُرسل التذاكر بعد الموافقة." },
    { q: "هل يمكنني إلغاء الحجز؟", a: "نعم. تواصل معنا في أي وقت قبل الفعالية مع رقم الحجز." },
    { q: "فقدت تذكرتي، ماذا أفعل؟", a: "تحقق أولًا من مجلد الرسائل غير المرغوب فيها. وإن لم تجدها، تواصل معنا برقم الحجز أو بالبريد الذي حجزت به، وسنرسل لك التذكرة مرة أخرى." },
    { q: "هل يمكنني الحجز لمجموعة؟", a: "نعم — يمكنك حجز عدة تذاكر في حجز واحد، ضمن الحد الظاهر لكل نوع تذكرة. وللمجموعات الأكبر أرسل طلب مؤسسة." },
    { q: "هل أحتاج إلى إنشاء حساب؟", a: "لا. تحتاج فقط إلى بياناتك وبريد إلكتروني لاستلام التذكرة." },
  ],

  ctaTitle: "اتخذ خطوتك القادمة.",
  ctaBody: "المقاعد محدودة. اعثر على فعاليتك واحجز تذكرتك في أقل من دقيقة.",

  footerLinks: "روابط سريعة",
  footerContact: "تواصل معنا",
  footerFollow: "تابعنا",
  privacy: "سياسة الخصوصية",
  whatsapp: "واتساب",
};

const STORAGE_KEY = "moevent-site-lang";

function initialLang(): Lang {
  // ?lang=ar / ?lang=en lets a shared link open in a given language.
  const param = new URLSearchParams(window.location.search).get("lang");
  if (param === "en" || param === "ar") return param;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    // storage blocked (private mode); fall through
  }
  return navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

interface LocaleValue {
  lang: Lang;
  t: Dict;
  isAr: boolean;
  toggle: () => void;
  formatDate: (iso: string, style: "long" | "short") => string;
  dateParts: (iso: string) => { day: string; month: string; weekday: string };
  monthHeading: (iso: string) => string;
  relativeDay: (days: number) => string;
  formatPrice: (price: number | null) => string;
  formatMoney: (amount: number) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const value = useMemo<LocaleValue>(() => {
    const d = lang === "ar" ? ar : en;
    // Western digits in Arabic too: phone numbers, prices and references stay readable for everyone.
    const locale = lang === "ar" ? "ar-u-nu-latn" : "en-GB";
    // Dates are stored as midnight UTC; format in UTC so the day never shifts.
    const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
      new Date(iso).toLocaleDateString(locale, { timeZone: "UTC", ...o });
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const money = (n: number) => `RWF ${n.toLocaleString("en-US")}`;

    return {
      lang,
      isAr: lang === "ar",
      t: d,
      toggle: () => setLang((l) => (l === "ar" ? "en" : "ar")),
      formatDate: (iso, style) =>
        fmt(iso, style === "long"
          ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
          : { weekday: "short", day: "numeric", month: "short" }),
      dateParts: (iso) => ({
        day: fmt(iso, { day: "numeric" }),
        month: fmt(iso, { month: "short" }),
        weekday: fmt(iso, { weekday: "short" }),
      }),
      monthHeading: (iso) => fmt(iso, { month: "long", year: "numeric" }),
      relativeDay: (days) => {
        if (days < 0) return d.ended;
        if (days === 0) return d.today;
        const s =
          days < 14 ? rtf.format(days, "day")
          : days < 60 ? rtf.format(Math.round(days / 7), "week")
          : rtf.format(Math.round(days / 30), "month");
        return s.charAt(0).toUpperCase() + s.slice(1); // "in 4 weeks" -> "In 4 weeks"
      },
      formatPrice: (price) => (price == null ? d.priceOnRequest : price === 0 ? d.free : money(price)),
      formatMoney: money,
    };
  }, [lang]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const v = useContext(LocaleContext);
  if (!v) throw new Error("useLocale must be used inside LocaleProvider");
  return v;
}
