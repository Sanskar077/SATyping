/**
 * Feature 4: Real-Time WPM Graph During Typing
 * Shows a live mini line chart of WPM over time while the user types.
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

export interface WpmSnapshot {
  time: number;   // seconds elapsed
  wpm: number;
  accuracy: number;
  errors: number;
}

interface WpmLiveChartProps {
  snapshots: WpmSnapshot[];
  targetWpm?: number;
  className?: string;
}

export function WpmLiveChart({ snapshots, targetWpm, className = "" }: WpmLiveChartProps) {
  if (snapshots.length < 2) {
    return (
      <div className={`flex items-center justify-center h-24 text-muted-foreground text-sm ${className}`}>
        WPM graph will appear after 5 seconds…
      </div>
    );
  }

  const maxWpm = Math.max(...snapshots.map(s => s.wpm), targetWpm ?? 0, 40);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={snapshots} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `${v}s`}
          />
          <YAxis
            domain={[0, Math.ceil(maxWpm / 10) * 10 + 10]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(val: number, key: string) => [
              key === "wpm" ? `${val} WPM` : `${val}%`,
              key === "wpm" ? "Net WPM" : "Accuracy",
            ]}
            labelFormatter={(l) => `${l}s`}
          />
          {targetWpm && (
            <ReferenceLine y={targetWpm} stroke="hsl(var(--primary))" strokeDasharray="4 2"
              label={{ value: `Target: ${targetWpm}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--primary))" }} />
          )}
          <Line
            type="monotone"
            dataKey="wpm"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={200}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            animationDuration={200}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-muted-foreground justify-center mt-1">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-primary inline-block" /> Net WPM
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-muted-foreground inline-block border-dashed border-t" /> Accuracy %
        </span>
      </div>
    </div>
  );
}
