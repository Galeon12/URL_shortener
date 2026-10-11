const API_BASE = import.meta.env.VITE_API_URL || '';

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = 'An unexpected error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      errorMessage = `Server returned ${response.status}: ${response.statusText}`;
    }
    const err = new Error(errorMessage);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export const api = {
  async getHealth() {
    return handleResponse(await fetch(`${API_BASE}/api/health`));
  },

  async getTokenStatus() {
    return handleResponse(await fetch(`${API_BASE}/api/url/tokens`));
  },

  async getRecentUrls() {
    return handleResponse(await fetch(`${API_BASE}/api/url/recent`));
  },

  async getUrlStats(code) {
    return handleResponse(await fetch(`${API_BASE}/api/url/stats/${encodeURIComponent(code)}`));
  },

  async shortenUrl({ longUrl, customCode, expiresIn }) {
    return handleResponse(
      await fetch(`${API_BASE}/api/url/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          longUrl,
          customCode: customCode?.trim() || undefined,
          expiresIn: expiresIn ? parseInt(expiresIn, 10) : undefined,
        }),
      })
    );
  },

  async deleteUrl(code) {
    return handleResponse(
      await fetch(`${API_BASE}/api/url/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      })
    );
  },
};
