import { iconControlClass } from "./simulator/controlStyles.js";

export function Navbar({ title, currentPage, onBack, backLabel = "Go back" }) {
  return (
    <header className="mb-6 border border-border-strong bg-surface text-foreground">
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 grow">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground-muted sm:text-xs">{title}</p>
          <h1 className="text-base font-bold leading-tight tracking-tight text-foreground sm:text-lg">{currentPage}</h1>
        </div>
        {onBack ? (
          <button
            type="button"
            className={`${iconControlClass} border-border-strong bg-surface text-foreground hover:bg-surface-muted hover:text-foreground`}
            onClick={onBack}
            aria-label={backLabel}
            title={backLabel}
          >
            ←
          </button>
        ) : null}
      </div>
    </header>
  );
}
