import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground",
            "placeholder:text-muted/60",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
            error && "border-danger focus:border-danger focus:ring-danger",
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-muted">{hint}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  InputHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }
>(({ className, label, error, id, ...props }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          "min-h-[88px] w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground",
          "placeholder:text-muted/60 resize-y",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          error && "border-danger",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  InputHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }
>(({ className, label, error, id, children, ...props }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={cn(
          "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          error && "border-danger",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
Select.displayName = "Select";
