import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.vocabclash.twa',
  appName: 'VocabClash',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true
  },
  server: {
    // Strictly local-first: no remote server.url
    cleartext: false,
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com']
    },
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 10000,
      statsUrl: ''
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#020617",
      androidSplashResourceName: "splash",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashImmersive: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: "#0f172a",
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true
    }
  }
};

export default config;
