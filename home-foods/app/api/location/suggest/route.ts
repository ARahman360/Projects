import { suggestFinnishAddresses } from "@/src/lib/location";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 3) return Response.json({ suggestions: [] });
  try {
    const suggestions = await suggestFinnishAddresses(query);
    return Response.json({ suggestions }, { headers: { "Cache-Control": "private, max-age=20" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address search is temporarily unavailable.";
    const status = message.includes("isn't configured") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
