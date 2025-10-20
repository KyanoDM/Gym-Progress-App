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
    addDoc,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const db = getFirestore(app);

// Global variables
let userMonths = [];
let selectedPostType = '';
let selectedMonth = null;
let selectedImage = '';
let selectedBeforeMonth = null;
let selectedAfterMonth = null;
let selectedBeforeImage = '';
let selectedAfterImage = '';

document.addEventListener("DOMContentLoaded", () => {
    checkOnboarding();
    setupPostCreation();
});

function checkOnboarding() {
    onAuthStateChanged(auth, async (user) => {
        // If there's no signed-in user, still attempt to load the feed (will show empty state)
        if (!user) {
            try {
                await loadFeedPosts();
            } catch (e) {
                console.error('Error loading feed for anonymous user:', e);
            }
            return;
        }

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

        // Load user's months for post creation and avatar
        await loadUserMonths(user.uid);
        loadUserAvatar(user);

        // Now that we have auth and user data, load the feed for the signed-in user
        try {
            await loadFeedPosts();
        } catch (e) {
            console.error('Error loading feed for signed-in user:', e);
        }
    });
}

async function loadUserMonths(userId) {
    try {
        const monthsRef = collection(db, "users", userId, "months");
        const q = query(
            monthsRef,
            where("userId", "==", userId),
            orderBy("year", "desc"),
            orderBy("month", "desc")
        );

        const querySnapshot = await getDocs(q);
        userMonths = [];

        querySnapshot.forEach((doc) => {
            userMonths.push({ id: doc.id, ...doc.data() });
        });

        // Sort months properly by date
        userMonths.sort((a, b) => {
            if (a.year !== b.year) {
                return b.year - a.year;
            }
            const monthOrder = {
                'january': 1, 'february': 2, 'march': 3, 'april': 4,
                'may': 5, 'june': 6, 'july': 7, 'august': 8,
                'september': 9, 'october': 10, 'november': 11, 'december': 12
            };
            const aMonth = monthOrder[a.month?.toLowerCase()] || 0;
            const bMonth = monthOrder[b.month?.toLowerCase()] || 0;
            return bMonth - aMonth;
        });

        console.log('Loaded months:', userMonths);
    } catch (error) {
        console.error("Error loading user months:", error);
    }
}

function loadUserAvatar(user) {
    const avatarWrapper = document.getElementById('user-avatar-wrapper');
    const avatarImg = document.getElementById('user-avatar');

    if (user.photoURL) {
        avatarImg.src = user.photoURL;
        avatarImg.onload = () => {
            avatarWrapper.classList.remove('skeleton', 'skeleton-circle', 'skeleton-avatar-sm');
            avatarImg.style.display = 'block';
        };
    } else {
        // Use default avatar or user's initials
        avatarWrapper.classList.remove('skeleton', 'skeleton-circle', 'skeleton-avatar-sm');
        avatarWrapper.innerHTML = '<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; font-weight: bold;">' +
            (user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U') + '</div>';
    }
}

function setupPostCreation() {
    // Post type selection
    document.querySelectorAll('.post-type-card').forEach(card => {
        card.addEventListener('click', () => {
            const postType = card.dataset.postType;
            selectPostType(postType);
        });
    });

    // Modal event listeners
    const modal = document.getElementById('createPostModal');
    modal.addEventListener('show.bs.modal', (event) => {
        const button = event.relatedTarget;
        const postType = button?.dataset.postType;
        if (postType) {
            selectPostType(postType);
        }
    });

    modal.addEventListener('hidden.bs.modal', () => {
        resetPostCreation();
    });

    // Back button
    document.getElementById('backToSelection').addEventListener('click', () => {
        showPostTypeSelection();
    });

    // Create post button
    document.getElementById('createPostBtn').addEventListener('click', () => {
        createPost();
    });

    // Month selection for month posts
    document.getElementById('monthSelect').addEventListener('change', (e) => {
        const monthId = e.target.value;
        if (monthId) {
            selectedMonth = userMonths.find(m => m.id === monthId);
            showMonthPreview(selectedMonth);
            showImageSelection(selectedMonth);
        }
    });

    // Text option radio buttons
    document.querySelectorAll('input[name="textOption"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const customTextArea = document.getElementById('custom-text-area');
            if (e.target.value === 'custom') {
                customTextArea.style.display = 'block';
            } else {
                customTextArea.style.display = 'none';
            }
        });
    });

    // Character counters
    document.getElementById('customPostText').addEventListener('input', (e) => {
        document.getElementById('customTextCounter').textContent = e.target.value.length;
    });

    document.getElementById('transformationText').addEventListener('input', (e) => {
        document.getElementById('transformationTextCounter').textContent = e.target.value.length;
    });

    // Transformation month selections
    document.getElementById('beforeMonthSelect').addEventListener('change', (e) => {
        const monthId = e.target.value;
        if (monthId) {
            selectedBeforeMonth = userMonths.find(m => m.id === monthId);
            showBeforeImageSelection(selectedBeforeMonth);
            updateAfterMonthOptions();
        }
    });

    document.getElementById('afterMonthSelect').addEventListener('change', (e) => {
        const monthId = e.target.value;
        if (monthId) {
            selectedAfterMonth = userMonths.find(m => m.id === monthId);
            showAfterImageSelection(selectedAfterMonth);
        }
    });
}

