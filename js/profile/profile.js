import { app } from "../firebase/config.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Init services
const auth = getAuth(app);
const db = getFirestore(app);

function updateAvatars(user) {
    const avatars = document.querySelectorAll("#user-avatar");
    avatars.forEach(img => {
        img.src = user.photoURL;
        img.classList.remove("d-none");
    });
}

async function fillProfile(user) {
    const profilePic = document.querySelector("#profile-pic");
    const userName = document.querySelector("#user-name");
    const userFullName = document.querySelector("#user-fullname");

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const fullName = user.displayName || userData?.account?.name || "Unknown";
    const username = userData?.account?.username || "Guest";

    if (profilePic) profilePic.src = user.photoURL || "image/img.jpg";
    if (userFullName) userFullName.textContent = fullName;
    if (userName) userName.textContent = `@${username}`;
}

async function checkOnboarding() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const onboardingComplete = userSnap.data()?.onboarding?.onboardingComplete;
        console.log(onboardingComplete);
        if (!onboardingComplete) {
            const alert = document.querySelector("#onboarding-alert");
            alert.classList.remove("hidden");
            if (alert) {
                alert.addEventListener("click", () => {
                    window.location.href = "onboarding.html";
                });
            }
        }
    });
}


function setupLogout() {
    const logoutBtn = document.querySelector("#logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            signOut(auth)
                .then(() => window.location.href = "login.html")
                .catch((err) => console.error("Logout failed:", err));
        });
    }
}

function handleAuthState(user) {
    if (user) {
        updateAvatars(user);
        fillProfile(user);
    } else {
        window.location.href = "login.html";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, handleAuthState);
    setupLogout();
    checkOnboarding();
});
