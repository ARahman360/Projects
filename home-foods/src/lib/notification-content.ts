export function orderNotification(status: string, kitchen: string) {
  const messages: Record<string,string> = {
    CONFIRMED: `${kitchen} accepted your order.`, PREPARING: `${kitchen} is preparing your food.`,
    READY_FOR_PICKUP: `Your food from ${kitchen} is ready for collection.`,
    PICKED_UP: `Your rider collected your order from ${kitchen}.`, IN_TRANSIT: "Your order is on its way.",
    DELIVERED: "Your order has been delivered. Enjoy your meal!", CANCELLED: `Your order from ${kitchen} was cancelled.`,
    DELAYED: "Your rider reported a delay. Open your order for details.", FAILED: "There is a delivery issue. Open your order for details.", REFUNDED: "A refund update is available for your order.",
  };
  return messages[status] ?? null;
}
