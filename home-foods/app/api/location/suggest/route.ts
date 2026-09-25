import { ADDRESS_LOOKUP_UNAVAILABLE_MESSAGE, isLocationProviderError, suggestFinnishAddresses } from "@/src/lib/location";
import { signLocation } from "@/src/lib/address-policy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 3) return Response.json({ suggestions: [] });
  try {
    const suggestions = await suggestFinnishAddresses(query);
    return Response.json({ suggestions: suggestions.map(s => ({ ...s, verificationToken: signLocation(s.location) })) }, { headers: { "Cache-Control": "private, max-age=20" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address search is temporarily unavailable.";
    const status = message === ADDRESS_LOOKUP_UNAVAILABLE_MESSAGE || isLocationProviderError(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
