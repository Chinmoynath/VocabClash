const fs = require('fs');
let content = fs.readFileSync('capacitor.config.ts', 'utf-8');
content = content.replace(
`    StatusBar: {
      style: 'DARK',
      backgroundColor: "#0f172a"
    }
  }`,
`    StatusBar: {
      style: 'DARK',
      backgroundColor: "#0f172a"
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true
    }
  }`);
fs.writeFileSync('capacitor.config.ts', content);
