// Firebase config generated from your Firebase Console
import { initializeApp } from 'firebase/app'
import { getFirestore, collection } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: (typeof window !== 'undefined' && window.__FIRESTORE_API_KEY) || '',
  authDomain: "the-choke-ledger.firebaseapp.com",
  databaseURL: "https://the-choke-ledger-default-rtdb.firebaseio.com",
  projectId: "the-choke-ledger",
  storageBucket: "the-choke-ledger.firebasestorage.app",
  messagingSenderId: "705619389077",
  appId: "1:705619389077:web:3f266c1d02668b76ecc99c",
  measurementId: "G-CKWJ6W6DPN"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const playersCol = collection(db, 'players')
