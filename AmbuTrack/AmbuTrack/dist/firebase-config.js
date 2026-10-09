// Paste the WEB APP configuration from Firebase Console → Project settings.
// This public configuration is not a service-account credential.
// Keep enabled=false until Anonymous Auth and firestore.rules are deployed.
export const firebaseSettings = {
  enabled: false,
  config: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: ''
  }
};
