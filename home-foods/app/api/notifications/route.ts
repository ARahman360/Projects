import { getSession, jsonError } from "@/src/lib/auth";
import { db } from "@/src/prisma/db";
import { orderNotification } from "@/src/lib/notification-content";

export const runtime = "nodejs";
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to see order updates.",401);
  if (session.role !== "CUSTOMER") return jsonError("Customer notifications only.",403);
  try {
    const orders = await db.orm.public.Order.where({customerId:session.userId})
      .select("id","orderNumber").include("shop",s=>s.select("name"))
      .orderBy(o=>o.createdAt.desc()).limit(50).all();
    const ids=orders.map(o=>o.id);
    const events=ids.length ? await db.orm.public.OrderStatusEvent.where(e=>e.orderId.in(ids)).orderBy(e=>e.createdAt.desc()).limit(100).all() : [];
    const notifications=events.flatMap(event=>{
      const order=orders.find(o=>o.id===event.orderId)!;
      const message=orderNotification(event.status,order.shop?.name??"Your kitchen");
      return message?[{id:event.id,orderId:order.id,orderNumber:order.orderNumber,status:event.status,message,createdAt:event.createdAt,href:`/orders#order-${order.id}`}]:[];
    }).slice(0,30);
    return Response.json({userId:session.userId,notifications},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return jsonError("Order updates are temporarily unavailable. Your orders are still saved.",503); }
}
