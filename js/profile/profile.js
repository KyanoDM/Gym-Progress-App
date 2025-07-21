import { app } from "../firebase/config.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDocs,
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    runTransaction
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Init
const auth = getAuth(app);
const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search);
const profileUid = urlParams.get("uid");

function updateAvatars(user) {
    const avatars = document.querySelectorAll("#user-avatar");
    avatars.forEach(img => {
        img.src = user.photoURL || "Image/img.jpg";
        img.classList.remove("d-none");
    });
}

async function fillProfile(currentUser) {
    const profilePic = document.querySelector("#profile-pic");
    const userName = document.querySelector("#user-name");
    const userFullName = document.querySelector("#user-fullname");
    const followBtn = document.querySelector("#follow-btn");
    const followerCountSpan = document.querySelector("#follower-count");
    const followingCountSpan = document.querySelector("#following-count"); // This is the span on the *viewed profile's* card
    const myFollowingCountDisplay = document.querySelector("#my-following-count-display"); // Element for *your* following count (e.g., in navbar/sidebar)

    const isOwnProfile = !profileUid || profileUid === currentUser.uid;

    let name = "Unknown";
    let username = "unknown";
    let photoURL = "Image/img.jpg";
    let viewedProfileFollowerCount = 0; // For the profile being viewed
    let viewedProfileFollowingCount = 0; // For the profile being viewed (this shouldn't change with your action)
    let currentUserFollowingCount = 0;   // IMPORTANT: This is *your* following count

    // Reference to the document of the profile being viewed
    const viewedProfileDocRef = doc(db, "users", isOwnProfile ? currentUser.uid : profileUid);
    const viewedProfileDocSnap = await getDoc(viewedProfileDocRef);

    if (viewedProfileDocSnap.exists()) {
        const viewedProfileData = viewedProfileDocSnap.data();
        const viewedProfileAccount = viewedProfileData.account || {};

        name = viewedProfileAccount.name || "Unknown";
        username = viewedProfileAccount.username || "unknown";
        photoURL = viewedProfileAccount.photoURL || photoURL;
        viewedProfileFollowerCount = viewedProfileAccount.followerCount || 0;
        viewedProfileFollowingCount = viewedProfileAccount.followingCount || 0;

        // Special handling for `currentUserFollowingCount` and `followBtn` visibility
        const currentUserDocSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (currentUserDocSnap.exists()) {
            const currentUserData = currentUserDocSnap.data();
            currentUserFollowingCount = currentUserData.account?.followingCount || 0;

            if (!isOwnProfile) {
                // Only show follow button if it's NOT our own profile
                let isFollowing = (currentUserData.following || []).includes(profileUid);
                followBtn.textContent = isFollowing ? "Unfollow" : "Follow";
                followBtn.classList.remove("d-none"); // Make button visible

                // Add or re-add the click listener
                followBtn.onclick = async () => {
                    const currentUserRef = doc(db, "users", currentUser.uid);
                    const targetUserRef = doc(db, "users", profileUid);

                    try {
                        await runTransaction(db, async (transaction) => {
                            const currentUserDoc = await transaction.get(currentUserRef);
                            const targetUserDoc = await transaction.get(targetUserRef);

                            if (!currentUserDoc.exists() || !targetUserDoc.exists()) {
                                throw new Error("User document(s) do not exist!");
                            }

                            const currentUserDataInTransaction = currentUserDoc.data();
                            const targetUserDataInTransaction = targetUserDoc.data();

                            let currentFollowerCountInDB = targetUserDataInTransaction.account?.followerCount || 0;
                            let currentFollowingCountInDB = currentUserDataInTransaction.account?.followingCount || 0;

                            let isCurrentlyFollowing = (currentUserDataInTransaction.following || []).includes(profileUid);

                            if (isCurrentlyFollowing) {
                                // UNFOLLOW LOGIC
                                transaction.update(currentUserRef, {
                                    following: arrayRemove(profileUid),
                                    "account.followingCount": Math.max(0, currentFollowingCountInDB - 1)
                                });
                                transaction.update(targetUserRef, {
                                    followers: arrayRemove(currentUser.uid),
                                    "account.followerCount": Math.max(0, currentFollowerCountInDB - 1)
                                });
                                isFollowing = false;
                                followBtn.textContent = "Follow";
                                viewedProfileFollowerCount = Math.max(0, viewedProfileFollowerCount - 1); // Update local for immediate display
                                currentUserFollowingCount = Math.max(0, currentUserFollowingCount - 1); // Update *your* local count

                            } else {
                                // FOLLOW LOGIC
                                transaction.update(currentUserRef, {
                                    following: arrayUnion(profileUid),
                                    "account.followingCount": currentFollowingCountInDB + 1
                                });
                                transaction.update(targetUserRef, {
                                    followers: arrayUnion(currentUser.uid),
                                    "account.followerCount": currentFollowerCountInDB + 1
                                });
                                isFollowing = true;
                                followBtn.textContent = "Unfollow";
                                viewedProfileFollowerCount++; // Update local for immediate display
                                currentUserFollowingCount++; // Update *your* local count
                            }
                        });

                        // Update UI elements AFTER successful transaction
                        if (followerCountSpan) followerCountSpan.textContent = viewedProfileFollowerCount;
                        if (myFollowingCountDisplay) myFollowingCountDisplay.textContent = currentUserFollowingCount;

                    } catch (error) {
                        console.error("Transaction failed:", error);
                    }
                };
            } else {
                // If it's own profile, ensure follow button is hidden
                followBtn?.classList.add("d-none");
                currentUserFollowingCount = viewedProfileFollowingCount; // On own profile, your following count is the profile's
            }
        } else {
            console.warn("Current user's Firestore document not found.");
            // Fallback for current user's data if their document doesn't exist
            currentUserFollowingCount = currentUser.email?.split("@")[0] || 0; // Or whatever fallback makes sense for your own following count
            if (!isOwnProfile) {
                // If current user's doc doesn't exist and we're viewing another profile, hide follow button
                followBtn?.classList.add("d-none");
            }
        }
    } else {
        console.error("Viewed user profile not found in Firestore.");
        // Fallback if the profile being viewed (could be own or other) does not exist in Firestore.
        // This might happen for brand new users if their doc isn't created on sign-up yet.
        // Or if a non-existent UID is passed in the URL.
        name = currentUser.displayName || currentUser.email?.split("@")[0]; // Use Firebase Auth for current user's info
        username = currentUser.email?.split("@")[0];
        photoURL = currentUser.photoURL || photoURL;
        followBtn?.classList.add("d-none"); // Hide follow button as no valid profile is loaded
        // Default counts remain 0
    }

    // Update common UI elements at the end of fillProfile (for both own and other profiles)
    if (profilePic) profilePic.src = photoURL;
    if (userName) userName.textContent = `@${username}`;
    if (userFullName) userFullName.textContent = name;
    if (followerCountSpan) followerCountSpan.textContent = viewedProfileFollowerCount;
    if (followingCountSpan) followingCountSpan.textContent = viewedProfileFollowingCount; // This shows the *viewed profile's* following count
    if (myFollowingCountDisplay) myFollowingCountDisplay.textContent = currentUserFollowingCount;
}

function setupLogout() {
    const logoutBtn = document.querySelector("#logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            signOut(auth)
                .then(() => window.location.href = "login.html")
                .catch(err => console.error("Logout failed:", err));
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            updateAvatars(user);
            fillProfile(user);
            setupLogout();
            const avatar = document.querySelectorAll("#user-avatar");
            const profileBtns = document.querySelectorAll("#ProfileBtn");
            addEventListeners(profileBtns);
            const searchInput = document.querySelector("#search-input");
            if (searchInput) {
                searchInput.addEventListener("input", () => handleUserSearch(searchInput.value.trim().toLowerCase()));
            }
        } else {
            window.location.href = "login.html";
        }
    });
});

function addEventListeners(profileBtns) {
    profileBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
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