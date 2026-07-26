(function(){const N="settings";if(typeof window>"u")return;function de(){if(window.name==="__LP_OVERLAY__"){try{sessionStorage.setItem("__lpOverlayContext","1")}catch{}return!0}try{if(sessionStorage.getItem("__lpOverlayContext")==="1")return!0}catch{}try{if(new URLSearchParams(window.location.search||"").get("lp_overlay")==="1")return!0}catch{}return window!==window.top&&typeof window.innerWidth=="number"&&window.innerWidth>420&&window.name==="__LP_SIDEBAR__",!1}if(de())return;const G=window.location.search.includes("lp_sidebar=1"),q=window.name==="__LP_SIDEBAR__";let Y=!1;try{Y=window.sessionStorage.getItem("__LP_SIDEBAR_ONCE__")==="1"}catch{}if(G||q){try{window.name="__LP_SIDEBAR__"}catch{}try{window.sessionStorage.setItem("__LP_SIDEBAR_ONCE__","1")}catch{}Y=!0}let R=G||q||Y;(document.getElementById("ai-frame")||window.location.protocol.includes("extension"))&&(R=!1),R&&window.parent!==window.top&&window!==window.top&&(R=!1);const U="__LP_SIDEBAR_ONCE__",j="lp-sidebar-provider-switcher-host",F="lp-sidebar-translation-addon-style",J="simple-translate",Le=2500,K=[`#${J}`,'div.notranslate[style*="all: initial"]','div.notranslate[style*="all:initial"]'].join(", "),$=[{value:"chatgpt",label:"ChatGPT"},{value:"claude",label:"Claude"},{value:"gemini",label:"Gemini"},{value:"perplexity",label:"Perplexity"},{value:"copilot",label:"Copilot"},{value:"grok",label:"Grok"},{value:"deepseek",label:"DeepSeek"},{value:"poe",label:"Poe"},{value:"mistral",label:"Mistral"},{value:"notebooklm",label:"NotebookLM"}];let _=null,D=null,C=null;function le(){try{if(new URLSearchParams(window.location.search||"").get("lp_sidebar")==="1"){try{window.sessionStorage.setItem(U,"1")}catch{}return!0}try{if(window.sessionStorage.getItem(U)==="1")return!0}catch{}}catch{}if(window.name==="__LP_SIDEBAR__"){try{window.sessionStorage.setItem(U,"1")}catch{}return!0}if(window.innerWidth<900)return!0;try{const t=String(document.referrer||"").toLowerCase();if(t.includes("lp_sidebar=1")||t.includes("sidebar.html"))return!0}catch{}return!1}const L={chatgpt:"https://chatgpt.com/",claude:"https://claude.ai/new",gemini:"https://gemini.google.com/app",perplexity:"https://www.perplexity.ai/",copilot:"https://copilot.microsoft.com/",grok:"https://grok.com/",deepseek:"https://chat.deepseek.com/",poe:"https://poe.com/",mistral:"https://chat.mistral.ai/chat",notebooklm:"https://notebooklm.google.com/"};function Q(){const e=String(window.location.hostname||"");return e.includes("chatgpt.com")||e.includes("chat.openai.com")?"chatgpt":e.includes("claude.ai")?"claude":e.includes("gemini.google.com")?"gemini":e.includes("perplexity.ai")?"perplexity":e.includes("copilot.microsoft.com")?"copilot":e.includes("grok.com")?"grok":e.includes("deepseek.com")?"deepseek":e.includes("poe.com")?"poe":e.includes("chat.mistral.ai")?"mistral":e.includes("notebooklm.google.com")?"notebooklm":""}function Z(){const e=String(window.location.hostname||"").toLowerCase();for(const t of Object.keys(L))try{const s=new URL(L[t]).hostname.toLowerCase();if(e===s||e.endsWith("."+s))return t}catch{}return""}function V(){return typeof browser<"u"?browser:typeof chrome<"u"?chrome:null}function O(e){const t=V();return!t||!t.runtime||!t.runtime.sendMessage?Promise.resolve(null):new Promise(r=>{let s=!1;const c=n=>{s||(s=!0,r(n??null))};try{const n=t.runtime.sendMessage(e,f=>{if(t.runtime&&t.runtime.lastError){c(null);return}c(f)});n&&typeof n.then=="function"&&n.then(c).catch(()=>c(null))}catch{c(null)}})}function pe(e){const t=V();return!t||!t.storage||!t.storage.local||!t.storage.local.get?Promise.resolve({}):new Promise(r=>{let s=!1;const c=n=>{s||(s=!0,r(n&&typeof n=="object"?n:{}))};try{const n=t.storage.local.get(e,f=>{if(t.runtime&&t.runtime.lastError){c({});return}c(f)});n&&typeof n.then=="function"&&n.then(c).catch(()=>c({}))}catch{c({})}})}function ee(e){const t=typeof e=="string"?e.trim().toLowerCase():"";return t==="ocean"||t==="sunset"||t==="modern"||t==="minimal"||t==="cyber"||t==="forest"||t==="pastel"||t==="mono"||t==="oled"||t==="sepia"||t==="retro"||t==="aurora"||t==="custom"?t:"classic"}async function ue(){try{const e=await pe(N),t=e&&e[N]&&typeof e[N]=="object"?e[N]:null;return{preset:ee(t&&t.themePreset),customColors:t&&t.customThemeColors&&typeof t.customThemeColors=="object"?{...t.customThemeColors}:null}}catch{return{preset:"classic",customColors:null}}}function fe(e){const t={classic:{text:"#f6f2eb",muted:"rgba(246, 242, 235, 0.68)",panel:"rgba(36, 27, 22, 0.88)",panelStrong:"rgba(43, 31, 25, 0.94)",surface:"rgba(255, 255, 255, 0.05)",surfaceHover:"rgba(255, 255, 255, 0.09)",border:"rgba(255, 219, 188, 0.18)",accent:"#f3a15f",accentSoft:"rgba(243, 161, 95, 0.18)",accentAlt:"#4fb7d4",danger:"#ffb4b4",dangerBg:"rgba(255, 84, 84, 0.14)",shadow:"0 18px 48px rgba(0, 0, 0, 0.4)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},modern:{text:"#eef4ff",muted:"rgba(238, 244, 255, 0.66)",panel:"rgba(11, 18, 30, 0.88)",panelStrong:"rgba(16, 24, 38, 0.94)",surface:"rgba(255, 255, 255, 0.05)",surfaceHover:"rgba(97, 208, 255, 0.12)",border:"rgba(97, 208, 255, 0.2)",accent:"#61d0ff",accentSoft:"rgba(97, 208, 255, 0.18)",accentAlt:"#8aa2ff",danger:"#ffb4b4",dangerBg:"rgba(255, 124, 116, 0.16)",shadow:"0 18px 48px rgba(0, 0, 0, 0.42)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},minimal:{text:"#1f2430",muted:"rgba(31, 36, 48, 0.62)",panel:"rgba(255, 255, 255, 0.86)",panelStrong:"rgba(255, 255, 255, 0.95)",surface:"rgba(59, 130, 246, 0.05)",surfaceHover:"rgba(37, 99, 235, 0.12)",border:"rgba(100, 116, 139, 0.18)",accent:"#2563eb",accentSoft:"rgba(37, 99, 235, 0.16)",accentAlt:"#14b8a6",danger:"#b91c1c",dangerBg:"rgba(220, 38, 38, 0.12)",shadow:"0 18px 48px rgba(148, 163, 184, 0.24)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},cyber:{text:"#edf5ff",muted:"rgba(237, 245, 255, 0.68)",panel:"rgba(8, 12, 22, 0.9)",panelStrong:"rgba(10, 16, 28, 0.95)",surface:"rgba(255, 255, 255, 0.05)",surfaceHover:"rgba(34, 211, 238, 0.14)",border:"rgba(87, 130, 255, 0.2)",accent:"#22d3ee",accentSoft:"rgba(34, 211, 238, 0.18)",accentAlt:"#7c3aed",danger:"#ffb4c9",dangerBg:"rgba(251, 113, 133, 0.14)",shadow:"0 18px 50px rgba(0, 0, 0, 0.48)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},ocean:{text:"#eef7ff",muted:"rgba(238, 247, 255, 0.68)",panel:"rgba(17, 32, 48, 0.88)",panelStrong:"rgba(21, 39, 58, 0.95)",surface:"rgba(255, 255, 255, 0.05)",surfaceHover:"rgba(67, 201, 183, 0.13)",border:"rgba(123, 181, 230, 0.18)",accent:"#43c9b7",accentSoft:"rgba(67, 201, 183, 0.18)",accentAlt:"#56a7ff",danger:"#ffd0cc",dangerBg:"rgba(255, 133, 120, 0.14)",shadow:"0 18px 46px rgba(0, 18, 36, 0.42)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},sunset:{text:"#fff0e5",muted:"rgba(255, 240, 229, 0.66)",panel:"rgba(50, 33, 31, 0.9)",panelStrong:"rgba(57, 38, 35, 0.95)",surface:"rgba(255, 255, 255, 0.05)",surfaceHover:"rgba(240, 140, 84, 0.14)",border:"rgba(255, 196, 152, 0.18)",accent:"#f08c54",accentSoft:"rgba(240, 140, 84, 0.18)",accentAlt:"#b983ff",danger:"#ffd1cf",dangerBg:"rgba(255, 138, 123, 0.14)",shadow:"0 18px 50px rgba(28, 10, 5, 0.44)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},forest:{text:"#edf7ee",muted:"rgba(237, 247, 238, 0.66)",panel:"rgba(15, 28, 20, 0.9)",panelStrong:"rgba(17, 31, 22, 0.95)",surface:"rgba(255, 255, 255, 0.05)",surfaceHover:"rgba(74, 222, 128, 0.14)",border:"rgba(111, 193, 137, 0.18)",accent:"#4ade80",accentSoft:"rgba(74, 222, 128, 0.18)",accentAlt:"#84cc16",danger:"#ffd2d8",dangerBg:"rgba(251, 113, 133, 0.14)",shadow:"0 18px 46px rgba(0, 0, 0, 0.42)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},pastel:{text:"#1f2b3f",muted:"rgba(31, 43, 63, 0.62)",panel:"rgba(255, 253, 248, 0.9)",panelStrong:"rgba(255, 255, 255, 0.96)",surface:"rgba(245, 158, 11, 0.05)",surfaceHover:"rgba(139, 92, 246, 0.12)",border:"rgba(168, 85, 247, 0.16)",accent:"#f59e0b",accentSoft:"rgba(245, 158, 11, 0.16)",accentAlt:"#8b5cf6",danger:"#be123c",dangerBg:"rgba(225, 29, 72, 0.12)",shadow:"0 18px 44px rgba(236, 164, 91, 0.24)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},mono:{text:"#f5f5f5",muted:"rgba(245, 245, 245, 0.64)",panel:"rgba(24, 25, 30, 0.9)",panelStrong:"rgba(28, 29, 34, 0.95)",surface:"rgba(255, 255, 255, 0.04)",surfaceHover:"rgba(209, 213, 219, 0.12)",border:"rgba(255, 255, 255, 0.14)",accent:"#d1d5db",accentSoft:"rgba(209, 213, 219, 0.14)",accentAlt:"#9ca3af",danger:"#fecaca",dangerBg:"rgba(248, 113, 113, 0.12)",shadow:"0 18px 48px rgba(0, 0, 0, 0.42)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},oled:{text:"#fafafa",muted:"rgba(250, 250, 250, 0.66)",panel:"rgba(6, 6, 6, 0.92)",panelStrong:"rgba(10, 10, 10, 0.97)",surface:"rgba(255, 255, 255, 0.04)",surfaceHover:"rgba(102, 227, 255, 0.12)",border:"rgba(255, 255, 255, 0.12)",accent:"#66e3ff",accentSoft:"rgba(102, 227, 255, 0.16)",accentAlt:"#8b5cf6",danger:"#ffd0d0",dangerBg:"rgba(255, 122, 122, 0.12)",shadow:"0 18px 58px rgba(0, 0, 0, 0.65)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},sepia:{text:"#302117",muted:"rgba(48, 33, 23, 0.62)",panel:"rgba(255, 248, 235, 0.9)",panelStrong:"rgba(255, 250, 241, 0.96)",surface:"rgba(138, 93, 43, 0.05)",surfaceHover:"rgba(138, 93, 43, 0.12)",border:"rgba(102, 67, 36, 0.16)",accent:"#8a5d2b",accentSoft:"rgba(138, 93, 43, 0.16)",accentAlt:"#b7793f",danger:"#92400e",dangerBg:"rgba(180, 83, 9, 0.12)",shadow:"0 18px 46px rgba(110, 78, 39, 0.2)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},retro:{text:"#f4ead6",muted:"rgba(244, 234, 214, 0.66)",panel:"rgba(35, 27, 18, 0.92)",panelStrong:"rgba(42, 33, 23, 0.96)",surface:"rgba(255, 255, 255, 0.04)",surfaceHover:"rgba(246, 196, 83, 0.14)",border:"rgba(246, 196, 83, 0.18)",accent:"#f6c453",accentSoft:"rgba(246, 196, 83, 0.16)",accentAlt:"#88b17b",danger:"#ffd6b5",dangerBg:"rgba(249, 115, 22, 0.12)",shadow:"0 18px 50px rgba(0, 0, 0, 0.48)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'},aurora:{text:"#e8f0fe",muted:"rgba(232, 240, 254, 0.66)",panel:"rgba(17, 24, 40, 0.92)",panelStrong:"rgba(12, 18, 32, 0.96)",surface:"rgba(255, 255, 255, 0.04)",surfaceHover:"rgba(45, 212, 191, 0.14)",border:"rgba(45, 212, 191, 0.18)",accent:"#2dd4bf",accentSoft:"rgba(45, 212, 191, 0.18)",accentAlt:"#818cf8",danger:"#ffd0d0",dangerBg:"rgba(255, 122, 122, 0.12)",shadow:"0 18px 58px rgba(0, 0, 0, 0.50)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'}};return t[ee(e)]||t.classic}function ge(e){function t(p,d){return typeof p=="string"&&/^#[0-9a-f]{6}$/i.test(p)?p:d}function r(p,d){const u=parseInt(p.slice(1,3),16),w=parseInt(p.slice(3,5),16),m=parseInt(p.slice(5,7),16);return"rgba("+u+","+w+","+m+","+d+")"}const s=t(e&&e.bg,"#1a1a2e"),c=t(e&&e.bgAlt,"#16213e"),n=t(e&&e.panel,"#0f3460"),f=t(e&&e.panelAlt,"#1a1a4e"),o=t(e&&e.ink,"#e0e0e0"),i=t(e&&e.muted,"#a0a0b0"),b=t(e&&e.accent,"#e94560"),v=t(e&&e.accent2,"#f5a623"),g=t(e&&e.accent3,"#533483"),x=t(e&&e.accent4,"#0f3460"),S=t(e&&e.border,"#2a2a4e");return{text:o,muted:r(o,.66),panel:r(s,.9),panelStrong:r(c,.95),surface:r(s,.5),surfaceHover:r(b,.14),border:"1px solid "+S,accent:b,accentSoft:r(b,.18),accentAlt:v,danger:"#ffb4b4",dangerBg:"rgba(255, 84, 84, 0.14)",shadow:"0 18px 48px rgba(0, 0, 0, 0.4)",font:'"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif'}}function be(){try{const e=window.localStorage.getItem("__lp_sidebar_ui_pos");if(e)return JSON.parse(e)}catch{}return null}function me(e,t){try{window.localStorage.setItem("__lp_sidebar_ui_pos",JSON.stringify({x:e,y:t}))}catch{}}function he(){let e=document.getElementById(j);if(e)return e;const t=document.documentElement||document.body;if(!t)return null;e=document.createElement("div"),e.id=j;const r=be(),s=r?`position:fixed; left:${r.x}px; top:${r.y}px; z-index:2147483647; pointer-events:none; touch-action:none;`:"position:fixed; top:12px; right:12px; z-index:2147483647; pointer-events:none; touch-action:none;";return e.style.cssText=s,t.appendChild(e),e}function te(){if(D)return D;const e=document.documentElement;return D={height:e&&e.style.height||"",paddingTop:e&&e.style.paddingTop||"",paddingBottom:e&&e.style.paddingBottom||""},D}function xe(){const e=document.documentElement,t=te();!e||!t||(e.style.height=t.height,e.style.paddingTop=t.paddingTop,e.style.paddingBottom=t.paddingBottom)}function we(){C&&(window.clearTimeout(C),C=null);let e=8;const t=()=>{if(xe(),e<=0){C=null;return}e-=1,C=window.setTimeout(t,1e3)};t()}function ye(e){return!!e&&e.id===J}function Se(e){return!(e instanceof HTMLElement)||e.tagName!=="DIV"||!e.classList.contains("notranslate")?!1:/(^|;)\s*all\s*:\s*initial\s*;?/i.test(String(e.getAttribute("style")||""))}function ve(e){if(!(e instanceof HTMLElement)||e.id===j)return!1;const t=ye(e),r=Se(e);return!t&&!r?!1:(e.style.setProperty("display","none","important"),e.style.setProperty("visibility","hidden","important"),e.style.setProperty("opacity","0","important"),e.style.setProperty("pointer-events","none","important"),e.setAttribute("aria-hidden","true"),e.dataset.lpSidebarSuppressed="true",r&&we(),!0)}function ne(e){if(!(e instanceof Element))return;const t=new Set,r=s=>{!(s instanceof HTMLElement)||t.has(s)||(t.add(s),ve(s))};r(e),e.querySelectorAll&&e.querySelectorAll(K).forEach(s=>{r(s)})}function Ee(){te();let e=document.getElementById(F);if(!e){const c=document.head||document.documentElement||document.body;if(!c)return;e=document.createElement("style"),e.id=F,e.textContent=`
        ${K} {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `,c.appendChild(e)}if(ne(document.documentElement||document.body),_)return;const t=document.documentElement||document.body;if(!t)return;let r=!1;function s(){r||(r=!0,setTimeout(function(){r=!1,ne(document.documentElement||document.body)},150))}_=new MutationObserver(c=>{for(let n=0;n<c.length;n++){const f=c[n].addedNodes;for(let o=0;o<f.length;o++){const i=f[o];if(i&&i.nodeType===1&&!i.dataset.lpSidebarSuppressed){s();return}}}}),_.observe(t,{childList:!0,subtree:!0})}function W(e,t,r,s){const c=!!s;e.dataset.busy=c?"true":"false",t.disabled=c,r.forEach(n=>{n.disabled=c})}async function P(e=3){if(document.getElementById("local-pocket-switcher-injected")||!R)return;try{window.name="__LP_SIDEBAR__"}catch{}const t=he();if(!t)return e>0?(await new Promise(a=>setTimeout(a,500)),P(e-1)):void 0;const r=t.shadowRoot||t.attachShadow({mode:"open"});if(!r)return e>0?(await new Promise(a=>setTimeout(a,500)),P(e-1)):void 0;const s=Q()||Z()||"chatgpt",c=await ue(),n=c.preset==="custom"?ge(c.customColors):fe(c.preset),f=document.createElement("style");f.textContent=`
      :host {
        all: initial;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      /* Entrance Animation for Menu */
      @keyframes menuEntrance {
        0% { opacity: 0; transform: translateY(-10px) scale(0.96); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      .shell {
        position: relative;
        width: auto;
        pointer-events: auto;
        font: 500 13px/1.4 ${n.font};
        color: ${n.text};
        z-index: 99999;
      }

      .trigger {
        display: flex;
        width: auto;
        min-width: 140px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 14px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        background: linear-gradient(135deg, ${n.panelStrong}, ${n.panel});
        color: inherit;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05);
        backdrop-filter: blur(24px) saturate(160%);
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .trigger:hover,
      .trigger:focus-visible {
        border-color: ${n.accent};
        background: linear-gradient(135deg, ${n.surfaceHover}, ${n.panel});
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
        outline: none;
      }

      .trigger:active {
        transform: translateY(0);
      }

      .trigger:disabled {
        cursor: progress;
        opacity: 0.6;
        transform: none;
      }

      .current-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }

      .ai-icon {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${n.accent};
        box-shadow: 0 0 12px ${n.accent};
        display: inline-block;
        flex-shrink: 0;
        animation: pulse 3s infinite alternate;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 6px ${n.accentSoft}; }
        100% { box-shadow: 0 0 14px ${n.accent}; }
      }

      .current {
        font-weight: 600;
        letter-spacing: 0.2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .caret-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${n.surface};
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .caret {
        width: 6px;
        height: 6px;
        border-right: 2px solid ${n.text};
        border-bottom: 2px solid ${n.text};
        transform: translateY(-2px) rotate(45deg);
        transition: border-color 0.3s;
      }

      .shell[data-open="true"] .caret-wrapper {
        transform: rotate(180deg);
        background: ${n.accentSoft};
      }
      .shell[data-open="true"] .caret {
        border-color: ${n.accent};
      }

      .menu {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        display: none;
        width: 260px;
        padding: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        background: linear-gradient(145deg, ${n.panelStrong}, ${n.panel});
        box-shadow: 0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
        backdrop-filter: blur(32px) saturate(180%);
        transform-origin: top right;
      }

      .shell[data-open="true"] .menu {
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: menuEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .menu-header {
        padding: 4px 6px 8px;
        border-bottom: 1px solid ${n.surfaceHover};
        margin-bottom: 4px;
      }

      .menu-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
        background: linear-gradient(90deg, #fff, ${n.muted});
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .menu-subtitle {
        font-size: 11px;
        color: ${n.muted};
        margin-top: 4px;
      }

      .options {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 50vh;
        overflow-y: auto;
        padding-right: 4px;
      }

      /* Custom Scrollbar for Options */
      .options::-webkit-scrollbar { width: 4px; }
      .options::-webkit-scrollbar-track { background: transparent; }
      .options::-webkit-scrollbar-thumb { background: ${n.surfaceHover}; border-radius: 4px; }
      .options::-webkit-scrollbar-thumb:hover { background: ${n.muted}; }

      .option {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border: none;
        border-radius: 12px;
        background: transparent;
        color: ${n.muted};
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .option::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: ${n.accent};
        transform: scaleY(0);
        transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        border-radius: 0 4px 4px 0;
      }

      .option:hover,
      .option:focus-visible {
        background: ${n.surfaceHover};
        color: ${n.text};
        transform: translateX(4px);
        outline: none;
      }

      .option[aria-selected="true"] {
        background: ${n.surface};
        color: ${n.text};
        font-weight: 600;
      }

      .option[aria-selected="true"]::before {
        transform: scaleY(0.6);
      }

      .option-name {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
      }

      .option-icon {
        font-size: 14px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .option:hover .option-icon,
      .option[aria-selected="true"] .option-icon {
        opacity: 1;
        color: ${n.accent};
      }

      .check {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${n.accent};
        color: #fff;
        font-size: 11px;
        opacity: 0;
        transform: scale(0.5);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .option[aria-selected="true"] .check {
        opacity: 1;
        transform: scale(1);
      }

      @media (max-width: 480px) {
        .trigger {
          min-width: 120px;
          padding: 6px 12px;
        }
        .current { font-size: 12px; }
      }
    `;const o=document.createElement("div");o.className="shell",o.dataset.open="false",o.dataset.busy="false";const i=document.createElement("button");i.className="trigger",i.type="button",i.setAttribute("aria-haspopup","listbox"),i.setAttribute("aria-expanded","false");const b=document.createElement("span");b.className="current-wrap";const v=document.createElement("span");v.className="ai-icon";const g=document.createElement("span");g.className="current";const x=document.createElement("span");x.className="caret-wrapper";const S=document.createElement("span");S.className="caret",S.setAttribute("aria-hidden","true");const p=document.createElement("div");p.className="menu";const d=document.createElement("div");d.className="menu-header";const u=document.createElement("div");u.className="menu-title",u.textContent="AI Provider";const w=document.createElement("div");w.className="menu-subtitle",w.textContent="Tukar enjin pintar pilihan anda.";const m=document.createElement("div");if(m.className="options",m.setAttribute("role","listbox"),b.appendChild(v),b.appendChild(g),x.appendChild(S),i.appendChild(b),i.appendChild(x),d.appendChild(u),d.appendChild(w),p.appendChild(d),p.appendChild(m),o.appendChild(i),o.appendChild(p),r.replaceChildren(f,o),!o||!i||!g||!m)return;const M=$.find(a=>a.value===s);g.textContent=M?M.label:"AI";const Ae={chatgpt:"\u{1F916}",claude:"\u{1F9E0}",gemini:"\u2728",perplexity:"\u{1F50D}",copilot:"\u{1F4BB}",grok:"\u{1F680}",deepseek:"\u{1F40B}",poe:"\u{1F52E}",mistral:"\u{1F32A}\uFE0F",notebooklm:"\u{1F4DA}"},T=[];$.forEach(a=>{const l=document.createElement("button"),h=document.createElement("span"),E=document.createElement("span"),I=document.createElement("span"),A=document.createElement("span");l.type="button",l.className="option",l.setAttribute("role","option"),l.dataset.provider=a.value,l.setAttribute("aria-selected",a.value===s?"true":"false"),h.className="option-name",E.className="option-icon",E.textContent=Ae[a.value]||"\u{1F539}",I.textContent=a.label,h.appendChild(E),h.appendChild(I),A.className="check",A.setAttribute("aria-hidden","true"),A.textContent="\u2713",l.appendChild(h),l.appendChild(A),T.push(l),m.appendChild(l),l.addEventListener("pointerdown",y=>{y.stopPropagation()}),l.addEventListener("click",async()=>{if(o.dataset.busy!=="true"){if(a.value===s){o.dataset.open="false",i.setAttribute("aria-expanded","false");return}W(o,i,T,!0),o.dataset.open="false",i.setAttribute("aria-expanded","false"),O({type:"sidebar-ui-switch-provider",provider:a.value}).catch(()=>{});try{window.sessionStorage.setItem(U,"1")}catch{}try{window.name="__LP_SIDEBAR__"}catch{}try{if(window!==window.top)window.name="__LP_SIDEBAR__",window.location.replace(H(a.value));else{const y=document.getElementById("ai-frame");y?(y.src=H(a.value),g.textContent=a.label,T.forEach(ce=>{ce.setAttribute("aria-selected",ce.dataset.provider===a.value?"true":"false")}),setTimeout(()=>{W(o,i,T,!1)},1e3)):(window.name="__LP_SIDEBAR__",window.location.replace(H(a.value)))}}catch{W(o,i,T,!1)}}})});const X=()=>{o.dataset.open="false",i.setAttribute("aria-expanded","false")},Ce=()=>{if(o.dataset.busy==="true")return;const a=o.dataset.open!=="true";o.dataset.open=a?"true":"false",i.setAttribute("aria-expanded",a?"true":"false")};let B=!1,re=0,ae=0,oe=0,ie=0,k=!1;const se=a=>{if(!B)return;const l=a.clientX-re,h=a.clientY-ae;!k&&(Math.abs(l)>3||Math.abs(h)>3)&&(k=!0,i.classList.add("dragging"),X()),k&&(a.preventDefault(),requestAnimationFrame(()=>{if(!B)return;let E=oe+l,I=ie+h;const A=Math.max(0,window.innerWidth-t.offsetWidth),y=Math.max(0,window.innerHeight-t.offsetHeight);E=Math.max(0,Math.min(E,A)),I=Math.max(0,Math.min(I,y)),t.style.right="auto",t.style.left=`${E}px`,t.style.top=`${I}px`}))},z=()=>{if(B&&(B=!1,i.classList.remove("dragging"),document.removeEventListener("pointermove",se),document.removeEventListener("pointerup",z),document.removeEventListener("pointercancel",z),k)){const a=t.getBoundingClientRect();me(a.left,a.top);const l=h=>{h.stopPropagation(),h.preventDefault(),i.removeEventListener("click",l,!0)};i.addEventListener("click",l,!0),setTimeout(()=>i.removeEventListener("click",l,!0),50)}};i.addEventListener("pointerdown",a=>{if(!a.isPrimary||a.button!==0&&a.pointerType==="mouse")return;B=!0,k=!1,re=a.clientX,ae=a.clientY;const l=t.getBoundingClientRect();oe=l.left,ie=l.top,document.addEventListener("pointermove",se,{passive:!1}),document.addEventListener("pointerup",z),document.addEventListener("pointercancel",z)}),i.addEventListener("click",()=>{k||Ce()}),document.addEventListener("pointerdown",a=>{if(o.dataset.open!=="true")return;(a.composedPath?a.composedPath():[]).indexOf(t)!==-1||X()},!0),document.addEventListener("keydown",a=>{a.key==="Escape"&&X()});try{const a=document.createElement("meta");a.id="local-pocket-switcher-injected",a.setAttribute("aria-hidden","true"),a.style.display="none",(document.head||document.documentElement||document.body).appendChild(a)}catch{}}function H(e){const t=L[e]||L.chatgpt;try{const r=new URL(t);return r.searchParams.set("lp_sidebar","1"),r.searchParams.set("lp_reload",Date.now().toString(36)),r.toString()}catch{return t+(t.includes("?")?"&":"?")+"lp_sidebar=1"}}function _e(){const e=V();!e||!e.runtime||!e.runtime.onMessage||e.runtime.onMessage.addListener(t=>{if(!t||t.type!=="sidebar-ui-navigate-provider")return;const r=t.provider;if(!(!r||!L[r]))try{window.name="__LP_SIDEBAR__",window.location.replace(H(r))}catch{}})}function ke(){const e="lp-popup-toolbar";if(document.getElementById(e))return;const t=document.createElement("div");t.id=e;const r=document.documentElement||document.body;if(!r)return;const s=t.attachShadow({mode:"closed"}),c=Q()||Z()||"chatgpt",n=$.find(d=>d.value===c)?.label||"AI",f=document.createElement("style");f.textContent=`
:host{all:initial;position:fixed;top:4px;right:8px;z-index:2147483647}
*{box-sizing:border-box;margin:0;padding:0}
.toolbar{display:flex;align-items:center;gap:4px;pointer-events:auto;background:linear-gradient(145deg,rgba(16,16,22,0.92),rgba(12,12,16,0.88));border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:2px 2px 2px 8px;box-shadow:0 8px 24px rgba(0,0,0,0.35);backdrop-filter:blur(16px);font-family:"Segoe UI Variable","Segoe UI",system-ui,-apple-system,sans-serif;color:#f0edea;font-size:12px;user-select:none;transition:opacity 0.15s}
.toolbar:hover{opacity:1!important}
.provider-btn{display:flex;align-items:center;gap:3px;padding:3px 8px;border:1px solid rgba(255,255,255,0.06);border-radius:14px;background:rgba(255,255,255,0.04);color:#f0edea;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.12s}
.provider-btn:hover{background:rgba(255,255,255,0.1)}
.caret{width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid rgba(255,255,255,0.4);transition:transform 0.2s}
.toolbar[data-open="true"] .caret{transform:rotate(180deg);border-top-color:#61d0ff}
.menu{position:absolute;top:calc(100% + 4px);right:0;min-width:150px;max-height:240px;overflow-y:auto;background:linear-gradient(145deg,rgba(20,20,25,0.98),rgba(15,15,18,0.98));border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:4px;box-shadow:0 12px 32px rgba(0,0,0,0.5);backdrop-filter:blur(24px);display:none;transform-origin:top right}
@keyframes menuIn{0%{opacity:0;transform:translateY(-6px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
.toolbar[data-open="true"] .menu{display:flex;flex-direction:column;gap:1px;animation:menuIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards}
.menu::-webkit-scrollbar{width:4px}
.menu::-webkit-scrollbar-track{background:transparent}
.menu::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
.opt{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;color:rgba(255,255,255,0.55);font-size:11px;font-weight:500;cursor:pointer;transition:all 0.12s;border:none;background:transparent;width:100%;text-align:left}
.opt:hover{background:rgba(255,255,255,0.06);color:#fff}
.opt[data-sel="1"]{background:rgba(97,208,255,0.08);color:#fff;font-weight:600}
.check{width:12px;height:12px;border-radius:50%;background:#61d0ff;color:#000;font-size:7px;font-weight:800;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(0.5);transition:all 0.2s}
.opt[data-sel="1"] .check{opacity:1;transform:scale(1)}
.close-btn{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:none;border-radius:50%;background:transparent;color:rgba(255,255,255,0.35);font-size:14px;line-height:1;cursor:pointer;transition:background 0.12s,color 0.12s}
.close-btn:hover{background:rgba(255,255,255,0.08);color:#ff6b6b}
.sep{height:1px;background:rgba(255,255,255,0.06);margin:3px 0}
`,s.appendChild(f);const o=document.createElement("div");o.className="toolbar",o.dataset.open="false";const i=document.createElement("button");i.className="provider-btn",i.type="button";const b=document.createElement("span");b.textContent=n;const v=document.createElement("span");v.className="caret",i.appendChild(b),i.appendChild(v);const g=document.createElement("button");g.className="close-btn",g.type="button",g.title="Close popup",g.textContent="\xD7";const x=document.createElement("div");x.className="menu",$.forEach(function(d){const u=document.createElement("button");u.className="opt",u.type="button",u.dataset.provider=d.value,u.dataset.sel=d.value===c?"1":"0";const w=document.createElement("span");w.textContent=d.label;const m=document.createElement("span");m.className="check",m.textContent="\u2713",u.appendChild(w),u.appendChild(m),u.addEventListener("pointerdown",function(M){M.stopPropagation()}),u.addEventListener("click",function(){if(d.value===c){o.dataset.open="false";return}O({type:"update-ai-overlay-popup",provider:d.value}).catch(function(){}),o.dataset.open="false"}),x.appendChild(u)});const S=document.createElement("div");S.className="sep";const p=document.createElement("button");p.className="opt",p.type="button",p.style.color="rgba(255,107,107,0.7)",p.textContent="Close popup",p.addEventListener("pointerdown",function(d){d.stopPropagation()}),p.addEventListener("click",function(){o.dataset.open="false",O({type:"close-ai-overlay-popup"}).catch(function(){})}),x.appendChild(S),x.appendChild(p),o.appendChild(i),o.appendChild(g),o.appendChild(x),s.appendChild(o),r.appendChild(t),i.addEventListener("click",function(d){d.stopPropagation(),o.dataset.open=o.dataset.open==="true"?"false":"true"}),document.addEventListener("pointerdown",function(d){if(o.dataset.open!=="true")return;(d.composedPath?d.composedPath():[]).indexOf(t)!==-1||(o.dataset.open="false")},!0),document.addEventListener("keydown",function(d){d.key==="Escape"&&(o.dataset.open==="true"?o.dataset.open="false":O({type:"close-ai-overlay-popup"}).catch(function(){}))})}function Ie(){try{if(new URLSearchParams(window.location.search).get("lp_popup")==="1"){ke();return}}catch{}le()&&(_e(),Ee(),document.body?P().catch(()=>{}):document.addEventListener("DOMContentLoaded",()=>{P().catch(()=>{})},{once:!0}),[2e3,4e3,8e3].forEach(e=>{setTimeout(()=>{document.getElementById("local-pocket-switcher-injected")||P().catch(()=>{})},e)}),window.addEventListener("beforeunload",()=>{_&&(_.disconnect(),_=null)},{once:!0}))}Ie()})();
