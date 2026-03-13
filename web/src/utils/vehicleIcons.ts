// Vehicle icons as SVG strings with VW/VH placeholders for dynamic sizing
export const mapVehicleEmojis: Record<string, string> = {
  truck: '<svg viewBox="0 0 64 64" width="VW" height="VH"><rect x="4" y="18" width="36" height="24" rx="3" fill="#f59e0b"/><rect x="6" y="20" width="32" height="14" rx="2" fill="#fbbf24"/><rect x="40" y="24" width="18" height="18" rx="3" fill="#dc2626"/><rect x="44" y="27" width="10" height="8" rx="2" fill="#7dd3fc"/><rect x="40" y="38" width="18" height="4" rx="1" fill="#991b1b"/><circle cx="16" cy="44" r="5" fill="#334155"/><circle cx="16" cy="44" r="2.5" fill="#94a3b8"/><circle cx="34" cy="44" r="5" fill="#334155"/><circle cx="34" cy="44" r="2.5" fill="#94a3b8"/><circle cx="50" cy="44" r="5" fill="#334155"/><circle cx="50" cy="44" r="2.5" fill="#94a3b8"/></svg>',
  car: '<svg viewBox="0 0 64 64" width="VW" height="VH"><path d="M12 34 L16 22 Q20 16 32 16 Q44 16 48 22 L52 34 Z" fill="#3b82f6"/><rect x="8" y="34" width="48" height="14" rx="4" fill="#2563eb"/><rect x="18" y="20" width="12" height="12" rx="2" fill="#bfdbfe"/><rect x="34" y="20" width="10" height="12" rx="2" fill="#bfdbfe"/><rect x="10" y="38" width="8" height="4" rx="1" fill="#fbbf24"/><rect x="46" y="38" width="8" height="4" rx="1" fill="#ef4444"/><circle cx="18" cy="48" r="5" fill="#334155"/><circle cx="18" cy="48" r="2.5" fill="#94a3b8"/><circle cx="46" cy="48" r="5" fill="#334155"/><circle cx="46" cy="48" r="2.5" fill="#94a3b8"/></svg>',
  motorcycle: '<svg viewBox="0 0 64 64" width="VW" height="VH"><circle cx="14" cy="44" r="8" fill="#334155"/><circle cx="14" cy="44" r="4" fill="#94a3b8"/><circle cx="50" cy="44" r="8" fill="#334155"/><circle cx="50" cy="44" r="4" fill="#94a3b8"/><path d="M14 44 L24 28 L38 24 L50 44" fill="none" stroke="#dc2626" stroke-width="3"/><rect x="22" y="22" width="18" height="8" rx="3" fill="#dc2626"/><rect x="30" y="16" width="6" height="8" rx="2" fill="#fbbf24"/><circle cx="38" cy="18" r="3" fill="#7dd3fc"/><path d="M40 24 L54 38" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/></svg>',
  bus: '<svg viewBox="0 0 64 64" width="VW" height="VH"><rect x="4" y="14" width="56" height="30" rx="5" fill="#f59e0b"/><rect x="8" y="18" width="10" height="10" rx="2" fill="#bfdbfe"/><rect x="22" y="18" width="10" height="10" rx="2" fill="#bfdbfe"/><rect x="36" y="18" width="10" height="10" rx="2" fill="#bfdbfe"/><rect x="50" y="18" width="8" height="14" rx="2" fill="#7dd3fc"/><rect x="4" y="40" width="56" height="4" rx="1" fill="#b45309"/><circle cx="16" cy="46" r="5" fill="#334155"/><circle cx="16" cy="46" r="2.5" fill="#94a3b8"/><circle cx="48" cy="46" r="5" fill="#334155"/><circle cx="48" cy="46" r="2.5" fill="#94a3b8"/></svg>',
  van: '<svg viewBox="0 0 64 64" width="VW" height="VH"><rect x="6" y="20" width="48" height="24" rx="4" fill="#f8fafc"/><path d="M54 20 L58 30 L58 44 L54 44 Z" fill="#e2e8f0"/><rect x="6" y="20" width="48" height="4" rx="2" fill="#64748b"/><rect x="10" y="26" width="12" height="10" rx="2" fill="#bfdbfe"/><rect x="26" y="26" width="12" height="10" rx="2" fill="#bfdbfe"/><rect x="42" y="26" width="10" height="14" rx="2" fill="#7dd3fc"/><rect x="6" y="40" width="52" height="4" rx="1" fill="#475569"/><circle cx="18" cy="46" r="5" fill="#334155"/><circle cx="18" cy="46" r="2.5" fill="#94a3b8"/><circle cx="46" cy="46" r="5" fill="#334155"/><circle cx="46" cy="46" r="2.5" fill="#94a3b8"/></svg>',
  pickup: '<svg viewBox="0 0 64 64" width="VW" height="VH"><rect x="4" y="26" width="28" height="16" rx="2" fill="#78716c"/><rect x="6" y="28" width="24" height="6" rx="1" fill="#a8a29e"/><rect x="32" y="20" width="22" height="22" rx="4" fill="#2563eb"/><rect x="36" y="23" width="14" height="10" rx="2" fill="#bfdbfe"/><rect x="32" y="38" width="22" height="4" rx="1" fill="#1d4ed8"/><circle cx="16" cy="44" r="5" fill="#334155"/><circle cx="16" cy="44" r="2.5" fill="#94a3b8"/><circle cx="46" cy="44" r="5" fill="#334155"/><circle cx="46" cy="44" r="2.5" fill="#94a3b8"/></svg>',
  tractor: '<svg viewBox="0 0 64 64" width="VW" height="VH"><rect x="20" y="18" width="24" height="20" rx="3" fill="#16a34a"/><rect x="24" y="20" width="14" height="10" rx="2" fill="#bbf7d0"/><rect x="10" y="30" width="14" height="8" rx="2" fill="#334155"/><circle cx="16" cy="44" r="10" fill="#334155"/><circle cx="16" cy="44" r="5" fill="#94a3b8"/><circle cx="16" cy="44" r="2" fill="#334155"/><circle cx="46" cy="40" r="7" fill="#334155"/><circle cx="46" cy="40" r="3.5" fill="#94a3b8"/><circle cx="46" cy="40" r="1.5" fill="#334155"/><rect x="44" y="18" width="4" height="16" rx="1" fill="#64748b"/></svg>',
  boat: '<svg viewBox="0 0 64 64" width="VW" height="VH"><path d="M4 40 Q8 28 32 28 Q56 28 60 40 Z" fill="#1d4ed8"/><path d="M8 40 Q12 32 32 32 Q52 32 56 40 Z" fill="#3b82f6"/><rect x="30" y="14" width="3" height="18" fill="#78716c"/><path d="M33 14 L50 28 L33 28 Z" fill="#f8fafc"/><path d="M2 42 Q16 36 32 42 Q48 48 62 42" fill="none" stroke="#60a5fa" stroke-width="2.5"/><circle cx="20" cy="34" r="2.5" fill="#bfdbfe"/></svg>',
  person: '<svg viewBox="0 0 64 64" width="VW" height="VH"><circle cx="32" cy="14" r="8" fill="#fbbf24"/><circle cx="29" cy="12" r="1.5" fill="#334155"/><circle cx="35" cy="12" r="1.5" fill="#334155"/><path d="M29 17 Q32 20 35 17" fill="none" stroke="#334155" stroke-width="1.2"/><rect x="24" y="22" width="16" height="20" rx="5" fill="#3b82f6"/><rect x="22" y="42" width="7" height="14" rx="3" fill="#1e3a5f"/><rect x="35" y="42" width="7" height="14" rx="3" fill="#1e3a5f"/><rect x="18" y="24" width="8" height="3" rx="1.5" fill="#fbbf24"/><rect x="38" y="24" width="8" height="3" rx="1.5" fill="#fbbf24"/></svg>',
  animal: '<svg viewBox="0 0 64 64" width="VW" height="VH"><ellipse cx="30" cy="30" rx="16" ry="10" fill="#a16207"/><circle cx="48" cy="22" r="8" fill="#ca8a04"/><circle cx="46" cy="20" r="2" fill="#334155"/><ellipse cx="50" cy="24" rx="3" ry="2" fill="#a16207"/><rect x="16" y="38" width="5" height="12" rx="2" fill="#92400e"/><rect x="26" y="38" width="5" height="12" rx="2" fill="#92400e"/><rect x="34" y="38" width="5" height="12" rx="2" fill="#92400e"/><rect x="42" y="38" width="5" height="12" rx="2" fill="#92400e"/><path d="M12 28 Q8 24 12 22" stroke="#a16207" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
};

