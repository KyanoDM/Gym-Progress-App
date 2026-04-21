import { app } from "../firebase/config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
});

function setupNavigation() {
    const settingsBtn = document.querySelector("#SettingsBtn") || document.querySelector(".dropdown-item:has(i.bi-gear)");
    const sidebarLogoutBtn = document.querySelector("#sidebar-logout-btn");

    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            window.location.href = "settings.html";
        });
    }

    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener("click", () => {
            signOut(auth)
                .then(() => window.location.href = "login.html")
                .catch(() => { });
        });
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const sidebarAvatarWrapper = document.getElementById("sidebar-avatar-wrapper");
    const sidebarAvatarImg = document.getElementById("sidebar-user-avatar");
    const monthsCountSpan = document.querySelector("#sidebar-months");
    const monthsWrapper = document.querySelector("#sidebar-months-wrapper");

    if (sidebarAvatarImg) {
        sidebarAvatarImg.style.display = "none";
    }

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const account = userSnap.data()?.account || {};

    if (sidebarAvatarImg && sidebarAvatarWrapper) {
        sidebarAvatarImg.onload = () => {
            sidebarAvatarImg.style.display = "block";
            sidebarAvatarWrapper.classList.remove("skeleton", "skeleton-circle", "skeleton-avatar-lg");
        };
        sidebarAvatarImg.src = account.photoURL || "Image/user.png";
    }

    if (monthsCountSpan && monthsWrapper) {
        monthsCountSpan.textContent = account.monthsCount || 0;
        monthsCountSpan.style.display = "inline";
        monthsWrapper.classList.remove("skeleton", "skeleton-text");
    }
});
