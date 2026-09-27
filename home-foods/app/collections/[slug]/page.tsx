import {redirect} from "next/navigation";
import {kitchenCollections} from "@/src/lib/kitchen-discovery";
import CollectionPage from "@/src/components/collection-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if(slug in kitchenCollections)redirect(`/kitchens?collection=${encodeURIComponent(slug)}`);
  return <CollectionPage slug={slug} />;
}
