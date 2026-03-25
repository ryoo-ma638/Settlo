// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDkvt2jFtT1qw8VpQHzf9_LbN4rpxPgBJs",
  authDomain: "pairpay-4c17a.firebaseapp.com",
  projectId: "pairpay-4c17a",
  storageBucket: "pairpay-4c17a.firebasestorage.app",
  messagingSenderId: "709008640085",
  appId: "1:709008640085:web:d5de5394d85efceafd6cdc",
  measurementId: "G-DNJ331XFJT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
