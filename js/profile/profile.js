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
    getDocFromCache,
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

    const isOwnProfile = !profileUid || profileUid === currentUser.uid; let name = "Unknown";
    let username = "unknown";
    let photoURL = "Image/user.png";
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

    // Fetch and show the latest post for the viewed profile
    try {
        const profileUserId = isOwnProfile ? currentUser.uid : profileUid;
        await fetchAndRenderLatestPost(profileUserId);
    } catch (e) {
        console.error('Error fetching latest post for profile:', e);
    }
}

async function fetchAndRenderLatestPost(profileUserId) {
    if (!profileUserId) return;
    const container = document.getElementById('latest-post-container');
    if (!container) return;

    try {
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        // Find first post that matches the userId
        let latest = null;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.userId === profileUserId && !latest) {
                latest = { id: docSnap.id, ...data };
            }
        });

        if (!latest) {
            container.innerHTML = `
                <div class="card shadow-sm p-3 text-center">
                    <div class="text-muted">No posts yet</div>
                </div>
            `;
            return;
        }

        container.innerHTML = renderCompactPostHTML(latest);
    } catch (err) {
        console.error('Error fetching latest post:', err);
        container.innerHTML = `<div class="text-center text-muted">Unable to load latest post</div>`;
    }
}

function renderCompactPostHTML(post) {
    const timeAgo = getTimeAgo(post.createdAt);
    const userName = post.userDisplayName || 'Anonymous';
    const userAvatar = post.userPhotoURL || null;

    const avatarHTML = userAvatar ?
        `<img src="${userAvatar}" class="rounded-circle me-3" style="width: 40px; height: 40px; object-fit: cover;">` :
        `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: bold;">${userName.charAt(0).toUpperCase()}</div>`;

    if (post.type === 'month') {
        return `
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        ${avatarHTML}
                        <div>
                            <strong>${userName}</strong>
                            <div class="text-muted small">Shared ${post.monthData.month} ${post.monthData.year} • ${timeAgo}</div>
                        </div>
                    </div>
                    <div class="feed-image-wrapper mb-2">
                        <div class="skeleton skeleton-image"></div>
                        <img src="${post.imageUrl}" class="post-image img-fluid rounded" onload="this.classList.add('loaded'); this.previousElementSibling && this.previousElementSibling.remove();" style="width:100%;">
                    </div>
                    ${post.text ? `<p class="mb-1">${post.text}</p>` : ''}
                    <div class="text-muted small">${post.likes ? post.likes.length : 0} likes</div>
                </div>
            </div>
        `;
    }

    // transformation
    return `
        <div class="card shadow-sm">
            <div class="card-body">
                <div class="d-flex align-items-center mb-2">
                    ${avatarHTML}
                    <div>
                        <strong>${userName}</strong>
                        <div class="text-muted small">Transformation • ${timeAgo}</div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-6">
                        <div class="feed-image-wrapper mb-2">
                            <div class="skeleton skeleton-image"></div>
                            <img src="${post.beforeImage}" class="post-image img-fluid rounded" onload="this.classList.add('loaded'); this.previousElementSibling && this.previousElementSibling.remove();" style="width:100%; object-fit:cover;">
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="feed-image-wrapper mb-2">
                            <div class="skeleton skeleton-image"></div>
                            <img src="${post.afterImage}" class="post-image img-fluid rounded" onload="this.classList.add('loaded'); this.previousElementSibling && this.previousElementSibling.remove();" style="width:100%; object-fit:cover;">
                        </div>
                    </div>
                </div>
                ${post.text ? `<p class="mb-1">${post.text}</p>` : ''}
                <div class="text-muted small">${post.likes ? post.likes.length : 0} likes</div>
            </div>
        </div>
    `;
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'just now';

    const now = new Date();
    const postTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInMs = now - postTime;
    const diffInMin = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMin < 1) return 'just now';
    if (diffInMin < 60) return `${diffInMin}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return postTime.toLocaleDateString();
}




document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            fillProfile(user);
        }
    });
});
