import { app } from "../firebase/config.js";
import {
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

function goToOnboarding() {
    window.location.href = "onboarding.html";
}

function initOnboardingAlert() {
    const alertEl = document.querySelector("#onboarding-alert");
    if (!alertEl) return;

    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const complete = userSnap.data()?.onboarding?.onboardingComplete;
            if (complete) return;

            alertEl.classList.remove("hidden");

            // Wire the Complete button (primary CTA)
            const completeBtn = alertEl.querySelector("button.btn-primary");
            if (completeBtn) {
                completeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    goToOnboarding();
                });
            }

            // Also allow clicking the alert body itself
            alertEl.style.cursor = "pointer";
            alertEl.addEventListener("click", goToOnboarding);
        } catch (err) {
            console.warn("[onboarding check failed]", err);
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOnboardingAlert);
} else {
    initOnboardingAlert();
}