function selectPostType(postType) {
    selectedPostType = postType;

    // Hide type selection
    document.getElementById('post-type-selection').style.display = 'none';

    // Show back button and create button
    document.getElementById('backToSelection').style.display = 'inline-block';
    document.getElementById('createPostBtn').style.display = 'inline-block';

    if (postType === 'month') {
        document.getElementById('month-post-creation').style.display = 'block';
        document.getElementById('createPostModalLabel').innerHTML = '<i class="bi bi-calendar-check me-2"></i>Share a Month';
        populateMonthOptions();
    } else if (postType === 'transformation') {
        document.getElementById('transformation-post-creation').style.display = 'block';
        document.getElementById('createPostModalLabel').innerHTML = '<i class="bi bi-arrow-left-right me-2"></i>Transformation Post';
        populateTransformationMonthOptions();
    }
}

function showPostTypeSelection() {
    // Hide creation forms
    document.getElementById('post-type-selection').style.display = 'block';
    document.getElementById('month-post-creation').style.display = 'none';
    document.getElementById('transformation-post-creation').style.display = 'none';

    // Hide buttons
    document.getElementById('backToSelection').style.display = 'none';
    document.getElementById('createPostBtn').style.display = 'none';

    // Reset title
    document.getElementById('createPostModalLabel').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Create Post';
}

function populateMonthOptions() {
    const monthSelect = document.getElementById('monthSelect');
    monthSelect.innerHTML = '<option value="">Choose a month to share...</option>';

    userMonths.forEach(month => {
        if (month.imageUrls && month.imageUrls.length > 0) {
            const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
            const option = document.createElement('option');
            option.value = month.id;
            option.textContent = `${monthName} ${month.year}`;
            monthSelect.appendChild(option);
        }
    });
}

function populateTransformationMonthOptions() {
    const beforeSelect = document.getElementById('beforeMonthSelect');
    const afterSelect = document.getElementById('afterMonthSelect');

    beforeSelect.innerHTML = '<option value="">Choose month for BEFORE image...</option>';
    afterSelect.innerHTML = '<option value="">Choose month for AFTER image...</option>';

    userMonths.forEach(month => {
        if (month.imageUrls && month.imageUrls.length > 0) {
            const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
            const option1 = document.createElement('option');
            const option2 = document.createElement('option');

            option1.value = month.id;
            option1.textContent = `${monthName} ${month.year}`;
            option2.value = month.id;
            option2.textContent = `${monthName} ${month.year}`;

            beforeSelect.appendChild(option1);
            afterSelect.appendChild(option2);
        }
    });
}

