import { app, storage } from "../firebase/config.js";
import { auth } from "../login/login.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    deleteDoc,
    addDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    ref
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

const db = getFirestore(app); document.addEventListener("DOMContentLoaded", () => {
    Initialize();
});

function Initialize() {
    console.log("Initializing months page...");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user found, redirecting to login");
            window.location.href = "login.html";
            return;
        }

        console.log("User authenticated:", user.uid);
        console.log("User email:", user.email);

        await loadUserMonths(user.uid);
        setupAddMonthButton();
    });
}

async function loadUserMonths(userId) {
    try {
        const monthsContainer = document.querySelector('.months-row');
        if (!monthsContainer) return;

        // Show loading state
        monthsContainer.innerHTML = '<div class="text-center p-4"><i class="bi bi-hourglass-split"></i> Loading months...</div>';

        console.log("Current user ID:", userId);

        // Query user's months from Firestore - simplified query first
        const monthsRef = collection(db, "users", userId, "months");

        const q = query(
            monthsRef,
            where("userId", "==", userId)
            // Remove orderBy for now to avoid index issues
        );

        const querySnapshot = await getDocs(q);
        const months = [];

        querySnapshot.forEach((doc) => {
            console.log("Document data:", doc.data());
            months.push({ id: doc.id, ...doc.data() });
        });

        console.log("Total months found:", months.length);
        console.log("Months data:", months);

        // Sort months manually in JavaScript
        months.sort((a, b) => {
            // Sort by year first (descending), then by month
            if (a.year !== b.year) {
                return b.year - a.year;
            }
            // For month sorting, convert month names to numbers
            const monthOrder = {
                'january': 1, 'february': 2, 'march': 3, 'april': 4,
                'may': 5, 'june': 6, 'july': 7, 'august': 8,
                'september': 9, 'october': 10, 'november': 11, 'december': 12
            };
            const aMonth = monthOrder[a.month?.toLowerCase()] || 0;
            const bMonth = monthOrder[b.month?.toLowerCase()] || 0;
            return bMonth - aMonth;
        });

        // Clear loading state
        monthsContainer.innerHTML = '';

        if (months.length === 0) {
            monthsContainer.innerHTML = `
                <div class="col-12 text-center p-5">
                    <i class="bi bi-calendar-x" style="font-size: 3rem; color: #6c757d;"></i>
                    <h5 class="mt-3 text-muted">No months added yet</h5>
                    <p class="text-muted">Start tracking your progress by adding your first month!</p>
                    <button class="btn btn-primary mt-3" id="addFirstMonthBtn">
                        <i class="bi bi-plus me-2"></i>Add Your First Month
                    </button>
                </div>
            `;

            // Add event listener to the button
            const addFirstMonthBtn = document.getElementById('addFirstMonthBtn');
            if (addFirstMonthBtn) {
                addFirstMonthBtn.addEventListener('click', () => {
                    const modal = new bootstrap.Modal(document.getElementById('addMonthModal'));
                    modal.show();
                    resetAddMonthForm();
                });
            }

            return;
        }

        // Create month cards
        if (months.length > 0) {
            // Add "Add Month" card first
            const addMonthCard = createAddMonthCard();
            monthsContainer.appendChild(addMonthCard);
        }

        months.forEach(month => {
            const monthCard = createMonthCard(month);
            monthsContainer.appendChild(monthCard);
        });

        // Set up toggle functionality after cards are created
        setupDetailsToggle();

    } catch (error) {
        console.error("Error loading months:", error);
        const monthsContainer = document.querySelector('.months-row');
        if (monthsContainer) {
            monthsContainer.innerHTML = `
                <div class="col-12 text-center p-5">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <h5 class="mt-3">Error loading months</h5>
                    <p class="text-muted">Error: ${error.message}</p>
                    <button class="btn btn-outline-secondary mt-2" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Retry
                    </button>
                </div>
            `;
        }
    }
}

function createMonthCard(month) {
    const monthCol = document.createElement('div');
    monthCol.className = 'months-col';

    console.log("Creating card for month:", month);

    // Get the cover image - handle different possible data structures
    let coverImage = 'Image/img.jpg'; // fallback image

    if (month.coverURL) {
        coverImage = month.coverURL;
    } else if (month.imageUrls && month.imageUrls.length > 0) {
        coverImage = month.imageUrls[0];
    } else if (month.imageUrls && typeof month.imageUrls === 'object') {
        // If imageUrls is an object with numeric keys
        const keys = Object.keys(month.imageUrls);
        if (keys.length > 0) {
            coverImage = month.imageUrls[keys[0]];
        }
    }

    // Format month name - handle different cases
    let monthName = month.month || 'Unknown';
    if (monthName && typeof monthName === 'string') {
        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
    }

    const year = month.year || new Date().getFullYear();
    const rating = month.rating || 5;
    const ratingBadgeClass = getRatingBadgeClass(rating);

    // Always start with details hidden - they'll be shown by setupDetailsToggle if needed
    const detailsDisplay = 'none';

    monthCol.innerHTML = `
        <div class="card h-100 shadow-sm month-card">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h6 class="mb-0">
                    <i class="bi bi-calendar3 me-2"></i>${monthName} ${year}
                </h6>
                <div class="d-flex align-items-center gap-2">
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-light" type="button" data-bs-toggle="dropdown">
                            <i class="bi bi-three-dots"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item view-month" href="#" data-month-id="${month.id}">
                                <i class="bi bi-eye me-2"></i>View
                            </a></li>
                            <li><a class="dropdown-item edit-month" href="#" data-month-id="${month.id}">
                                <i class="bi bi-pencil me-2"></i>Edit
                            </a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger delete-month" href="#" data-month-id="${month.id}">
                                <i class="bi bi-trash me-2"></i>Delete
                            </a></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="card-body p-0">
                <div class="position-relative">
                    <img src="${coverImage}" class="card-img-top" alt="${monthName} Progress" 
                         style="height: 150px; object-fit: cover;" 
                         onerror="this.src='Image/img.jpg'">
                </div>
                <div class="p-3">
                    <p class="card-text small mb-2">
                        ${month.description || 'No description available.'}
                    </p>
                    <div class="d-flex flex-wrap gap-2 mb-2 month-details d-none">
                        ${month.weight ? `<span class="badge bg-secondary"><i class="bi bi-speedometer2 me-1"></i>${month.weight} kg</span>` : ''}
                        ${month.gymVisits ? `<span class="badge bg-info"><i class="bi bi-calendar-check me-1"></i>${month.gymVisits} visits</span>` : ''}
                        <span class="badge ${ratingBadgeClass}"><i class="bi bi-star-fill me-1"></i>${rating}/10</span>
                    </div>
                </div>
            </div>
            <div class="card-footer bg-light">
                <div class="d-flex justify-content-between align-items-center">
                    <button class="btn btn-sm btn-outline-primary view-month" data-month-id="${month.id}">
                        <i class="bi bi-arrow-right me-1"></i>View
                    </button>
                    ${month.videoUrl ? `<small class="text-muted"><i class="bi bi-play-circle me-1"></i>Has video</small>` : ''}
                    ${month.imageUrls ? `<small class="text-muted"><i class="bi bi-images me-1"></i>${month.imageUrls.length} images</small>` : ''}
                </div>
            </div>
        </div>
    `;

    // Add event listeners for the dropdown actions
    setupMonthCardEvents(monthCol, month);

    return monthCol;
}

