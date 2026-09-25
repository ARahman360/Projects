export const terminalOrders = new Set(["DELIVERED", "CANCELLED", "REFUNDED"]);
export function acceptsNewOrders(shop: { status: string; isOnline: boolean }, accountStatus = "ACTIVE") {
  return shop.status === "ACTIVE" && shop.isOnline && accountStatus === "ACTIVE";
}
export function kitchenState(shop: { status: string; isOnline: boolean }) {
  if (shop.status === "ACTIVE") return shop.isOnline ? "Online" : "Offline";
  return ({ PENDING: "Pending approval", SUSPENDED: "Suspended", CLOSED: "Rejected / closed" } as Record<string, string>)[shop.status] ?? shop.status;
}
export function pickupTransition(current: string, requested: string) {
  if (requested === "PICKED_UP" || requested === "IN_TRANSIT") {
    if (current === "IN_TRANSIT" || current === "DELIVERED") return "ALREADY_APPLIED";
    if (current === "ACCEPTED" || current === "PICKED_UP") return "IN_TRANSIT";
  }
  if (requested === "DELIVERED") {
    if (current === "DELIVERED") return "ALREADY_APPLIED";
    if (current === "IN_TRANSIT") return "DELIVERED";
  }
  return null;
}
export function reasonError(reason: unknown) {
  return typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 500
    ? "Please give a reason between 5 and 500 characters." : null;
}
