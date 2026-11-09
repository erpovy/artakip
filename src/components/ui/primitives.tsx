import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default:
        "bg-gradient-to-b from-primary to-blue-600 text-primary-foreground shadow-md shadow-primary/20 hover:brightness-110 active:scale-[0.99] border border-primary/40",
      destructive:
        "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/20 hover:brightness-110 active:scale-[0.99] border border-rose-500/40",
      outline:
        "border border-border/80 bg-card/60 backdrop-blur-sm hover:bg-accent/70 hover:text-accent-foreground hover:border-primary/40 shadow-sm",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50",
      ghost: "hover:bg-accent/70 hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      default: "h-10 px-4 py-2 rounded-xl",
      sm: "h-9 rounded-lg px-3.5 text-xs",
      lg: "h-12 rounded-xl px-7 text-sm font-semibold",
      icon: "h-9 w-9 rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-background/80 backdrop-blur-sm px-3.5 py-2 text-sm ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-border/75 bg-card/85 backdrop-blur-md text-card-foreground shadow-sm transition-all duration-200",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "danger" | "warning" | "outline";
}) {
  const styles = {
    default: "bg-primary/15 text-primary border-primary/30",
    success:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    warning:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    outline: "text-foreground border-border bg-background/50",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-colors",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

/**
 * Canlı nabız (pulse) nokta göstergesi
 */
export function StatusPulse({
  status,
  paused = false,
  size = "md",
}: {
  status: "UP" | "DOWN" | "UNKNOWN" | string;
  paused?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";

  if (paused) {
    return (
      <span className="relative inline-flex items-center justify-center">
        <span className={cn("rounded-full bg-slate-400 dark:bg-slate-500", dim)} />
      </span>
    );
  }

  if (status === "UP") {
    return (
      <span className="relative inline-flex items-center justify-center">
        <span
          className={cn(
            "animate-ping absolute inline-flex rounded-full bg-emerald-400 opacity-75",
            dim
          )}
        />
        <span className={cn("relative inline-flex rounded-full bg-emerald-500", dim)} />
      </span>
    );
  }

  if (status === "DOWN") {
    return (
      <span className="relative inline-flex items-center justify-center">
        <span
          className={cn(
            "animate-ping absolute inline-flex rounded-full bg-rose-400 opacity-75",
            dim
          )}
        />
        <span className={cn("relative inline-flex rounded-full bg-rose-500", dim)} />
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={cn("relative inline-flex rounded-full bg-amber-500", dim)} />
    </span>
  );
}

/**
 * Görsel Uptime Heartbeat Çubuğu (Better Stack / GitHub Status tarzı)
 */
export function UptimeHeartbeatBar({
  status,
  uptimePercent = 100,
  paused = false,
  bars = 24,
}: {
  status: "UP" | "DOWN" | "UNKNOWN" | string;
  uptimePercent?: number;
  paused?: boolean;
  bars?: number;
}) {
  return (
    <div className="flex items-center gap-[3px]" title={`30 Günlük Uptime: %${uptimePercent}`}>
      {Array.from({ length: bars }).map((_, idx) => {
        const isLast = idx === bars - 1;
        let color = "bg-emerald-500/85 hover:bg-emerald-400";
        if (paused) {
          color = "bg-slate-400/40 dark:bg-slate-600/50";
        } else if (isLast && status === "DOWN") {
          color = "bg-rose-500 animate-pulse";
        } else if (status === "UNKNOWN") {
          color = "bg-amber-500/40";
        } else if (uptimePercent < 99.5 && idx === Math.floor(bars * 0.6)) {
          color = "bg-rose-500/80";
        } else if (uptimePercent < 95 && idx % 6 === 0) {
          color = "bg-rose-500/80";
        }
        return (
          <span
            key={idx}
            className={cn(
              "h-4 w-1 rounded-full transition-transform hover:scale-y-125",
              color
            )}
          />
        );
      })}
    </div>
  );
}
