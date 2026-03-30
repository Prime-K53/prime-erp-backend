function openInvoicePreview() { 
  const fallbackGetUrl = (path) => {
    const baseUrl = String(window.BASE_URL || '').trim().replace(/\/+$/, '');
    const cleanedPath = String(path || '').trim().replace(/^\/+/, '');
    if (!baseUrl) return cleanedPath ? `/${cleanedPath}` : '';
    if (baseUrl.endsWith('/api') && cleanedPath.startsWith('api/')) {
      return `${baseUrl}/${cleanedPath.slice(4)}`;
    }
    return cleanedPath ? `${baseUrl}/${cleanedPath}` : baseUrl;
  };
  const previewUrl = (window.getApiUrl || fallbackGetUrl)('invoice/preview');
  fetch(previewUrl) 
    .then(r => r.text()) 
    .then(html => { 
      const iframe = document.getElementById("invoiceFrame"); 
      if (iframe) {
        iframe.srcdoc = html; 
        const modal = document.getElementById("modal");
        if (modal) modal.style.display = "flex"; 
      }
    }); 
} 
function closeInvoice() { 
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none"; 
} 
