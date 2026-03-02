const SkeletonMessages = () => (
  <div className="space-y-4 px-4 py-4 animate-pulse">
    {/* Incoming message skeleton */}
    <div className="flex justify-start">
      <div className="max-w-[70%] space-y-2">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-12 w-52 rounded-xl bg-muted" />
      </div>
    </div>
    {/* Outgoing message skeleton */}
    <div className="flex justify-end">
      <div className="h-10 w-44 rounded-xl bg-muted" />
    </div>
    {/* Incoming */}
    <div className="flex justify-start">
      <div className="max-w-[70%] space-y-2">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-16 w-60 rounded-xl bg-muted" />
      </div>
    </div>
    {/* Outgoing */}
    <div className="flex justify-end">
      <div className="h-10 w-36 rounded-xl bg-muted" />
    </div>
    <div className="flex justify-start">
      <div className="h-8 w-48 rounded-xl bg-muted" />
    </div>
  </div>
);

export default SkeletonMessages;
