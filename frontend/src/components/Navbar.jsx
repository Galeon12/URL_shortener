import React from 'react';
import { Link2, Sun, Moon, ShieldCheck, Activity, AlertCircle, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Navbar({ health, tokens, theme, onToggleTheme, onRefreshData }) {
  const isHealthy = health?.status === 'online';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background font-semibold shadow-sm">
            <Link2 className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">
              Shorten
            </span>
            <span className="font-mono text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </div>
        </div>

        {/* Center / Right Telemetry */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Health indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground bg-card">
            <span
              className={`h-2 w-2 rounded-full ${
                isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-foreground">
              {isHealthy ? 'API Online' : 'Connecting...'}
            </span>
            {health?.database && (
              <span className="text-[11px] text-muted-foreground ml-1 hidden md:inline">
                ({health.database})
              </span>
            )}
          </div>

          {/* Public domain indicator */}
          {health?.baseUrl && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground bg-card">
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-mono text-foreground text-[11px] truncate max-w-[190px]">
                {health.baseUrl.replace(/^https?:\/\//, '')}
              </span>
            </div>
          )}

          {/* Tokens status badge */}
          {tokens && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground bg-card">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden md:inline">Tokens:</span>
              <span className="font-mono font-medium text-foreground">
                {tokens.tokens ?? 10}/{tokens.capacity ?? 10}
              </span>
            </div>
          )}

          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
