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
    const profileBtns = document.querySelectorAll("#ProfileBtn");
    const settingsBtn = document.querySelector("#SettingsBtn") || document.querySelector(".dropdown-item:has(i.bi-gear)");
    const sidebarLogoutBtn = document.querySelector("#sidebar-logout-btn");
    const followerCountSpan = document.querySelector("#sidebar-followers");
    const followingCountSpan = document.querySelector("#sidebar-following");
    const searchInput = document.querySelector("#search-input");

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

    // Sidebar logout button
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener("click", () => {
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


onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    // Get sidebar avatar wrapper and image
    const sidebarAvatarWrapper = document.getElementById("sidebar-avatar-wrapper");
    const sidebarAvatarImg = document.getElementById("sidebar-user-avatar");

    const followerCountSpan = document.querySelector("#sidebar-followers");
    const followingCountSpan = document.querySelector("#sidebar-following");
    const monthsCountSpan = document.querySelector("#sidebar-months");
    const monthsWrapper = document.querySelector("#sidebar-months-wrapper");

    // Hide sidebar image initially (to show skeletons)
    if (sidebarAvatarImg) {
        sidebarAvatarImg.style.display = "none";
    }

    // Load sidebar avatar and on load show image + remove skeleton wrapper classes
    if (sidebarAvatarImg && sidebarAvatarWrapper) {
        sidebarAvatarImg.onload = () => {
            sidebarAvatarImg.style.display = "block";
            sidebarAvatarWrapper.classList.remove("skeleton", "skeleton-circle", "skeleton-avatar-lg");
        };
        sidebarAvatarImg.src = user.photoURL || "Image/img.jpg";
    }

    // For followers/following counts — skeleton classes already applied in HTML
    // No need to add skeleton classes, just clear content while loading
    if (followerCountSpan) {
        followerCountSpan.textContent = ""; // clear text while loading
    }
    if (followingCountSpan) {
        followingCountSpan.textContent = "";
    }

    // Fetch user data from Firestore
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const account = userSnap.data()?.account || {};

    // Update counts and remove skeleton once loaded
    if (followerCountSpan) {
        followerCountSpan.textContent = account.followerCount || 0;
        followerCountSpan.classList.remove("skeleton", "skeleton-text");
    }
    if (followingCountSpan) {
        followingCountSpan.textContent = account.followingCount || 0;
        followingCountSpan.classList.remove("skeleton", "skeleton-text");
    }

    // Update months count from database
    if (monthsCountSpan && monthsWrapper) {
        monthsCountSpan.textContent = account.monthsCount || 0;
        monthsCountSpan.style.display = "inline";
        monthsWrapper.classList.remove("skeleton", "skeleton-text");
    }
});

