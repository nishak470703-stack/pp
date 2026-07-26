(function () {
  if (typeof window === "undefined") return;

  window.LPJarvisMarkdown = {
    render: function (text) {
      if (!text) return "";
      var html = text
        .replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
          lang = lang || "";
          return '<pre><code class="lang-' + lang + '">' + code + '</code></pre>';
        })
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/^- (.+)$/gm, '<li class="ul-item">$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li class="ol-item">$1</li>');
      html = html.replace(/(<li class="ul-item">.*<\/li>\n?)+/g, function (m) {
        return '<ul>' + m.replace(/ class="ul-item"/g, '').replace(/\n$/, '') + '</ul>';
      });
      html = html.replace(/(<li class="ol-item">.*<\/li>\n?)+/g, function (m) {
        return '<ol>' + m.replace(/ class="ol-item"/g, '').replace(/\n$/, '') + '</ol>';
      });
      return html;
    },

    addCodeCopyButtons: function (container) {
      if (!container) return;
      var pres = container.querySelectorAll("pre");
      pres.forEach(function (pre) {
        if (pre.querySelector(".lp-jarvis-code-copy")) return;
        var btn = document.createElement("button");
        btn.textContent = "\uD83D\uDCCB Salin";
        btn.className = "lp-jarvis-code-copy";
        btn.addEventListener("click", function () {
          var code = pre.querySelector("code");
          var txt = code ? code.textContent : pre.textContent;
          (navigator.clipboard ? navigator.clipboard.writeText(txt).catch(function(){}) : Promise.resolve())
            .then(function () {
              btn.textContent = "\u2705 Disalin";
              setTimeout(function () { btn.textContent = "\uD83D\uDCCB Salin"; }, 2000);
            });
        });
        pre.style.position = "relative";
        pre.appendChild(btn);
      });
    }
  };
})();
