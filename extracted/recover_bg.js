const fs = require('fs');
let content = fs.readFileSync('c:/Users/L/Desktop/e2dbecab6b534d638039-2.7.3/background.js', 'utf8');

const badAnchor = `              var th = Math.max(1, Math.round(h * scale));
              var cnv = document.createElement("canvas");
              cnv.width = tw; cnv.height = th;
              if (message.type === "jarvis-capture-screenshot") {`;

const goodText = `              var th = Math.max(1, Math.round(h * scale));
              var cnv = document.createElement("canvas");
              cnv.width = tw; cnv.height = th;
              var ctx = cnv.getContext("2d");
              ctx.drawImage(img, 0, 0, tw, th);
              var out = cnv.toDataURL("image/jpeg", quality);
              // If JPEG didn't actually shrink it, keep the original.
              if (!out || out.length >= dataUrl.length) out = dataUrl;
              resolve(out);
            } catch (e) { resolve(dataUrl); }
          };
          img.onerror = function () { resolve(dataUrl); };
          img.src = dataUrl;
        } catch (e) { resolve(dataUrl); }
      });
    }

    if (message.type === "jarvis-capture-screenshot") {`;

if (content.includes(badAnchor)) {
    content = content.replace(badAnchor, goodText);
    fs.writeFileSync('c:/Users/L/Desktop/e2dbecab6b534d638039-2.7.3/background.js', content);
    console.log("Restored background.js successfully");
} else {
    console.log("badAnchor not found");
}
