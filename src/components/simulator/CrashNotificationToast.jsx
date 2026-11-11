export function CrashNotificationToast({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <aside aria-label="Crash notifications" className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-sm flex-col gap-2">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 rounded border p-3 shadow-lg backdrop-blur transition-all ${
            notif.type === "crash"
              ? "border-danger/70 bg-surface/95 text-foreground shadow-danger/10"
              : "border-border bg-surface/95 text-foreground"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 select-none text-base">
              {notif.type === "crash" ? "💥" : "ℹ️"}
            </span>
            <div>
              <p className="text-xs font-bold text-danger">
                {notif.title ?? "Crash Fault Detected"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground">
                {notif.message}
              </p>
              {notif.details ? (
                <p className="mt-1 font-mono text-[10px] text-foreground-muted">
                  {notif.details}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(notif.id)}
            className="p-1 text-xs text-foreground-muted hover:text-foreground"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </aside>
  );
}

