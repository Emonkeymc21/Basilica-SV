// netlify/functions/saint-of-day.js
// Extrae santo del día desde Vatican News en español
const axios = require("axios");
const cheerio = require("cheerio");

function clean(s=''){ return s.replace(/\s+/g,' ').trim(); }

exports.handler = async ()=>{
  const now = new Date();
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const dd = String(now.getDate()).padStart(2,'0');
  const url = `https://www.vaticannews.va/es/santos/${mm}/${dd}.html`;

  try{
    const {data:html}= await axios.get(url,{timeout:12000, headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'es-ES,es;q=0.9'}});
    const $=cheerio.load(html);

    // Título
    let title = clean($('h1').first().text()) || clean($('.section__head-title').first().text()) || '';
    if(!title) title = clean($('.article-title, .title').first().text());

    // Intentar título específico del santo
    const blocks=['.article-body','.article__content','.article-content','.section__content','main'];
    let saintTitle='';
    for(const b of blocks){
      const t=clean($(b).find('h2,h3,strong').first().text());
      if(t && t.length>6){ saintTitle=t; break;}
    }
    if(!saintTitle) saintTitle=title || `Santo del día (${dd}/${mm})`;

    // Descripción
    let description='';
    for(const b of blocks){
      const ps=$(b).find('p').map((i,el)=>clean($(el).text())).get().filter(Boolean);
      if(ps.length){ description=ps.slice(0,2).join(' '); break;}
    }

    // Imagen
    let image='';
    const imgSel=['meta[property="og:image"]','main img','.article img','.article-body img'];
    for(const s of imgSel){
      let src='';
      if(s.startsWith('meta')) src=$(s).attr('content')||'';
      else src=$(s).first().attr('src')||'';
      if(src){
        if(src.startsWith('//')) src='https:'+src;
        if(src.startsWith('/')) src='https://www.vaticannews.va'+src;
        image=src; break;
      }
    }

    return {statusCode:200, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=1800'}, body:JSON.stringify({ok:true,title:saintTitle,description,image,url,source:'vaticannews'})};
  }catch(e){
    return {statusCode:200, headers:{'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify({ok:false,title:`Santo del día (${dd}/${mm})`,description:'No pudimos obtener el contenido ahora. Tocá Actualizar en unos segundos.',image:'',url,source:'vaticannews',error:e.message})};
  }
};
