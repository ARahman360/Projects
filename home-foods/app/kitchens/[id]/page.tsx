import KitchenPage from "@/src/components/kitchen-page";

export default async function KitchenRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KitchenPage id={id} />;
}
