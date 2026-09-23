export default function Loading() {
  return <main className="loading-page" aria-busy="true" aria-live="polite"><span className="loading-spinner" aria-hidden="true"/><p>Setting the table…</p><div className="loading-skeleton"/><div className="loading-skeleton short"/></main>;
}
