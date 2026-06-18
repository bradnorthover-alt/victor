import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCjmVASEGSu2Cx4gzqgMQBAuvIxv60YsIw",
  authDomain: "victor-ceo.firebaseapp.com",
  projectId: "victor-ceo",
  storageBucket: "victor-ceo.firebasestorage.app",
  messagingSenderId: "1085868110990",
  appId: "1:1085868110990:web:a65fedf92915d2475845df"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
