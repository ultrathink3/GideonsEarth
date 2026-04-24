/* GideonsEarth :: media-geoint.js  v2.0
   MEDIA-GEOINT - AI Visual Scene Geolocation
   Analyzes images/videos with AI (Gemini/GPT-4o/Claude)
   to identify location from scenery, landmarks, text, architecture */
(function(){
"use strict";
var _feed=function(k,m){return window.feed?window.feed(k,m):console.log("["+k+"] "+m);};
var _pin=function(p){return window.pinTarget?window.pinTarget(p):null;};
function _fly(lon,lat,alt){alt=alt||600000;var v=window.GideonsEarth&&window.GideonsEarth.viewer;if(!v)return;window.autoRotate=false;v.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(lon,lat,alt),duration:2.2});}
var GEOINT_PROMPT=[
    "You are an expert GEOINT analyst. Geolocate this image using ALL visible evidence.",
    "Scan for: 1.TEXT(signs,plates,graffiti,any language) 2.ARCHITECTURE(style,materials,roofs,facades) 3.VEGETATION(species,biome) 4.INFRASTRUCTURE(roads,signs,vehicles,power lines) 5.GEOGRAPHY(mountains,coast,terrain,climate) 6.CULTURAL(flags,clothing,food,markets) 7.SUN/SHADOWS(hemisphere,latitude) 8.SKY/CLIMATE(clouds,haze,seasons)",
    "Respond with ONLY valid JSON (no markdown):",
    '{"country":null,"region":null,"city":null,"lat":null,"lon":null,"confidence":"none","clues":[],"reasoning":""}'
].join("\n");