function showMonthPreview(month) {
    const preview = document.getElementById('month-preview');
    const imagesContainer = document.getElementById('month-preview-images');
    const title = document.getElementById('month-preview-title');
    const description = document.getElementById('month-preview-description');
    const weight = document.getElementById('month-preview-weight');
    const rating = document.getElementById('month-preview-rating');

    // Clear previous images
    imagesContainer.innerHTML = '';

    // Show first few images
    const imagesToShow = month.imageUrls.slice(0, 3);
    imagesToShow.forEach(imageUrl => {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'img-thumbnail';
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'cover';
        imagesContainer.appendChild(img);
    });

    if (month.imageUrls.length > 3) {
        const moreIndicator = document.createElement('div');
        moreIndicator.className = 'img-thumbnail d-flex align-items-center justify-content-center text-muted';
        moreIndicator.style.width = '60px';
        moreIndicator.style.height = '60px';
        moreIndicator.innerHTML = `+${month.imageUrls.length - 3}`;
        imagesContainer.appendChild(moreIndicator);
    }

    // Update text content
    const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
    title.textContent = `${monthName} ${month.year}`;
    description.textContent = month.description || 'No description available';
    weight.textContent = month.weight ? `Weight: ${month.weight} kg` : 'Weight: Not recorded';
    rating.textContent = `Rating: ${month.rating || 'N/A'}/10`;

    preview.style.display = 'block';
}

function showImageSelection(month) {
    const container = document.getElementById('image-options');
    container.innerHTML = '';

    month.imageUrls.forEach((imageUrl, index) => {
        const imageOption = document.createElement('div');
        imageOption.className = 'image-option';
        imageOption.style.cursor = 'pointer';
        imageOption.innerHTML = `
            <img src="${imageUrl}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;" />
            <div class="text-center mt-1">
                <input type="radio" name="selectedImage" value="${imageUrl}" id="img-${index}">
                <label for="img-${index}" class="small">Select</label>
            </div>
        `;

        imageOption.addEventListener('click', () => {
            document.getElementById(`img-${index}`).checked = true;
            selectedImage = imageUrl;
            showTextOption();
        });

        container.appendChild(imageOption);
    });

    document.getElementById('image-selection').style.display = 'block';
}

function showTextOption() {
    document.getElementById('text-option').style.display = 'block';
}

function showBeforeImageSelection(month) {
    const container = document.getElementById('before-image-options');
    container.innerHTML = '';

    month.imageUrls.forEach((imageUrl, index) => {
        const imageOption = document.createElement('div');
        imageOption.className = 'image-option';
        imageOption.style.cursor = 'pointer';
        imageOption.innerHTML = `
            <img src="${imageUrl}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;" />
            <div class="text-center mt-1">
                <input type="radio" name="selectedBeforeImage" value="${imageUrl}" id="before-img-${index}">
                <label for="before-img-${index}" class="small">Select</label>
            </div>
        `;

        imageOption.addEventListener('click', () => {
            document.getElementById(`before-img-${index}`).checked = true;
            selectedBeforeImage = imageUrl;
            updateTransformationPreview();
        });

        container.appendChild(imageOption);
    });

    document.getElementById('before-image-selection').style.display = 'block';
}

function showAfterImageSelection(month) {
    const container = document.getElementById('after-image-options');
    container.innerHTML = '';

    month.imageUrls.forEach((imageUrl, index) => {
        const imageOption = document.createElement('div');
        imageOption.className = 'image-option';
        imageOption.style.cursor = 'pointer';
        imageOption.innerHTML = `
            <img src="${imageUrl}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;" />
            <div class="text-center mt-1">
                <input type="radio" name="selectedAfterImage" value="${imageUrl}" id="after-img-${index}">
                <label for="after-img-${index}" class="small">Select</label>
            </div>
        `;

        imageOption.addEventListener('click', () => {
            document.getElementById(`after-img-${index}`).checked = true;
            selectedAfterImage = imageUrl;
            updateTransformationPreview();
        });

        container.appendChild(imageOption);
    });

    document.getElementById('after-image-selection').style.display = 'block';
}

