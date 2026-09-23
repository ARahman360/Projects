import Brand from "@/src/components/brand";
import Link from "next/link";

export default function NotFound() {
  return <main id="main-content" tabIndex={-1} className="not-found-page"><Brand/><div className="not-found-content"><span className="eyebrow"><span className="eyebrow-line"/> A LITTLE OFF THE MENU</span><h1>We can’t find<br/><em>that page.</em></h1><p>This page may have moved, or the link might be a little stale. There are still lovely things waiting at HomeFoods.</p><Link className="dark-cta" href="/">Back to the menu <span>→</span></Link><Link className="not-found-help" href="/#faq">Need a hand? Visit our FAQs</Link></div><span className="not-found-number" aria-hidden="true">404</span></main>;
}