function createAddMonthCard() {
    const addMonthCol = document.createElement('div');
    addMonthCol.className = 'months-col';

    addMonthCol.innerHTML = `
        <div class="card h-100 shadow-sm border-dashed" style="border: 2px dashed #dee2e6; cursor: pointer;">
            <div class="card-body d-flex flex-column justify-content-center align-items-center text-center p-5">
                <i class="bi bi-plus-circle" style="font-size: 3rem; color: #6c757d; margin-bottom: 1rem;"></i>
                <h5 class="text-muted mb-2">Add New Month</h5>
                <p class="text-muted small mb-0">Track your progress for a new month</p>
            </div>
        </div>
    `;

    // Add click event to open modal
    addMonthCol.addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('addMonthModal'));

        // Reset form when modal is fully shown
        const modalElement = document.getElementById('addMonthModal');
        modalElement.addEventListener('shown.bs.modal', function () {
            resetAddMonthForm();
        }, { once: true }); // Use once: true so the event listener is removed after first use

        modal.show();
    });

    return addMonthCol;
}

function setupMonthCardEvents(monthCol, month) {
    // View month
    const viewButtons = monthCol.querySelectorAll('.view-month');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openViewMonthModal(month);
        });
    });

    // Edit month
    const editButton = monthCol.querySelector('.edit-month');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.preventDefault();
            openEditMonthModal(month);
        });
    }

    // Delete month
    const deleteButton = monthCol.querySelector('.delete-month');
    if (deleteButton) {
        deleteButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleDeleteMonth(month.id, month.month, month.year);
        });
    }
}

async function openEditMonthModal(month) {
    // Set global edit mode variables
    window.isEditMode = true;
    window.editingMonthId = month.id;
    window.editingMonthData = month;

    // Open the modal
    const modal = new bootstrap.Modal(document.getElementById('addMonthModal'));

    // Change modal title
    const modalTitle = document.getElementById('addMonthModalLabel');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Month';
    }

    // Change save button text
    const saveBtn = document.getElementById('saveMonthBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" style="display: none;" id="saveSpinner"></span><i class="bi bi-pencil me-2"></i>Update Month';
    }

    // Show modal and populate form when fully shown
    const modalElement = document.getElementById('addMonthModal');
    modalElement.addEventListener('shown.bs.modal', function () {
        populateEditForm(month);
    }, { once: true });

    modal.show();
}

function populateEditForm(month) {
    // Basic Information
    const monthSelect = document.getElementById('monthSelect');
    const yearInput = document.getElementById('yearInput');
    const descriptionInput = document.getElementById('descriptionInput');

    if (monthSelect && month.month) {
        monthSelect.value = month.month.toLowerCase();
    }
    if (yearInput && month.year) {
        yearInput.value = month.year;
    }
    if (descriptionInput && month.description) {
        descriptionInput.value = month.description;
        // Update character counter
        const descriptionCounter = document.getElementById('descriptionCounter');
        if (descriptionCounter) {
            const currentLength = month.description.length;
            descriptionCounter.textContent = currentLength;

            // Change color if approaching limit
            if (currentLength > 90) {
                descriptionCounter.style.color = '#dc3545'; // Red
            } else if (currentLength > 75) {
                descriptionCounter.style.color = '#ffc107'; // Yellow
            } else {
                descriptionCounter.style.color = '#6c757d'; // Gray
            }
        }
    }

    // Progress Details
    const weightInput = document.getElementById('weightInput');
    const gymVisitsInput = document.getElementById('gymVisitsInput');
    const ratingInput = document.getElementById('ratingInput');
    const ratingValue = document.getElementById('ratingValue');
    const notesInput = document.getElementById('notesInput');

    if (weightInput && month.weight) {
        weightInput.value = month.weight;
    }
    if (gymVisitsInput && month.gymVisits) {
        gymVisitsInput.value = month.gymVisits;
    }
    if (ratingInput && month.rating) {
        ratingInput.value = month.rating;
        if (ratingValue) {
            ratingValue.textContent = month.rating;
        }
    }
    if (notesInput && month.notes) {
        notesInput.value = month.notes;
    }

    // Video
    const videoUrlInput = document.getElementById('videoUrlInput');
    if (videoUrlInput && month.videoUrl && !month.videoUrl.includes('firebasestorage.googleapis.com')) {
        // Only populate if it's an external URL (not an uploaded file)
        videoUrlInput.value = month.videoUrl;
    }

    // Images - show existing images but don't populate file input
    if (month.imageUrls && month.imageUrls.length > 0) {
        showExistingImages(month.imageUrls, month.coverURL);
    }

    // Clear any previous file selections
    window.selectedFiles = [];
    const imagesInput = document.getElementById('imagesInput');
    if (imagesInput) {
        imagesInput.value = '';
    }
}

