export default function ComparePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subreddit Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming view for side-by-side sentiment trend analysis and activity
          deltas across the tracked subreddits.
        </p>
      </div>
      <div className="h-96 rounded-md border border-dashed border-muted-foreground/40" />
    </div>
  );
}