// EXIF parsing utilities
var TYPE_SZ=[0,1,1,2,4,8,1,1,2,4,8,4,8];
function rdASC(dv,o,n){var s="";for(var i=0;i<n&&o+i<dv.byteLength;i++){var c=dv.getUint8(o+i);if(!c)break;s+=String.fromCharCode(c);}return s.trim()||null;}
function rdRat(dv,o,le){var n=dv.getUint32(o,le),d=dv.getUint32(o+4,le);return d?n/d:0;}
function vO(dv,e,base,le,t,n){var sz=(TYPE_SZ[t]||1)*n;return sz<=4?e+8:base+dv.getUint32(e+8,le);}
function parseGpsIfd(dv,pos,base,le){
    if(pos+2>dv.byteLength)return null;
    var cnt=dv.getUint16(pos,le),refs={},raws={};
    for(var i=0;i<cnt;i++){
        var e=pos+2+i*12;if(e+12>dv.byteLength)break;
        var tag=dv.getUint16(e,le),t=dv.getUint16(e+2,le),n=dv.getUint32(e+4,le),o=vO(dv,e,base,le,t,n);
        if(tag===0x0001)refs.latRef=rdASC(dv,o,n);
        else if(tag===0x0003)refs.lonRef=rdASC(dv,o,n);
        else if(tag===0x0005)refs.altRef=dv.getUint8(o);
        else if(tag===0x0002)raws.lat=[rdRat(dv,o,le),rdRat(dv,o+8,le),rdRat(dv,o+16,le)];
        else if(tag===0x0004)raws.lon=[rdRat(dv,o,le),rdRat(dv,o+8,le),rdRat(dv,o+16,le)];
        else if(tag===0x0006)raws.alt=rdRat(dv,o,le);
        else if(tag===0x0007)raws.time=[rdRat(dv,o,le),rdRat(dv,o+8,le),rdRat(dv,o+16,le)];
        else if(tag===0x001D)raws.date=rdASC(dv,o,n);
    }
    if(!raws.lat||!raws.lon)return null;
    var ld=raws.lat[0]+raws.lat[1]/60+raws.lat[2]/3600;
    var lo=raws.lon[0]+raws.lon[1]/60+raws.lon[2]/3600;
    var g={lat:refs.latRef==="S"?-ld:ld,lon:refs.lonRef==="W"?-lo:lo,
        alt:raws.alt!=null?(refs.altRef===1?-raws.alt:raws.alt):null,ts:null};
    if(raws.date&&raws.time){
        var dp=raws.date.split(":");
        var hh=String(Math.floor(raws.time[0])).padStart(2,"0");
        var mm=String(Math.floor(raws.time[1])).padStart(2,"0");
        var ss=String(Math.floor(raws.time[2])).padStart(2,"0");
        try{g.ts=new Date(dp[0]+"-"+dp[1]+"-"+dp[2]+"T"+hh+":"+mm+":"+ss+"Z");}catch(ex){}
    }
    return g;
}
function parseExifSub(dv,pos,base,le,out){
    if(pos+2>dv.byteLength)return;
    var c=dv.getUint16(pos,le);
    for(var i=0;i<c;i++){
        var e=pos+2+i*12;if(e+12>dv.byteLength)break;
        var tag=dv.getUint16(e,le),t=dv.getUint16(e+2,le),n=dv.getUint32(e+4,le),o=vO(dv,e,base,le,t,n);
        if(tag===0x9003)out.dateTimeOriginal=rdASC(dv,o,n);
        else if(tag===0x829D)out.fNumber="f/"+rdRat(dv,o,le).toFixed(1);
        else if(tag===0x8827)out.iso=t===3?dv.getUint16(o,le):dv.getUint32(o,le);
        else if(tag===0x920A)out.focalLength=rdRat(dv,o,le).toFixed(1)+" mm";
        else if(tag===0xA002)out.imageWidth=t===3?dv.getUint16(o,le):dv.getUint32(o,le);
        else if(tag===0xA003)out.imageHeight=t===3?dv.getUint16(o,le):dv.getUint32(o,le);
    }
}
function parseJpegExif(buf){
    var dv=new DataView(buf),u8=new Uint8Array(buf);
    if(dv.getUint16(0,false)!==0xFFD8)return null;
    var pos=2;
    while(pos+4<=buf.byteLength){
        if(u8[pos]!==0xFF)break;
        var mk=dv.getUint16(pos,false),sl=dv.getUint16(pos+2,false);
        if(mk===0xFFE1&&u8[pos+4]===0x45&&u8[pos+5]===0x78&&u8[pos+6]===0x69&&u8[pos+7]===0x66&&u8[pos+8]===0&&u8[pos+9]===0){
            var base=pos+10,bom=dv.getUint16(base,false),le=bom===0x4949;
            if((bom===0x4949||bom===0x4D4D)&&dv.getUint16(base+2,le)===42){
                var i0=base+dv.getUint32(base+4,le);
                if(i0+2<=buf.byteLength){
                    var R={make:null,model:null,dateTime:null,gps:null,camera:{}},cnt=dv.getUint16(i0,le);
                    for(var i=0;i<cnt;i++){
                        var e=i0+2+i*12;if(e+12>buf.byteLength)break;
                        var tag=dv.getUint16(e,le),t=dv.getUint16(e+2,le),n=dv.getUint32(e+4,le);
                        if(tag===0x010F)R.make=rdASC(dv,vO(dv,e,base,le,t,n),n);
                        else if(tag===0x0110)R.model=rdASC(dv,vO(dv,e,base,le,t,n),n);
                        else if(tag===0x0132)R.dateTime=rdASC(dv,vO(dv,e,base,le,t,n),n);
                        else if(tag===0x8825)R.gps=parseGpsIfd(dv,base+dv.getUint32(e+8,le),base,le);
                        else if(tag===0x8769)parseExifSub(dv,base+dv.getUint32(e+8,le),base,le,R.camera);
                    }
                    return R;
                }
            }
        }
        if(mk===0xFFD9||mk===0xFFDA)break;
        pos+=2+sl;
    }
    return null;
}
function parseMp4Gps(buf){
    var dv=new DataView(buf),u8=new Uint8Array(buf);
    function s4(o){return String.fromCharCode(u8[o],u8[o+1],u8[o+2],u8[o+3]);}
    var C={"moov":1,"udta":1,"trak":1,"mdia":1,"minf":1,"ilst":1,"edts":1,"meta":1};
    function walk(o,end){
        while(o+8<=end){
            var sz=dv.getUint32(o,false);if(sz===0)sz=end-o;if(sz<8)break;
            var t=s4(o+4),d=o+8,de=Math.min(o+sz,end);
            if(t==="©xyz"){var slen=dv.getUint16(d,false),s="";for(var k=0;k<slen&&d+4+k<de;k++)s+=String.fromCharCode(u8[d+4+k]);var m=s.match(/([+-][0-9.]+)([+-][0-9.]+)/);if(m)return{lat:parseFloat(m[1]),lon:parseFloat(m[2])};}
            if(t==="meta"){var f=walk(d+4,de);if(f)return f;}
            else if(C[t]){var f2=walk(d,de);if(f2)return f2;}
            o+=sz;
        }
        return null;
    }
    return walk(0,buf.byteLength);
}
// Image → base64 (resized to max 800x600)
function imgToB64(file){
    return new Promise(function(res,rej){
        var url=URL.createObjectURL(file),img=new Image();
        img.onload=function(){
            var sc=Math.min(800/img.width,600/img.height,1);
            var c=document.createElement("canvas");
            c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
            c.getContext("2d").drawImage(img,0,0,c.width,c.height);
            URL.revokeObjectURL(url);
            res(c.toDataURL("image/jpeg",0.85).split(",")[1]);
        };
        img.onerror=function(){URL.revokeObjectURL(url);rej(new Error("img load failed"));};
        img.src=url;
    });
}
// Extract N frames from video element
function extractFrames(vid,n){
    return new Promise(function(res){
        var frames=[],c=document.createElement("canvas"),ctx=c.getContext("2d");
        function doIt(){
            var dur=isFinite(vid.duration)?vid.duration:30;
            c.width=Math.min(vid.videoWidth||640,800);
            c.height=Math.min(vid.videoHeight||480,600);
            var times=[],idx=0;
            for(var i=0;i<n;i++)times.push((dur/(n+1))*(i+1));
            function next(){
                if(idx>=times.length){res(frames);return;}
                var t=times[idx++],done=false;
                function onS(){if(done)return;done=true;vid.removeEventListener("seeked",onS);ctx.drawImage(vid,0,0,c.width,c.height);frames.push({time:t,b64:c.toDataURL("image/jpeg",0.80).split(",")[1],thumb:c.toDataURL("image/jpeg",0.3)});next();}
                vid.addEventListener("seeked",onS);
                vid.currentTime=t;
                setTimeout(function(){if(!done){done=true;vid.removeEventListener("seeked",onS);next();}},3500);
            }
            next();
        }
        if(vid.readyState>=1)doIt();
        else vid.addEventListener("loadedmetadata",doIt,{once:true});
    });
}
// Extract JSON from AI text response
function extractJSON(text){
    if(!text)return null;
    try{return JSON.parse(text.trim());}catch(e){}
    var m=text.match(/\{[\s\S]*\}/);
    if(m)try{return JSON.parse(m[0]);}catch(e){}
    return null;
}
var _progEl;
function progress(msg){if(!_progEl)_progEl=document.getElementById("media-ai-progress");if(_progEl){_progEl.style.display="block";_progEl.innerHTML+=(_progEl.innerHTML?"<br>":"")+"&gt; "+msg;}}
function clearProgress(){if(!_progEl)_progEl=document.getElementById("media-ai-progress");if(_progEl){_progEl.innerHTML="";_progEl.style.display="none";}}
// AI Providers
function callGemini(frames,key){
    // Auto-detects: API key (AIzaSy...) or OAuth Bearer token (ya29...)
    var isOAuth=key.startsWith('ya29.');
    var model='gemini-2.5-flash';
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent'+(isOAuth?'':'?key='+key);
    var hdrs=isOAuth?{'Authorization':'Bearer '+key,'Content-Type':'application/json'}:{'Content-Type':'application/json'};
    progress('Sending '+frames.length+' frame(s) to Gemini 2.5 Flash ('+(isOAuth?'OAuth Bearer':'API key')+')...');
    var parts=[{text:GEOINT_PROMPT}];
    frames.forEach(function(f){parts.push({inline_data:{mime_type:'image/jpeg',data:f.b64}});});
    return fetch(url,{method:'POST',headers:hdrs,
        body:JSON.stringify({contents:[{parts:parts}],generationConfig:{temperature:0.1,maxOutputTokens:1500}})
    }).then(function(r){if(!r.ok)return r.text().then(function(t){if(r.status===401||r.status===403){return refreshGeminiToken().then(function(newTok){PROVIDER_KEYS.gemini=newTok;aiKey.value=newTok;return callGemini(frames,newTok);});}throw new Error('Gemini '+r.status+': '+t.slice(0,250));});return r.json();})
    .then(function(d){
        var text=d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts[0].text;
        var parsed=extractJSON(text);
        if(!parsed)throw new Error('Could not parse Gemini JSON. Raw: '+(text||'empty').slice(0,300));
        parsed._provider='Gemini 2.5 Flash';parsed._raw=text;return parsed;
    });
}
function callOpenAI(frames,key){
    progress("Sending "+frames.length+" frame(s) to GPT-4o-mini...");
    var content=[{type:"text",text:GEOINT_PROMPT}];
    frames.forEach(function(f){content.push({type:"image_url",image_url:{url:"data:image/jpeg;base64,"+f.b64,detail:"high"}});});
    return fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
        body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"user",content:content}],max_tokens:1200})
    }).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error("OpenAI "+r.status+": "+t.slice(0,200));});return r.json();})
    .then(function(d){
        var text=d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
        var p=extractJSON(text);if(!p)throw new Error("Could not parse OpenAI JSON response");
        p._provider="GPT-4o-mini";p._raw=text;return p;
    });
}
function callClaude(frames,key){
    progress("Sending "+frames.length+" frame(s) to Claude 3 Haiku...");
    var content=[];
    frames.forEach(function(f){content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:f.b64}});});
    content.push({type:"text",text:GEOINT_PROMPT});
    return fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:1200,messages:[{role:"user",content:content}]})
    }).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error("Claude "+r.status+": "+t.slice(0,200));});return r.json();})
    .then(function(d){
        var text=d.content&&d.content[0]&&d.content[0].text;
        var p=extractJSON(text);if(!p)throw new Error("Could not parse Claude JSON response");
        p._provider="Claude 3 Haiku";p._raw=text;return p;
    });
}

