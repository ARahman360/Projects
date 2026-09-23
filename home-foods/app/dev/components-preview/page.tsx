import { notFound } from "next/navigation";
import UiPreview from "@/src/components/ui/ui-preview";

export default function ComponentsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UiPreview/>;
}
