import React, { useState } from 'react';
import {
  Copy,
  Check,
  QrCode,
  Trash2,
  ExternalLink,
  Search,
  MousePointerClick,
  Link2,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimestamp } from '@/lib/utils';

export function UrlList({
  urls,
  loading,
  error,
  onRefresh,
  onDeleteUrl,
  onOpenQr,
}) {
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [deletingCode, setDeletingCode] = useState(null);

  const handleCopy = (shortUrl, code) => {
    navigator.clipboard.writeText(shortUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Are you sure you want to delete the short link "/${code}"?`)) {
      return;
    }
    setDeletingCode(code);
    try {
      await onDeleteUrl(code);
    } finally {
      setDeletingCode(null);
    }
  };

  const filteredUrls = urls.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.urlCode?.toLowerCase().includes(q) ||
      item.longUrl?.toLowerCase().includes(q) ||
      item.shortUrl?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-4">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Recent Links
          </h2>
          <Badge variant="secondary" className="font-mono text-xs px-2 py-0">
            {urls.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by slug or URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh list"
            aria-label="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load links: {error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="text-xs border-destructive/30"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading State: Skeletons */}
      {loading && urls.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="space-y-2 w-full sm:w-2/3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && urls.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground mb-3">
            <Link2 className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No links yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Shorten your first link using the input above. All generated URLs will appear here with click metrics.
          </p>
        </div>
      )}

      {/* Filtered Empty State */}
      {!loading && urls.length > 0 && filteredUrls.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
          No links matched your search term "{search}".
        </div>
      )}

      {/* URL List */}
      <div className="space-y-2">
        {filteredUrls.map((item) => {
          const isCopied = copiedCode === item.urlCode;
          const isDeleting = deletingCode === item.urlCode;

          return (
            <div
              key={item._id || item.urlCode}
              className="group rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-muted-foreground/30 hover:bg-accent/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              {/* Left Details */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={item.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs sm:text-sm font-medium text-foreground tracking-tight hover:underline flex items-center gap-1"
                    title={item.shortUrl}
                  >
                    {item.shortUrl}
                  </a>

                  <Badge
                    variant="outline"
                    className="text-[11px] font-normal text-muted-foreground flex items-center gap-1 py-0 h-5"
                  >
                    <MousePointerClick className="h-3 w-3" />
                    <span>{item.clicks ?? 0} {item.clicks === 1 ? 'click' : 'clicks'}</span>
                  </Badge>

                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatTimestamp(item.date)}
                  </span>
                </div>

                {/* Long destination link */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate max-w-xs sm:max-w-md md:max-w-lg" title={item.longUrl}>
                    {item.longUrl}
                  </span>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                {/* Direct Link */}
                <a
                  href={item.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Test redirect"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Visit
                </a>

                {/* Copy Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy(item.shortUrl, item.urlCode)}
                  title="Copy short link"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy
                    </>
                  )}
                </Button>

                {/* QR Code Modal Trigger */}
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => onOpenQr?.(item)}
                  title="View QR Code"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <QrCode className="h-3.5 w-3.5" />
                </Button>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="iconSm"
                  disabled={isDeleting}
                  onClick={() => handleDelete(item.urlCode)}
                  title="Delete short link"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
