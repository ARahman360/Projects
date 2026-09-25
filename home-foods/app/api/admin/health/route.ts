import { getSession, jsonError } from "@/src/lib/auth";
import { db } from "@/src/prisma/db";
import { verifyAddressText, getDrivingDistanceMeters } from "@/src/lib/location";
import { isDeliveryRadiusEnforced } from "@/src/lib/feature-flags";

export const runtime="nodejs";
type Probe={status:"ready"|"error"|"missing";message:string;checkedAt:string};
let cached:{until:number;value:Promise<Probe>}|undefined;
function probe() {
  if(cached && cached.until>Date.now())return cached.value;
  const value=(async():Promise<Probe>=>{
    const checkedAt=new Date().toISOString();
    if(!process.env.GEOAPIFY_API_KEY?.trim())return {status:"missing",message:"Configure GEOAPIFY_API_KEY on the server and restart it.",checkedAt};
    try {
      const from=await verifyAddressText("Mannerheimintie 9, 00100 Helsinki, Finland");
      const to=await verifyAddressText("Kaivokatu 1, Helsinki, Finland");
      await getDrivingDistanceMeters(from,to);
      return {status:"ready",message:"Finnish address lookup and driving routes responded successfully.",checkedAt};
    } catch(error) {return {status:"error",message:error instanceof Error?error.message:"Provider check failed. Retry shortly.",checkedAt};}
  })();
  cached={until:Date.now()+120000,value};return value;
}
export async function GET() {
  const session=await getSession();
  if(!session)return jsonError("Sign in to inspect service health.",401);
  if(session.role!=="ADMIN")return jsonError("Administrator access is required.",403);
  try {
    const [provider,shops]=await Promise.all([probe(),db.orm.public.Shop.select("id","name","status","address","city","latitude","longitude").all()]);
    return Response.json({provider,radiusEnforced:isDeliveryRadiusEnforced(),kitchens:shops.map(shop=>({id:shop.id,name:shop.name,status:shop.status,address:shop.address,city:shop.city,locationStatus:shop.address?.startsWith("[SANDBOX LOCATION]")?"example":!shop.address||!shop.city||shop.latitude==null||shop.longitude==null?"missing":"stored"}))},{headers:{"Cache-Control":"private, no-store"}});
  } catch {return jsonError("Health information could not be loaded. Check the database connection.",503);}
}
