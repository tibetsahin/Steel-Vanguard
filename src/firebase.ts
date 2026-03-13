import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDuKxGCf07iyAwf9ONSVtZZmP7olJW9lMg",
  authDomain: "normalwartr.firebaseapp.com",
  projectId: "normalwartr",
  storageBucket: "normalwartr.firebasestorage.app",
  messagingSenderId: "454225406087",
  appId: "1:454225406087:web:2f5e6b9b13f67bb8143022",
  measurementId: "G-NFM3XZ0MBF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const db = getDatabase(app);
