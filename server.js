const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (your starsearch.html)
app.use(express.static('public'));

// Proxy endpoint — fetches any URL and strips blocking headers
app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('No URL provided');

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            redirect: 'follow'
        });

        const contentType = response.headers.get('content-type') || 'text/html';
        let body = await response.text();

        // Rewrite links so they also go through the proxy
        const baseUrl = new URL(url);
        body = body
            // Rewrite absolute href/src links
            .replace(/(href|src)="(https?:\/\/[^"]+)"/g, (_, attr, link) =>
                `${attr}="/proxy?url=${encodeURIComponent(link)}"`)
            // Rewrite root-relative links
            .replace(/(href|src)="(\/[^"]+)"/g, (_, attr, link) =>
                `${attr}="/proxy?url=${encodeURIComponent(baseUrl.origin + link)}"`)
            // Inject base tag for relative assets
            .replace('<head>', `<head><base href="${url}">`);

        // Strip ALL the headers that block embedding
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.set({
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'ALLOWALL',
        });

        res.send(body);
    } catch (err) {
        res.status(500).send(`
            <div style="font-family:sans-serif;padding:40px;text-align:center;color:#888;background:#111;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <h2 style="color:#fff">Could not load page</h2>
                <p>${err.message}</p>
                <a href="${url}" target="_blank" style="color:#8ab4f8">Open directly ↗</a>
            </div>
        `);
    }
});

app.listen(PORT, () => console.log(`StarSearch proxy running on port ${PORT}`));
