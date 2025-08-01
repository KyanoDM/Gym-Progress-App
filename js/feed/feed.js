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

        // Refresh feed (placeholder for now)
        // loadFeedPosts();

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
