import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";

export interface LatLng {
  lat: number;
  lng: number;
}

// Kigali — prices are in RWF, so most events are around here.
const DEFAULT_CENTER: LatLng = { lat: -1.9441, lng: 30.0619 };

// OpenStreetMap's Nominatim: free, no key. Its policy allows light use
// (max ~1 request/second, no autocomplete), so search runs only on submit.
const NOMINATIM = "https://nominatim.openstreetmap.org";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** A CSS pin, so Leaflet's default marker images (which bundlers break) aren't needed. */
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:hsl(var(--primary));transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Map for choosing an event's venue: click or drag the pin, search a place,
 * or use the device's location. Calls `onChange` with the coordinates, and
 * `onAddress` with a readable address when one is found for the pin.
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
  isAr,
}: {
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
  onAddress: (address: string) => void;
  isAr: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Latest callbacks for the Leaflet handlers, which are bound once.
  const cbRef = useRef({ onChange, onAddress });
  cbRef.current = { onChange, onAddress };

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const lang = isAr ? "ar,en" : "en";

  const reverseGeocode = async (p: LatLng) => {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=17&accept-language=${lang}`);
      const data = await res.json();
      if (data?.display_name) cbRef.current.onAddress(shortAddress(data.display_name));
    } catch {
      // Address is a convenience; the pin is what matters.
    }
  };

  const placePin = (p: LatLng, { pan = false, lookup = true } = {}) => {
    const map = mapRef.current;
    if (!map) return;
    const pos = { lat: round(p.lat), lng: round(p.lng) };
    if (markerRef.current) markerRef.current.setLatLng(pos);
    else {
      const m = L.marker(pos, { icon: pinIcon, draggable: true, keyboard: true, title: isAr ? "موقع الفعالية" : "Event location" }).addTo(map);
      m.on("dragend", () => {
        const ll = m.getLatLng();
        const next = { lat: round(ll.lat), lng: round(ll.lng) };
        cbRef.current.onChange(next);
        void reverseGeocode(next);
      });
      markerRef.current = m;
    }
    if (pan) map.setView(pos, Math.max(map.getZoom(), 16));
    cbRef.current.onChange(pos);
    if (lookup) void reverseGeocode(pos);
  };

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = value ?? DEFAULT_CENTER;
    const map = L.map(containerRef.current, { center: start, zoom: value ? 16 : 12, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => placePin(e.latlng));
    mapRef.current = map;
    if (value) placePin(value, { lookup: false });
    // The dialog animates in; recompute size once it has settled.
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&accept-language=${lang}&q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as SearchResult[];
      setResults(data);
      if (data.length === 0) setMessage(isAr ? "لم يُعثر على نتائج." : "No places found.");
    } catch {
      setMessage(isAr ? "تعذّر البحث الآن." : "Search isn't available right now.");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setMessage(isAr ? "تحديد الموقع يتطلب https أو localhost." : "Your location needs the dashboard on https or localhost.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        placePin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { pan: true });
      },
      () => {
        setLocating(false);
        setMessage(isAr ? "تعذّر تحديد موقعك." : "Couldn't get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const clearPin = () => {
    markerRef.current?.remove();
    markerRef.current = null;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {/* Not a <form>: this sits inside the event form. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder={isAr ? "ابحث عن مكان…" : "Search a place…"}
            className="h-9 ps-8 text-sm"
            aria-label={isAr ? "ابحث عن مكان" : "Search a place"}
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => void search()} disabled={searching}>
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isAr ? "بحث" : "Search"}
        </Button>
      </div>

      {results && results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border text-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                className="w-full text-start px-3 py-2 hover:bg-muted/60 flex items-start gap-2"
                onClick={() => {
                  placePin({ lat: Number(r.lat), lng: Number(r.lon) }, { pan: true, lookup: false });
                  onAddress(shortAddress(r.display_name));
                  setResults(null);
                }}
              >
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={containerRef}
        className="isolate h-64 w-full overflow-hidden rounded-md border border-border"
        role="application"
        aria-label={isAr ? "خريطة: انقر لتحديد موقع الفعالية" : "Map: click to set the event location"}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground" dir="ltr">
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : isAr ? "انقر على الخريطة لوضع الدبوس" : "Click the map to drop a pin"}
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
            {isAr ? "موقعي" : "My location"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearPin}>
              <X className="w-3.5 h-3.5" />
              {isAr ? "إزالة الدبوس" : "Remove pin"}
            </Button>
          )}
        </div>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

/** Nominatim names are long ("Venue, Street, Sector, District, City, Province, 0000, Country"); keep the first few parts. */
function shortAddress(full: string): string {
  return full.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 3).join(", ");
}
