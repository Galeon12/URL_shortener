import React, { useState } from 'react';
import {
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  SlidersHorizontal,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function HeroShortenForm({ onShortenSuccess, onOpenQr, baseUrl }) {
  const [longUrl, setLongUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdUrl, setCreatedUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!longUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let targetUrl = longUrl.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      const res = await fetch('/api/url/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          longUrl: targetUrl,
          customCode: showCustom && customCode.trim() ? customCode.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to shorten URL');
      }

      setCreatedUrl(data);
      setLongUrl('');
      setCustomCode('');
      setShowCustom(false);
      onShortenSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdUrl?.shortUrl) return;
    navigator.clipboard.writeText(createdUrl.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full">
      {/* Form Container */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <LinkIcon className="h-4 w-4" />
              </div>
              <Input
                type="text"
                placeholder="Paste your long link (e.g. github.com/user/project)..."
                value={longUrl}
                onChange={(e) => {
                  setLongUrl(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                className="pl-9 h-11 text-sm bg-background border-input focus-visible:ring-1"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !longUrl.trim()}
              className="h-11 px-5 font-medium shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Shortening...
                </>
              ) : (
                <>
                  Shorten URL
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Secondary Controls (Custom Alias Toggle) */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" />
              {showCustom ? 'Hide custom alias' : 'Add custom alias (optional)'}
            </button>

            <span className="text-muted-foreground hidden sm:inline">
              Press <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter ↵</kbd> to submit
            </span>
          </div>

          {/* Custom Alias Input */}
          {showCustom && (
            <div className="pt-2 animate-in fade-in-0 duration-150">
              <div className="flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm">
                <span className="text-muted-foreground font-mono text-xs select-none pr-1 truncate max-w-[200px]">
                  {baseUrl ? baseUrl.replace(/^https?:\/\//, '') + '/' : 'short.link/'}
                </span>
                <input
                  type="text"
                  placeholder="custom-slug"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                  disabled={loading}
                  maxLength={30}
                  className="w-full bg-transparent text-sm focus:outline-none font-mono placeholder:text-muted-foreground"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Letters, numbers, dashes, and underscores (2-30 characters).
              </p>
            </div>
          )}
        </form>

        {/* Error State Banner */}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-0"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium">Creation failed</p>
              <p className="text-muted-foreground mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Success Creation Result Card */}
      {createdUrl && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-[11px] font-mono">
                Ready
              </Badge>
              <span className="text-xs text-muted-foreground">
                Short link generated successfully
              </span>
            </div>
            <button
              onClick={() => setCreatedUrl(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
              aria-label="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={createdUrl.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm sm:text-base font-semibold text-foreground hover:underline flex items-center gap-1.5"
                >
                  {createdUrl.shortUrl}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-lg mt-0.5">
                {createdUrl.longUrl}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1 sm:flex-initial text-xs"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenQr?.(createdUrl)}
                className="flex-1 sm:flex-initial text-xs"
              >
                <QrCode className="mr-1.5 h-3.5 w-3.5" />
                QR Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
