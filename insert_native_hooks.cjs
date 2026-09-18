const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const hooks = `
  // --- NATIVE ANDROID POLISH ---
  useEffect(() => {
    if (!isNativeCapacitor()) return;

    // 1. Hide Splash Screen cleanly
    SplashScreen.hide().catch(() => {});

    // 2. Set Status Bar to Dark Mode
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNativeCapacitor()) return;

    let backListener = null;
    CapacitorApp.addListener('backButton', () => {
      // Modals
      if (showAiModal) { setShowAiModal(false); return; }
      if (showProfileModal) { setShowProfileModal(false); return; }
      if (showEditProfileModal) { setShowEditProfileModal(false); return; }
      if (showPremiumModal) { setShowPremiumModal(false); return; }
      if (showAdModal) { setShowAdModal(false); return; }
      if (showStreakModal) { setShowStreakModal(false); return; }
      if (showStatsModal) { setShowStatsModal(false); return; }
      if (showAppGuideModal) { setShowAppGuideModal(false); return; }
      if (showTourModal) { setShowTourModal(false); return; }
      if (showPlayModeModal) { setShowPlayModeModal(false); return; }
      if (showFriendLobbyModal) { setShowFriendLobbyModal(false); return; }
      if (showOfflineWarningModal) { setShowOfflineWarningModal(false); return; }
      if (showSeoGuidesModal) { setShowSeoGuidesModal(false); return; }
      if (showDueRevisionModal) { setShowDueRevisionModal(false); return; }
      if (showAdminArticles) { setShowAdminArticles(false); return; }
      if (showAdminImporter) { setShowAdminImporter(false); return; }
      if (showBattleAnalytics) { setShowBattleAnalytics(false); return; }
      if (showSscTop100CompletionModal) { setShowSscTop100CompletionModal(false); return; }

      // Subscreens
      if (activeAiQuestion) { setActiveAiQuestion(null); return; }
      if (activeArticleSlug) { setActiveArticleSlug(null); return; }
      if (activeSeoSlug) { setActiveSeoSlug(null); return; }
      if (isViewingArticlesIndex) { setIsViewingArticlesIndex(false); return; }

      // Active Drill
      if (practiceCustomQueue || activeSscTop100Category) {
        setPracticeCustomQueue(null);
        setActiveSscTop100Category(null);
        setPracticeModeBannerTitle(null);
        return;
      }

      // 1v1 Match
      if (isMatchmaking || matchState) {
        if (window.confirm("Abandon current battle?")) {
           if (isMatchmaking) {
             handleCancelMatchmaking();
           } else if (matchState?.roomId) {
             forfeitLiveRoom(matchState.roomId, player.id);
             setMatchState(null);
           }
        }
        return;
      }

      // Root tabs navigation
      if (currentTab !== 'arena') {
        setCurrentTab('arena');
        return;
      }

      // Root of roots -> minimize
      CapacitorApp.minimizeApp();
    }).then(listener => {
      backListener = listener;
    });

    return () => {
      if (backListener) backListener.remove();
    };
  }, [
    showAiModal, showProfileModal, showEditProfileModal, showPremiumModal, showAdModal,
    showStreakModal, showStatsModal, showAppGuideModal, showTourModal, showPlayModeModal,
    showFriendLobbyModal, showOfflineWarningModal, showSeoGuidesModal, showDueRevisionModal,
    showAdminArticles, showAdminImporter, showBattleAnalytics, showSscTop100CompletionModal,
    activeAiQuestion, activeArticleSlug, activeSeoSlug, isViewingArticlesIndex,
    practiceCustomQueue, activeSscTop100Category, isMatchmaking, matchState, currentTab, player.id
  ]);
  // --- END NATIVE ANDROID POLISH ---
`;

lines.splice(2488, 0, hooks);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
