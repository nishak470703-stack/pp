(function(){if(console.log("[Pomodoro] Script loading on:",window.location.href),typeof window>"u"){console.log("[Pomodoro] Window is undefined, returning");return}if(window.__lpPomodoroOverlayInstalled){console.log("[Pomodoro] Already installed, skipping");return}if(window.__lpPomodoroOverlayInstalled=!0,window.name==="__LP_SIDEBAR__"){console.log("[Pomodoro] Skipping sidebar window");return}const p=typeof browser<"u"?browser:typeof chrome<"u"?chrome:null;if(console.log("[Pomodoro] API check:",{api:!!p,storage:!!(p&&p.storage),storageLocal:!!(p&&p.storage&&p.storage.local),runtime:!!(p&&p.runtime)}),!p||!p.storage||!p.runtime||!p.storage.local){console.log("[Pomodoro] API not available, returning");return}console.log("[Pomodoro] Initialization complete, setting up message listener");const C="pomodoro-overlay-root",P={focus:25,shortBreak:5,longBreak:15},et={focus:"Focus Time",shortBreak:"Short Break",longBreak:"Long Break"},t={open:!1,mode:"focus",timeLeft:P.focus*60,totalTime:P.focus*60,running:!1,sessions:0,totalFocusTime:0,settings:{focusTime:P.focus,shortBreakTime:P.shortBreak,longBreakTime:P.longBreak,autoStartTimer:!1,autoStartBreaks:!1,soundNotifications:!0,notificationSound:"chime",soundVolume:.3,customSound:null,repeatSoundUntilClicked:!1,theme:"default",darkMode:!0,dailyGoal:0,showBgIndicator:!0},minimized:!1,previousFocus:null,originalTitle:null,closeTimeoutId:null,openAnimTimeoutId:null,wasDragging:!1,currentTask:null,currentNotes:null,history:[]};let i,ce,Se,me,w,we,Be,Te,Le,F,Ae,Ce,Pe,De,ze,B=[],R,_,G,V,j,H,Y,Me,D,X,z,qe,W,M,$,K,J,Q,Ue,Z,Ne,pe,q,Oe,U,ue,fe,ge,N,ee,te,Fe,Re,_e,ve,oe=null,T=[],Ge,be=[],d=null,Ve=!1,b=null,k=null,E=null,ne=!1,ae={x:0,y:0},xe=!1;const je={chime:[{freq:800,duration:.1},{freq:600,duration:.1},{freq:800,duration:.3}],bell:[{freq:523.25,duration:.5},{freq:659.25,duration:.5},{freq:783.99,duration:.8}],ding:[{freq:1200,duration:.15},{freq:1e3,duration:.15}],alert:[{freq:880,duration:.1},{freq:0,duration:.1},{freq:880,duration:.1},{freq:0,duration:.1},{freq:880,duration:.2}],gentle:[{freq:440,duration:.3},{freq:523.25,duration:.3},{freq:659.25,duration:.4}],upbeat:[{freq:523.25,duration:.1},{freq:659.25,duration:.1},{freq:783.99,duration:.1},{freq:1046.5,duration:.3}]},He={klaxon:[{freq:880,duration:.28},{freq:660,duration:.28},{freq:880,duration:.28},{freq:660,duration:.28}],beep:[{freq:1040,duration:.16},{freq:0,duration:.1},{freq:1040,duration:.16},{freq:0,duration:.1},{freq:1040,duration:.16}],digital:[{freq:1568,duration:.12},{freq:1318,duration:.12},{freq:2093,duration:.28}],chime:[{freq:523.25,duration:.3},{freq:659.25,duration:.3},{freq:783.99,duration:.5}]},Ye=["Min","Sen","Sel","Rab","Kam","Jum","Sab"],Xe={focus:{from:"#ff6b6b",to:"#feca57"},shortBreak:{from:"#48dbfb",to:"#0abde3"},longBreak:{from:"#55efc4",to:"#00b894"}},We={default:{surface:"#1e1814",surfaceStrong:"#2c231c",ink:"#f6eee7",inkSoft:"#d6c3b3",muted:"#b1917b",accent:"#ffb36a",accent2:"#ff8a5b"},sunset:{surface:"#1a1418",surfaceStrong:"#2a1c22",ink:"#f5e6e8",inkSoft:"#d4b8be",muted:"#b18a94",accent:"#ff7b6b",accent2:"#ff5a5b"},ocean:{surface:"#0e1724",surfaceStrong:"#162338",ink:"#e0ecf5",inkSoft:"#a8c4d9",muted:"#6e95b5",accent:"#5bc0eb",accent2:"#3a9fd4"},forest:{surface:"#0f1a12",surfaceStrong:"#1a2e20",ink:"#e2efe5",inkSoft:"#aec9b5",muted:"#76a384",accent:"#7ed957",accent2:"#5ab83a"},midnight:{surface:"#0e0e14",surfaceStrong:"#181826",ink:"#dcdcf0",inkSoft:"#a8a8cc",muted:"#7272a3",accent:"#8870ff",accent2:"#6a4fe0"},lavender:{surface:"#18141e",surfaceStrong:"#261c34",ink:"#e8e0f0",inkSoft:"#c4b4d9",muted:"#9a84b5",accent:"#c084fc",accent2:"#a855f7"}};function l(n,e,o){var a={type:n};if(e)for(var s in e)e.hasOwnProperty(s)&&(a[s]=e[s]);typeof o=="function"?p.runtime.sendMessage(a,o):p.runtime.sendMessage(a).catch(function(){})}function v(n){if(n){if(t.mode=n.mode||"focus",t.timeLeft=n.timeLeft!=null?n.timeLeft:t.timeLeft,t.totalTime=n.totalTime!=null?n.totalTime:t.totalTime,t.running=n.running===!0,t.sessions=n.sessions||0,t.totalFocusTime=n.totalFocusTime||0,n.currentTask!=null&&(t.currentTask=n.currentTask),n.settings)for(var e in n.settings)n.settings.hasOwnProperty(e)&&(t.settings[e]=n.settings[e]);n.minimized!=null&&(t.minimized=n.minimized)}}function $e(){R&&(R.value=t.settings.focusTime),_&&(_.value=t.settings.shortBreakTime),G&&(G.value=t.settings.longBreakTime),V&&(V.checked=t.settings.autoStartTimer),j&&(j.checked=t.settings.autoStartBreaks),H&&(H.checked=t.settings.soundNotifications),D&&(D.checked=!!t.settings.repeatSoundUntilClicked),Y&&(Y.value=t.settings.notificationSound||"chime"),W&&(W.value=(t.settings.soundVolume||.3)*100),M&&(M.textContent=Math.round((t.settings.soundVolume||.3)*100)+"%"),$&&($.value=t.settings.theme||"default"),K&&(K.checked=t.settings.darkMode!==!1),J&&(J.value=t.settings.dailyGoal||0),Q&&(Q.checked=t.settings.showBgIndicator!==!1),X&&(X.value=t.currentTask||"")}function tt(){if(console.log("[Pomodoro] createOverlay called"),document.getElementById(C)){console.log("[Pomodoro] Overlay already exists");return}const n=document.createElement("style");n.textContent=`
      #${C} {
        --pomo-surface: #1e1814;
        --pomo-surface-strong: #2c231c;
        --pomo-surface-soft: rgba(255, 255, 255, 0.05);
        --pomo-line: rgba(255, 229, 200, 0.12);
        --pomo-line-strong: rgba(255, 229, 200, 0.26);
        --pomo-ink: #f6eee7;
        --pomo-ink-soft: #d6c3b3;
        --pomo-muted: #b1917b;
        --pomo-accent: #ffb36a;
        --pomo-accent-2: #ff8a5b;
        --pomo-active-from: #ff6b6b;
        --pomo-active-to: #feca57;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(500px, calc(100vw - 24px));
        max-height: 96vh;
        border: 1px solid var(--pomo-line);
        border-radius: 20px;
        background: var(--pomo-surface);
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.16);
        display: none;
        flex-direction: column;
        z-index: 2147483647;
        font-family: "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-ink);
        color-scheme: dark;
        overflow: hidden;
        transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      #${C}.pomo-opening {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.96);
      }
      #${C}.pomo-closing {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.96);
        pointer-events: none;
      }
      .pomodoro-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid var(--pomo-line);
        cursor: grab;
        user-select: none;
        flex-shrink: 0;
      }
      .pomodoro-header:active { cursor: grabbing; }
      .pomodoro-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .pomodoro-brand-mark {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--pomo-accent), var(--pomo-accent-2));
        box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.04);
        flex-shrink: 0;
      }
      .pomodoro-brand-title {
        font: 700 16px/1 "Aptos Display", "Segoe UI", sans-serif;
        color: var(--pomo-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pomodoro-header-controls {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }
      .pomodoro-header-btn {
        width: 34px;
        height: 34px;
        border: 1px solid var(--pomo-line);
        border-radius: 999px;
        background: var(--pomo-surface-soft);
        color: var(--pomo-ink-soft);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 150ms ease;
      }
      .pomodoro-header-btn:hover {
        border-color: var(--pomo-line-strong);
        background: rgba(255, 255, 255, 0.12);
        color: var(--pomo-ink);
      }
      .pomodoro-content {
        flex: 1;
        padding: 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        overflow-y: auto;
      }
      .timer-modes {
        display: flex;
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        background: var(--pomo-surface-soft);
        width: 100%;
      }
      .timer-mode-btn {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid transparent;
        border-radius: 999px;
        background: transparent;
        color: var(--pomo-muted);
        cursor: pointer;
        font: 700 11px/1 "Aptos Display", "Segoe UI", sans-serif;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        transition: all 140ms ease;
      }
      .timer-mode-btn:hover {
        color: var(--pomo-ink-soft);
        background: rgba(255, 255, 255, 0.04);
      }
      .timer-mode-btn.active {
        border-color: var(--pomo-line-strong);
        background: rgba(255, 255, 255, 0.1);
        color: var(--pomo-ink);
      }
      .timer-display {
        position: relative;
        width: 200px;
        height: 200px;
      }
      .timer-ring {
        transform: rotate(-90deg);
      }
      .timer-ring-bg {
        fill: none;
        stroke: var(--pomo-line);
        stroke-width: 8;
      }
      .timer-ring-progress {
        fill: none;
        stroke: url(#pomoModeGradient);
        stroke-width: 8;
        stroke-linecap: round;
        stroke-dashoffset: 0;
        transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .timer-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }
      .timer-time {
        font-size: 48px;
        font-weight: 800;
        background: linear-gradient(135deg, var(--pomo-active-from), var(--pomo-active-to));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        font-variant-numeric: tabular-nums;
        letter-spacing: -2px;
      }
      .timer-label {
        font: 500 12px/1 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-muted);
        margin-top: 6px;
      }
      .timer-controls {
        display: flex;
        gap: 8px;
        width: 100%;
      }
      .timer-btn-primary {
        flex: 2;
        min-height: 42px;
        padding: 0 16px;
        border: 1px solid transparent;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--pomo-accent), var(--pomo-accent-2));
        color: #ffffff;
        font: 700 13px/1 "Aptos Display", "Segoe UI", sans-serif;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 150ms ease;
      }
      .timer-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(255, 179, 106, 0.3);
      }
      .timer-btn-primary:active { transform: translateY(0); }
      .timer-btn-primary.running {
        background: var(--pomo-surface-soft);
        border-color: var(--pomo-line);
        color: var(--pomo-ink);
      }
      .timer-btn-primary.running:hover {
        border-color: var(--pomo-line-strong);
        background: rgba(255, 255, 255, 0.12);
      }
      .timer-btn-primary kbd {
        font: 600 9px/1 "Aptos Display", "Segoe UI", sans-serif;
        padding: 2px 5px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.15);
        opacity: 0.7;
        margin-left: 2px;
      }
      .timer-btn-primary.running kbd {
        border-color: var(--pomo-line);
        background: var(--pomo-surface-soft);
      }
      .timer-btn-secondary {
        flex: 1;
        min-height: 42px;
        padding: 0 14px;
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        background: var(--pomo-surface-soft);
        color: var(--pomo-ink-soft);
        font: 600 12px/1 "Aptos Display", "Segoe UI", sans-serif;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 150ms ease;
      }
      .timer-btn-secondary:hover {
        border-color: var(--pomo-line-strong);
        background: rgba(255, 255, 255, 0.12);
        color: var(--pomo-ink);
      }
      .timer-btn-secondary:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none !important;
      }
      .timer-btn-secondary kbd {
        font: 600 9px/1 "Aptos Display", "Segoe UI", sans-serif;
        padding: 2px 5px;
        border: 1px solid var(--pomo-line);
        border-radius: 4px;
        background: var(--pomo-surface-soft);
        opacity: 0.6;
      }
      .timer-stats {
        display: flex;
        gap: 8px;
        width: 100%;
      }
      .stat-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        background: var(--pomo-surface-soft);
      }
      .stat-value {
        font: 800 20px/1 "Aptos Display", "Segoe UI", sans-serif;
        color: var(--pomo-accent);
      }
      .stat-label {
        font: 700 10px/1 "Aptos Display", "Segoe UI", sans-serif;
        color: var(--pomo-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .session-dots {
        display: flex;
        gap: 6px;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .session-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1.5px solid var(--pomo-line-strong);
        background: transparent;
        transition: all 200ms ease;
      }
      .session-dot.filled {
        background: var(--pomo-accent);
        border-color: var(--pomo-accent);
        box-shadow: 0 0 6px rgba(255, 179, 106, 0.4);
      }
      .settings-toggle {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        background: transparent;
        color: var(--pomo-muted);
        font: 600 12px/1 "Aptos Display", "Segoe UI", sans-serif;
        cursor: pointer;
        transition: all 140ms ease;
      }
      .settings-toggle:hover {
        border-color: var(--pomo-line-strong);
        color: var(--pomo-ink-soft);
        background: var(--pomo-surface-soft);
      }
      .settings-panel {
        display: none;
        padding: 16px;
        background: var(--pomo-surface-soft);
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        width: 100%;
        gap: 2px;
        box-sizing: border-box;
        max-height: none;
      }
      .settings-panel.open {
        display: flex;
        flex-direction: column;
      }
      .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        box-sizing: border-box;
        padding: 8px 0;
        border-bottom: 1px solid var(--pomo-line);
      }
      .setting-row:last-child { border-bottom: none; }
      .setting-label {
        font: 500 12px/1 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-ink-soft);
        flex: 1;
        min-width: 0;
      }
      .setting-input {
        width: 60px;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid var(--pomo-line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--pomo-ink);
        font: 600 13px/1 "Aptos", "Segoe UI", sans-serif;
        text-align: center;
        transition: border-color 150ms ease;
        flex-shrink: 0;
      }
      .setting-input:focus {
        outline: none;
        border-color: var(--pomo-line-strong);
        box-shadow: 0 0 0 3px rgba(99, 211, 255, 0.12);
      }
      .setting-checkbox {
        width: 16px;
        height: 16px;
        accent-color: var(--pomo-accent);
        cursor: pointer;
        flex-shrink: 0;
      }
      .setting-select {
        min-height: 32px;
        padding: 0 12px;
        border: 1px solid var(--pomo-line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--pomo-ink);
        font: 700 12px/1 "Aptos Display", "Segoe UI", sans-serif;
        cursor: pointer;
        transition: border-color 150ms ease;
        flex-shrink: 0;
      }
      .setting-select:focus {
        outline: none;
        border-color: var(--pomo-line-strong);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
      }
      .setting-select option {
        background: var(--pomo-surface-strong);
        color: var(--pomo-ink);
      }
      .test-sound-btn {
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid var(--pomo-line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--pomo-ink-soft);
        font: 700 11px/1 "Aptos Display", "Segoe UI", sans-serif;
        cursor: pointer;
        transition: all 150ms ease;
        flex-shrink: 0;
      }
      .test-sound-btn:hover {
        border-color: var(--pomo-line-strong);
        background: rgba(255, 255, 255, 0.12);
        color: var(--pomo-ink);
      }
      .resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 24px;
        height: 24px;
        cursor: nwse-resize;
      }
      .resize-handle::after {
        content: "";
        position: absolute;
        bottom: 6px;
        right: 6px;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        background: linear-gradient(135deg, transparent 50%, var(--pomo-muted) 50%);
        opacity: 0.4;
        transition: opacity 140ms ease;
      }
      .resize-handle:hover::after { opacity: 0.7; }
      .minimized .pomodoro-content,
      .minimized .resize-handle { display: none; }
      .minimized .pomodoro-header { border-radius: 20px; border-bottom: none; }
      @keyframes pomoPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .timer-running .timer-time {
        animation: pomoPulse 2s ease-in-out infinite;
      }
      #pomodoro-bg-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 18px;
        border: 1px solid var(--pomo-line, rgba(255, 229, 200, 0.12));
        border-radius: 999px;
        background: var(--pomo-surface, #1e1814);
        color: var(--pomo-ink, #f6eee7);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
        font: 600 13px/1 "Aptos Display", "Segoe UI", sans-serif;
        z-index: 2147483646;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 150ms ease, box-shadow 150ms ease;
        animation: pomoSlideIn 300ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      #pomodoro-bg-indicator:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
      }
      @keyframes pomoSlideIn {
        from { transform: translateY(60px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes pomoSlideOut {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(60px); opacity: 0; }
      }
      .pomo-task-row {
        display: flex;
        gap: 6px;
        width: 100%;
        align-items: center;
      }
      .pomo-task-input {
        flex: 1;
        min-height: 36px;
        padding: 0 12px;
        border: 1px solid var(--pomo-line);
        border-radius: 10px;
        background: var(--pomo-surface-soft);
        color: var(--pomo-ink);
        font: 500 12px/1 "Aptos", "Segoe UI", sans-serif;
        transition: border-color 150ms ease;
      }
      .pomo-task-input:focus {
        outline: none;
        border-color: var(--pomo-line-strong);
      }
      .pomo-distract-btn {
        width: 36px;
        height: 36px;
        border: 1px solid var(--pomo-line);
        border-radius: 999px;
        background: var(--pomo-surface-soft);
        color: var(--pomo-muted);
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 150ms ease;
      }
      .pomo-distract-btn:hover {
        border-color: var(--pomo-line-strong);
        color: var(--pomo-accent);
        background: rgba(255, 179, 106, 0.1);
      }
      .pomo-volume-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
      }
      .pomo-volume-slider {
        flex: 1;
        accent-color: var(--pomo-accent);
        height: 4px;
        cursor: pointer;
      }
      .pomo-volume-value {
        font: 600 11px/1 "Aptos Display", "Segoe UI", sans-serif;
        color: var(--pomo-muted);
        min-width: 36px;
        text-align: right;
      }
      .pomo-stats-panel {
        display: none;
        padding: 16px;
        background: var(--pomo-surface-soft);
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        width: 100%;
        gap: 8px;
        box-sizing: border-box;
        flex-direction: column;
      }
      .pomo-stats-panel.open {
        display: flex;
      }
      .pomo-stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid var(--pomo-line);
      }
      .pomo-stat-row:last-child { border-bottom: none; }
      .pomo-stat-label-sm {
        font: 500 11px/1 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-ink-soft);
      }
      .pomo-stat-value-sm {
        font: 700 11px/1 "Aptos Display", "Segoe UI", sans-serif;
        color: var(--pomo-accent);
      }
      .pomo-custom-sound-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
      }
      .pomo-custom-sound-input {
        font: 500 11px/1 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-ink-soft);
        flex: 1;
      }
      .pomo-notes-textarea {
        width: 100%;
        min-height: 60px;
        padding: 10px;
        border: 1px solid var(--pomo-line);
        border-radius: 10px;
        background: var(--pomo-surface-soft);
        color: var(--pomo-ink);
        font: 500 11px/1.4 "Aptos", "Segoe UI", sans-serif;
        resize: vertical;
        box-sizing: border-box;
        transition: border-color 150ms ease;
      }
      .pomo-notes-textarea:focus {
        outline: none;
        border-color: var(--pomo-line-strong);
      }
      .pomo-alarm-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      .pomo-alarm-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--pomo-line);
        border-radius: 12px;
        background: var(--pomo-surface-soft);
      }
      .pomo-alarm-item.disabled {
        opacity: 0.5;
      }
      .pomo-alarm-toggle {
        width: 34px;
        height: 18px;
        border-radius: 999px;
        border: none;
        background: var(--pomo-line-strong);
        position: relative;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 150ms ease;
      }
      .pomo-alarm-toggle.on {
        background: var(--pomo-accent);
      }
      .pomo-alarm-toggle::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: #fff;
        transition: transform 150ms ease;
      }
      .pomo-alarm-toggle.on::after {
        transform: translateX(16px);
      }
      .pomo-alarm-info {
        flex: 1;
        min-width: 0;
      }
      .pomo-alarm-time {
        font: 800 16px/1 "Aptos Display", "Segoe UI", sans-serif;
        color: var(--pomo-ink);
      }
      .pomo-alarm-meta {
        font: 600 10px/1.3 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-top: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pomo-alarm-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .pomo-alarm-mini-btn {
        width: 28px;
        height: 28px;
        border: 1px solid var(--pomo-line);
        border-radius: 8px;
        background: transparent;
        color: var(--pomo-ink-soft);
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 140ms ease;
      }
      .pomo-alarm-mini-btn:hover {
        border-color: var(--pomo-line-strong);
        background: rgba(255, 255, 255, 0.12);
        color: var(--pomo-ink);
      }
      .pomo-alarm-edit {
        display: none;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        padding: 14px;
        border: 1px solid var(--pomo-line);
        border-radius: 14px;
        background: var(--pomo-surface-soft);
        box-sizing: border-box;
      }
      .pomo-alarm-edit.open {
        display: flex;
      }
      .pomo-alarm-edit-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .pomo-alarm-edit-label {
        font: 500 12px/1 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-ink-soft);
      }
      .pomo-alarm-time-input {
        width: 56px;
        min-height: 32px;
        padding: 0 8px;
        border: 1px solid var(--pomo-line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--pomo-ink);
        font: 600 13px/1 "Aptos", "Segoe UI", sans-serif;
        text-align: center;
      }
      .pomo-alarm-text-input {
        flex: 1;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid var(--pomo-line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--pomo-ink);
        font: 500 12px/1 "Aptos", "Segoe UI", sans-serif;
        min-width: 120px;
      }
      .pomo-alarm-day {
        width: 30px;
        height: 30px;
        border: 1px solid var(--pomo-line);
        border-radius: 8px;
        background: transparent;
        color: var(--pomo-muted);
        cursor: pointer;
        font: 700 10px/1 "Aptos Display", "Segoe UI", sans-serif;
        transition: all 140ms ease;
      }
      .pomo-alarm-day.on {
        border-color: var(--pomo-accent);
        background: rgba(255, 179, 106, 0.16);
        color: var(--pomo-accent);
      }
      .pomo-alarm-edit-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .pomo-alarm-empty {
        font: 500 12px/1.4 "Aptos", "Segoe UI", sans-serif;
        color: var(--pomo-muted);
        text-align: center;
        padding: 12px;
      }
    `,document.head.appendChild(n),i=document.createElement("div"),i.id=C,i.innerHTML=`
      <div class="pomodoro-header">
        <div class="pomodoro-brand">
          <div class="pomodoro-brand-mark"></div>
          <span class="pomodoro-brand-title">Pomodoro</span>
        </div>
        <div class="pomodoro-header-controls">
          <button class="pomodoro-header-btn" id="minimizeBtn" title="Minimize (M)">\u2212</button>
          <button class="pomodoro-header-btn" id="closeBtn" title="Close (Esc)">\u2715</button>
        </div>
      </div>
      <div class="pomodoro-content">
        <div class="timer-modes">
          <button class="timer-mode-btn active" data-mode="focus">Focus</button>
          <button class="timer-mode-btn" data-mode="shortBreak">Short Break</button>
          <button class="timer-mode-btn" data-mode="longBreak">Long Break</button>
        </div>
        <div class="timer-display">
          <svg class="timer-ring" width="200" height="200" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="pomoModeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ff6b6b" />
                <stop offset="100%" style="stop-color:#feca57" />
              </linearGradient>
            </defs>
            <circle class="timer-ring-bg" cx="100" cy="100" r="90" />
            <circle class="timer-ring-progress" id="timerProgress" cx="100" cy="100" r="90" />
          </svg>
          <div class="timer-text">
            <div class="timer-time" id="timerTime">25:00</div>
            <div class="timer-label" id="timerLabel">Focus Time</div>
          </div>
        </div>
        <div class="timer-controls">
          <button class="timer-btn-primary" id="startPauseBtn">
            <span>\u25B6</span> Start <kbd>Space</kbd>
          </button>
          <button class="timer-btn-secondary" id="resetBtn">
            <span>\u21BA</span> Reset <kbd>R</kbd>
          </button>
          <button class="timer-btn-secondary" id="skipBtn">
            <span>\u23ED</span> Skip <kbd>S</kbd>
          </button>
        </div>
        <div class="timer-stats">
          <div class="stat-item">
            <div class="stat-value" id="sessionsCount">0</div>
            <div class="stat-label">Sessions</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" id="totalTime">0m</div>
            <div class="stat-label">Focus Time</div>
          </div>
        </div>
        <div class="session-dots" id="sessionDots"></div>
        <div class="pomo-task-row">
          <input type="text" class="pomo-task-input" id="taskInput" placeholder="What are you working on?">
          <button class="pomo-distract-btn" id="distractionBtn" title="Log distraction">!</button>
        </div>
        <button class="settings-toggle" id="settingsToggle">\u2699 Settings</button>
        <div class="settings-panel" id="settingsPanel">
          <div class="setting-row">
            <span class="setting-label">Focus (min)</span>
            <input type="number" class="setting-input" id="focusTime" value="25" min="1" max="60">
          </div>
          <div class="setting-row">
            <span class="setting-label">Short Break (min)</span>
            <input type="number" class="setting-input" id="shortBreakTime" value="5" min="1" max="30">
          </div>
          <div class="setting-row">
            <span class="setting-label">Long Break (min)</span>
            <input type="number" class="setting-input" id="longBreakTime" value="15" min="1" max="60">
          </div>
          <div class="setting-row">
            <span class="setting-label">Auto-start Timer</span>
            <input type="checkbox" class="setting-checkbox" id="autoStartTimer">
          </div>
          <div class="setting-row">
            <span class="setting-label">Auto-start Breaks</span>
            <input type="checkbox" class="setting-checkbox" id="autoStartBreaks">
          </div>
          <div class="setting-row">
            <span class="setting-label">Sound Notifications</span>
            <input type="checkbox" class="setting-checkbox" id="soundNotifications" checked>
          </div>
          <div class="setting-row">
            <span class="setting-label">Repeat Sound Until Clicked</span>
            <input type="checkbox" class="setting-checkbox" id="repeatSoundUntilClicked">
          </div>
          <div class="setting-row">
            <span class="setting-label">Notification Sound</span>
            <select class="setting-select" id="soundSelect">
              <option value="chime">Chime</option>
              <option value="bell">Bell</option>
              <option value="ding">Ding</option>
              <option value="alert">Alert</option>
              <option value="gentle">Gentle</option>
              <option value="upbeat">Upbeat</option>
            </select>
            <button class="test-sound-btn" id="testSoundBtn">Test</button>
          </div>
          <div class="setting-row">
            <span class="setting-label">Volume</span>
            <div class="pomo-volume-row">
              <input type="range" class="pomo-volume-slider" id="volumeSlider" min="0" max="100" value="30">
              <span class="pomo-volume-value" id="volumeValue">30%</span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Custom Sound</span>
            <div class="pomo-custom-sound-row">
              <input type="file" class="pomo-custom-sound-input" id="customSoundInput" accept="audio/*">
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">Theme</span>
            <select class="setting-select" id="themeSelect">
              <option value="default">Default</option>
              <option value="sunset">Sunset</option>
              <option value="ocean">Ocean</option>
              <option value="forest">Forest</option>
              <option value="midnight">Midnight</option>
              <option value="lavender">Lavender</option>
            </select>
          </div>
          <div class="setting-row">
            <span class="setting-label">Dark Mode</span>
            <input type="checkbox" class="setting-checkbox" id="darkModeToggle" checked>
          </div>
          <div class="setting-row">
            <span class="setting-label">Daily Goal</span>
            <input type="number" class="setting-input" id="dailyGoalInput" value="0" min="0" max="20">
          </div>
          <div class="setting-row">
            <span class="setting-label">Mini Timer (overlay closed)</span>
            <input type="checkbox" class="setting-checkbox" id="showBgIndicatorCheckbox" checked>
          </div>
        </div>
        <textarea class="pomo-notes-textarea" id="notesInput" placeholder="Session notes (optional)..." style="display:none;"></textarea>
        <button class="settings-toggle" id="statsToggle">\u{1F4CA} Stats</button>
        <div class="pomo-stats-panel" id="statsPanel">
          <div class="pomo-stat-row">
            <span class="pomo-stat-label-sm">Today</span>
            <span class="pomo-stat-value-sm" id="statToday">0</span>
          </div>
          <div class="pomo-stat-row">
            <span class="pomo-stat-label-sm">This Week</span>
            <span class="pomo-stat-value-sm" id="statWeek">0</span>
          </div>
          <div class="pomo-stat-row">
            <span class="pomo-stat-label-sm">Total Sessions</span>
            <span class="pomo-stat-value-sm" id="statTotalSessions">0</span>
          </div>
          <div class="pomo-stat-row">
            <span class="pomo-stat-label-sm">Total Focus Time</span>
            <span class="pomo-stat-value-sm" id="statTotalTime">0m</span>
          </div>
          <div class="pomo-stat-row">
            <span class="pomo-stat-label-sm">Daily Goal</span>
            <span class="pomo-stat-value-sm" id="statGoal">0 / 0</span>
          </div>
        </div>
        <button class="settings-toggle" id="alarmsToggle">\u23F0 Alarms</button>
        <div class="pomo-stats-panel" id="alarmsPanel">
          <div class="pomo-alarm-list" id="alarmList"></div>
          <button class="settings-toggle" id="addAlarmBtn">+ Add Alarm</button>
          <div class="pomo-alarm-edit" id="alarmEdit">
            <div class="pomo-alarm-edit-row">
              <input type="text" class="pomo-alarm-text-input" id="alarmLabel" placeholder="Label (optional)">
            </div>
            <div class="pomo-alarm-edit-row">
              <span class="pomo-alarm-edit-label">Time</span>
              <input type="number" class="pomo-alarm-time-input" id="alarmHour" min="1" max="12" value="7">
              <span class="pomo-alarm-edit-label">:</span>
              <input type="number" class="pomo-alarm-time-input" id="alarmMinute" min="0" max="59" value="0">
              <select class="setting-select" id="alarmAmPm">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <div class="pomo-alarm-edit-row" id="alarmDays"></div>
            <div class="pomo-alarm-edit-row">
              <span class="pomo-alarm-edit-label">Sound</span>
              <select class="setting-select" id="alarmSound">
                <option value="klaxon">Klaxon</option>
                <option value="beep">Beep</option>
                <option value="digital">Digital</option>
                <option value="chime">Chime</option>
              </select>
            </div>
            <div class="pomo-alarm-edit-row">
              <span class="pomo-alarm-edit-label">Volume</span>
              <input type="range" class="pomo-volume-slider" id="alarmVolume" min="0" max="100" value="70" style="flex:1;">
              <button class="test-sound-btn" id="alarmTestBtn">Test</button>
            </div>
            <div class="pomo-alarm-edit-actions">
              <button class="timer-btn-secondary" id="alarmCancelBtn">Cancel</button>
              <button class="timer-btn-primary" id="alarmSaveBtn" style="flex:1;">Save</button>
            </div>
          </div>
        </div>
      </div>
      <div class="resize-handle" id="resizeHandle"></div>
    `,document.body.appendChild(i),ce=document.getElementById("timerTime"),Se=document.getElementById("timerLabel"),me=document.getElementById("timerProgress"),w=document.getElementById("startPauseBtn"),we=document.getElementById("resetBtn"),Be=document.getElementById("skipBtn"),Te=document.getElementById("sessionsCount"),Le=document.getElementById("totalTime"),F=document.getElementById("sessionDots"),Ae=document.getElementById("minimizeBtn"),Ce=document.getElementById("closeBtn"),Pe=document.getElementById("settingsToggle"),De=document.getElementById("settingsPanel"),ze=document.getElementById("resizeHandle"),B=document.querySelectorAll(".timer-mode-btn"),R=document.getElementById("focusTime"),_=document.getElementById("shortBreakTime"),G=document.getElementById("longBreakTime"),V=document.getElementById("autoStartTimer"),j=document.getElementById("autoStartBreaks"),H=document.getElementById("soundNotifications"),D=document.getElementById("repeatSoundUntilClicked"),Y=document.getElementById("soundSelect"),Me=document.getElementById("testSoundBtn"),X=document.getElementById("taskInput"),z=document.getElementById("notesInput"),qe=document.getElementById("distractionBtn"),W=document.getElementById("volumeSlider"),M=document.getElementById("volumeValue"),$=document.getElementById("themeSelect"),K=document.getElementById("darkModeToggle"),J=document.getElementById("dailyGoalInput"),Ue=document.getElementById("statsToggle"),Z=document.getElementById("statsPanel"),Ne=document.getElementById("alarmsToggle"),pe=document.getElementById("alarmsPanel"),q=document.getElementById("alarmList"),Oe=document.getElementById("addAlarmBtn"),U=document.getElementById("alarmEdit"),ue=document.getElementById("alarmLabel"),fe=document.getElementById("alarmHour"),ge=document.getElementById("alarmMinute"),N=document.getElementById("alarmDays"),ee=document.getElementById("alarmSound"),te=document.getElementById("alarmVolume"),ve=document.getElementById("alarmAmPm"),Fe=document.getElementById("alarmTestBtn"),Re=document.getElementById("alarmCancelBtn"),_e=document.getElementById("alarmSaveBtn"),Ge=document.getElementById("customSoundInput"),Q=document.getElementById("showBgIndicatorCheckbox"),Ve||(ot(),Ve=!0)}function ot(){w.addEventListener("click",function(){var e=t.running?"pomodoro-pause":"pomodoro-start";l(e,null,function(o){if(o&&o.state){var a=t.running;v(o.state),u(),t.running&&!a?(d||I(),L()):!t.running&&a&&le()}})}),we.addEventListener("click",function(){l("pomodoro-reset",null,function(e){e&&e.state&&(v(e.state),u())})}),Be.addEventListener("click",function(){l("pomodoro-skip",null,function(e){e&&e.state&&(v(e.state),u(),Qe())})}),Ae.addEventListener("click",function(){t.minimized=!t.minimized,i.classList.toggle("minimized",t.minimized),l("pomodoro-update-settings",{settings:{minimized:t.minimized}})}),Ce.addEventListener("click",se),Pe.addEventListener("click",function(){De.classList.toggle("open")}),Ue.addEventListener("click",function(){Z.classList.toggle("open"),Z.classList.contains("open")&&dt()}),Ne.addEventListener("click",function(){pe.classList.toggle("open"),pe.classList.contains("open")&&O()}),(function(){if(N){N.textContent="";for(var o=0;o<7;o++)(function(a){var s=document.createElement("button");s.type="button",s.className="pomo-alarm-day",s.textContent=Ye[a],s.dataset.day=String(a),s.addEventListener("click",function(){var r=T.indexOf(a);r===-1?(T.push(a),s.classList.add("on")):(T.splice(r,1),s.classList.remove("on"))}),N.appendChild(s)})(o)}})(),Oe.addEventListener("click",function(){Je(null)}),_e.addEventListener("click",function(){lt()}),Re.addEventListener("click",function(){ye()}),Fe.addEventListener("click",function(){d||I(),Ke(ee.value,parseInt(te.value,10)/100)}),B.forEach(function(e){e.addEventListener("click",function(){l("pomodoro-switch-mode",{mode:e.dataset.mode},function(o){o&&o.state&&(v(o.state),u(),B.forEach(function(a){a.classList.toggle("active",a.dataset.mode===t.mode)}))})})}),R.addEventListener("change",function(e){var o=parseInt(e.target.value);o>=1&&o<=60&&(t.settings.focusTime=o,l("pomodoro-update-settings",{settings:{focusTime:o}}),t.mode==="focus"&&!t.running&&(t.totalTime=o*60,t.timeLeft=o*60,u()))}),_.addEventListener("change",function(e){var o=parseInt(e.target.value);o>=1&&o<=30&&(t.settings.shortBreakTime=o,l("pomodoro-update-settings",{settings:{shortBreakTime:o}}),t.mode==="shortBreak"&&!t.running&&(t.totalTime=o*60,t.timeLeft=o*60,u()))}),G.addEventListener("change",function(e){var o=parseInt(e.target.value);o>=1&&o<=60&&(t.settings.longBreakTime=o,l("pomodoro-update-settings",{settings:{longBreakTime:o}}),t.mode==="longBreak"&&!t.running&&(t.totalTime=o*60,t.timeLeft=o*60,u()))}),V.addEventListener("change",function(e){t.settings.autoStartTimer=e.target.checked,l("pomodoro-update-settings",{settings:{autoStartTimer:e.target.checked}})}),j.addEventListener("change",function(e){t.settings.autoStartBreaks=e.target.checked,l("pomodoro-update-settings",{settings:{autoStartBreaks:e.target.checked}})}),H.addEventListener("change",function(e){t.settings.soundNotifications=e.target.checked,l("pomodoro-update-settings",{settings:{soundNotifications:e.target.checked}}),e.target.checked&&!d&&I()}),D&&D.addEventListener("change",function(e){t.settings.repeatSoundUntilClicked=e.target.checked,l("pomodoro-update-settings",{settings:{repeatSoundUntilClicked:e.target.checked}})}),Y.addEventListener("change",function(e){t.settings.notificationSound=e.target.value,l("pomodoro-update-settings",{settings:{notificationSound:e.target.value}})}),Me.addEventListener("click",function(){d||I(),he()}),W.addEventListener("input",function(e){var o=parseInt(e.target.value)/100;t.settings.soundVolume=o,M&&(M.textContent=Math.round(o*100)+"%"),l("pomodoro-update-settings",{settings:{soundVolume:o}})}),$.addEventListener("change",function(e){t.settings.theme=e.target.value,ie(e.target.value),l("pomodoro-update-settings",{settings:{theme:e.target.value}})}),K.addEventListener("change",function(e){t.settings.darkMode=e.target.checked,ie(t.settings.theme),l("pomodoro-update-settings",{settings:{darkMode:e.target.checked}})}),J.addEventListener("change",function(e){var o=parseInt(e.target.value);o>=0&&o<=20&&(t.settings.dailyGoal=o,l("pomodoro-update-settings",{settings:{dailyGoal:o}}))}),Q.addEventListener("change",function(e){t.settings.showBgIndicator=e.target.checked,l("pomodoro-update-settings",{settings:{showBgIndicator:e.target.checked}}),e.target.checked?t.running&&!t.open&&L():le()}),X.addEventListener("change",function(e){t.currentTask=e.target.value||null,l("pomodoro-update-task",{task:t.currentTask})}),z.addEventListener("change",function(e){t.currentNotes=e.target.value||null,l("pomodoro-update-notes",{notes:t.currentNotes})}),qe.addEventListener("click",function(){var e=prompt("What distracted you?");e!==null&&l("pomodoro-add-distraction",{note:e||""})}),Ge.addEventListener("change",function(e){var o=e.target.files[0];if(o){var a=new FileReader;a.onload=function(s){t.settings.customSound=s.target.result,l("pomodoro-update-settings",{settings:{customSound:s.target.result}})},a.readAsDataURL(o)}}),document.querySelector(".pomodoro-header").addEventListener("mousedown",function(e){if(!e.target.closest(".pomodoro-header-controls")){e.stopPropagation(),ne=!0,t.wasDragging=!1;var o=i.getBoundingClientRect();ae.x=e.clientX-o.left,ae.y=e.clientY-o.top,i.style.transform="none",i.style.left=o.left+"px",i.style.top=o.top+"px"}}),ze.addEventListener("mousedown",function(e){xe=!0,e.preventDefault()})}function I(){try{d=new(window.AudioContext||window.webkitAudioContext)}catch(n){console.error("[Pomodoro] Failed to initialize audio context:",n)}}function he(){if(t.settings.soundNotifications&&(d||I(),!!d)){var n=je[t.settings.notificationSound]||je.chime;try{d.state==="suspended"&&d.resume().catch(function(){});var e=d.currentTime;n.forEach(function(o){if(o.freq===0){e+=o.duration;return}var a=d.createOscillator(),s=d.createGain();a.connect(s),s.connect(d.destination),a.frequency.setValueAtTime(o.freq,e),a.type="sine";var r=t.settings.soundVolume!=null?t.settings.soundVolume:.3;s.gain.setValueAtTime(r,e),s.gain.exponentialRampToValueAtTime(.01,e+o.duration),a.start(e),a.stop(e+o.duration),e+=o.duration})}catch(o){console.error("[Pomodoro] Failed to play sound:",o)}}}function Ke(n,e){if(d||I(),!!d){var o=He[n]||He.klaxon;try{d.state==="suspended"&&d.resume().catch(function(){});var a=d.currentTime,s=Math.max(.05,Math.min(1,e??.7));o.forEach(function(r){if(r.freq===0){a+=r.duration;return}var m=d.createOscillator(),c=d.createGain();m.connect(c),c.connect(d.destination),m.frequency.setValueAtTime(r.freq,a),m.type="square",c.gain.setValueAtTime(s,a),c.gain.exponentialRampToValueAtTime(.001,a+r.duration),m.start(a),m.stop(a+r.duration),a+=r.duration})}catch(r){console.error("[Pomodoro] Failed to play alarm sound:",r)}}}function nt(n,e){var o=n<12?"AM":"PM",a=n%12;a===0&&(a=12);var s=String(a),r=String(e).padStart(2,"0");return s+":"+r+" "+o}function at(n){var e=n<12?"AM":"PM",o=n%12;return o===0&&(o=12),{hour12:o,ampm:e}}function it(n,e){return n=parseInt(n,10),isNaN(n)&&(n=12),n=Math.max(1,Math.min(12,n)),e==="PM"?n===12?12:n+12:n===12?0:n}function rt(n){if(!n.days||!n.days.length||n.days.length===7)return"Every day";var e=n.days.slice().sort(function(o,a){return o-a});return e.map(function(o){return Ye[o]}).join(" ")}function O(){l("alarm-clock-get-all",null,function(n){n&&Array.isArray(n.alarms)&&st(n.alarms)})}function st(n){if(q){if(q.textContent="",!n.length){var e=document.createElement("div");e.className="pomo-alarm-empty",e.textContent='No alarms yet. Click "+ Add Alarm" to create one.',q.appendChild(e);return}n.slice().sort(function(o,a){return o.hour*60+o.minute-(a.hour*60+a.minute)}).forEach(function(o){var a=document.createElement("div");a.className="pomo-alarm-item"+(o.enabled?"":" disabled");var s=document.createElement("button");s.className="pomo-alarm-toggle"+(o.enabled?" on":""),s.title=o.enabled?"Disable":"Enable",s.addEventListener("click",function(){l("alarm-clock-toggle",{id:o.id},function(){O()})});var r=document.createElement("div");r.className="pomo-alarm-info";var m=document.createElement("div");m.className="pomo-alarm-time",m.textContent=nt(o.hour,o.minute);var c=document.createElement("div");c.className="pomo-alarm-meta",c.textContent=(o.label?o.label+" \xB7 ":"")+rt(o),r.appendChild(m),r.appendChild(c);var f=document.createElement("div");f.className="pomo-alarm-actions";var g=document.createElement("button");g.className="pomo-alarm-mini-btn",g.title="Edit",g.textContent="\u270E",g.addEventListener("click",function(){Je(o)});var x=document.createElement("button");x.className="pomo-alarm-mini-btn",x.title="Delete",x.textContent="\u{1F5D1}",x.addEventListener("click",function(){l("alarm-clock-delete",{id:o.id},function(){O()})}),f.appendChild(g),f.appendChild(x),a.appendChild(s),a.appendChild(r),a.appendChild(f),q.appendChild(a)})}}function Je(n){if(U){oe=n?n.id:null,ue.value=n&&n.label?n.label:"",ge.value=n?n.minute:0,T=n&&n.days?n.days.slice():[],ee.value=n&&n.sound?n.sound:"klaxon",te.value=n&&typeof n.volume=="number"?Math.round(n.volume*100):70;var e=at(n?n.hour:7);fe.value=e.hour12,ve.value=e.ampm;var o=N.querySelectorAll(".pomo-alarm-day");o.forEach(function(a){a.classList.toggle("on",T.indexOf(parseInt(a.dataset.day,10))!==-1)}),U.classList.add("open")}}function ye(){U&&U.classList.remove("open"),oe=null}function lt(){var n=parseInt(ge.value,10);isNaN(n)&&(n=0),n=Math.max(0,Math.min(59,n));var e=it(fe.value,ve.value),o={label:ue.value.trim(),hour:e,minute:n,days:T.slice(),sound:ee.value,volume:parseInt(te.value,10)/100};oe?(o.id=oe,l("alarm-clock-update",{alarm:o},function(){ye(),O()})):l("alarm-clock-add",{alarm:o},function(){ye(),O()})}function ie(n){if(i){var e=We[n]||We.default,o=t.settings.darkMode!==!1;o||(e={surface:"#f5f0eb",surfaceStrong:"#ede5dc",ink:"#1a1410",inkSoft:"#4a3f38",muted:"#8a7a6e",accent:"#e8965a",accent2:"#d97a45"}),i.style.setProperty("--pomo-surface",e.surface),i.style.setProperty("--pomo-surface-strong",e.surfaceStrong),i.style.setProperty("--pomo-ink",e.ink),i.style.setProperty("--pomo-ink-soft",e.inkSoft),i.style.setProperty("--pomo-muted",e.muted),i.style.setProperty("--pomo-accent",e.accent),i.style.setProperty("--pomo-accent-2",e.accent2)}}function Qe(){z&&(z.style.display="block",z.focus())}function dt(){l("pomodoro-get-history",null,function(n){n&&n.history&&(be=n.history,ct())})}function ct(){if(Z){var n=new Date().toISOString().slice(0,10),e=0,o=0,a=0,s=new Date,r=new Date(s);r.setDate(r.getDate()-r.getDay());for(var m=r.toISOString().slice(0,10),c=0;c<be.length;c++){var f=be[c];if(!(!f.completed||f.mode!=="focus")){var g=f.date?f.date.slice(0,10):"";g===n&&e++,g>=m&&g<=n&&o++,a+=Math.floor((f.duration||0)/60)}}var x=document.getElementById("statToday"),A=document.getElementById("statWeek"),S=document.getElementById("statTotalSessions"),h=document.getElementById("statTotalTime"),de=document.getElementById("statGoal");if(x&&(x.textContent=e+" pomodoro"+(e!==1?"s":"")),A&&(A.textContent=o+" pomodoro"+(o!==1?"s":"")),S&&(S.textContent=t.sessions),h&&(h.textContent=Ze(Math.round(a))),de){var y=t.settings.dailyGoal||0;de.textContent=e+" / "+y+(y>0?" ("+(e>=y?"Done!":Math.round(e/y*100)+"%)"):"")}}}function ke(n,e,o){o||(o="success"),E&&(clearInterval(E),E=null),k&&(clearTimeout(k),k=null);var a=document.getElementById("pomodoro-notification");a&&a.remove();var s=!!t.settings.repeatSoundUntilClicked&&!!t.settings.soundNotifications;s&&(E=setInterval(function(){he()},4e3));var r=document.createElement("div");r.id="pomodoro-notification";var m=o==="success"?"linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)":"linear-gradient(135deg, #48dbfb 0%, #0abde3 100%)",c=o==="success"?"\u{1F389}":"\u2615";r.style.cssText=["position: fixed; top: 30px; right: 30px;","background: "+m+"; color: white;","padding: 20px 25px; border-radius: 16px;","font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;","z-index: 2147483648;","box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);","display: flex; align-items: flex-start; gap: 15px;","min-width: 300px; max-width: 400px;","animation: slideInRight 0.5s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer;"].join(" ");var f=document.createElement("div");f.style.cssText="font-size:32px;line-height:1;",f.textContent=c;var g=document.createElement("div");g.style.cssText="flex:1;";var x=document.createElement("div");x.style.cssText="font-size:18px;font-weight:700;margin-bottom:6px;",x.textContent=n;var A=document.createElement("div");A.style.cssText="font-size:14px;opacity:0.9;",A.textContent=e,g.appendChild(x),g.appendChild(A);var S=document.createElement("button");S.className="close-btn",S.style.cssText="background:rgba(255,255,255,0.2);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;",S.textContent="\u2715",r.appendChild(f),r.appendChild(g),r.appendChild(S);var h=document.getElementById("pomodoro-notif-style");h||(h=document.createElement("style"),h.id="pomodoro-notif-style",h.textContent=["@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }","@keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }","#pomodoro-notification:hover { transform: translateY(-2px); box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4); }","#pomodoro-notification .close-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }"].join(" "),document.head.appendChild(h));var de=r.querySelector(".close-btn");de.addEventListener("click",function(Ie){Ie.stopPropagation(),y()}),r.addEventListener("click",function(Ie){Ie.stopPropagation(),y(),Ee()}),document.body.appendChild(r),s||(k=setTimeout(y,8e3));function y(){E&&(clearInterval(E),E=null),k&&(clearTimeout(k),k=null),r.parentNode&&(r.style.animation="slideOutRight 0.5s cubic-bezier(0.4, 0, 0.2, 1)",setTimeout(function(){r.parentNode&&r.remove()},500))}}function re(n){var e=Math.floor(n/60),o=n%60;return(e<10?"0":"")+e+":"+(o<10?"0":"")+o}function Ze(n){if(n<60)return n+"m";var e=Math.floor(n/60),o=n%60;return e+"h "+o+"m"}function u(){if(!(!ce||!i)){ce.textContent=re(t.timeLeft),Se.textContent=et[t.mode];var n=Xe[t.mode]||Xe.focus;i.style.setProperty("--pomo-active-from",n.from),i.style.setProperty("--pomo-active-to",n.to),ie(t.settings.theme||"default");var e=document.querySelectorAll("#pomoModeGradient stop");e.length>=2&&(e[0].style.stopColor=n.from,e[1].style.stopColor=n.to);var o=2*Math.PI*90,a=t.totalTime>0?t.timeLeft/t.totalTime:1;me.style.strokeDasharray=o,me.style.strokeDashoffset=o*(1-a),Te.textContent=t.sessions,Le.textContent=Ze(t.totalFocusTime),t.running?(i.classList.add("timer-running"),w.innerHTML="<span>\u23F8</span> Pause <kbd>Space</kbd>",w.classList.add("running")):(i.classList.remove("timer-running"),w.innerHTML="<span>\u25B6</span> Start <kbd>Space</kbd>",w.classList.remove("running")),mt(),t.running&&t.timeLeft>0?(t.originalTitle||(t.originalTitle=document.title),document.title="["+re(t.timeLeft)+"] "+t.originalTitle):t.originalTitle&&(document.title=t.originalTitle)}}function mt(){if(F){var n=t.sessions%4;F.textContent="";for(var e=0;e<4;e++){var o=document.createElement("span");o.className="session-dot"+(e<n?" filled":""),F.appendChild(o)}}}function Ee(){if(console.log("[Pomodoro] toggle() called, state.open:",t.open),t.open)return console.log("[Pomodoro] Closing overlay"),se(),!1;var n=document.getElementById("pomodoro-bg-indicator");n&&n.remove(),b&&(clearInterval(b),b=null),console.log("[Pomodoro] Creating overlay"),tt(),t.open=!0,console.log("[Pomodoro] Overlay created, state.open set to true"),t.closeTimeoutId&&(clearTimeout(t.closeTimeoutId),t.closeTimeoutId=null),t.openAnimTimeoutId&&(clearTimeout(t.openAnimTimeoutId),t.openAnimTimeoutId=null),i.style.display="flex",i.classList.remove("pomo-closing"),i.classList.add("pomo-opening"),t.previousFocus||(t.previousFocus=document.activeElement),l("pomodoro-subscribe",null,function(o){o&&o.state&&(v(o.state),u(),$e(),ie(t.settings.theme||"default"),t.minimized?i.classList.add("minimized"):i.classList.remove("minimized"),t.running&&(t.originalTitle||(t.originalTitle=document.title)))});var e=function(){i&&i.classList.remove("pomo-opening")};return requestAnimationFrame(function(){requestAnimationFrame(e)}),t.openAnimTimeoutId=setTimeout(e,100),!0}function se(){!t.open||!i||(t.open=!1,i.classList.add("pomo-closing"),t.originalTitle&&(document.title=t.originalTitle,t.originalTitle=null),t.closeTimeoutId&&clearTimeout(t.closeTimeoutId),t.openAnimTimeoutId&&(clearTimeout(t.openAnimTimeoutId),t.openAnimTimeoutId=null),t.closeTimeoutId=setTimeout(function(){i&&(i.style.display="none",i.classList.remove("pomo-closing")),t.closeTimeoutId=null},250),t.running?L():l("pomodoro-unsubscribe"),t.previousFocus&&(t.previousFocus.focus(),t.previousFocus=null))}function L(){if(t.settings.showBgIndicator!==!1){var n=document.getElementById("pomodoro-bg-indicator");n&&n.remove(),b&&(clearInterval(b),b=null);var e=document.createElement("div");e.id="pomodoro-bg-indicator";var o=document.createElement("span");o.textContent="\u{1F345}";var a=document.createElement("span");a.id="bg-timer-time",a.textContent=re(t.timeLeft),e.appendChild(o),e.appendChild(a),e.addEventListener("click",function(){Ee()}),document.body.appendChild(e),b=setInterval(function(){var s=document.getElementById("pomodoro-bg-indicator"),r=document.getElementById("bg-timer-time");if(!s||!r||!t.running){clearInterval(b),b=null,s&&s.remove();return}r.textContent=re(t.timeLeft)},1e3)}}function le(){var n=document.getElementById("pomodoro-bg-indicator");n&&n.remove(),b&&(clearInterval(b),b=null)}document.addEventListener("mousemove",function(n){!ne||!i||(t.wasDragging=!0,i.style.left=n.clientX-ae.x+"px",i.style.top=n.clientY-ae.y+"px")}),document.addEventListener("mouseup",function(){ne&&(t.wasDragging=!0),ne=!1,i&&(i.style.transform="",i.style.left="",i.style.top="")}),document.addEventListener("mousemove",function(n){if(!(!xe||!i)){var e=i.getBoundingClientRect(),o=n.clientX-e.left,a=n.clientY-e.top;o>=300&&(i.style.width=o+"px"),a>=400&&(i.style.height=a+"px")}}),document.addEventListener("mouseup",function(){xe=!1}),document.addEventListener("keydown",function(n){if(n.key==="Escape"&&t.open){se();return}if(t.open&&!(n.target.tagName==="INPUT"||n.target.tagName==="SELECT"||n.target.tagName==="TEXTAREA"))switch(n.key){case" ":n.preventDefault();var e=t.running?"pomodoro-pause":"pomodoro-start";l(e,null,function(o){if(o&&o.state){var a=t.running;v(o.state),u(),t.running&&!a?(d||I(),L()):!t.running&&a&&le()}});break;case"r":case"R":l("pomodoro-reset",null,function(o){o&&o.state&&(v(o.state),u())});break;case"s":case"S":l("pomodoro-skip",null,function(o){o&&o.state&&(v(o.state),u(),Qe())});break;case"1":l("pomodoro-switch-mode",{mode:"focus"},function(o){o&&o.state&&(v(o.state),u(),B.forEach(function(a){a.classList.toggle("active",a.dataset.mode==="focus")}))});break;case"2":l("pomodoro-switch-mode",{mode:"shortBreak"},function(o){o&&o.state&&(v(o.state),u(),B.forEach(function(a){a.classList.toggle("active",a.dataset.mode==="shortBreak")}))});break;case"3":l("pomodoro-switch-mode",{mode:"longBreak"},function(o){o&&o.state&&(v(o.state),u(),B.forEach(function(a){a.classList.toggle("active",a.dataset.mode==="longBreak")}))});break;case"m":case"M":t.minimized=!t.minimized,i.classList.toggle("minimized",t.minimized),l("pomodoro-update-settings",{settings:{minimized:t.minimized}});break}}),document.addEventListener("click",function(n){if(!(!t.open||!i)&&!i.contains(n.target)){if(t.wasDragging){t.wasDragging=!1;return}se()}}),p.runtime.onMessage.addListener(function(e,o,a){if(!e||typeof e!="object")return!1;if(e.type==="toggle-pomodoro-overlay")try{var s=Ee();return a({ok:s}),!0}catch(c){return console.error("[Pomodoro] Toggle error:",c),a({ok:!1,error:String(c)}),!0}if(e.type==="alarm-clock-fire"){if(!document.hasFocus())return!1;var r=e.alarm||{};return ke(r.label?"\u23F0 "+r.label:"Alarm","Waktu alarm telah tiba.","success"),Ke(r.sound,r.volume),!1}if(e.type==="pomodoro-state"){if(e.state){var m=t.running;v(e.state),t.open&&(u(),$e()),t.running&&!m?L():!t.running&&m&&le(),(e.completed==="focus"||e.completed==="break")&&(he(),e.completed==="focus"?ke("Pomodoro Complete!","Great job! Time for a well-deserved break.","success"):ke("Break Complete!","Ready to get back to work?","break"))}return!1}return!1}),l("pomodoro-subscribe",null,function(n){n&&n.state&&(v(n.state),t.running&&L())})})();
