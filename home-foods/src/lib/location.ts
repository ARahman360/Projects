export type Coordinates = { latitude: number; longitude: number };
export type VerifiedLocation = Coordinates & {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
  accuracy?: number;
};
export type LocationResolution = VerifiedLocation & {
  deliverable: boolean;
  nearbyKitchens: number;
  nearestKitchenKm: number | null;
};

export const MAX_DELIVERY_DISTANCE_METERS = 20_000;
export const OUTSIDE_FINLAND_MESSAGE = "Sorry, Home Foods is not available in this country. We currently deliver only within Finland.";
export const NO_COVERAGE_MESSAGE = "Home Foods is not available at this address yet. Please try another location.";
export const ROUTING_UNAVAILABLE_MESSAGE = "We couldn't check delivery distance right now. Please try again in a moment.";
export const isWithinDeliveryRadius = (distanceMeters: number) => Number.isFinite(distanceMeters) && distanceMeters >= 0 && distanceMeters <= MAX_DELIVERY_DISTANCE_METERS;

type GeoapifyProperties = {
  formatted?: string; street?: string; housenumber?: string; postcode?: string; city?: string; suburb?: string;
  district?: string; county?: string; state?: string; country?: string; country_code?: string; place_id?: string;
  lat?: number; lon?: number; distance?: number;
};
type GeoapifyResult = GeoapifyProperties & { properties?: GeoapifyProperties; geometry?: { coordinates?: [number, number] } };
type GeoapifyResponse = { results?: GeoapifyResult[]; features?: GeoapifyResult[] };
type RouteMatrixResponse = { sources_to_targets?: Array<Array<{ distance: number | null }>> };

function apiKey() {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("Geoapify isn't configured. Set GEOAPIFY_API_KEY in the server environment and restart the app.");
  return key;
}

