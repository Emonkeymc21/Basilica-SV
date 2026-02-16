export async function handler(event, context) {
  try {
    // Use Argentina time (UTC-3)
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const pageUrl = `https://www.vaticannews.va/es/santos/${mm}/${dd}.html`;

    // Fetch HTML (server-side: no CORS issues)
    const res = await fetch(pageUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BasilicaSanVicenteBot/1.0; +https://example.com)"
      }
    });
    if (!res.ok) {
      throw new Error(`VaticanNews status ${res.status}`);
    }
    const html = await res.text();

    // Try to get OpenGraph image (usually present)
    const ogImgMatch = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const image = ogImgMatch ? ogImgMatch[1] : null;

    // First h2 usually contains the main saint name on that day page
    // e.g. <h2 ...>s. Hilario ...</h2>
    const h2Match = html.match(/<h2[^>]*>(.*?)<\/h2>/is);
    const rawTitle = h2Match ? h2Match[1] : "Santo del día";
    const title = rawTitle
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // "Leer todo..." link for the first saint (if present)
    const leerTodoMatch = html.match(/href=["']([^"']+)["'][^>]*>\s*Leer todo\.\.\.\s*<\/a>/i);
    let url = pageUrl;
    if (leerTodoMatch && leerTodoMatch[1]) {
      const href = leerTodoMatch[1].startsWith("http") ? leerTodoMatch[1] : `https://www.vaticannews.va${leerTodoMatch[1]}`;
      url = href;
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600"
      },
      body: JSON.stringify({ title, image, url, source: "vaticannews" })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        title: "Santo del día",
        image: null,
        url: "https://www.vaticannews.va/es/santos.html",
        source: "fallback"
      })
    };
  }
}
