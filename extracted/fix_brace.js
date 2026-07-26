const fs = require('fs');
let c = fs.readFileSync('jarvisSidebar.js', 'utf8');

// The string we want to replace
let target1 = '} catch (e) {}\r\n      }\r\n      addBubble("jarvis"';
let replacement1 = '} catch (e) {}\r\n      addBubble("jarvis"';

let target2 = '} catch (e) {}\n      }\n      addBubble("jarvis"';
let replacement2 = '} catch (e) {}\n      addBubble("jarvis"';

if (c.indexOf(target1) !== -1) {
  c = c.replace(target1, replacement1);
  console.log('Replaced \\r\\n!');
} else if (c.indexOf(target2) !== -1) {
  c = c.replace(target2, replacement2);
  console.log('Replaced \\n!');
} else {
  console.log('Not found!');
}

fs.writeFileSync('jarvisSidebar.js', c);