/**
 * Get HTML string for a Leaflet divIcon with a colored circle background and vehicle SVG
 * @param category - Vehicle category (truck, car, motorcycle, bus, van, pickup, tractor, boat, person, animal)
 * @param speed - Current speed in km/h (or similar units)
 * @param course - Bearing/heading in degrees (0-360)
 * @returns HTML string for Leaflet divIcon
 */
export function getVehicleIconHtml(category: string, speed: number, course: number): string {
  // Get the SVG for this category, default to car if not found
  const svgTemplate = mapVehicleEmojis[category.toLowerCase()] || mapVehicleEmojis.car;

  // Determine color based on speed (green if moving, red if stationary)
  const color = speed > 2 ? '#10b981' : '#ef4444'; // green or red

  // Replace VW and VH placeholders with 32px (inner icon size)
  const svgWithSize = svgTemplate.replace(/VW/g, '32').replace(/VH/g, '32');

  // Side-view emoji icons don't rotate - course is tracked for continuity only
  const html = `<div style="position:relative;width:52px;height:52px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">
  <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
    <circle cx="26" cy="26" r="24" fill="${color}" stroke="white" stroke-width="2.5"/>
  </svg>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
    ${svgWithSize}
  </div>
</div>`;

  return html;
}

/**
 * Calculate bearing (course) in degrees from one coordinate to another
 * @param lat1 - Starting latitude
 * @param lng1 - Starting longitude
 * @param lat2 - Ending latitude
 * @param lng2 - Ending longitude
 * @returns Bearing in degrees (0-360)
 */
export function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Convert to radians
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  // Calculate bearing using the forward azimuth formula
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  let bearing = Math.atan2(y, x);

  // Convert from radians to degrees
  bearing = (bearing * 180) / Math.PI;

  // Normalize to 0-360 range
  bearing = (bearing + 360) % 360;

  return bearing;
}
