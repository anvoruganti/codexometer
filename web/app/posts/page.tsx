export default function PostsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Post Explorer</h1>
        <p className="text-sm text-muted-foreground">
          The interactive table will list recent posts with sentiment scores,
          metadata, and quick access to top comments.
        </p>
      </div>
      <div className="h-96 rounded-md border border-dashed border-muted-foreground/40" />
    </div>
  );
}
