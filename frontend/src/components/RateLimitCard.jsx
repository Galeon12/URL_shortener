import React from 'react';
import { Shield, Clock, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function RateLimitCard({ tokens }) {
  if (!tokens) return null;

  const current = tokens.tokens ?? 10;
  const capacity = tokens.capacity ?? 10;
  const percentage = Math.min(100, Math.max(0, (current / capacity) * 100));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Rate Limit Shield
            </CardTitle>
          </div>
          <span className="font-mono text-xs font-semibold text-foreground">
            {current} / {capacity}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all duration-300 ${
              percentage < 30
                ? 'bg-destructive'
                : percentage < 60
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>Refills +1 every {tokens.fillRate ? Math.round(1000 / tokens.fillRate) : 10}s</span>
          </div>
          <span>Token Bucket Algorithm</span>
        </div>
      </CardContent>
    </Card>
  );
}