async function geoapifyRequest(path: string, parameters: URLSearchParams): Promise<GeoapifyResponse> {
  parameters.set("apiKey", apiKey());
  const response = await fetch(`https://api.geoapify.com${path}?${parameters}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Geoapify rejected the API key. Check that it is valid and that Geocoding and Routing APIs are enabled." : "The address service is temporarily unavailable. Please retry.");
  return await response.json() as GeoapifyResponse;
}

function fromGeoapify(result: GeoapifyResult): VerifiedLocation | null {
  // `format=json` returns flat result records; GeoJSON puts the same values
  // under `properties`. Accept both so labels and country checks are retained.
  const p = result.properties ?? result;
  const latitude = p.lat ?? result.lat;
  const longitude = p.lon ?? result.lon;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const street = p.street ?? "";
  const number = p.housenumber ?? "";
  return {
    formattedAddress: p.formatted ?? [street, number, p.postcode, p.city ?? p.suburb ?? p.district, p.country].filter(Boolean).join(", "),
    addressLine1: [street, number].filter(Boolean).join(" "),
    city: p.city ?? p.suburb ?? p.district ?? p.county ?? p.state ?? "",
    postalCode: p.postcode ?? "",
    countryCode: p.country_code?.toUpperCase() ?? (/^(finland|suomi)$/i.test(p.country ?? "") ? "FI" : ""),
    latitude,
    longitude,
  };
}

function validateFinnishAddress(result: VerifiedLocation | null): VerifiedLocation {
  if (!result) throw new Error("Geoapify did not return usable address details. Please choose a more specific address.");
  if (result.countryCode !== "FI") throw new Error(OUTSIDE_FINLAND_MESSAGE);
  if (!result.addressLine1 || !result.city) throw new Error("Please choose a Finnish street address with a street, building number and city.");
  return result;
}

export async function suggestFinnishAddresses(text: string) {
  if (text.trim().length < 3 || text.length > 160) return [];
  // Keep the hard country filter, and include the dedicated countrycodes
  // parameter so Geoapify gateways that prefer the newer parameter agree.
  const parameters = new URLSearchParams({ text: text.trim(), filter: "countrycode:fi", countrycodes: "fi", limit: "6", lang: "fi", format: "json" });
  const payload = await geoapifyRequest("/v1/geocode/autocomplete", parameters);
  const rows = payload.results ?? payload.features ?? [];
  const parseRows = (items: GeoapifyResult[]) => items.map((row) => {
    const parsed = fromGeoapify(row);
    // GeoJSON feature coordinates are [longitude, latitude].
    if (parsed || !row.geometry?.coordinates) return parsed;
    const [longitude, latitude] = row.geometry.coordinates;
    return fromGeoapify({ ...row, properties: { ...row.properties, lon: longitude, lat: latitude } });
  }).filter((row): row is VerifiedLocation => row !== null)
    // The request uses Geoapify's hard Finland filter. Some provider records
    // omit country metadata; in that case the hard-filtered result is Finnish,
    // and the selection is still verified again before it is accepted.
    .map((location) => ({ ...location, countryCode: location.countryCode || "FI" }))
    .filter((location) => location.countryCode === "FI")
    .map((location) => ({ text: location.formattedAddress, location }));
  const suggestions = parseRows(rows);
  if (suggestions.length) return suggestions;

  // Address Autocomplete can return no rows for partial house-number queries.
  // Try Finland-filtered forward geocoding as a fallback before saying no match.
  const fallback = await geoapifyRequest("/v1/geocode/search", new URLSearchParams({ text: text.trim(), filter: "countrycode:fi", countrycodes: "fi", limit: "6", lang: "fi", format: "json" }));
  return parseRows(fallback.results ?? fallback.features ?? []);
}

export async function verifyAddressText(address: string) {
  if (address.trim().length < 5 || address.trim().length > 250) throw new Error("Enter a complete delivery address.");
  // Do not country-filter verification: we need the provider's actual country to reject foreign matches.
  const payload = await geoapifyRequest("/v1/geocode/search", new URLSearchParams({ text: address.trim(), limit: "1", lang: "fi", format: "json" }));
  return validateFinnishAddress(fromGeoapify(payload.results?.[0] ?? {}));
}

export async function verifyCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("The location coordinates are invalid. Please try again.");
  }
  const payload = await geoapifyRequest("/v1/geocode/reverse", new URLSearchParams({ lat: String(latitude), lon: String(longitude), lang: "fi", format: "json" }));
  return validateFinnishAddress(fromGeoapify(payload.results?.[0] ?? {}));
}

export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const h = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const routeDistanceCache = new Map<string, { meters: number; expiresAt: number }>();
const ROUTE_CACHE_MS = 6 * 60 * 60 * 1000;
// Preserve the exact verified coordinates in cache keys. Rounding could reuse
// a route on the wrong side of the 20 km boundary for nearby points.
const coordinateKey = (point: Coordinates) => `${point.latitude},${point.longitude}`;

export async function getDrivingDistanceMeters(origin: Coordinates, destination: Coordinates): Promise<number> {
  const key = `${coordinateKey(origin)}|${coordinateKey(destination)}`;
  const cached = routeDistanceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.meters;
  try {
    const payload = await geoapifyRequest("/v1/routing", new URLSearchParams({ waypoints: `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`, mode: "drive", units: "metric", format: "json" }));
    const meters = payload.results?.[0]?.distance;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) throw new Error(ROUTING_UNAVAILABLE_MESSAGE);
    if (routeDistanceCache.size >= 5000) routeDistanceCache.delete(routeDistanceCache.keys().next().value!);
    routeDistanceCache.set(key, { meters, expiresAt: Date.now() + ROUTE_CACHE_MS });
    return meters;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Geoapify isn't configured")) throw error;
    throw new Error(ROUTING_UNAVAILABLE_MESSAGE);
  }
}

export async function getKitchenDeliveryDistances(customer: Coordinates, kitchens: Coordinates[]): Promise<Array<number | null>> {
  if (!kitchens.length) return [];
  const distances: Array<number | null> = Array(kitchens.length).fill(null);
  const missing: Array<{ index: number; point: Coordinates }> = [];
  kitchens.forEach((point, index) => {
    const cached = routeDistanceCache.get(`${coordinateKey(point)}|${coordinateKey(customer)}`);
    if (cached && cached.expiresAt > Date.now()) distances[index] = cached.meters;
    else missing.push({ index, point });
  });
  if (!missing.length) return distances;
  try {
    const key = apiKey();
    const parameters = new URLSearchParams({ apiKey: key });
    // Geoapify allows up to 1,000 source/target cells per matrix request.
    for (let offset = 0; offset < missing.length; offset += 1000) {
      const batch = missing.slice(offset, offset + 1000);
      const response = await fetch(`https://api.geoapify.com/v1/routematrix?${parameters}`, {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ mode: "drive", units: "metric", sources: batch.map(({ point }) => ({ location: [point.longitude, point.latitude] })), targets: [{ location: [customer.longitude, customer.latitude] }] }),
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Geoapify rejected the API key. Check that Geocoding and Route Matrix APIs are enabled." : ROUTING_UNAVAILABLE_MESSAGE);
      const payload = await response.json() as RouteMatrixResponse;
      const matrix = payload.sources_to_targets;
      if (!matrix || matrix.length !== batch.length) throw new Error(ROUTING_UNAVAILABLE_MESSAGE);
      for (let row = 0; row < batch.length; row++) {
        const meters = matrix[row]?.[0]?.distance;
        if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) continue;
        const { index, point } = batch[row];
        distances[index] = meters;
        if (routeDistanceCache.size >= 5000) routeDistanceCache.delete(routeDistanceCache.keys().next().value!);
        routeDistanceCache.set(`${coordinateKey(point)}|${coordinateKey(customer)}`, { meters, expiresAt: Date.now() + ROUTE_CACHE_MS });
      }
    }
    return distances;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Geoapify isn't configured")) throw error;
    if (error instanceof Error && error.message.includes("Geoapify rejected")) throw error;
    throw new Error(ROUTING_UNAVAILABLE_MESSAGE);
  }
}

