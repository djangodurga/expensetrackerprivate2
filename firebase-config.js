// Firebase configuration (compat SDK)
const firebaseConfig = {
  apiKey: "AIzaSyDNacEddizSkIWx_CRTaCYAU2Oc4cx3dxg",
  authDomain: "expensetrackerprivate2.firebaseapp.com",
  projectId: "expensetrackerprivate2",
  storageBucket: "expensetrackerprivate2.firebasestorage.app",
  messagingSenderId: "394176314939",
  appId: "1:394176314939:web:3872837e1c472b09e5661e"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
