import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Laptop,
  Smartphone,
  Bot,
  Globe,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { formatTimestamp } from '@/lib/utils';

export function AnalyticsModal({ urlItem, open, onOpenChange }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !urlItem?.urlCode) {
      setStats(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getUrlStats(urlItem.urlCode)
      .then((data) => {
        if (isMounted) setStats(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load link statistics');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, urlItem?.urlCode]);

  if (!urlItem) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(urlItem.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Aggregate device breakdown from clickLog
  const clickLog = stats?.clickLog || [];
  const deviceCounts = clickLog.reduce(
    (acc, c) => {
      const type = c.deviceType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    { desktop: 0, mobile: 0, bot: 0, unknown: 0 }
  );

  const isExpired = stats?.expiresAt && new Date(stats.expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/10 text-foreground">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle>Link Analytics</DialogTitle>
            <DialogDescription>
              Asynchronous telemetry and click breakdown
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
        {/* Link summary */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-foreground truncate">
              {urlItem.shortUrl}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="iconSm"
                onClick={handleCopyLink}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Copy short link"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a
                href={urlItem.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                title="Open short link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground truncate" title={urlItem.longUrl}>
            → {urlItem.longUrl}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Fetching telemetry...</span>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : stats ? (
          <>
            {/* Metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                  Total Clicks
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
                  {stats.clicks ?? 0}
                </span>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                  Created
                </span>
                <span className="text-xs font-medium text-foreground mt-1.5 block">
                  {formatTimestamp(stats.date)}
                </span>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                  Status
                </span>
                <span className="mt-1 block">
                  {stats.expiresAt ? (
                    <Badge
                      variant={isExpired ? 'destructive' : 'outline'}
                      className="text-[10px] py-0"
                    >
                      {isExpired ? 'Expired' : 'Expires ' + formatTimestamp(stats.expiresAt)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 text-emerald-500 border-emerald-500/30">
                      Permanent
                    </Badge>
                  )}
                </span>
              </div>
            </div>

            {/* Device breakdown */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Device Classification
              </span>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="rounded border border-border/60 p-2 bg-muted/20">
                  <Laptop className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs font-semibold block">{deviceCounts.desktop}</span>
                  <span className="text-[10px] text-muted-foreground">Desktop</span>
                </div>
                <div className="rounded border border-border/60 p-2 bg-muted/20">
                  <Smartphone className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs font-semibold block">{deviceCounts.mobile}</span>
                  <span className="text-[10px] text-muted-foreground">Mobile</span>
                </div>
                <div className="rounded border border-border/60 p-2 bg-muted/20">
                  <Bot className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs font-semibold block">{deviceCounts.bot}</span>
                  <span className="text-[10px] text-muted-foreground">Bot / Other</span>
                </div>
              </div>
            </div>

            {/* Recent click stream */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Recent Click Stream
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Async log (max 100)
                </span>
              </span>

              {clickLog.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 text-center">
                  No clicks recorded yet. Click or share your link to see live tracking.
                </p>
              ) : (
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {clickLog.slice(-10).reverse().map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] py-1 border-b border-border/40 last:border-b-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] uppercase px-1 py-0 h-4">
                          {entry.deviceType || 'client'}
                        </Badge>
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          {entry.referrer ? new URL(entry.referrer).hostname : 'Direct'}
                        </span>
                      </div>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
