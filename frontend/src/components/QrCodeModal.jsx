import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, ExternalLink, Check } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function QrCodeModal({ urlItem, open, onOpenChange }) {
  const [copied, setCopied] = React.useState(false);

  if (!urlItem) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(urlItem.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const a = document.createElement('a');
        a.download = `qr-${urlItem.urlCode}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>QR Code</DialogTitle>
        <DialogDescription>
          Scan to quickly access this shortened destination.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <QRCodeSVG
            id="qr-code-svg"
            value={urlItem.shortUrl}
            size={180}
            level="H"
            includeMargin={false}
          />
        </div>

        <div className="mt-4 w-full text-center">
          <p className="font-mono text-sm font-medium text-foreground truncate max-w-xs mx-auto">
            {urlItem.shortUrl}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-xs mx-auto mt-0.5">
            Redirects to: {urlItem.longUrl}
          </p>
        </div>

        <div className="mt-6 flex w-full gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleCopyLink}
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Link
              </>
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleDownload}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download PNG
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
