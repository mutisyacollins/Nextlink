// ==================== FIREBASE CONFIG ====================
// GitHub Pages cannot use /__/firebase/init.js.
// This direct config works on GitHub Pages.

const firebaseConfig = {
  apiKey: "AIzaSyClzZeYKWsfMkWkio9E3IZxGz-nAi73gDI",
  authDomain: "nextlink-net.firebaseapp.com",
  projectId: "nextlink-net",
  storageBucket: "nextlink-net.firebasestorage.app",
  messagingSenderId: "424354367102",
  appId: "1:424354367102:web:f299a4b61b6010e5ab7a2f",
  measurementId: "G-JC2DHJWFRD"
};

firebase.initializeApp(firebaseConfig);

try {
  firebase.analytics();
} catch (e) {
  console.warn("Analytics not available:", e.message);
}

const auth = firebase.auth();
const db = firebase.firestore();
