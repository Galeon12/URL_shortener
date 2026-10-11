import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroShortenForm } from '@/components/HeroShortenForm';
import { UrlList } from '@/components/UrlList';
import { RateLimitCard } from '@/components/RateLimitCard';
import { QrCodeModal } from '@/components/QrCodeModal';
import { AnalyticsModal } from '@/components/AnalyticsModal';
import { api } from '@/services/api';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [health, setHealth] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [urls, setUrls] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [urlsError, setUrlsError] = useState(null);
  const [selectedQrUrl, setSelectedQrUrl] = useState(null);
  const [selectedAnalyticsUrl, setSelectedAnalyticsUrl] = useState(null);

  // Sync theme with HTML class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch health and tokens
  const fetchTelemetry = useCallback(async () => {
    try {
      const [healthData, tokenData] = await Promise.allSettled([
        api.getHealth(),
        api.getTokenStatus(),
      ]);

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      } else {
        setHealth({ status: 'offline' });
      }

      if (tokenData.status === 'fulfilled') {
        setTokens(tokenData.value);
      }
    } catch {
      setHealth({ status: 'offline' });
    }
  }, []);

  // Fetch URLs
  const fetchUrls = useCallback(async () => {
    setLoadingUrls(true);
    setUrlsError(null);
    try {
      const data = await api.getRecentUrls();
      setUrls(Array.isArray(data) ? data : []);
    } catch (err) {
      setUrlsError(err.message || 'Unable to connect to service');
    } finally {
      setLoadingUrls(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    fetchUrls();

    // Subtle background refresh every 30s
    const interval = setInterval(() => {
      fetchTelemetry();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchTelemetry, fetchUrls]);

  // When a new URL is shortened
  const handleShortenSuccess = (newUrl) => {
    setUrls((prev) => {
      const filtered = prev.filter((item) => item.urlCode !== newUrl.urlCode);
      return [newUrl, ...filtered];
    });
    // refresh token status
    api.getTokenStatus().then(setTokens).catch(() => {});
  };

  // When a URL is deleted
  const handleDeleteUrl = async (code) => {
    await api.deleteUrl(code);
    setUrls((prev) => prev.filter((item) => item.urlCode !== code));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
      {/* Header */}
      <Navbar
        health={health}
        tokens={tokens}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefreshData={() => {
          fetchTelemetry();
          fetchUrls();
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="space-y-3 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Fast, resilient URL shortening.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Generate clean aliases, monitor click telemetry, and distribute QR codes. Built on a token-bucket rate limiter.
          </p>
        </div>

        {/* Shorten Form */}
        <HeroShortenForm
          baseUrl={health?.baseUrl}
          onShortenSuccess={handleShortenSuccess}
          onOpenQr={setSelectedQrUrl}
        />

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Recent Links (2 cols on desktop) */}
          <div className="md:col-span-2">
            <UrlList
              urls={urls}
              loading={loadingUrls}
              error={urlsError}
              onRefresh={fetchUrls}
              onDeleteUrl={handleDeleteUrl}
              onOpenQr={setSelectedQrUrl}
              onOpenAnalytics={setSelectedAnalyticsUrl}
            />
          </div>

          {/* Sidebar Telemetry & System Info */}
          <div className="space-y-4">
            <RateLimitCard tokens={tokens} />

            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Distributed Architecture
              </h4>
              <p className="leading-relaxed">
                Atomic token-bucket rate limiting, Redis cache-aside (24h TTL), and asynchronous post-redirect telemetry tracking.
              </p>
              <div className="pt-2 border-t border-border space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>API Status</span>
                  <span className="font-mono text-foreground font-medium">
                    {health?.status === 'online' ? 'Operational' : 'Connecting'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Database</span>
                  <span className="font-mono text-foreground font-medium">
                    {health?.database || 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Redis Cache</span>
                  <span className="font-mono text-foreground font-medium">
                    {health?.redis || 'Fallback Mode'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Shorten Service &copy; {new Date().getFullYear()}</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Distributed Cache</span>
            <span>&bull;</span>
            <span>Async Analytics</span>
            <span>&bull;</span>
            <span>Linear Aesthetic</span>
          </div>
        </div>
      </footer>

      {/* QR Code Modal */}
      <QrCodeModal
        urlItem={selectedQrUrl}
        open={Boolean(selectedQrUrl)}
        onOpenChange={(open) => {
          if (!open) setSelectedQrUrl(null);
        }}
      />

      {/* Analytics Modal */}
      <AnalyticsModal
        urlItem={selectedAnalyticsUrl}
        open={Boolean(selectedAnalyticsUrl)}
        onOpenChange={(open) => {
          if (!open) setSelectedAnalyticsUrl(null);
        }}
      />
    </div>
  );
}
