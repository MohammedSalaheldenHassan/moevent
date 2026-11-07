import { Link } from "wouter";
import { Facebook, Instagram, Mail, MessageCircle, Phone, Twitter } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useSectionLink, type SectionId } from "@/lib/sections";
import { siteConfig } from "@/config/site";
import { Wordmark } from "./Logo";
import { LanguageToggle } from "./Navbar";

export function Footer() {
  const { t } = useLocale();
  const sectionLink = useSectionLink();
  const { contact, social } = siteConfig;

  const links: { id: SectionId; label: string }[] = [
    { id: "events", label: t.navEvents },
    { id: "how", label: t.navHow },
    { id: "about", label: t.navAbout },
    { id: "faq", label: t.navFaq },
  ];
  const contacts = [
    contact.phone && { href: `tel:${contact.phone.replace(/\s/g, "")}`, icon: Phone, label: contact.phone, ltr: true },
    contact.whatsapp && { href: `https://wa.me/${contact.whatsapp}`, icon: MessageCircle, label: t.whatsapp, ltr: false },
    contact.email && { href: `mailto:${contact.email}`, icon: Mail, label: contact.email, ltr: true },
  ].filter(Boolean) as { href: string; icon: typeof Phone; label: string; ltr: boolean }[];
  const socials = [
    social.instagram && { href: social.instagram, icon: Instagram, label: "Instagram" },
    social.facebook && { href: social.facebook, icon: Facebook, label: "Facebook" },
    social.x && { href: social.x, icon: Twitter, label: "X" },
  ].filter(Boolean) as { href: string; icon: typeof Phone; label: string }[];

  const heading = "text-xs font-semibold uppercase tracking-wider text-muted";
  // min-h-10: comfortable touch targets on phones.
  const link = "inline-flex min-h-10 items-center text-sm text-ink-soft hover:text-ink hover:underline underline-offset-4";

  return (
    <footer className="bg-surface">
      <div className="h-10 bg-[url('/brand/motif.png')] bg-[length:auto_100%] bg-repeat-x" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-muted">{t.footer}</p>
          <LanguageToggle className="-ms-3 mt-4" />
        </div>

        <nav aria-label={t.footerLinks}>
          <h2 className={heading}>{t.footerLinks}</h2>
          <ul className="mt-2">
            {links.map((l) => (
              <li key={l.id}>
                <a href={`/#${l.id}`} onClick={sectionLink(l.id)} className={link}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {contacts.length > 0 && (
          <div>
            <h2 className={heading}>{t.footerContact}</h2>
            <ul className="mt-2">
              {contacts.map((c) => (
                <li key={c.href}>
                  <a href={c.href} className={`${link} gap-2 break-all`} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    <c.icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span dir={c.ltr ? "ltr" : undefined}>{c.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {socials.length > 0 && (
          <div>
            <h2 className={heading}>{t.footerFollow}</h2>
            <ul className="mt-4 flex gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    <s.icon className="size-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-muted sm:px-6">
          <p className="py-2">
            © {new Date().getFullYear()} Nexus Youth. {t.rights}
          </p>
          <Link href="/privacy" className="inline-flex min-h-10 items-center hover:text-ink hover:underline underline-offset-4">
            {t.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}