function showExistingImages(imageUrls, coverURL) {
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');

    if (!imagePreview || !imagePreviewContainer) return;

    // Show the image preview section
    imagePreview.style.display = 'block';

    // Clear existing previews
    imagePreviewContainer.innerHTML = '';

    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'd-flex flex-wrap gap-2';

    imageUrls.forEach((imageUrl, index) => {
        const isCover = imageUrl === coverURL;

        const imagePreviewItem = document.createElement('div');
        imagePreviewItem.className = 'image-preview-item position-relative';
        imagePreviewItem.style.cssText = 'width: 120px; height: 120px; border-radius: 8px; overflow: hidden; border: 2px solid #dee2e6;';

        imagePreviewItem.innerHTML = `
            <img src="${imageUrl}" alt="Month image" style="width: 100%; height: 100%; object-fit: cover;">
            <button type="button" class="remove-existing-image position-absolute" 
                    style="top: 5px; right: 5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px;"
                    data-image-url="${imageUrl}">
                <i class="bi bi-x"></i>
            </button>
            ${isCover ? '<span class="badge bg-primary position-absolute" style="top: 5px; left: 5px; font-size: 0.65rem;">Cover</span>' : ''}
        `;

        // Add remove functionality for existing images
        const removeBtn = imagePreviewItem.querySelector('.remove-existing-image');
        removeBtn.addEventListener('click', () => {
            if (!window.imagesToDelete) {
                window.imagesToDelete = [];
            }
            window.imagesToDelete.push(imageUrl);
            imagePreviewItem.remove();

            // If all images are removed, hide the preview
            if (previewContainer.children.length === 0) {
                imagePreview.style.display = 'none';
            }
        });

        previewContainer.appendChild(imagePreviewItem);
    });

    imagePreviewContainer.appendChild(previewContainer);
}

async function openViewMonthModal(month) {
    console.log('Opening view modal for month:', month);

    // Set global view data
    window.currentViewingMonth = month;

    // Open the modal
    const modal = new bootstrap.Modal(document.getElementById('viewMonthModal'));

    // Populate the modal content
    populateViewModal(month);

    // Setup modal action buttons
    setupViewModalActions(month);

    modal.show();
}

function populateViewModal(month) {
    // Update title
    const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
    const year = month.year || new Date().getFullYear();
    document.getElementById('viewMonthTitle').textContent = `${monthName} ${year}`;

    // Update rating with enhanced styling
    const ratingBadge = document.getElementById('viewRatingBadge');
    const rating = month.rating || 5;
    const ratingClass = getEnhancedRatingClass(rating);
    ratingBadge.className = `badge fs-6 me-2 ${ratingClass}`;
    ratingBadge.innerHTML = `<i class="bi bi-star-fill me-1"></i>${rating}/10`;

    // Update weight
    const weightContainer = document.getElementById('viewWeightContainer');
    const weightSpan = document.getElementById('viewWeight');
    if (month.weight) {
        weightSpan.textContent = `${month.weight} kg`;
        weightContainer.style.display = 'flex';
    } else {
        weightContainer.style.display = 'none';
    }

    // Update gym visits
    const gymVisitsContainer = document.getElementById('viewGymVisitsContainer');
    const gymVisitsSpan = document.getElementById('viewGymVisits');
    if (month.gymVisits) {
        gymVisitsSpan.textContent = `${month.gymVisits} visits`;
        gymVisitsContainer.style.display = 'flex';
    } else {
        gymVisitsContainer.style.display = 'none';
    }

    // Update description
    const descriptionElement = document.getElementById('viewDescription');
    descriptionElement.textContent = month.description || 'No description provided for this month.';

    // Update notes
    const notesElement = document.getElementById('viewNotes');
    notesElement.textContent = month.notes || 'No notes added for this month.';

    // Load images
    loadViewImages(month);

    // Load video
    loadViewVideo(month);
}

function getEnhancedRatingClass(rating) {
    const value = parseInt(rating);
    if (value >= 9) return 'rating-badge-excellent';
    if (value >= 7) return 'rating-badge-good';
    if (value >= 5) return 'rating-badge-average';
    return 'rating-badge-poor';
}