function updateAfterMonthOptions() {
    const afterSelect = document.getElementById('afterMonthSelect');
    afterSelect.innerHTML = '<option value="">Choose month for AFTER image...</option>';

    if (!selectedBeforeMonth) return;

    // Only show months that are more recent than the before month
    const beforeDate = getMonthDate(selectedBeforeMonth);

    userMonths.forEach(month => {
        if (month.imageUrls && month.imageUrls.length > 0 && month.id !== selectedBeforeMonth.id) {
            const monthDate = getMonthDate(month);
            if (monthDate > beforeDate) {
                const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
                const option = document.createElement('option');
                option.value = month.id;
                option.textContent = `${monthName} ${month.year}`;
                afterSelect.appendChild(option);
            }
        }
    });
}

function getMonthDate(month) {
    const monthNames = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    const monthIndex = monthNames[month.month?.toLowerCase()] || 0;
    return new Date(month.year || 2024, monthIndex);
}

function updateTransformationPreview() {
    if (selectedBeforeImage && selectedAfterImage && selectedBeforeMonth && selectedAfterMonth) {
        const preview = document.getElementById('transformation-preview');
        const beforeImg = document.getElementById('before-preview-img');
        const afterImg = document.getElementById('after-preview-img');
        const beforeDate = document.getElementById('before-date');
        const afterDate = document.getElementById('after-date');

        beforeImg.src = selectedBeforeImage;
        afterImg.src = selectedAfterImage;

        const beforeMonthName = selectedBeforeMonth.month ? selectedBeforeMonth.month.charAt(0).toUpperCase() + selectedBeforeMonth.month.slice(1) : 'Unknown';
        const afterMonthName = selectedAfterMonth.month ? selectedAfterMonth.month.charAt(0).toUpperCase() + selectedAfterMonth.month.slice(1) : 'Unknown';

        beforeDate.textContent = `${beforeMonthName} ${selectedBeforeMonth.year}`;
        afterDate.textContent = `${afterMonthName} ${selectedAfterMonth.year}`;

        preview.style.display = 'block';
    }
}

