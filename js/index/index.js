import { app } from "../firebase/config.js";
import { auth } from "../login/login.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    getDocs,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    const avatarImgs = document.querySelectorAll("#user-avatar");
    const profileBtns = document.querySelectorAll("#ProfileBtn");
    const searchInput = document.querySelector("#search-input");
    const followerCountSpan = document.querySelector("#sidebar-followers");
    const followingCountSpan = document.querySelector("#sidebar-following");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            avatarImgs.forEach(img => {
                img.src = user.photoURL || "Image/img.jpg";
                img.classList.remove("d-none");
            });

            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const { account = {} } = userSnap.data();
                followerCountSpan && (followerCountSpan.textContent = account.followerCount || 0);
                followingCountSpan && (followingCountSpan.textContent = account.followingCount || 0);
            } else {
                followerCountSpan && (followerCountSpan.textContent = 0);
                followingCountSpan && (followingCountSpan.textContent = 0);
            }
        } else {
            avatarImgs.forEach(img => img.classList.add("d-none"));
            followerCountSpan && (followerCountSpan.textContent = 0);
            followingCountSpan && (followingCountSpan.textContent = 0);
            // window.location.href = "login.html";
        }
    });

    addProfileBtnListeners(profileBtns);
    checkOnboarding();

    if (searchInput) {
        searchInput.addEventListener("input", () =>
            handleUserSearch(searchInput.value.trim().toLowerCase())
        );
    }
});

function addProfileBtnListeners(btns) {
    btns.forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    });
}

function checkOnboarding() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const onboardingComplete = userSnap.data()?.onboarding?.onboardingComplete;
        if (!onboardingComplete) {
            const alert = document.querySelector("#onboarding-alert");
            if (alert) {
                alert.classList.remove("hidden");
                alert.addEventListener("click", () => {
                    window.location.href = "onboarding.html";
                });
            }
        }
    });
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
                photoURL: data.account?.photoURL || "Image/img.jpg"
            });
        });
        displaySearchResults(users);
    } catch (error) {
        console.error("Error fetching users:", error);
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
        const card = document.createElement("div");
        card.className = "card mb-2 p-2 d-flex flex-row align-items-center gap-3";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="${user.photoURL}" width="40" height="40" class="rounded-circle border">
            <div>
                <strong>@${user.username}</strong><br>
                <span class="text-muted">${user.name}</span>
            </div>
        `;
        card.addEventListener("click", () => {
            window.location.href = `profile.html?uid=${user.id}`;
        });
        container.appendChild(card);
    });
}
