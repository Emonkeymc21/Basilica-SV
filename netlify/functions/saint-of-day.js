// netlify/functions/saint-of-day.js
// Extrae santo del día desde Vatican News en español
const axios = require("axios");
const cheerio = require("cheerio");

function clean(s=''){ return s.replace(/\s+/g,' ').trim(); }

// netlify/functions/saint-of-day.js
exports.handler = async () => {
  try {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    // URL Vatican News por fecha
    const url = `https://www.vaticannews.va/es/santos/${mm}/${dd}.html`;

    const resp = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BasilicaSV/1.0)"
      }
    });

    if (!resp.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          ok: false,
          error: `No se pudo obtener Vatican News (${resp.status})`,
          source: url
        })
      };
    }

    const html = await resp.text();

    // Helpers simples para extraer meta tags
    const getMeta = (propertyOrName) => {
      const r1 = new RegExp(
        `<meta[^>]+property=["']${propertyOrName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      );
      const r2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${propertyOrName}["'][^>]*>`,
        "i"
      );
      const r3 = new RegExp(
        `<meta[^>]+name=["']${propertyOrName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      );
      const r4 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${propertyOrName}["'][^>]*>`,
        "i"
      );
      return (
        html.match(r1)?.[1] ||
        html.match(r2)?.[1] ||
        html.match(r3)?.[1] ||
        html.match(r4)?.[1] ||
        null
      );
    };

    // Title (fallback al <title>)
    const ogTitle = getMeta("og:title");
    const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || null;
    const title = ogTitle || titleTag || "Santo del día";

    // Description
    const ogDesc = getMeta("og:description");
    const metaDesc = getMeta("description");
    const description = ogDesc || metaDesc || "Sin descripción disponible.";

    // Image
    const image = getMeta("og:image") || null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: true,
        source: url,
        title,
        description,
        image,
        link: url
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: false,
        error: err.message || "Error interno al obtener santo del día"
      })
    };
  }
};