async function createPost() {
    const user = auth.currentUser;
    if (!user) return;

    const createBtn = document.getElementById('createPostBtn');
    const spinner = document.getElementById('createPostSpinner');
    const errorDiv = document.getElementById('createPostError');

    try {
        // Show loading state
        createBtn.disabled = true;
        spinner.style.display = 'inline-block';
        errorDiv.style.display = 'none';

        let postData;

        if (selectedPostType === 'month') {
            if (!selectedMonth || !selectedImage) {
                throw new Error('Please select a month and image');
            }

            const textOption = document.querySelector('input[name="textOption"]:checked').value;
            const postText = textOption === 'custom' ?
                document.getElementById('customPostText').value.trim() :
                selectedMonth.description || '';

            postData = {
                type: 'month',
                userId: user.uid,
                userDisplayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
                userPhotoURL: user.photoURL || null,
                monthId: selectedMonth.id,
                monthData: {
                    month: selectedMonth.month,
                    year: selectedMonth.year,
                    weight: selectedMonth.weight,
                    rating: selectedMonth.rating,
                    gymVisits: selectedMonth.gymVisits
                },
                imageUrl: selectedImage,
                text: postText,
                createdAt: serverTimestamp(),
                likes: [],
                comments: []
            };

        } else if (selectedPostType === 'transformation') {
            if (!selectedBeforeMonth || !selectedAfterMonth || !selectedBeforeImage || !selectedAfterImage) {
                throw new Error('Please select both before and after months and images');
            }

            const transformationText = document.getElementById('transformationText').value.trim();
            if (!transformationText) {
                throw new Error('Please write your transformation story');
            }

            postData = {
                type: 'transformation',
                userId: user.uid,
                userDisplayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
                userPhotoURL: user.photoURL || null,
                beforeMonth: {
                    id: selectedBeforeMonth.id,
                    month: selectedBeforeMonth.month,
                    year: selectedBeforeMonth.year,
                    weight: selectedBeforeMonth.weight
                },
                afterMonth: {
                    id: selectedAfterMonth.id,
                    month: selectedAfterMonth.month,
                    year: selectedAfterMonth.year,
                    weight: selectedAfterMonth.weight
                },
                beforeImage: selectedBeforeImage,
                afterImage: selectedAfterImage,
                text: transformationText,
                createdAt: serverTimestamp(),
                likes: [],
                comments: []
            };
        } else {
            throw new Error('Invalid post type');
        }

        // Create the post in Firestore
        const postsRef = collection(db, "posts");
        await addDoc(postsRef, postData);

        // Show success and close modal
        showToast('success', 'Post created successfully!');

        const modal = bootstrap.Modal.getInstance(document.getElementById('createPostModal'));
        modal.hide();

        // Refresh feed to show the new post
        loadFeedPosts();

    } catch (error) {
        console.error('Error creating post:', error);
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        // Hide loading state
        createBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

function resetPostCreation() {
    // Reset all variables
    selectedPostType = '';
    selectedMonth = null;
    selectedImage = '';
    selectedBeforeMonth = null;
    selectedAfterMonth = null;
    selectedBeforeImage = '';
    selectedAfterImage = '';

    // Reset form
    document.getElementById('monthSelect').value = '';
    document.getElementById('beforeMonthSelect').value = '';
    document.getElementById('afterMonthSelect').value = '';
    document.getElementById('customPostText').value = '';
    document.getElementById('transformationText').value = '';
    document.getElementById('useOriginalText').checked = true;

    // Hide all sections
    document.getElementById('month-preview').style.display = 'none';
    document.getElementById('image-selection').style.display = 'none';
    document.getElementById('text-option').style.display = 'none';
    document.getElementById('custom-text-area').style.display = 'none';
    document.getElementById('before-image-selection').style.display = 'none';
    document.getElementById('after-image-selection').style.display = 'none';
    document.getElementById('transformation-preview').style.display = 'none';

    // Show type selection
    showPostTypeSelection();
}

function showToast(type, message) {
    const toastContainer = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');

    const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';

    toast.innerHTML = `
        <div class="toast-header ${bgClass} text-white">
            <i class="bi ${icon} me-2"></i>
            <strong class="me-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Feed loading functions
async function loadFeedPosts() {
    const feedContainer = document.getElementById('feed-posts');

    try {
        // Show loading skeleton
        showFeedLoading(feedContainer);

        // Get current user and their following list
        const currentUser = auth.currentUser;
        if (!currentUser) {
            // Not signed in - show empty
            feedContainer.innerHTML = '';
            showEmptyFeedMessage(feedContainer);
            return;
        }

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        let followingList = userDoc.exists() ? (userDoc.data().following || []) : [];

        // Always include the current user's own UID so their posts show up in the feed
        if (!followingList.includes(currentUser.uid)) {
            followingList.push(currentUser.uid);
        }

        // If user follows nobody (and no own posts), show an empty feed message
        if (!followingList || followingList.length === 0) {
            feedContainer.innerHTML = '';
            feedContainer.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-people text-muted" style="font-size: 3rem"></i>
                    <h5 class="mt-3 text-muted">Your feed is empty</h5>
                    <p class="text-muted">You are not following anyone yet. Follow users to see their posts here.</p>
                </div>
            `;
            return;
        }

        // Firestore 'in' queries are limited to 10 values - batch if needed
        const posts = [];
        const BATCH_SIZE = 10;
        for (let i = 0; i < followingList.length; i += BATCH_SIZE) {
            const batch = followingList.slice(i, i + BATCH_SIZE);
            const postsRef = collection(db, 'posts');
            const postsQuery = query(postsRef, where('userId', 'in', batch), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(postsQuery);
            snapshot.forEach(docSnap => posts.push({ id: docSnap.id, ...docSnap.data() }));
        }

        // Sort combined posts by createdAt descending
        posts.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
        });

        // Clear loading and display posts
        feedContainer.innerHTML = '';

        if (posts.length === 0) {
            showEmptyFeedMessage(feedContainer);
        } else {
            posts.forEach(post => {
                const postElement = createPostElement(post);
                feedContainer.appendChild(postElement);
            });
        }

    } catch (error) {
        console.error('Error loading feed posts:', error);
        showFeedError(feedContainer);
    }
}

