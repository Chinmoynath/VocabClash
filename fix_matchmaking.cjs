const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(
`      if (isMatchmaking || matchState) {
        if (window.confirm("Abandon current battle?")) {
           if (isMatchmaking) {
             handleCancelMatchmaking();
           } else if (matchState?.roomId) {
             forfeitLiveRoom(matchState.roomId, player.id);
             setMatchState(null);
           }
        }
        return;
      }`,
`      if (isMatchmaking || matchState) {
        if (window.confirm("Abandon current battle?")) {
           if (isMatchmaking) {
             setIsMatchmaking(false);
           } else if (matchState) {
             if (matchState.realRoomId) {
               forfeitLiveRoom(matchState.realRoomId, player.id);
             }
             setMatchState(null);
           }
        }
        return;
      }`);
fs.writeFileSync('src/App.tsx', content);
