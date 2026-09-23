import SpotlightCard, { type GlowColor } from "@/src/components/ui/spotlight-card";

export default function WorkspaceMetrics({ items }: { items: Array<{ label: string; value: string | number; color?: GlowColor }> }) {
  return <div className="workspace-stats spotlight-metric-grid">{items.map((item) => <SpotlightCard key={item.label} className="spotlight-kpi" size="small" glowColor={item.color ?? "green"}><span>{item.label}</span><b>{item.value}</b></SpotlightCard>)}</div>;
}