function showFeedLoading(container) {
    // Skeleton loading cards similar to other pages
    container.innerHTML = `
        <div class="d-flex flex-column gap-3 py-3" id="feed-loading-skeleton">
            <div class="card shadow-sm p-3">
                <div class="d-flex gap-3">
                    <div class="skeleton skeleton-circle skeleton-avatar-sm"></div>
                    <div class="flex-grow-1">
                        <div class="skeleton skeleton-text mb-2" style="width:40%"></div>
                        <div class="skeleton" style="height:180px; margin-top:8px"></div>
                    </div>
                </div>
            </div>
            <div class="card shadow-sm p-3">
                <div class="d-flex gap-3">
                    <div class="skeleton skeleton-circle skeleton-avatar-sm"></div>
                    <div class="flex-grow-1">
                        <div class="skeleton skeleton-text mb-2" style="width:30%"></div>
                        <div class="skeleton" style="height:140px; margin-top:8px"></div>
                    </div>
                </div>
            </div>
            <div class="card shadow-sm p-3">
                <div class="d-flex gap-3">
                    <div class="skeleton skeleton-circle skeleton-avatar-sm"></div>
                    <div class="flex-grow-1">
                        <div class="skeleton skeleton-text mb-2" style="width:50%"></div>
                        <div class="skeleton" style="height:160px; margin-top:8px"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showEmptyFeedMessage(container) {
    container.innerHTML = `
        <div class="text-center py-5">
            <i class="bi bi-rss text-muted" style="font-size: 3rem;"></i>
            <h5 class="mt-3 text-muted">No posts yet</h5>
            <p class="text-muted">Follow other users or create your first post to see content here!</p>
        </div>
    `;
}

function showFeedError(container) {
    container.innerHTML = `
        <div class="text-center py-5">
            <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Error loading posts</h5>
            <button class="btn btn-outline-primary mt-2" onclick="loadFeedPosts()">
                <i class="bi bi-arrow-clockwise me-2"></i>Try again
            </button>
        </div>
    `;
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'card shadow-sm';

    const timeAgo = getTimeAgo(post.createdAt);
    const userName = post.userDisplayName || 'Anonymous';
    const userAvatar = post.userPhotoURL || null;

    if (post.type === 'month') {
        postDiv.innerHTML = createMonthPostHTML(post, userName, userAvatar, timeAgo);
    } else if (post.type === 'transformation') {
        postDiv.innerHTML = createTransformationPostHTML(post, userName, userAvatar, timeAgo);
    }

    return postDiv;
}

function createMonthPostHTML(post, userName, userAvatar, timeAgo) {
    const monthName = post.monthData.month ?
        post.monthData.month.charAt(0).toUpperCase() + post.monthData.month.slice(1) : 'Unknown';

    const avatarHTML = userAvatar ?
        `<img src="${userAvatar}" class="rounded-circle me-3" style="width: 40px; height: 40px; object-fit: cover;">` :
        `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: bold;">${userName.charAt(0).toUpperCase()}</div>`;

    return `
        <div class="card-header border-0 pb-0">
            <div class="d-flex align-items-center">
                ${avatarHTML}
                <div class="flex-grow-1">
                    <h6 class="mb-0 fw-bold">${userName}</h6>
                    <small class="text-muted">
                        <i class="bi bi-calendar-check me-1"></i>
                        Shared ${monthName} ${post.monthData.year} • ${timeAgo}
                    </small>
                </div>
            </div>
        </div>
        <div class="card-body pt-3">
            ${post.text ? `<p class="mb-3">${post.text}</p>` : ''}
            <div class="position-relative">
                <img src="${post.imageUrl}" class="img-fluid rounded month-post-image">

            </div>
            <div class="row mt-3 text-center">
                ${post.monthData.weight ? `
                <div class="col-4">
                    <div class="border-end">
                        <strong class="d-block">${post.monthData.weight} kg</strong>
                        <small class="text-muted">Weight</small>
                    </div>
                </div>` : ''}
                ${post.monthData.gymVisits ? `
                <div class="col-4">
                    <div class="border-end">
                        <strong class="d-block">${post.monthData.gymVisits}</strong>
                        <small class="text-muted">Gym Visits</small>
                    </div>
                </div>` : ''}
                ${post.monthData.rating ? `
                <div class="col-4">
                    <strong class="d-block">${post.monthData.rating}/10</strong>
                    <small class="text-muted">Rating</small>
                </div>` : ''}
            </div>
        </div>
        <div class="card-footer border-0 pt-0">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex gap-3">
                    <button class="btn btn-link p-0 text-muted">
                        <i class="bi bi-heart me-1"></i>${post.likes ? post.likes.length : 0}
                    </button>
                    <button class="btn btn-link p-0 text-muted">
                        <i class="bi bi-chat me-1"></i>${post.comments ? post.comments.length : 0}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createTransformationPostHTML(post, userName, userAvatar, timeAgo) {
    const beforeMonthName = post.beforeMonth.month ?
        post.beforeMonth.month.charAt(0).toUpperCase() + post.beforeMonth.month.slice(1) : 'Unknown';
    const afterMonthName = post.afterMonth.month ?
        post.afterMonth.month.charAt(0).toUpperCase() + post.afterMonth.month.slice(1) : 'Unknown';

    const avatarHTML = userAvatar ?
        `<img src="${userAvatar}" class="rounded-circle me-3" style="width: 40px; height: 40px; object-fit: cover;">` :
        `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: bold;">${userName.charAt(0).toUpperCase()}</div>`;

    const weightChange = post.beforeMonth.weight && post.afterMonth.weight ?
        (post.afterMonth.weight - post.beforeMonth.weight).toFixed(1) : null;

    return `
        <div class="card-header border-0 pb-0">
            <div class="d-flex align-items-center">
                ${avatarHTML}
                <div class="flex-grow-1">
                    <h6 class="mb-0 fw-bold">${userName}</h6>
                    <small class="text-muted">
                        <i class="bi bi-arrow-left-right me-1"></i>
                        Transformation Post • ${timeAgo}
                    </small>
                </div>
            </div>
        </div>
        <div class="card-body pt-3">
            <p class="mb-3">${post.text}</p>
           <div class="row transformation-post">
            <div class="col-6">
                <div class="text-center">
                    <h6 class="mb-2 text-muted">BEFORE</h6>
                    <img src="${post.beforeImage}" class="img-fluid transformation-image">
                    <p class="mb-1 mt-2"><strong>${post.beforeMonth?.weight ? post.beforeMonth.weight + ' kg' : '--'}</strong></p>
                    <small class="text-muted">${beforeMonthName} ${post.beforeMonth?.year || ''}</small>
                </div>
            </div>
            <div class="col-6">
                <div class="text-center">
                    <h6 class="mb-2 text-muted">AFTER</h6>
                    <img src="${post.afterImage}" class="img-fluid transformation-image">
                    <p class="mb-1 mt-2"><strong>${post.afterMonth?.weight ? post.afterMonth.weight + ' kg' : '--'}</strong></p>
                    <small class="text-muted">${afterMonthName} ${post.afterMonth?.year || ''}</small>
                </div>
            </div>
        </div>

            ${weightChange ? `
            <div class="text-center mt-3">
                <span class="badge ${weightChange > 0 ? 'bg-success' : 'bg-primary'} fs-6">
                    ${weightChange > 0 ? '+' : ''}${weightChange} kg change
                </span>
            </div>` : ''}
        </div>
        <div class="card-footer border-0 pt-0">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex gap-3">
                    <button class="btn btn-link p-0 text-muted">
                        <i class="bi bi-heart me-1"></i>${post.likes ? post.likes.length : 0}
                    </button>
                    <button class="btn btn-link p-0 text-muted">
                        <i class="bi bi-chat me-1"></i>${post.comments ? post.comments.length : 0}
                    </button>
                </div>
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

// Make loadFeedPosts globally accessible for retry button
window.loadFeedPosts = loadFeedPosts;
