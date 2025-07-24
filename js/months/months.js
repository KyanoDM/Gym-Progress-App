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
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
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
                    <button class="btn btn-primary mt-3" onclick="document.querySelector('.btn-primary').click()">
                        <i class="bi bi-plus me-2"></i>Add Your First Month
                    </button>
                </div>
            `;
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
                  
                </div>
            </div>
            <div class="card-footer bg-light">
                <div class="d-flex justify-content-between align-items-center">
                    <button class="btn btn-sm btn-outline-primary view-month" data-month-id="${month.id}">
                        <i class="bi bi-arrow-right me-1"></i>View
                    </button>
                    ${month.videoUrl ? `<small class="text-muted"><i class="bi bi-play-circle me-1"></i>Has video</small>` : ''}
                    ${month.imageUrls && month.imageUrls.length > 1 ? `<small class="text-muted"><i class="bi bi-images me-1"></i>${month.imageUrls.length} images</small>` : ''}
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
        modal.show();
        resetAddMonthForm();
    });

    return addMonthCol;
}

function setupMonthCardEvents(monthCol, month) {
    // View month
    const viewButtons = monthCol.querySelectorAll('.view-month');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // TODO: Navigate to month detail page
            console.log('View month:', month.id);
        });
    });

    // Edit month
    const editButton = monthCol.querySelector('.edit-month');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.preventDefault();
            // TODO: Navigate to edit month page
            console.log('Edit month:', month.id);
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

async function handleDeleteMonth(monthId, monthName, year) {
    const confirmDelete = confirm(`Are you sure you want to delete ${monthName} ${year}? This action cannot be undone.`);

    if (!confirmDelete) return;

    try {
        const user = auth.currentUser;
        if (!user) {
            alert("You must be logged in to delete a month.");
            return;
        }

        // Delete the month document from the correct subcollection path
        await deleteDoc(doc(db, "users", user.uid, "months", monthId));

        // Reload the months to reflect the change
        await loadUserMonths(user.uid);

        // Show success toast
        showToast(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} deleted successfully!`, 'success');

    } catch (error) {
        console.error("Error deleting month:", error);
        showToast("Error deleting month. Please try again.", 'error');
    }
}

function setupAddMonthButton() {
    const addButton = document.querySelector('.btn-primary');
    if (addButton && addButton.textContent.includes('Add New Month')) {
        addButton.addEventListener('click', () => {
            // Show the add month modal
            const modal = new bootstrap.Modal(document.getElementById('addMonthModal'));
            modal.show();

            // Reset form when modal opens
            resetAddMonthForm();
        });
    }

    // Setup the form submission
    setupAddMonthForm();
}

function resetAddMonthForm() {
    const form = document.getElementById('addMonthForm');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const errorDiv = document.getElementById('addMonthError');
    const monthSelect = document.getElementById('monthSelect');
    const yearInput = document.getElementById('yearInput');
    const ratingInput = document.getElementById('ratingInput');
    const ratingValue = document.getElementById('ratingValue');
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

    // Reset video inputs state
    if (videoFileInput) videoFileInput.disabled = false;
    if (videoUrlInput) {
        videoUrlInput.disabled = false;
        videoUrlInput.placeholder = 'https://youtube.com/watch?v=...';
    }

    // Set current year and month as defaults
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();

    if (yearInput) {
        yearInput.value = currentYear;
    }
    if (monthSelect) {
        monthSelect.value = currentMonth;
    }

    // Reset rating to 5
    if (ratingInput) {
        ratingInput.value = 5;
    }
    if (ratingValue) {
        ratingValue.textContent = '5';
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

    // Initialize selectedFiles array
    window.selectedFiles = [];

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
            if (files.length > 0) {
                window.selectedFiles = files;
                showImagePreviews(files);
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

            try {
                await handleAddMonth();

                // Show success toast
                showToast('Month added successfully!', 'success');

                // Hide modal on success
                const modal = bootstrap.Modal.getInstance(document.getElementById('addMonthModal'));
                modal.hide();

                // Reload months to show the new one
                await loadUserMonths(auth.currentUser.uid);

            } catch (error) {
                console.error('Error adding month:', error);
                showError(errorDiv, `Error adding month: ${error.message}`);
                showToast(`Error adding month: ${error.message}`, 'error');
            } finally {
                // Re-enable submit button and hide spinner
                saveBtn.disabled = false;
                saveSpinner.style.display = 'none';
            }
        });
    }
}

function showImagePreviews(files, container) {
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'block';

    const previewContainer = document.createElement('div');
    previewContainer.className = 'image-preview-grid';

    Array.from(files).forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-preview-item';

                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'btn-close btn-remove-image';
                removeBtn.setAttribute('aria-label', 'Remove image');
                removeBtn.addEventListener('click', () => removeImageFromSelection(index));

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

        if (window.selectedFiles.length > 0) {
            showImagePreviews(window.selectedFiles, document.getElementById('imagePreview'));
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
    if (imagePreview) {
        imagePreview.style.display = 'none';
        imagePreview.innerHTML = '';
    }
}

async function handleAddMonth() {
    const monthSelect = document.getElementById('monthSelect');
    const yearInput = document.getElementById('yearInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const notesInput = document.getElementById('notesInput');
    const weightInput = document.getElementById('weightInput');
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
        const uploadPromises = Array.from(window.selectedFiles).map(async (file, index) => {
            const fileName = `${userId}_${month}_${year}_img_${index}_${Date.now()}.${file.name.split('.').pop()}`;
            const imageRef = storageRef(storage, `month_images/${userId}/${fileName}`);

            try {
                const snapshot = await uploadBytes(imageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                return downloadURL;
            } catch (error) {
                console.error('Error uploading image:', error);
                throw new Error(`Failed to upload image: ${file.name}`);
            }
        });

        imageUrls = await Promise.all(uploadPromises);
        coverURL = imageUrls[0] || ''; // First image as cover
    }

    // Upload video if provided
    let videoUrl = '';
    if (videoFileInput.files.length > 0) {
        const videoFile = videoFileInput.files[0];
        // Check file size (100MB limit)
        if (videoFile.size > 100 * 1024 * 1024) {
            throw new Error('Video file is too large. Maximum size is 100MB.');
        }

        const videoFileName = `${userId}_${month}_${year}_video_${Date.now()}.${videoFile.name.split('.').pop()}`;
        const videoRef = storageRef(storage, `month_videos/${userId}/${videoFileName}`);

        try {
            const snapshot = await uploadBytes(videoRef, videoFile);
            videoUrl = await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error('Error uploading video:', error);
            throw new Error(`Failed to upload video: ${videoFile.name}`);
        }
    } else if (videoUrlInput.value.trim()) {
        videoUrl = videoUrlInput.value.trim();
    }

    // Prepare month data
    const monthData = {
        userId: userId,
        month: month,
        year: year,
        description: descriptionInput.value.trim() || '',
        notes: notesInput.value.trim() || '',
        weight: weightInput.value ? parseFloat(weightInput.value) : null,
        rating: rating,
        videoUrl: videoUrl,
        imageUrls: imageUrls,
        coverURL: coverURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Add to Firestore
    await addDoc(monthsRef, monthData);

    console.log('Month added successfully:', monthData);
} function showError(errorDiv, message) {
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