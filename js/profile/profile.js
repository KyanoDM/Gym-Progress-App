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

                        const updatedUserSnap = await getDoc(doc(db, "users", currentUser.uid));
                        const updatedAccountData = updatedUserSnap.data()?.account || {};

                        if (followerCountSpanBottom)
                            followerCountSpanBottom.textContent = updatedAccountData.followerCount || 0;
                        if (followingCountSpanBottom)
                            followingCountSpanBottom.textContent = updatedAccountData.followingCount || 0;

                    } catch (error) {
                        // Silent error handling
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

    if (profilePic) {
        const profilePicWrapper = document.getElementById("profile-pic-wrapper");

        // Set up the onload event to hide skeleton and show image
        profilePic.onload = () => {
            profilePic.style.display = "block";
            if (profilePicWrapper) {
                profilePicWrapper.classList.remove("skeleton", "skeleton-circle");
            }
        };

        // Set the image source to trigger loading
        profilePic.src = photoURL;
    }
    if (userFullName) {
        userFullName.textContent = `${name}`;
        userFullName.classList.remove("skeleton", "skeleton-text");
        userFullName.style.width = "auto";
        userFullName.style.height = "auto";
    }
    if (userName) {
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

        userName.innerHTML = `@${username}${badges}`;
        userName.classList.remove("skeleton", "skeleton-text");
        userName.style.width = "auto";
        userName.style.height = "auto";
    }

    if (followerCountSpan) {
        followerCountSpan.textContent = viewedProfileFollowerCount;
        followerCountSpan.classList.remove("skeleton", "skeleton-text");
        followerCountSpan.style.width = "auto";
        followerCountSpan.style.height = "auto";
    }
    if (followingCountSpan) {
        followingCountSpan.textContent = viewedProfileFollowingCount;
        followingCountSpan.classList.remove("skeleton", "skeleton-text");
        followingCountSpan.style.width = "auto";
        followingCountSpan.style.height = "auto";
    }
    if (myFollowingCountDisplay) myFollowingCountDisplay.textContent = currentUserFollowingCount;
}




document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            fillProfile(user);
        }
    });
});
