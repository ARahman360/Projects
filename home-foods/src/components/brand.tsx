import Link from "next/link";

export default function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return <Link className={`homefoods-brand${compact ? " compact" : ""}`} href={href} aria-label="HomeFoods home">
    <svg className="homefoods-mark" viewBox="0 0 44 44" role="img" aria-hidden="true">
      <rect width="44" height="44" rx="14" fill="currentColor" />
      <path d="M13 17c1.4-2.1 3.2-3.2 5.4-3.2 1.7 0 2.5.9 3.6 2.7 1.1-1.8 1.9-2.7 3.6-2.7 2.2 0 4 1.1 5.4 3.2" fill="none" stroke="#e78a61" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11.5 23.2h21l-2 8.7a2.5 2.5 0 0 1-2.4 1.9H15.9a2.5 2.5 0 0 1-2.4-1.9l-2-8.7Z" fill="none" stroke="#fffaf0" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M15.4 27.2h13.2" stroke="#e78a61" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
    <span className="homefoods-wordmark"><span>Home</span><b>Foods</b></span>
  </Link>;
}
