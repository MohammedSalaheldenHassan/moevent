import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { siteConfig } from "@/config/site";

/** Native <details>: keyboard and screen-reader accessible without extra JS. */
export function Faq() {
  const { t } = useLocale();
  const { phone, whatsapp, email } = siteConfig.contact;

  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <div>
          <h2 id="faq-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.faqTitle}
          </h2>
          <p className="mt-2 text-muted">{t.faqSub}</p>
          <ul className="mt-4 text-sm">
            {phone && (
              <li>
                <a href={`tel:${phone.replace(/\s/g, "")}`} dir="ltr" className="inline-flex min-h-10 items-center break-all font-medium text-ink hover:text-accent">
                  {phone}
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center break-all font-medium text-ink hover:text-accent">
                  {t.whatsapp}
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="inline-flex min-h-10 items-center break-all font-medium text-ink hover:text-accent">
                  {email}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {t.faqs.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium hover:bg-bg/60 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
