import { app } from "../firebase/config.js";
import { auth } from "../login/login.js"; // Adjust path if needed
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc, // <--- Make sure getDoc is imported
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    getDocs,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {

    const avatar = document.querySelectorAll("#user-avatar");
    const profileBtns = document.querySelectorAll("#ProfileBtn");
    const searchInput = document.querySelector("#search-input");

    const followerCountSpan = document.querySelector("#sidebar-followers");
    const followingCountSpan = document.querySelector("#sidebar-following"); // Corrected ID as per your text, assuming it was a typo in original code

    onAuthStateChanged(auth, async (user) => { // Made the callback async
        if (user) {
            avatar.forEach(img => {
                img.src = user.photoURL || "Image/img.jpg"; // Added fallback for photoURL
                console.log(user.photoURL);
                img.classList.remove("d-none");
            });

            // --- FETCHING FOLLOWER/FOLLOWING COUNTS FOR THE CURRENT USER ---
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef); // Fetch the user's document

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const accountData = userData.account || {};

                const followers = accountData.followerCount || 0;
                const following = accountData.followingCount || 0;

                if (followerCountSpan) {
                    followerCountSpan.textContent = followers;
                }
                if (followingCountSpan) {
                    followingCountSpan.textContent = following;
                }
            } else {
                console.warn("User document not found for current user:", user.uid);
                // Optionally set counts to 0 or display a message
                if (followerCountSpan) followerCountSpan.textContent = 0;
                if (followingCountSpan) followingCountSpan.textContent = 0;
            }
            // --- END FETCHING ---

        } else {
            // User is not logged in, redirect or hide elements
            // For example, hide avatar and set counts to 0
            avatar.forEach(img => img.classList.add("d-none"));
            if (followerCountSpan) followerCountSpan.textContent = 0;
            if (followingCountSpan) followingCountSpan.textContent = 0;
            // window.location.href = "login.html"; // Uncomment if you want to redirect
        }
    });

    addEventListeners(profileBtns);
    checkOnboarding();

    if (searchInput) {
        searchInput.addEventListener("input", () => handleUserSearch(searchInput.value.trim().toLowerCase()));
    }

    // These lines are incorrect here, as viewedProfileFollowerCount/FollowingCount
    // are not defined in this scope. They are handled within onAuthStateChanged now.
    // if (followerCountSpan) followerCountSpan.textContent = viewedProfileFollowerCount;
    // if (followingCountSpan) followingCountSpan.textContent = viewedProfileFollowingCount;
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
        if (!user) return; // Ensure user is logged in
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

    container.innerHTML = ""; // Clear previous results

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