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
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#0f172a",
      androidSplashResourceName: "splash",
      showSpinner: true,
      spinnerColor: "#3b82f6"
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: "#0f172a"
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true
    }
  }
};

export default config;
