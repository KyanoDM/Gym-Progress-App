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
    updateDoc,
    arrayUnion,
    arrayRemove,
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

        // Load user's months for post creation
        await loadUserMonths(user.uid);
        loadUserAvatar(user);
        
        // Load and display feed posts
        await loadFeedPosts();
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
        await loadFeedPosts();    } catch (error) {
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

    // Reset character counters
    document.getElementById('customTextCounter').textContent = '0';
    document.getElementById('transformationTextCounter').textContent = '0';

    // Hide error message
    const errorDiv = document.getElementById('createPostError');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }

    // Reset loading state
    const createBtn = document.getElementById('createPostBtn');
    const spinner = document.getElementById('createPostSpinner');
    if (createBtn) createBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';

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

async function loadFeedPosts() {
    const postsLoading = document.getElementById('posts-loading');
    const noPostsMessage = document.getElementById('no-posts-message');
    const feedContainer = document.getElementById('feed-posts');
    
    try {
        // Show loading animation
        postsLoading.style.display = 'block';
        noPostsMessage.style.display = 'none';
        
        const postsRef = collection(db, "posts");
        const q = query(postsRef, orderBy("createdAt", "desc"));
        
        const querySnapshot = await getDocs(q);
        const posts = [];
        
        querySnapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        
        // Hide loading animation
        postsLoading.style.display = 'none';
        
        displayPosts(posts);
        
    } catch (error) {
        console.error("Error loading posts:", error);
        postsLoading.style.display = 'none';
        feedContainer.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-triangle text-muted" style="font-size: 3rem;"></i>
                <h5 class="mt-3 text-muted">Error loading posts</h5>
                <p class="text-muted">Please try refreshing the page.</p>
            </div>
        `;
    }
}

function displayPosts(posts) {
    const feedContainer = document.getElementById('feed-posts');
    const postsLoading = document.getElementById('posts-loading');
    const noPostsMessage = document.getElementById('no-posts-message');
    
    // Hide loading
    postsLoading.style.display = 'none';
    
    if (posts.length === 0) {
        noPostsMessage.style.display = 'block';
        return;
    }
    
    // Hide no posts message and clear existing posts
    noPostsMessage.style.display = 'none';
    
    // Clear existing posts but keep loading and no-posts elements
    const existingPosts = feedContainer.querySelectorAll('.card');
    existingPosts.forEach(post => post.remove());
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        feedContainer.appendChild(postElement);
    });
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'card border-0 shadow-sm';
    
    // Format date
    const createdAt = post.createdAt ? new Date(post.createdAt.seconds * 1000) : new Date();
    const timeAgo = getTimeAgo(createdAt);
    
    if (post.type === 'month') {
        postDiv.innerHTML = `
            <div class="card-body">
                <!-- User info -->
                <div class="d-flex align-items-center mb-3">
                    ${post.userPhotoURL ? 
                        `<img src="${post.userPhotoURL}" alt="User avatar" class="rounded-circle me-3" width="40" height="40">` :
                        `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: bold;">
                            ${post.userDisplayName ? post.userDisplayName.charAt(0).toUpperCase() : 'U'}
                        </div>`
                    }
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${post.userDisplayName || 'Anonymous'}</h6>
                        <small class="text-muted">${timeAgo}</small>
                    </div>
                </div>
                
                <!-- Post content -->
                <div class="mb-3">
                    <h6 class="mb-2">
                        <i class="bi bi-calendar-check me-2 text-primary"></i>
                        ${post.monthData.month ? post.monthData.month.charAt(0).toUpperCase() + post.monthData.month.slice(1) : 'Unknown'} ${post.monthData.year}
                    </h6>
                    ${post.text ? `<p class="mb-3">${post.text}</p>` : ''}
                </div>
                
                <!-- Month image -->
                <div class="mb-3">
                    <div class="d-flex justify-content-center">
                        <img src="${post.imageUrl}" alt="Progress photo" class="img-fluid rounded" style="max-height: 500px; max-width: 100%; object-fit: contain;">
                    </div>
                </div>
                
                <!-- Month stats -->
                <div class="row text-center border-top pt-3">
                    ${post.monthData.weight ? `
                        <div class="col-4">
                            <div class="fw-bold">${post.monthData.weight}kg</div>
                            <small class="text-muted">Weight</small>
                        </div>
                    ` : ''}
                    ${post.monthData.rating ? `
                        <div class="col-4">
                            <div class="fw-bold">${post.monthData.rating}/10</div>
                            <small class="text-muted">Rating</small>
                        </div>
                    ` : ''}
                    ${post.monthData.gymVisits ? `
                        <div class="col-4">
                            <div class="fw-bold">${post.monthData.gymVisits}</div>
                            <small class="text-muted">Gym Visits</small>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Post actions -->
                <div class="border-top pt-3 mt-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex gap-3">
                            <button class="btn btn-link p-0 text-muted like-btn" onclick="toggleLike('${post.id}')" data-post-id="${post.id}">
                                <i class="bi bi-heart${post.likes && post.likes.includes(auth.currentUser?.uid) ? '-fill text-danger' : ''} me-1"></i>
                                <span class="like-count">${post.likes ? post.likes.length : 0}</span>
                            </button>
                            <button class="btn btn-link p-0 text-muted comment-btn" onclick="toggleComments('${post.id}')">
                                <i class="bi bi-chat me-1"></i>
                                <span>${post.comments ? post.comments.length : 0}</span>
                            </button>
                        </div>
                        <button class="btn btn-link p-0 text-muted">
                            <i class="bi bi-share"></i>
                        </button>
                    </div>
                    
                    <!-- Comments Section -->
                    <div class="comments-section mt-3" id="comments-${post.id}" style="display: none;">
                        <div class="border-top pt-3">
                            <!-- Add Comment Form -->
                            <div class="d-flex gap-2 mb-3">
                                <img src="${auth.currentUser?.photoURL || ''}" alt="Your avatar" class="rounded-circle" width="32" height="32" style="object-fit: cover;">
                                <div class="flex-grow-1">
                                    <div class="input-group">
                                        <input type="text" class="form-control form-control-sm" placeholder="Write a comment..." id="comment-input-${post.id}">
                                        <button class="btn btn-primary btn-sm" onclick="addComment('${post.id}')">
                                            <i class="bi bi-send"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Comments List -->
                            <div id="comments-list-${post.id}">
                                ${post.comments ? post.comments.map(comment => `
                                    <div class="d-flex gap-2 mb-2">
                                        <img src="${comment.userPhotoURL || ''}" alt="User avatar" class="rounded-circle" width="32" height="32" style="object-fit: cover;">
                                        <div class="flex-grow-1">
                                            <div class="bg-light rounded p-2">
                                                <small class="fw-bold">${comment.userDisplayName || 'Anonymous'}</small>
                                                <p class="mb-0 small">${comment.text}</p>
                                            </div>
                                            <small class="text-muted">${getTimeAgo(new Date(comment.createdAt?.seconds * 1000 || Date.now()))}</small>
                                        </div>
                                    </div>
                                `).join('') : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (post.type === 'transformation') {
        const beforeMonthName = post.beforeMonth.month ? post.beforeMonth.month.charAt(0).toUpperCase() + post.beforeMonth.month.slice(1) : 'Unknown';
        const afterMonthName = post.afterMonth.month ? post.afterMonth.month.charAt(0).toUpperCase() + post.afterMonth.month.slice(1) : 'Unknown';
        
        postDiv.innerHTML = `
            <div class="card-body">
                <!-- User info -->
                <div class="d-flex align-items-center mb-3">
                    ${post.userPhotoURL ? 
                        `<img src="${post.userPhotoURL}" alt="User avatar" class="rounded-circle me-3" width="40" height="40">` :
                        `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: bold;">
                            ${post.userDisplayName ? post.userDisplayName.charAt(0).toUpperCase() : 'U'}
                        </div>`
                    }
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${post.userDisplayName || 'Anonymous'}</h6>
                        <small class="text-muted">${timeAgo}</small>
                    </div>
                </div>
                
                <!-- Post content -->
                <div class="mb-3">
                    <h6 class="mb-2">
                        <i class="bi bi-arrow-left-right me-2 text-success"></i>
                        Transformation Progress
                    </h6>
                    ${post.text ? `<p class="mb-3">${post.text}</p>` : ''}
                </div>
                
                <!-- Transformation images -->
                <div class="row mb-3">
                    <div class="col-6">
                        <div class="text-center">
                            <img src="${post.beforeImage}" alt="Before" class="img-fluid rounded mb-2" style="max-height: 400px; width: 100%; object-fit: contain;">
                            <div class="small text-muted">
                                <strong>Before</strong><br>
                                ${beforeMonthName} ${post.beforeMonth.year}
                                ${post.beforeMonth.weight ? `<br>${post.beforeMonth.weight}kg` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="text-center">
                            <img src="${post.afterImage}" alt="After" class="img-fluid rounded mb-2" style="max-height: 400px; width: 100%; object-fit: contain;">
                            <div class="small text-muted">
                                <strong>After</strong><br>
                                ${afterMonthName} ${post.afterMonth.year}
                                ${post.afterMonth.weight ? `<br>${post.afterMonth.weight}kg` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Weight change info -->
                ${post.beforeMonth.weight && post.afterMonth.weight ? `
                    <div class="text-center mb-3 p-2 bg-light rounded">
                        <small class="text-muted">
                            Weight change: 
                            <strong class="${post.afterMonth.weight > post.beforeMonth.weight ? 'text-success' : 'text-primary'}">
                                ${post.afterMonth.weight > post.beforeMonth.weight ? '+' : ''}${(post.afterMonth.weight - post.beforeMonth.weight).toFixed(1)}kg
                            </strong>
                        </small>
                    </div>
                ` : ''}
                
                <!-- Post actions -->
                <div class="border-top pt-3 mt-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex gap-3">
                            <button class="btn btn-link p-0 text-muted like-btn" onclick="toggleLike('${post.id}')" data-post-id="${post.id}">
                                <i class="bi bi-heart${post.likes && post.likes.includes(auth.currentUser?.uid) ? '-fill text-danger' : ''} me-1"></i>
                                <span class="like-count">${post.likes ? post.likes.length : 0}</span>
                            </button>
                            <button class="btn btn-link p-0 text-muted comment-btn" onclick="toggleComments('${post.id}')">
                                <i class="bi bi-chat me-1"></i>
                                <span>${post.comments ? post.comments.length : 0}</span>
                            </button>
                        </div>
                        <button class="btn btn-link p-0 text-muted">
                            <i class="bi bi-share"></i>
                        </button>
                    </div>
                    
                    <!-- Comments Section -->
                    <div class="comments-section mt-3" id="comments-${post.id}" style="display: none;">
                        <div class="border-top pt-3">
                            <!-- Add Comment Form -->
                            <div class="d-flex gap-2 mb-3">
                                <img src="${auth.currentUser?.photoURL || ''}" alt="Your avatar" class="rounded-circle" width="32" height="32" style="object-fit: cover;">
                                <div class="flex-grow-1">
                                    <div class="input-group">
                                        <input type="text" class="form-control form-control-sm" placeholder="Write a comment..." id="comment-input-${post.id}">
                                        <button class="btn btn-primary btn-sm" onclick="addComment('${post.id}')">
                                            <i class="bi bi-send"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Comments List -->
                            <div id="comments-list-${post.id}">
                                ${post.comments ? post.comments.map(comment => `
                                    <div class="d-flex gap-2 mb-2">
                                        <img src="${comment.userPhotoURL || ''}" alt="User avatar" class="rounded-circle" width="32" height="32" style="object-fit: cover;">
                                        <div class="flex-grow-1">
                                            <div class="bg-light rounded p-2">
                                                <small class="fw-bold">${comment.userDisplayName || 'Anonymous'}</small>
                                                <p class="mb-0 small">${comment.text}</p>
                                            </div>
                                            <small class="text-muted">${getTimeAgo(new Date(comment.createdAt?.seconds * 1000 || Date.now()))}</small>
                                        </div>
                                    </div>
                                `).join('') : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add event listener for Enter key on comment inputs
    const commentInput = postDiv.querySelector(`#comment-input-${post.id}`);
    if (commentInput) {
        commentInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                addComment(post.id);
            }
        });
    }
    
    return postDiv;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Like and Comment functionality
async function toggleLike(postId) {
    const user = auth.currentUser;
    if (!user) {
        showToast('error', 'Please log in to like posts');
        return;
    }

    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) {
            showToast('error', 'Post not found');
            return;
        }

        const postData = postSnap.data();
        const likes = postData.likes || [];
        const userLiked = likes.includes(user.uid);

        if (userLiked) {
            // Unlike the post
            await updateDoc(postRef, {
                likes: arrayRemove(user.uid)
            });
        } else {
            // Like the post
            await updateDoc(postRef, {
                likes: arrayUnion(user.uid)
            });
        }

        // Update UI immediately
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] i`);
        const likeCount = document.querySelector(`[data-post-id="${postId}"] .like-count`);
        
        if (userLiked) {
            likeBtn.className = 'bi bi-heart me-1';
            likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
        } else {
            likeBtn.className = 'bi bi-heart-fill text-danger me-1';
            likeCount.textContent = parseInt(likeCount.textContent) + 1;
        }

    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('error', 'Failed to update like');
    }
}

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
    } else {
        commentsSection.style.display = 'none';
    }
}

async function addComment(postId) {
    const user = auth.currentUser;
    if (!user) {
        showToast('error', 'Please log in to comment');
        return;
    }

    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentText = commentInput.value.trim();
    
    if (!commentText) {
        showToast('error', 'Please enter a comment');
        return;
    }

    try {
        const postRef = doc(db, "posts", postId);
        const newComment = {
            userId: user.uid,
            userDisplayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
            userPhotoURL: user.photoURL || null,
            text: commentText,
            createdAt: serverTimestamp()
        };

        await updateDoc(postRef, {
            comments: arrayUnion(newComment)
        });

        // Clear input
        commentInput.value = '';

        // Add comment to UI immediately
        const commentsList = document.getElementById(`comments-list-${postId}`);
        const commentElement = document.createElement('div');
        commentElement.className = 'd-flex gap-2 mb-2';
        commentElement.innerHTML = `
            <img src="${newComment.userPhotoURL || ''}" alt="User avatar" class="rounded-circle" width="32" height="32" style="object-fit: cover;">
            <div class="flex-grow-1">
                <div class="bg-light rounded p-2">
                    <small class="fw-bold">${newComment.userDisplayName}</small>
                    <p class="mb-0 small">${newComment.text}</p>
                </div>
                <small class="text-muted">Just now</small>
            </div>
        `;
        commentsList.appendChild(commentElement);

        // Update comment count
        const commentBtn = document.querySelector(`button[onclick="toggleComments('${postId}')"] span`);
        if (commentBtn) {
            commentBtn.textContent = parseInt(commentBtn.textContent) + 1;
        }

        showToast('success', 'Comment added successfully');

    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('error', 'Failed to add comment');
    }
}

// Make functions available globally
window.toggleLike = toggleLike;
window.toggleComments = toggleComments;
window.addComment = addComment;

// Handle Enter key in comment inputs
function handleCommentKeypress(event, postId) {
    if (event.key === 'Enter') {
        addComment(postId);
    }
}
window.handleCommentKeypress = handleCommentKeypress;

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
