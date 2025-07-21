import { app } from "../firebase/config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
});

function setupNavigation() {
    const avatarImgs = document.querySelectorAll("#user-avatar");
    const profileBtns = document.querySelectorAll("#ProfileBtn");
    const settingsBtn = document.querySelector("#SettingsBtn") || document.querySelector(".dropdown-item:has(i.bi-gear)");
    const logoutBtn = document.querySelector("#logout-btn");
    const followerCountSpan = document.querySelector("#sidebar-followers");
    const followingCountSpan = document.querySelector("#sidebar-following");
    const searchInput = document.querySelector("#search-input");

    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        // Avatar
        avatarImgs.forEach(img => {
            img.src = user.photoURL || "Image/img.jpg";
            img.classList.remove("d-none");
        });

        // Profile stats
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const account = userSnap.data()?.account || {};
        if (followerCountSpan) followerCountSpan.textContent = account.followerCount || 0;
        if (followingCountSpan) followingCountSpan.textContent = account.followingCount || 0;
    });

    // Profile buttons
    profileBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    });

    // Settings button
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            window.location.href = "settings.html";
        });
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            signOut(auth)
                .then(() => window.location.href = "login.html")
                .catch(err => console.error("Logout failed:", err));
        });
    }

    // Search input
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            handleUserSearch(searchInput.value.trim().toLowerCase());
        });
    }
}

async function handleUserSearch(queryText) {
    const resultsContainer = document.querySelector("#search-results");
    if (!resultsContainer) return;

    if (!queryText) {
        resultsContainer.innerHTML = "";
        return;
    }

    try {
        const usersRef = collection(db, "users");
        const q = query(
            usersRef,
            orderBy("account.username"),
            startAt(queryText),
            endAt(queryText + "\uf8ff")
        );
        const querySnapshot = await getDocs(q);
        const users = [];

        querySnapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                id: doc.id,
                username: data.account?.username,
                name: data.account?.name,
                photoURL: data.account?.photoURL || "Image/img.jpg",
                isVerified: data.account?.isVerified,
                isAdmin: data.account?.isAdmin,
                isOwner: data.account?.isOwner
            });
        });

        displaySearchResults(users);
    } catch (error) {
        console.error("Error searching users:", error);
    }
}

function displaySearchResults(users) {
    const container = document.querySelector("#search-results");
    if (!container) return;

    container.innerHTML = "";

    if (users.length === 0) {
        container.innerHTML = `<div class="text-muted p-2">No users found.</div>`;
        return;
    }

    users.forEach(user => {
        let badges = "";
        if (user.isVerified) badges += ` <i class="bi bi-patch-check-fill text-primary" title="Verified"></i>`;
        if (user.isAdmin) badges += ` <i class="bi bi-shield-lock-fill text-danger" title="Admin"></i>`;
        if (user.isOwner) badges += ` <i class="bi bi-award-fill text-warning" title="Owner"></i>`;

        const card = document.createElement("div");
        card.className = "card mb-2 p-2 d-flex flex-row align-items-center gap-3";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="${user.photoURL}" width="40" height="40" class="rounded-circle border">
            <div>
                <strong>@${user.username}${badges}</strong><br>
                <span class="text-muted">${user.name}</span>
            </div>
        `;
        card.addEventListener("click", () => {
            window.location.href = `profile.html?uid=${user.id}`;
        });

        container.appendChild(card);
    });
}
