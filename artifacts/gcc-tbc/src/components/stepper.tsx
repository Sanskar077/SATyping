import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
}

/** Progress dots + labels for a multi-step wizard. Built from tokens already in the design system. */
export function Stepper({ steps, current, className = "" }: StepperProps) {
  return (
    <ol className={`flex items-center w-full ${className}`}>
      {steps.map((label, i) => {
        const isComplete = i < current;
        const isCurrent = i === current;
        return (
          <li key={label} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  isComplete
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                }`}
              >
                {isComplete ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 -mt-5 rounded ${isComplete ? "bg-primary" : "bg-border"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