function loadViewImages(month) {
    const imageGallery = document.getElementById('imageGallery');
    const noImagesMessage = document.getElementById('noImagesMessage');

    // Clear existing images
    imageGallery.innerHTML = '';

    if (!month.imageUrls || month.imageUrls.length === 0) {
        noImagesMessage.style.display = 'block';
        return;
    }

    noImagesMessage.style.display = 'none';

    // Store images for lightbox
    window.currentViewImages = month.imageUrls;

    month.imageUrls.forEach((imageUrl, index) => {
        const isCover = imageUrl === month.coverURL;

        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-4 col-sm-6 mb-3';

        const imageDiv = document.createElement('div');
        imageDiv.className = `gallery-image ${isCover ? 'cover-image' : ''}`;
        imageDiv.onclick = () => openImageLightbox(index);

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Progress image ${index + 1}`;
        img.onerror = () => {
            img.src = 'Image/img.jpg';
        };

        imageDiv.appendChild(img);
        colDiv.appendChild(imageDiv);
        imageGallery.appendChild(colDiv);
    });
}

function loadViewVideo(month) {
    const videoSection = document.getElementById('videoSection');
    const videoContainer = document.getElementById('videoContainer');

    if (!month.videoUrl) {
        videoSection.style.display = 'none';
        return;
    }

    videoSection.style.display = 'block';
    videoContainer.innerHTML = '';

    if (month.videoUrl.includes('firebasestorage.googleapis.com')) {
        // It's an uploaded video file
        const video = document.createElement('video');
        video.src = month.videoUrl;
        video.controls = true;
        video.className = 'w-100';
        video.style.maxHeight = '400px';

        videoContainer.appendChild(video);
    } else {
        // It's an external URL - try to create an embed
        const embedUrl = getVideoEmbedUrl(month.videoUrl);

        if (embedUrl) {
            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.className = 'w-100';
            iframe.style.height = '300px';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;

            videoContainer.appendChild(iframe);
        } else {
            // Fallback: show a link
            const linkContainer = document.createElement('div');
            linkContainer.className = 'text-center p-4 bg-light rounded';
            linkContainer.innerHTML = `
                <i class="bi bi-play-circle" style="font-size: 3rem; color: #6c757d;"></i>
                <p class="mt-2 mb-2">External Video</p>
                <a href="${month.videoUrl}" target="_blank" class="btn btn-outline-primary">
                    <i class="bi bi-box-arrow-up-right me-2"></i>Open Video
                </a>
            `;

            videoContainer.appendChild(linkContainer);
        }
    }
}

function getVideoEmbedUrl(url) {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
}

function setupViewModalActions(month) {
    // Edit button
    const editBtn = document.getElementById('viewModalEditBtn');
    editBtn.onclick = () => {
        // Close view modal
        const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewMonthModal'));
        viewModal.hide();

        // Open edit modal
        setTimeout(() => {
            openEditMonthModal(month);
        }, 300);
    };

    // Delete button
    const deleteBtn = document.getElementById('viewModalDeleteBtn');
    deleteBtn.onclick = async () => {
        // Close view modal first
        const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewMonthModal'));
        viewModal.hide();

        // Handle delete after modal is closed
        setTimeout(async () => {
            await handleDeleteMonth(month.id, month.month, month.year);
        }, 300);
    };
}

// Image Lightbox Functions
function openImageLightbox(index) {
    if (!window.currentViewImages || window.currentViewImages.length === 0) return;

    window.currentLightboxIndex = index;

    const modal = new bootstrap.Modal(document.getElementById('imageLightboxModal'));
    updateLightboxImage();
    setupLightboxNavigation();

    modal.show();
}

function updateLightboxImage() {
    const img = document.getElementById('lightboxImage');
    const counter = document.getElementById('lightboxCounter');
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');

    const currentIndex = window.currentLightboxIndex;
    const images = window.currentViewImages;

    img.src = images[currentIndex];
    counter.textContent = `${currentIndex + 1} of ${images.length}`;

    // Show/hide navigation buttons
    prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
    nextBtn.style.display = currentIndex < images.length - 1 ? 'flex' : 'none';
}

function setupLightboxNavigation() {
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');

    prevBtn.onclick = () => {
        if (window.currentLightboxIndex > 0) {
            window.currentLightboxIndex--;
            updateLightboxImage();
        }
    };

    nextBtn.onclick = () => {
        if (window.currentLightboxIndex < window.currentViewImages.length - 1) {
            window.currentLightboxIndex++;
            updateLightboxImage();
        }
    };

    // Keyboard navigation
    document.addEventListener('keydown', handleLightboxKeyboard);
}

function handleLightboxKeyboard(e) {
    const modal = document.getElementById('imageLightboxModal');
    if (!modal.classList.contains('show')) return;

    if (e.key === 'ArrowLeft' && window.currentLightboxIndex > 0) {
        window.currentLightboxIndex--;
        updateLightboxImage();
    } else if (e.key === 'ArrowRight' && window.currentLightboxIndex < window.currentViewImages.length - 1) {
        window.currentLightboxIndex++;
        updateLightboxImage();
    } else if (e.key === 'Escape') {
        const modalInstance = bootstrap.Modal.getInstance(modal);
        modalInstance.hide();
    }
}

// Clean up keyboard listener when lightbox is closed
document.getElementById('imageLightboxModal').addEventListener('hidden.bs.modal', () => {
    document.removeEventListener('keydown', handleLightboxKeyboard);
});

async function handleDeleteMonth(monthId, monthName, year) {
    const confirmDelete = confirm(`Are you sure you want to delete ${monthName} ${year}? This action cannot be undone.`);

    if (!confirmDelete) return;

    try {
        const user = auth.currentUser;
        if (!user) {
            alert("You must be logged in to delete a month.");
            return;
        }

        // First, get the month data to access image and video URLs
        const monthDocRef = doc(db, "users", user.uid, "months", monthId);
        const monthDoc = await getDoc(monthDocRef);

        if (!monthDoc.exists()) {
            throw new Error('Month not found');
        }

        const monthData = monthDoc.data();

        // Delete associated images from Storage if they exist
        if (monthData?.imageUrls && Array.isArray(monthData.imageUrls)) {
            const imageDeletePromises = monthData.imageUrls.map(async (imageUrl) => {
                try {
                    // Extract the storage path from the URL
                    const imageRef = ref(storage, imageUrl);
                    await deleteObject(imageRef);
                    console.log('Deleted image:', imageUrl);
                } catch (error) {
                    console.warn('Failed to delete image:', imageUrl, error);
                }
            });

            await Promise.all(imageDeletePromises);
        }

        // Delete associated video from Storage if it exists and is an uploaded file
        if (monthData?.videoUrl) {
            try {
                // Check if it's a Firebase Storage URL (contains firebasestorage.googleapis.com)
                // or if it contains our storage path structure
                const isFirebaseStorageUrl = monthData.videoUrl.includes('firebasestorage.googleapis.com') ||
                    monthData.videoUrl.includes('month_videos/');

                if (isFirebaseStorageUrl) {
                    const videoRef = ref(storage, monthData.videoUrl);
                    await deleteObject(videoRef);
                    console.log('Deleted video:', monthData.videoUrl);
                } else {
                    console.log('Skipping video deletion - external URL:', monthData.videoUrl);
                }
            } catch (error) {
                console.warn('Failed to delete video:', monthData.videoUrl, error);
            }
        }

        // Delete the month document from Firestore
        await deleteDoc(monthDocRef);

        // Reload the months to reflect the change
        await loadUserMonths(user.uid);

        // Show success toast
        showToast(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} deleted successfully!`, 'success');

    } catch (error) {
        console.error("Error deleting month:", error);
        showToast("Error deleting month. Please try again.", 'error');
    }
}

