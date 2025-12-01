// Import the functions you need from the SDKs you need
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
// You can find this in the Firebase Console -> Project Settings -> General -> Your Apps
const firebaseConfig = {
    apiKey: "AIzaSyDUMSroR4ttcdohVK2Y8qq7yWIBrkAWKWQ",
    authDomain: "studio-7145332012-9a179.firebaseapp.com",
    projectId: "studio-7145332012-9a179",
    storageBucket: "studio-7145332012-9a179.firebasestorage.app",
    messagingSenderId: "832894479416",
    appId: "1:832894479416:web:2163932c408afeabdb8acd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
