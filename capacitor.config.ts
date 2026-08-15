/// <reference types="@capacitor-firebase/authentication" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suga.app',
  appName: 'suga',
  webDir: 'www',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'phone']
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 700,
      backgroundColor: '#ffffffff',
      showSpinner: false,
      spinnerColor: '#fe2c55',
      androidScaleType: 'CENTER'
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#3880FF'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_suga',
      iconColor: '#3880FF'
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false
      }
    }
  },
  cordova: {
    preferences: {
      ScrollEnabled: 'false',
      BackupWebStorage: 'none',
      SplashMaintainAspectRatio: 'true',
      FadeSplashScreenDuration: '120',
      SplashShowOnlyFirstTime: 'false',
      SplashScreen: 'screen',
      SplashScreenDelay: '700'
    }
  }
};

export default config;