function setupDetailsToggle() {
    const toggle = document.getElementById('showDetailsToggle');
    if (!toggle) return;

    // Restore user's preference from localStorage
    const savedPreference = localStorage.getItem('showMonthDetails');
    const showDetails = savedPreference === 'true';

    // Set toggle state
    toggle.checked = showDetails;

    // Apply the preference to existing month details
    const monthDetails = document.querySelectorAll('.month-details');
    monthDetails.forEach(detail => {
        if (showDetails) {
            detail.classList.remove("d-none");
        } else {
            detail.classList.add("d-none");
        }
    });

    toggle.addEventListener('change', (e) => {
        const showDetails = e.target.checked;
        const monthDetails = document.querySelectorAll('.month-details');

        monthDetails.forEach(detail => {
            if (showDetails) {
                detail.classList.remove("d-none");
            } else {
                detail.classList.add("d-none");
            }
        });

        // Store preference in localStorage
        localStorage.setItem('showMonthDetails', showDetails.toString());
    });
}

function setupAddMonthButton() {
    const addButton = document.querySelector('.btn-primary');
    if (addButton && addButton.textContent.includes('Add New Month')) {
        addButton.addEventListener('click', () => {
            // Show the add month modal
            const modal = new bootstrap.Modal(document.getElementById('addMonthModal'));

            // Reset form when modal is fully shown
            const modalElement = document.getElementById('addMonthModal');
            modalElement.addEventListener('shown.bs.modal', function () {
                resetAddMonthForm();
            }, { once: true }); // Use once: true so the event listener is removed after first use

            modal.show();
        });
    }

    // Setup the form submission
    setupAddMonthForm();
}

function resetAddMonthForm() {
    // Reset edit mode variables
    window.isEditMode = false;
    window.editingMonthId = null;
    window.editingMonthData = null;
    window.imagesToDelete = [];

    // Reset modal title and button
    const modalTitle = document.getElementById('addMonthModalLabel');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Add New Month';
    }

    const saveBtn = document.getElementById('saveMonthBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" style="display: none;" id="saveSpinner"></span><i class="bi bi-plus me-2"></i>Add Month';
    }

    const form = document.getElementById('addMonthForm');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const errorDiv = document.getElementById('addMonthError');
    const monthSelect = document.getElementById('monthSelect');
    const yearInput = document.getElementById('yearInput');
    const ratingInput = document.getElementById('ratingInput');
    const ratingValue = document.getElementById('ratingValue');
    const gymVisitsInput = document.getElementById('gymVisitsInput');
    const videoFileInput = document.getElementById('videoFileInput');
    const videoUrlInput = document.getElementById('videoUrlInput');

    if (form) form.reset();
    if (imagePreview) {
        imagePreview.style.display = 'none';
    }
    if (imagePreviewContainer) {
        imagePreviewContainer.innerHTML = '';
    }
    if (errorDiv) errorDiv.style.display = 'none';

    // Reset character counter
    const descriptionCounter = document.getElementById('descriptionCounter');
    if (descriptionCounter) {
        descriptionCounter.textContent = '0';
        descriptionCounter.style.color = '#6c757d';
    }

    // Reset video inputs state
    if (videoFileInput) videoFileInput.disabled = false;
    if (videoUrlInput) {
        videoUrlInput.disabled = false;
        videoUrlInput.placeholder = 'https://youtube.com/watch?v=...';
    }

    // Set current year and month as defaults
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth(); // 0 for January, 1 for February, etc.
    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const currentMonthName = monthNames[currentMonthIndex];

    console.log('Setting default values:', { currentYear, currentMonth: currentMonthName });

    if (yearInput) {
        yearInput.value = currentYear;
        console.log('Set year to:', currentYear);
    }
    if (monthSelect) {
        monthSelect.value = currentMonthName;
        console.log('Set month to:', currentMonthName, 'Available options:', Array.from(monthSelect.options).map(o => o.value));
        console.log('Month select value after setting:', monthSelect.value);

        // If the current month value didn't stick, try to find and set it
        if (monthSelect.value !== currentMonthName) {
            const monthOption = Array.from(monthSelect.options).find(option => option.value === currentMonthName);
            if (monthOption) {
                monthOption.selected = true;
                console.log('Manually selected month option:', currentMonthName);
            } else {
                console.warn('Month option not found:', currentMonthName);
            }
        }
    }

    // Reset rating to 5
    if (ratingInput) {
        ratingInput.value = 5;
    }
    if (ratingValue) {
        ratingValue.textContent = '5';
    }

    // Set gym visits to 15 by default
    if (gymVisitsInput) {
        gymVisitsInput.value = '15';
    }

    // Clear the file input references
    window.selectedFiles = [];
}

function getRatingBadgeClass(rating) {
    const value = parseInt(rating);
    if (value <= 3) return 'bg-danger';
    if (value <= 6) return 'bg-warning';
    if (value <= 8) return 'bg-info';
    return 'bg-success';
}