export async function getKitchenDeliveryDistance(origin: Coordinates, kitchen: Coordinates) {
  const distanceMeters = await getDrivingDistanceMeters(kitchen, origin);
  return { distanceMeters, distanceKm: distanceMeters / 1000, eligible: isWithinDeliveryRadius(distanceMeters) };
}

export async function checkDeliveryCoverage(location: VerifiedLocation): Promise<Omit<LocationResolution, keyof VerifiedLocation>> {
  const { db } = await import("@/src/prisma/db");
  const { isDeliveryRadiusEnforced, isNationwideDevelopmentSeller, isNationwideDevelopmentMode } = await import("@/src/lib/feature-flags");
  const kitchens = await db.orm.public.Shop.where({ status: "ACTIVE" }).select("id", "latitude", "longitude").include("seller", (seller) => seller.select("name", "email")).all();
  const discoverableKitchens = isNationwideDevelopmentMode() ? kitchens.filter((shop) => isNationwideDevelopmentSeller(shop.seller)) : kitchens;
  if (!isDeliveryRadiusEnforced()) return { deliverable: discoverableKitchens.length > 0, nearbyKitchens: discoverableKitchens.length, nearestKitchenKm: null };
  const withCoordinates = kitchens.filter((kitchen) => typeof kitchen.latitude === "number" && typeof kitchen.longitude === "number");
  if (!withCoordinates.length) return { deliverable: false, nearbyKitchens: 0, nearestKitchenKm: null };
  const distances = await getKitchenDeliveryDistances(location, withCoordinates.map((kitchen) => ({ latitude: kitchen.latitude!, longitude: kitchen.longitude! })));
  const available = distances.filter((distance): distance is number => distance !== null).map((distanceMeters) => ({ distanceMeters, distanceKm: distanceMeters / 1000, eligible: isWithinDeliveryRadius(distanceMeters) }));
  const eligible = available.filter((result) => result.eligible);
  if (!eligible.length && distances.some((distance) => distance === null)) throw new Error(ROUTING_UNAVAILABLE_MESSAGE);
  return { deliverable: eligible.length > 0, nearbyKitchens: eligible.length, nearestKitchenKm: available.length ? Math.min(...available.map((result) => result.distanceKm)) : null };
}

export async function resolveLocation(location: VerifiedLocation): Promise<LocationResolution> {
  const coverage = await checkDeliveryCoverage(location);
  return { ...location, ...coverage };
}

export function getLocationConfiguration() {
  return { geoapifyConfigured: Boolean(process.env.GEOAPIFY_API_KEY?.trim()), maximumDeliveryDistanceKm: MAX_DELIVERY_DISTANCE_METERS / 1000, mapTiles: "OpenStreetMap" };
}
