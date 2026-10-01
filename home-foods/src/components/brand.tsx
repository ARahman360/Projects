import Link from "next/link";
import Image from "next/image";

export default function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return <Link className={`homefoods-brand${compact ? " compact" : ""}`} href={href} aria-label="HomeFoods home">
    <span className="brand-symbol-art" aria-hidden="true"><Image src="/brand/homefoods-symbol.png" width={1254} height={1254} sizes="96px" alt=""/></span>
    <span className="brand-wordmark-art" aria-hidden="true"><Image src="/brand/homefoods-wordmark.png" width={1448} height={1086} sizes="240px" alt=""/></span>
  </Link>;
}