function setupAddMonthForm() {
    const form = document.getElementById('addMonthForm');
    const imagesInput = document.getElementById('imagesInput');
    const imagePreview = document.getElementById('imagePreview');
    const saveBtn = document.getElementById('saveMonthBtn');
    const saveSpinner = document.getElementById('saveSpinner');
    const errorDiv = document.getElementById('addMonthError');
    const videoFileInput = document.getElementById('videoFileInput');
    const videoUrlInput = document.getElementById('videoUrlInput');
    const ratingInput = document.getElementById('ratingInput');
    const ratingValue = document.getElementById('ratingValue');
    const descriptionInput = document.getElementById('descriptionInput');
    const descriptionCounter = document.getElementById('descriptionCounter');

    // Initialize selectedFiles array
    window.selectedFiles = [];

    // Handle description character counter
    if (descriptionInput && descriptionCounter) {
        // Update counter on page load
        descriptionCounter.textContent = descriptionInput.value.length;

        descriptionInput.addEventListener('input', (e) => {
            const currentLength = e.target.value.length;
            descriptionCounter.textContent = currentLength;

            // Change color if approaching limit
            if (currentLength > 90) {
                descriptionCounter.style.color = '#dc3545'; // Red
            } else if (currentLength > 75) {
                descriptionCounter.style.color = '#ffc107'; // Yellow
            } else {
                descriptionCounter.style.color = '#6c757d'; // Gray
            }
        });
    }

    // Handle rating slider
    if (ratingInput && ratingValue) {
        ratingInput.addEventListener('input', (e) => {
            ratingValue.textContent = e.target.value;
            ratingValue.className = `badge ${getRatingBadgeClass(e.target.value)}`;
        });
    }

    // Handle image preview
    if (imagesInput) {
        imagesInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            const imagePreviewContainer = document.getElementById('imagePreviewContainer');

            if (files.length > 0) {
                window.selectedFiles = files;
                showImagePreviews(files, imagePreviewContainer);
            } else {
                window.selectedFiles = [];
                hideImagePreview();
            }
        });
    }

    // Handle video input validation (prevent both file and URL)
    if (videoFileInput && videoUrlInput) {
        videoFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                videoUrlInput.value = '';
                videoUrlInput.disabled = true;
                videoUrlInput.placeholder = 'Video file selected - URL disabled';
            } else {
                videoUrlInput.disabled = false;
                videoUrlInput.placeholder = 'https://youtube.com/watch?v=...';
            }
        });

        videoUrlInput.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                videoFileInput.disabled = true;
            } else {
                videoFileInput.disabled = false;
            }
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!auth.currentUser) {
                showError(errorDiv, 'You must be logged in to add a month.');
                return;
            }

            // Disable submit button and show spinner
            saveBtn.disabled = true;
            saveSpinner.style.display = 'inline-block';

            // Show progress bar and disable modal closing
            showUploadProgress();
            disableModalClose();

            try {
                if (window.isEditMode) {
                    await handleEditMonth();
                    showToast('Month updated successfully!', 'success');
                } else {
                    await handleAddMonth();
                    showToast('Month added successfully!', 'success');
                }

                // Hide modal on success
                const modal = bootstrap.Modal.getInstance(document.getElementById('addMonthModal'));
                modal.hide();

                // Reload months to show the changes
                await loadUserMonths(auth.currentUser.uid);

            } catch (error) {
                console.error('Error saving month:', error);
                const action = window.isEditMode ? 'updating' : 'adding';
                showError(errorDiv, `Error ${action} month: ${error.message}`);
                showToast(`Error ${action} month: ${error.message}`, 'error');
            } finally {
                // Re-enable submit button and hide spinner
                saveBtn.disabled = false;
                saveSpinner.style.display = 'none';

                // Hide progress bar and re-enable modal closing
                hideUploadProgress();
                enableModalClose();
            }
        });
    }
}

function showImagePreviews(files, container) {
    if (!container) return;

    // Show the image preview section
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.style.display = 'block';
    }

    container.innerHTML = '';

    // Create a flex container for small previews
    const previewContainer = document.createElement('div');
    previewContainer.className = 'd-flex flex-wrap gap-2';

    Array.from(files).forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-preview-item position-relative';
                imgContainer.style.cssText = 'width: 80px; height: 80px; border: 2px solid #dee2e6; border-radius: 8px; overflow: hidden;';

                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
                img.alt = `Preview ${index + 1}`;
                img.title = file.name;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'btn-close position-absolute';
                removeBtn.style.cssText = 'top: 2px; right: 2px; font-size: 10px; background: rgba(220, 53, 69, 0.9); border-radius: 50%; width: 18px; height: 18px;';
                removeBtn.setAttribute('aria-label', 'Remove image');
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeImageFromSelection(index);
                });

                // Add cover badge for first image
                if (index === 0) {
                    const coverBadge = document.createElement('span');
                    coverBadge.className = 'badge bg-primary position-absolute';
                    coverBadge.style.cssText = 'top: 2px; left: 2px; font-size: 0.6rem;';
                    coverBadge.textContent = 'Cover';
                    imgContainer.appendChild(coverBadge);
                }

                imgContainer.appendChild(img);
                imgContainer.appendChild(removeBtn);
                previewContainer.appendChild(imgContainer);
            };
            reader.readAsDataURL(file);
        }
    });

    container.appendChild(previewContainer);
}

// Remove image from selection
function removeImageFromSelection(index) {
    if (window.selectedFiles && window.selectedFiles.length > index) {
        window.selectedFiles.splice(index, 1);

        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        if (window.selectedFiles.length > 0) {
            showImagePreviews(window.selectedFiles, imagePreviewContainer);
        } else {
            hideImagePreview();
            // Clear the file input
            const imagesInput = document.getElementById('imagesInput');
            if (imagesInput) {
                imagesInput.value = '';
            }
        }
    }
}

// Hide image preview
function hideImagePreview() {
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');

    if (imagePreview) {
        imagePreview.style.display = 'none';
    }
    if (imagePreviewContainer) {
        imagePreviewContainer.innerHTML = '';
    }
}

