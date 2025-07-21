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

// Firebase init
const auth = getAuth(app);
const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search);
const profileUid = urlParams.get("uid");

function updateAvatars(user) {
    document.querySelectorAll("#user-avatar").forEach(img => {
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
    const followingCountSpan = document.querySelector("#following-count");
    const myFollowingCountDisplay = document.querySelector("#my-following-count-display");
    const followerCountSpanBottom = document.querySelector("#sidebar-followers");
    const followingCountSpanBottom = document.querySelector("#sidebar-following");

    let viewedProfileAccount = {};

    const isOwnProfile = !profileUid || profileUid === currentUser.uid;

    let name = "Unknown";
    let username = "unknown";
    let photoURL = "Image/img.jpg";
    let viewedProfileFollowerCount = 0;
    let viewedProfileFollowingCount = 0;
    let currentUserFollowingCount = 0;

    const viewedProfileDocRef = doc(db, "users", isOwnProfile ? currentUser.uid : profileUid);
    const viewedProfileDocSnap = await getDoc(viewedProfileDocRef);

    if (viewedProfileDocSnap.exists()) {
        const viewedProfileData = viewedProfileDocSnap.data();
        viewedProfileAccount = viewedProfileData.account || {};

        name = viewedProfileAccount.name || name;
        username = viewedProfileAccount.username || username;
        photoURL = viewedProfileAccount.photoURL || photoURL;
        viewedProfileFollowerCount = viewedProfileAccount.followerCount || 0;
        viewedProfileFollowingCount = viewedProfileAccount.followingCount || 0;

        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const accountData = userData.account || {};
        const followers = accountData.followerCount || 0;
        const following = accountData.followingCount || 0;

        if (followerCountSpanBottom) followerCountSpanBottom.textContent = followers;
        if (followingCountSpanBottom) followingCountSpanBottom.textContent = following;

        const currentUserDocSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (currentUserDocSnap.exists()) {
            const currentUserData = currentUserDocSnap.data();
            currentUserFollowingCount = currentUserData.account?.followingCount || 0;

            if (!isOwnProfile) {
                let isFollowing = (currentUserData.following || []).includes(profileUid);
                followBtn.textContent = isFollowing ? "Unfollow" : "Follow";
                followBtn.classList.remove("d-none");

                followBtn.onclick = async () => {
                    const currentUserRef = doc(db, "users", currentUser.uid);
                    const targetUserRef = doc(db, "users", profileUid);

                    try {
                        await runTransaction(db, async (transaction) => {
                            const currentUserDoc = await transaction.get(currentUserRef);
                            const targetUserDoc = await transaction.get(targetUserRef);

                            if (!currentUserDoc.exists() || !targetUserDoc.exists()) throw new Error("User document(s) do not exist!");

                            const currentUserDataInTransaction = currentUserDoc.data();
                            const targetUserDataInTransaction = targetUserDoc.data();

                            let currentFollowerCountInDB = targetUserDataInTransaction.account?.followerCount || 0;
                            let currentFollowingCountInDB = currentUserDataInTransaction.account?.followingCount || 0;
                            let isCurrentlyFollowing = (currentUserDataInTransaction.following || []).includes(profileUid);

                            if (isCurrentlyFollowing) {
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
                                viewedProfileFollowerCount = Math.max(0, viewedProfileFollowerCount - 1);
                                currentUserFollowingCount = Math.max(0, currentUserFollowingCount - 1);
                            } else {
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
                                viewedProfileFollowerCount++;
                                currentUserFollowingCount++;
                            }
                        });

                        if (followerCountSpan) followerCountSpan.textContent = viewedProfileFollowerCount;
                        if (myFollowingCountDisplay) myFollowingCountDisplay.textContent = currentUserFollowingCount;
                    } catch (error) {
                        console.error("Transaction failed:", error);
                    }
                };
            } else {
                followBtn?.classList.add("d-none");
                currentUserFollowingCount = viewedProfileFollowingCount;
            }
        } else {
            currentUserFollowingCount = currentUser.email?.split("@")[0] || 0;
            if (!isOwnProfile) followBtn?.classList.add("d-none");
        }
    } else {
        name = currentUser.displayName || currentUser.email?.split("@")[0];
        username = currentUser.email?.split("@")[0];
        photoURL = currentUser.photoURL || photoURL;
        followBtn?.classList.add("d-none");
    }

    if (profilePic) profilePic.src = photoURL;
    if (userName) userName.textContent = `@${username}`;
    if (userFullName) {
        let badges = "";

        if (viewedProfileAccount.isVerified) {
            badges += ` <i class="bi bi-patch-check-fill text-primary" title="Verified"></i>`;
        }

        if (viewedProfileAccount.isAdmin) {
            badges += ` <i class="bi bi-shield-lock-fill text-danger" title="Admin"></i>`;
        }

        if (viewedProfileAccount.isOwner) {
            badges += ` <i class="bi bi-award-fill text-warning" title="Owner"></i>`;
        }

        userName.innerHTML = `${name}${badges}`;
    }

    if (followerCountSpan) followerCountSpan.textContent = viewedProfileFollowerCount;
    if (followingCountSpan) followingCountSpan.textContent = viewedProfileFollowingCount;
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

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            updateAvatars(user);
            fillProfile(user);
            setupLogout();
            addEventListeners(document.querySelectorAll("#ProfileBtn"));
            const searchInput = document.querySelector("#search-input");
            if (searchInput) {
                searchInput.addEventListener("input", () => handleUserSearch(searchInput.value.trim().toLowerCase()));
            }
        } else {
            window.location.href = "login.html";
        }
    });
});
