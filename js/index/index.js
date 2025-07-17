import { app } from "../firebase/config.js";
import { auth } from "../login/login.js"; // Adjust path if needed
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    const avatar = document.querySelectorAll("#user-avatar");
    const profileBtns = document.querySelectorAll("#ProfileBtn");
    onAuthStateChanged(auth, (user) => {
        if (user) {
            avatar.forEach(img => {
                img.src = user.photoURL;
                console.log(user.photoURL);
                img.classList.remove("d-none");
            });
        }
    });
    addEventListeners(profileBtns);
    checkOnboarding();
});

function addEventListeners(profileBtns) {
    profileBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    });
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