async function handleAddMonth() {
    const monthSelect = document.getElementById('monthSelect');
    const yearInput = document.getElementById('yearInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const notesInput = document.getElementById('notesInput');
    const weightInput = document.getElementById('weightInput');
    const gymVisitsInput = document.getElementById('gymVisitsInput');
    const ratingInput = document.getElementById('ratingInput');
    const videoUrlInput = document.getElementById('videoUrlInput');
    const videoFileInput = document.getElementById('videoFileInput');
    const imagesInput = document.getElementById('imagesInput');
    const errorDiv = document.getElementById('addMonthError');

    // Validate required fields
    if (!monthSelect.value) {
        throw new Error('Please select a month.');
    }
    if (!yearInput.value) {
        throw new Error('Please enter a year.');
    }

    const yearValue = parseInt(yearInput.value);
    const currentYear = new Date().getFullYear();

    if (yearValue < 2020 || yearValue > currentYear + 5) {
        throw new Error(`Year must be between 2020 and ${currentYear + 5}.`);
    }

    const userId = auth.currentUser.uid;
    const month = monthSelect.value.toLowerCase();
    const year = yearValue;
    const rating = parseInt(ratingInput?.value) || 5;

    // Check if month already exists
    const monthsRef = collection(db, "users", userId, "months");
    const existingQuery = query(
        monthsRef,
        where("userId", "==", userId),
        where("month", "==", month),
        where("year", "==", year)
    );

    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
        throw new Error(`${month.charAt(0).toUpperCase() + month.slice(1)} ${year} already exists.`);
    }

    // Upload images if any - use selectedFiles array for better control
    let imageUrls = [];
    let coverURL = '';

    if (window.selectedFiles && window.selectedFiles.length > 0) {
        imageUrls = await uploadImagesWithProgress(window.selectedFiles, userId, month, year);
        coverURL = imageUrls[0] || ''; // First image as cover
    }

    // Upload video if provided
    let videoUrl = '';
    let videoType = '';
    if (videoFileInput.files.length > 0) {
        const videoFile = videoFileInput.files[0];
        const videoResult = await uploadVideoWithProgress(videoFile, userId, month, year);
        videoUrl = videoResult.url;
        videoType = videoResult.type;
    } else if (videoUrlInput.value.trim()) {
        updateProgress(60, `<div class="progress-step"><i class="bi bi-link-45deg me-1"></i>Adding video URL</div>`);
        videoUrl = videoUrlInput.value.trim();
        videoType = 'url';
    }

    // Prepare and save month data
    updateProgress(95, `<div class="progress-step"><i class="bi bi-database me-1"></i>Saving month data...</div>`);

    // Prepare month data
    const monthData = {
        userId: userId,
        month: month,
        year: year,
        description: descriptionInput.value.trim() || '',
        notes: notesInput.value.trim() || '',
        weight: weightInput.value ? parseFloat(weightInput.value) : null,
        gymVisits: gymVisitsInput.value ? parseInt(gymVisitsInput.value) : null,
        rating: rating,
        videoUrl: videoUrl,
        videoType: videoType,
        imageUrls: imageUrls,
        coverURL: coverURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Add to Firestore
    await addDoc(monthsRef, monthData);

    updateProgress(100, `<div class="progress-step"><i class="bi bi-check-circle me-1"></i>Month added successfully!</div>`);

    console.log('Month added successfully:', monthData);
}

async function handleEditMonth() {
    const monthSelect = document.getElementById('monthSelect');
    const yearInput = document.getElementById('yearInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const notesInput = document.getElementById('notesInput');
    const weightInput = document.getElementById('weightInput');
    const gymVisitsInput = document.getElementById('gymVisitsInput');
    const ratingInput = document.getElementById('ratingInput');
    const videoUrlInput = document.getElementById('videoUrlInput');
    const videoFileInput = document.getElementById('videoFileInput');
    const imagesInput = document.getElementById('imagesInput');
    const errorDiv = document.getElementById('addMonthError');

    // Validate required fields
    if (!monthSelect.value) {
        throw new Error('Please select a month.');
    }
    if (!yearInput.value) {
        throw new Error('Please enter a year.');
    }

    const yearValue = parseInt(yearInput.value);
    const currentYear = new Date().getFullYear();

    if (yearValue < 2020 || yearValue > currentYear + 5) {
        throw new Error(`Year must be between 2020 and ${currentYear + 5}.`);
    }

    const userId = auth.currentUser.uid;
    const month = monthSelect.value.toLowerCase();
    const year = yearValue;
    const rating = parseInt(ratingInput?.value) || 5;

    // Check if month/year combination already exists (but not for the current editing month)
    const monthsRef = collection(db, "users", userId, "months");
    const existingQuery = query(
        monthsRef,
        where("userId", "==", userId),
        where("month", "==", month),
        where("year", "==", year)
    );

    const existingSnapshot = await getDocs(existingQuery);
    const existingDocs = existingSnapshot.docs.filter(doc => doc.id !== window.editingMonthId);

    if (existingDocs.length > 0) {
        throw new Error(`${month.charAt(0).toUpperCase() + month.slice(1)} ${year} already exists.`);
    }

    // Get current month data
    const currentMonthData = window.editingMonthData;

    // Handle image deletions first
    if (window.imagesToDelete && window.imagesToDelete.length > 0) {
        updateProgress(5, `<div class="progress-step"><i class="bi bi-trash me-1"></i>Removing old images...</div>`);

        const deletePromises = window.imagesToDelete.map(async (imageUrl) => {
            try {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
                console.log('Deleted image:', imageUrl);
            } catch (error) {
                console.warn('Failed to delete image:', imageUrl, error);
            }
        });
        await Promise.all(deletePromises);
    }

    // Upload new images if any
    let newImageUrls = [];
    if (window.selectedFiles && window.selectedFiles.length > 0) {
        newImageUrls = await uploadImagesWithProgress(window.selectedFiles, userId, month, year);
    }

    // Combine existing images (minus deleted ones) with new images
    let currentImageUrls = currentMonthData.imageUrls || [];
    if (window.imagesToDelete && window.imagesToDelete.length > 0) {
        currentImageUrls = currentImageUrls.filter(url => !window.imagesToDelete.includes(url));
    }

    const finalImageUrls = [...currentImageUrls, ...newImageUrls];
    const coverURL = finalImageUrls.length > 0 ? finalImageUrls[0] : '';

    // Handle video upload/update
    let videoUrl = currentMonthData.videoUrl || '';
    let videoType = currentMonthData.videoType || '';

    if (videoFileInput.files.length > 0) {
        // Delete old video if it exists and is a storage file
        if (currentMonthData.videoUrl && currentMonthData.videoUrl.includes('firebasestorage.googleapis.com')) {
            updateProgress(55, `<div class="progress-step"><i class="bi bi-trash me-1"></i>Removing old video...</div>`);
            try {
                const oldVideoRef = ref(storage, currentMonthData.videoUrl);
                await deleteObject(oldVideoRef);
                console.log('Deleted old video');
            } catch (error) {
                console.warn('Failed to delete old video:', error);
            }
        }

        // Upload new video
        const videoFile = videoFileInput.files[0];
        const videoResult = await uploadVideoWithProgress(videoFile, userId, month, year);
        videoUrl = videoResult.url;
        videoType = 'file';
    } else if (videoUrlInput.value.trim()) {
        // Delete old video if it was a storage file and now switching to URL
        if (currentMonthData.videoUrl && currentMonthData.videoUrl.includes('firebasestorage.googleapis.com')) {
            updateProgress(60, `<div class="progress-step"><i class="bi bi-trash me-1"></i>Removing old video file...</div>`);
            try {
                const oldVideoRef = ref(storage, currentMonthData.videoUrl);
                await deleteObject(oldVideoRef);
                console.log('Deleted old video file when switching to URL');
            } catch (error) {
                console.warn('Failed to delete old video:', error);
            }
        }

        updateProgress(70, `<div class="progress-step"><i class="bi bi-link-45deg me-1"></i>Updating video URL</div>`);
        videoUrl = videoUrlInput.value.trim();
        videoType = 'url';
    }

    // Prepare updated month data
    updateProgress(95, `<div class="progress-step"><i class="bi bi-database me-1"></i>Updating month data...</div>`);

    // Prepare updated month data
    const updatedMonthData = {
        userId: userId,
        month: month,
        year: year,
        description: descriptionInput.value.trim() || '',
        notes: notesInput.value.trim() || '',
        weight: weightInput.value ? parseFloat(weightInput.value) : null,
        gymVisits: gymVisitsInput.value ? parseInt(gymVisitsInput.value) : null,
        rating: rating,
        videoUrl: videoUrl,
        videoType: videoType,
        imageUrls: finalImageUrls,
        coverURL: coverURL,
        createdAt: currentMonthData.createdAt, // Keep original creation date
        updatedAt: serverTimestamp()
    };

    // Update in Firestore
    const monthDocRef = doc(db, "users", userId, "months", window.editingMonthId);
    await updateDoc(monthDocRef, updatedMonthData);

    updateProgress(100, `<div class="progress-step"><i class="bi bi-check-circle me-1"></i>Month updated successfully!</div>`);

    console.log('Month updated successfully:', updatedMonthData);
}

function showError(errorDiv, message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function showToast(message, type = 'success') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const toastId = `toast-${Date.now()}`;
    const toastClass = type === 'success' ? 'bg-success' : 'bg-danger';
    const icon = type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle';

    const toastHTML = `
        <div class="toast ${toastClass} text-white" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header ${toastClass} text-white border-0">
                <i class="bi ${icon} me-2"></i>
                <strong class="me-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();

    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Progress Bar Functions
function showUploadProgress() {
    const progressSection = document.getElementById('uploadProgress');
    if (progressSection) {
        progressSection.style.display = 'block';
        updateProgress(0, 'Preparing upload...');
    }
}

function hideUploadProgress() {
    const progressSection = document.getElementById('uploadProgress');
    if (progressSection) {
        progressSection.style.display = 'none';
    }
}

function updateProgress(percentage, details = '') {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressDetails = document.getElementById('progressDetails');

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
    }

    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    if (progressDetails && details) {
        progressDetails.innerHTML = details;
    }
}

function disableModalClose() {
    const modal = document.getElementById('addMonthModal');
    const cancelBtn = document.getElementById('cancelBtn');

    if (modal) {
        modal.classList.add('modal-uploading');
    }

    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Uploading...';
    }
}

function enableModalClose() {
    const modal = document.getElementById('addMonthModal');
    const cancelBtn = document.getElementById('cancelBtn');

    if (modal) {
        modal.classList.remove('modal-uploading');
    }

    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.innerHTML = 'Cancel';
    }
}

// Enhanced upload functions with progress tracking
async function uploadImagesWithProgress(files, userId, month, year) {
    if (!files || files.length === 0) return [];

    updateProgress(10, 'Starting image uploads...');

    const imageUrls = [];
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const fileName = `${userId}_${month}_${year}_img_${i}_${Date.now()}.${file.name.split('.').pop()}`;
        const imageRef = storageRef(storage, `month_images/${userId}/${fileName}`);

        try {
            // Update progress for current image
            const baseProgress = 10 + (i / totalFiles) * 40; // Images take 40% of total progress
            updateProgress(baseProgress, `<div class="progress-step"><i class="bi bi-image me-1"></i>Uploading image ${i + 1} of ${totalFiles}: ${file.name}</div>`);

            const snapshot = await uploadBytes(imageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            imageUrls.push(downloadURL);

            // Update progress after successful upload
            const completedProgress = 10 + ((i + 1) / totalFiles) * 40;
            updateProgress(completedProgress, `<div class="progress-step"><i class="bi bi-check-circle me-1"></i>Image ${i + 1} uploaded successfully</div>`);

        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error(`Failed to upload image: ${file.name}`);
        }
    }

    return imageUrls;
}

async function uploadVideoWithProgress(videoFile, userId, month, year) {
    if (!videoFile) return { url: '', type: '' };

    // Check file size
    if (videoFile.size > 200 * 1024 * 1024) {
        throw new Error('Video file is too large. Maximum size is 200MB.');
    }

    updateProgress(50, `<div class="progress-step"><i class="bi bi-play-circle me-1"></i>Uploading video: ${videoFile.name}</div>`);

    const videoFileName = `${userId}_${month}_${year}_video_${Date.now()}.${videoFile.name.split('.').pop()}`;
    const videoRef = storageRef(storage, `month_videos/${userId}/${videoFileName}`);

    try {
        const snapshot = await uploadBytes(videoRef, videoFile);
        const videoUrl = await getDownloadURL(snapshot.ref);

        updateProgress(90, `<div class="progress-step"><i class="bi bi-check-circle me-1"></i>Video uploaded successfully</div>`);

        return { url: videoUrl, type: 'upload' };
    } catch (error) {
        console.error('Error uploading video:', error);
        throw new Error(`Failed to upload video: ${videoFile.name}`);
    }
}