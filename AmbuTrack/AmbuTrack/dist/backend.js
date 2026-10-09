import { validateState } from './state.js';
const LOCAL_KEY='ambutrack-state-v2';
export function configured(settings){return settings.enabled===true&&['apiKey','authDomain','projectId','appId'].every(k=>typeof settings.config?.[k]==='string'&&settings.config[k].trim().length>0);}
// Keep all SDK modules pinned to the same version. Loaded only when configured.
async function loadSDK(){
  const [app,auth,firestore]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
  ]);return {...app,...auth,...firestore};
}
export async function openBackend(settings,seed,{sdkLoader=loadSDK,storage=globalThis.localStorage}={}){
  validateState(seed);
  if(!configured(settings)){
    if(settings.enabled)throw Error('Firebase is enabled but its web configuration is incomplete.');
    let state=seed;let recoveryWarning='';
    try{const raw=storage?.getItem(LOCAL_KEY);if(raw)state=validateState(JSON.parse(raw));}catch{recoveryWarning='Previous local data could not be loaded; demo defaults are shown.';}
    return {mode:'local',state,recoveryWarning,async save(next){validateState(next);if(!storage)throw Error('Browser storage is unavailable.');storage.setItem(LOCAL_KEY,JSON.stringify(next));}};
  }
  const sdk=await sdkLoader();
  const app=sdk.initializeApp(settings.config),auth=sdk.getAuth(app);
  await sdk.setPersistence(auth,sdk.browserLocalPersistence);
  await auth.authStateReady();
  const user=auth.currentUser||(await sdk.signInAnonymously(auth)).user;
  const db=sdk.getFirestore(app),ref=sdk.doc(db,'users',user.uid,'ambutrack','state');
  // Seed only once. Transactions prevent two tabs from replacing existing data.
  const loaded=await sdk.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(snap.exists())return snap.data();
    const first={revision:0,state:seed,mutationId:'seed',updatedAt:sdk.serverTimestamp()};tx.set(ref,first);return first;
  });
  validateState(loaded.state);let revision=loaded.revision;
  if(!Number.isInteger(revision)||revision<0)throw Error('Invalid Firebase state revision.');
  return {mode:'firebase',uid:user.uid,state:loaded.state,async save(next){
    validateState(next);const expected=revision;
    const mutationId=globalThis.crypto.randomUUID();
    const result=await sdk.runTransaction(db,async tx=>{
      const snap=await tx.get(ref),current=snap.exists()?snap.data():null;
      if(!current||current.revision!==expected){const error=Error('Another tab changed this workspace. Reload to use the latest cloud copy.');error.code='ambutrack/conflict';throw error;}
      tx.set(ref,{revision:expected+1,state:next,mutationId,updatedAt:sdk.serverTimestamp()});return expected+1;
    });revision=result;
  }};
}
// Serialize writes so an older snapshot can never arrive after a newer one.
export function createSaveQueue(save,onStatus){
  let pending=null,running=false,failed=false;
  async function flush(){
    if(running||failed||!pending)return;
    running=true;
    while(pending&&!failed){const current=pending;pending=null;onStatus('saving');try{await save(current);onStatus('saved');}catch(error){pending=pending||current;failed=true;onStatus('error',error);}}
    running=false;
  }
  return {enqueue(state){pending=JSON.parse(JSON.stringify(state));void flush();},retry(){failed=false;void flush();},get unsaved(){return running||!!pending;}};
}
