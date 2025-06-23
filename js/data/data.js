import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";
import { getAuth} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyAlmsUBdc7rDMFzt32FO1H3QOWdgO9FNzg",
    authDomain: "gymprogressapp-18807.firebaseapp.com",
    projectId: "gymprogressapp-18807",
    storageBucket: "gymprogressapp-18807.firebasestorage.app",
    messagingSenderId: "832434251038",
    appId: "1:832434251038:web:81e5d4241e00127639550f",
    measurementId: "G-X81K00GX78"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

