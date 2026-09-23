import CollectionPage from "@/src/components/collection-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CollectionPage slug={slug} />;
}
