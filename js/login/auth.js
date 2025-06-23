import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


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

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.querySelector(".btn-outline-primary");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            signInWithPopup(auth, provider)
                .then(async (result) => {
                    const user = result.user;

                    // Save user data to Firestore
                    const userRef = doc(db, "users", user.uid);
                    await setDoc(userRef, {
                        name: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        lastLogin: new Date()
                    }, { merge: true });  // merge: true to update without overwriting entire doc

                    // Now update UI as before
                    const loginBtn = document.getElementById("login-btn");
                    const avatar = document.getElementById("user-avatar");

                    if (loginBtn && avatar) {
                        loginBtn.classList.add("d-none");
                        avatar.src = user.photoURL;
                        avatar.classList.remove("d-none");
                    }

                    console.log("Logged in user and saved to Firestore:", user);
                })
                .catch((error) => {
                    console.error("Login failed:", error);
              });
        });
    }
    const avatar = document.getElementById("user-avatar");

    if (avatar) {
        avatar.addEventListener("click", () => {
            // Instead of signOut here, redirect to profile page
            window.location.href = "profile.html";
        });
    }
});

onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById("login-btn");
    const avatar = document.getElementById("user-avatar");

    if (user) {
        // Still logged in ✅
        if (loginBtn) loginBtn.classList.add("d-none");
        if (avatar) {
            avatar.src = user.photoURL;
            avatar.classList.remove("d-none");
        }
    } else {
        // Not logged in
        if (loginBtn) loginBtn.classList.remove("d-none");
        if (avatar) avatar.classList.add("d-none");
    }
});



// Assume db and auth are initialized as before

const weightInput = document.getElementById("weight-input");
const saveWeightBtn = document.getElementById("save-weight-btn");

saveWeightBtn.addEventListener("click", async () => {
    const weight = parseFloat(weightInput.value);
    if (isNaN(weight) || weight <= 0) {
        alert("Please enter a valid weight");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to save your weight.");
        return;
    }

    const userRef = doc(db, "users", user.uid);
    try {
        await setDoc(userRef, { weight: weight }, { merge: true });  // merge so other fields stay intact
    } catch (error) {
        console.error("Error saving weight:", error);
        alert("Failed to save weight.");
    }
});