// Netlify Function: santo del día (simple)
// Fuente principal: Vatican News (puede cambiar el HTML, por eso hay fallback).
// Devuelve: { title, url, source }

function pickFirstMatch(text, patterns){
  for(const p of patterns){
    const m = text.match(p);
    if(m && m[1]) return m[1].trim();
  }
  return null;
}

exports.handler = async function(event, context){
  try{
    const target = "https://www.vaticannews.va/es/santos.html";
    const res = await fetch(target, {
      headers: {
        "user-agent": "SanVicenteWebApp/1.0 (+https://example.invalid)"
      }
    });
    const html = await res.text();

    // Intentamos detectar el primer título de santo (HTML puede variar).
    // Ojo: esto es heurístico.
    const title = pickFirstMatch(html, [
      /<h3[^>]*class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i,
      /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/i,
      /<h3[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/h3>/i
    ]);

    // Detectamos el primer link (relativo) dentro del bloque de santos
    const rel = pickFirstMatch(html, [
      /<h3[^>]*class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"/i,
      /<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]+)"/i,
      /<h3[^>]*>\s*<a[^>]*href="([^"]+)"/i
    ]);

    const url = rel
      ? (rel.startsWith("http") ? rel : ("https://www.vaticannews.va" + rel))
      : target;

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=900" // 15 min
      },
      body: JSON.stringify({
        title: title || "Santo del día",
        url,
        source: "Vatican News"
      })
    };
  }catch(err){
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        title: "Santo del día",
        url: "https://www.vaticannews.va/es.html",
        source: "fallback"
      })
    };
  }
};
