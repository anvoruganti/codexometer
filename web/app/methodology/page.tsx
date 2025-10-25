export default function MethodologyPage() {
  return (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl p-6">
      <h1>Methodology & Transparency</h1>
      <p>
        This page will explain the data flow from Reddit to Supabase, detail the
        VADER-based sentiment model, outline retention policies, and call out
        known limitations as required by the product specification.
      </p>
      <p>
        Additional sections will document sampling sizes, refresh cadence,
        scoring thresholds, and links back to the PRD for accountability.
      </p>
    </div>
  );
}