function callGrok(frames,key){
    progress("Sending "+frames.length+" frame(s) to Grok Vision (xAI)...");
    var content=[{type:"text",text:GEOINT_PROMPT}];
    frames.forEach(function(f){content.push({type:"image_url",image_url:{url:"data:image/jpeg;base64,"+f.b64,detail:"high"}});});
    return fetch("https://api.x.ai/v1/chat/completions",{
        method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
        body:JSON.stringify({model:"grok-2-vision-1212",messages:[{role:"user",content:content}],max_tokens:1200})
    }).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error("Grok "+r.status+": "+t.slice(0,200));});return r.json();})
    .then(function(d){
        var text=d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
        var p=extractJSON(text);if(!p)throw new Error("Could not parse Grok response");
        p._provider="Grok-2 Vision";p._raw=text;return p;
    });
}
function geocode(ai){
    var q=[ai.city,ai.region,ai.country].filter(Boolean).join(", ");
    if(!q)return Promise.resolve(null);
    return fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(q),{headers:{Accept:"application/json"}})
        .then(function(r){return r.ok?r.json():[]})
        .then(function(d){if(!d||!d.length)return null;return{lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon),name:d[0].display_name,src:"nominatim"};})
        .catch(function(){return null;});
}
// UI setup
var _last=null,_frames=[],_hist=[];
function el(id){return document.getElementById(id);}
var dz=el("media-drop"),fi=el("media-file-input");
var ip=el("media-img-preview"),vp=el("media-vid-preview"),pw=el("media-preview-wrap");
var gr=el("media-gps-result"),ar=el("media-ai-result"),ac=el("media-actions");
var hy=el("media-history"),hl=el("media-history-lbl"),fn=el("media-filename");
var fs=el("media-frame-strip"),ab=el("media-analyze");
var aiKey=el("media-ai-key"),aiProv=el("media-ai-provider"),aiFC=el("media-frame-count");
if(!dz){console.warn("MEDIA-GEOINT: panel not in DOM");return;}
var sk=PROVIDER_KEYS[aiProv.value]||localStorage.getItem("gi:media-ai-key")||"";aiKey.value=sk;
var sp=localStorage.getItem("gi:media-ai-prov")||"";if(sp)aiProv.value=sp;
aiKey.addEventListener("change",function(){localStorage.setItem("gi:media-ai-key",aiKey.value);});
aiProv.addEventListener("change",function(){localStorage.setItem("gi:media-ai-prov",aiProv.value);if(PROVIDER_KEYS[aiProv.value])aiKey.value=PROVIDER_KEYS[aiProv.value];});
dz.addEventListener("click",function(){fi.click();});
["dragenter","dragover"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("drag");});});
["dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("drag");});});
dz.addEventListener("drop",function(e){doFiles(e.dataTransfer.files);});
fi.addEventListener("change",function(e){doFiles(e.target.files);});
ab.addEventListener("click",function(){
    if(!_last)return;
    var k=aiKey.value.trim();
    if(!k){ar.innerHTML='<div class="placeholder">&gt; API key required — enter Gemini/OpenAI/Claude key above</div>';ar.style.display="block";return;}
    runAI(_last,k);
});
el("media-pin").addEventListener("click",function(){
    if(!_last)return;var c=_last.coords||_last.exifGps;if(!c)return;
    _pin({label:(_last.name||"").replace(/\.[^.]+$/,""),lat:c.lat,lon:c.lon,meta:"MEDIA-GEOINT AI",danger:false});
    _fly(c.lon,c.lat,400000);
    _feed("ok","MEDIA-GEOINT :: pinned @ "+c.lat.toFixed(4)+", "+c.lon.toFixed(4));
});
el("media-fly").addEventListener("click",function(){if(!_last)return;var c=_last.coords||_last.exifGps;if(!c)return;_fly(c.lon,c.lat,1500);_feed("ok","MEDIA-GEOINT :: at ground level");});
el("media-chrono").addEventListener("click",function(){
    if(!_last||!_last.timestamp)return;
    var tab=document.querySelector('.tab[data-tab="chrono"]'),ts=el("chrono-ts");
    if(tab)tab.click();if(ts)ts.value=_last.timestamp.toISOString().slice(0,16);
    _feed("warn","MEDIA-GEOINT: timestamp sent to CHRONO tab");
});
el("media-export").addEventListener("click",function(){
    if(!_last)return;
    var blob=new Blob([JSON.stringify({file:_last.name,exifGps:_last.exifGps,aiResult:_last.aiResult,coords:_last.coords,timestamp:_last.timestamp?_last.timestamp.toISOString():null},null,2)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="media-geoint-"+Date.now()+".json";document.body.appendChild(a);a.click();a.remove();
    _feed("ok","MEDIA-GEOINT :: exported");
});
function doFiles(list){
    var files=Array.from(list||[]).filter(function(f){
        var x=f.name.split(".").pop().toLowerCase();
        return f.type.startsWith("image/")||f.type.startsWith("video/")||/^(jpg|jpeg|png|webp|tif|tiff|heic|heif|mp4|mov|avi|mkv|m4v|3gp)$/.test(x);
    });
    if(!files.length){_feed("warn","MEDIA-GEOINT :: no supported files");return;}
    var chain=Promise.resolve();
    files.forEach(function(f){chain=chain.then(function(){return doOne(f);});});
}
function doOne(file){
    _feed("warn","MEDIA-GEOINT :: loading "+file.name+"...");
    var ext=file.name.split(".").pop().toLowerCase();
    if(ip.src&&ip.src.startsWith("blob:"))URL.revokeObjectURL(ip.src);
    if(vp.src&&vp.src.startsWith("blob:"))URL.revokeObjectURL(vp.src);
    ip.style.display="none";vp.style.display="none";
    var isImg=/^(jpg|jpeg|png|gif|webp|tif|tiff|heic|heif)$/.test(ext)||file.type.startsWith("image/");
    var isVid=/^(mp4|mov|avi|mkv|m4v|3gp)$/.test(ext)||file.type.startsWith("video/");
    if(isImg){ip.src=URL.createObjectURL(file);ip.style.display="block";}
    else if(isVid){vp.src=URL.createObjectURL(file);vp.style.display="block";}
    pw.style.display="block";
    fn.textContent=file.name+"  ·  "+(file.size/1024).toFixed(1)+" KB";
    gr.innerHTML='<div class="placeholder">&gt; reading EXIF metadata...</div>';
    gr.style.display="block";ar.style.display="none";ac.style.display="none";
    fs.style.display="none";fs.innerHTML="";ab.style.display="none";
    _frames=[];_last=null;_progEl=null;
    var R={name:file.name,type:file.type,size:file.size,exifGps:null,exif:null,timestamp:null,coords:null,aiResult:null};
    return file.slice(0,4*1024*1024).arrayBuffer().then(function(buf){
        if(isImg){
            var ex=parseJpegExif(buf);
            if(ex){R.exif=ex;R.exifGps=ex.gps;
                var dt=(ex.camera&&ex.camera.dateTimeOriginal)||ex.dateTime;
                if(dt)try{var ps=dt.split(" "),dp=ps[0].split(":");R.timestamp=new Date(dp[0]+"-"+dp[1]+"-"+dp[2]+"T"+(ps[1]||"00:00:00")+"Z");}catch(e){}
            }
        }
        if(isVid){var mg=parseMp4Gps(buf);if(mg){R.exifGps={lat:mg.lat,lon:mg.lon,alt:null};}}
        _last=R;
        showExif(R);
        if(isVid){
            return extractFrames(vp,parseInt(aiFC.value)||3).then(function(frs){
                _frames=frs;showFrameStrip(frs);ab.style.display="block";
                _feed("ok","MEDIA-GEOINT :: "+frs.length+" frames ready — enter API key and click ANALYZE SCENE");
            });
        } else {
            ab.style.display="block";
            _feed(R.exifGps?"ok":"warn","MEDIA-GEOINT :: "+(R.exifGps?"EXIF GPS found":"no EXIF GPS")+" — "+file.name);
        }
    }).then(function(){addHist(R);})
    .catch(function(e){_feed("err","MEDIA-GEOINT :: "+e.message);});
}
function runAI(R,key){
    clearProgress();
    ar.innerHTML='<div class="placeholder">&gt; AI visual analysis in progress...</div>';
    ar.style.display="block";ab.disabled=true;
    var isVid=R.type.startsWith("video/")||/\.(mp4|mov|avi|mkv|m4v|3gp)$/i.test(R.name);
    var fnMap={gemini:callGemini,"gemini-proxy":callGeminiProxy,openai:callOpenAI,claude:callClaude,grok:callGrok};
    var callFn=fnMap[aiProv.value]||callGemini;
    var fPromise=isVid
        ?Promise.resolve(_frames.length?_frames:[{b64:"",time:0}])
        :imgToB64(fi.files[0]||new Blob()).then(function(b64){return[{b64:b64,time:0}];}).catch(function(){return[];});
    fPromise.then(function(frames){
        if(!frames||!frames.length||!frames[0].b64){_feed("err","MEDIA-GEOINT :: no image data to analyze");ab.disabled=false;return;}
        return callFn(frames,key);
    }).then(function(ai){
        if(!ai)return;
        R.aiResult=ai;
        progress("AI identified: "+(ai.country||"unknown")+", confidence="+(ai.confidence||"?"));
        var coordP;
        if(ai.lat&&ai.lon&&Math.abs(ai.lat)<=90&&Math.abs(ai.lon)<=180){
            coordP=Promise.resolve({lat:ai.lat,lon:ai.lon,src:"ai-direct"});
        } else if(ai.country||ai.city){
            progress("Geocoding: "+(ai.city||"")+(ai.country?", "+ai.country:"")+"...");
            coordP=geocode(ai).catch(function(){return null;});
        } else coordP=Promise.resolve(null);
        return coordP.then(function(coords){
            R.coords=coords;
            showAI(ai,coords);
            if(coords){
                _pin({label:R.name.replace(/\.[^.]+$/,"")+" (GEOINT-AI)",lat:coords.lat,lon:coords.lon,meta:"AI GEOINT · "+(ai.confidence||"?")+" confidence · "+(ai.country||""),danger:false});
                _fly(coords.lon,coords.lat,500000);
                _feed("ok","MEDIA-GEOINT :: AI located — "+(ai.country||"")+(ai.city?", "+ai.city:"")+" @ "+coords.lat.toFixed(3)+", "+coords.lon.toFixed(3));
            } else {
                _feed("warn","MEDIA-GEOINT :: AI confidence='" +ai.confidence+ "' — could not geocode");
            }
            ac.style.display="flex";
            el("media-pin").style.display=coords||R.exifGps?"":"none";
        });
    }).catch(function(e){
        ar.innerHTML='<div class="placeholder" style="color:#ff2e6e">&gt; Error: '+e.message+'</div>';
        _feed("err","MEDIA-GEOINT :: "+e.message);
    }).finally(function(){ab.disabled=false;});
}
function kv(k,v){return '<div class="kv"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>';}
function showExif(R){
    var gps=R.exifGps,html="";
    if(gps){
        html+=kv("EXIF GPS",'<span style="color:#12ffc6">✓ FOUND</span>');
        html+=kv("LAT",gps.lat.toFixed(6)+"&deg;");
        html+=kv("LON",gps.lon.toFixed(6)+"&deg;");
        if(gps.alt!=null)html+=kv("ALT",gps.alt.toFixed(0)+" m");
        if(gps.ts)html+=kv("GPS_TIME",gps.ts.toISOString());
        _pin({label:R.name.replace(/\.[^.]+$/,""),lat:gps.lat,lon:gps.lon,meta:"EXIF GPS"});
        _fly(gps.lon,gps.lat,600000);
        ac.style.display="flex";
    } else {
        html+=kv("EXIF GPS",'<span style="color:#ff2e6e">✗ not embedded</span>');
        html+=kv("HINT",'<span style="color:#ffb020">Use AI visual analysis below — enter API key and click ANALYZE</span>');
    }
    if(R.exif){
        if(R.exif.make)html+=kv("MAKE",R.exif.make);
        if(R.exif.model)html+=kv("MODEL",R.exif.model);
        var dt=(R.exif.camera&&R.exif.camera.dateTimeOriginal)||R.exif.dateTime;
        if(dt)html+=kv("CAPTURED",dt);
        if(R.exif.camera){
            var cam=R.exif.camera;
            if(cam.imageWidth)html+=kv("RES",cam.imageWidth+" × "+cam.imageHeight);
            if(cam.fNumber)html+=kv("f-STOP",cam.fNumber);
            if(cam.iso)html+=kv("ISO",cam.iso);
            if(cam.focalLength)html+=kv("FOCAL",cam.focalLength);
        }
    }
    if(R.timestamp)html+=kv("TIMESTAMP",R.timestamp.toISOString());
    gr.innerHTML=html;gr.style.display="block";
    el("media-chrono").style.display=R.timestamp?"":"none";
}
function showAI(ai,coords){
    var conf=ai.confidence||"none";
    var cc={high:"#12ffc6",medium:"#ffb020",low:"#ff8c00",none:"#ff2e6e"}[conf]||"#ff2e6e";
    var html=kv("AI_MODEL",ai._provider||"unknown");
    html+=kv("CONFIDENCE",'<span style="color:'+cc+'">'+conf.toUpperCase()+'</span>');
    if(ai.country)html+=kv("COUNTRY",ai.country);
    if(ai.region)html+=kv("REGION",ai.region);
    if(ai.city)html+=kv("CITY",ai.city);
    if(coords)html+=kv("COORDS",coords.lat.toFixed(5)+", "+coords.lon.toFixed(5)+' <span style="opacity:0.6">(source:'+coords.src+')</span>');
    if(ai.reasoning)html+=kv("ANALYSIS",'<span style="opacity:0.85;font-size:10px">'+ai.reasoning+'</span>');
    if(ai.clues&&ai.clues.length)html+=kv("CLUES",'<ul style="margin:2px 0;padding-left:14px;font-size:10px">'+ai.clues.map(function(c){return'<li>'+c+'</li>';}).join('')+'</ul>');
    ar.innerHTML=html;ar.style.display="block";
}
function showFrameStrip(frames){
    if(!frames||!frames.length)return;
    fs.innerHTML="";
    frames.forEach(function(f){
        var img=document.createElement("img");
        img.src=f.thumb;img.title="t="+f.time.toFixed(1)+"s";
        img.style.cssText="height:52px;width:auto;border:1px solid rgba(18,255,198,0.3);border-radius:2px;cursor:pointer;flex-shrink:0;";
        img.addEventListener("click",function(){vp.currentTime=f.time;});
        fs.appendChild(img);
    });
    fs.style.cssText="display:flex;gap:4px;overflow-x:auto;padding:4px 0;";
}
function addHist(R){
    _hist.unshift(R);hl.style.display="block";
    hy.innerHTML=_hist.slice(0,12).map(function(h,idx){
        var hc=!!(h.coords||h.exifGps);
        return '<div class="upload-row" data-idx="'+idx+'" style="cursor:pointer">'
            +'<span class="name">'+h.name+'</span>'
            +'<span class="st" style="color:'+(hc?'#12ffc6':'#ff2e6e')+'">'+( h.exifGps?'EXIF':h.coords?'AI':'✗')+'</span>'
            +'</div>';
    }).join("");
    hy.querySelectorAll(".upload-row[data-idx]").forEach(function(row){
        row.addEventListener("click",function(){var h=_hist[parseInt(row.dataset.idx)];var c=h&&(h.coords||h.exifGps);if(c)_fly(c.lon,c.lat,500000);});
    });
}
_feed("ok","MEDIA-GEOINT v2.0 :: AI visual scene geolocator armed");
console.log("%cMedia GEOINT v2 ready","color:#12ffc6;font-weight:bold");
window.MEDIA_GEOINT={runAI:runAI,extractFrames:extractFrames};
})();
