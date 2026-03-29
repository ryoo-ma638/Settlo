// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDkvt2jFtT1qw8VpQHzf9_LbN4rpxPgBJs",
  authDomain: "pairpay-4c17a-9f1b0.firebaseapp.com",
  projectId: "pairpay-4c17a-9f1b0",
  storageBucket: "pairpay-4c17a-9f1b0.firebasestorage.app",
  messagingSenderId: "463550464554",
  appId: "1:463550464554:web:3af6bafb24dfc6d36f3953",
  measurementId: "G-GG8L1J1NY2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const db = getFirestore(app);

export { auth, provider, db };
