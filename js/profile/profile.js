import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

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
const auth = getAuth(app);

window.onload = () => {
    const profilePic = document.querySelector("#profile-pic");
    const userName = document.querySelector("#user-name");
    const userEmail = document.querySelector("#user-email");
    const logoutBtn = document.querySelector("#logout-btn");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            profilePic.src = user.photoURL;
            userName.textContent = `Name: ${user.displayName}`;
            userEmail.textContent = `Email: ${user.email}`;
        } else {
            // Not logged in, redirect to homepage/login page
            window.location.href = "index.html"; // or your login page
        }
    });

    logoutBtn.addEventListener("click", () => {
        signOut(auth)
            .then(() => {
                window.location.href = "index.html"; // redirect after logout
            })
            .catch((error) => {
                console.error("Logout error:", error);
            });
    });
};
