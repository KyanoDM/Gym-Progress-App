import { app } from "../firebase/config.js";
import {
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

let weightChart = null;

document.addEventListener("DOMContentLoaded", () => {
    Initialize();
});

function Initialize() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        await loadDashboardData(user.uid);
        setupQuickActions();
        updateDateTime();
    });
}

async function loadDashboardData(userId) {
    try {
        // Load user's months data
        const monthsRef = collection(db, "users", userId, "months");
        const q = query(
            monthsRef,
            where("userId", "==", userId),
            orderBy("year", "desc"),
            orderBy("month", "desc")
        );

        const querySnapshot = await getDocs(q);
        const months = [];

        querySnapshot.forEach((doc) => {
            months.push({ id: doc.id, ...doc.data() });
        });

        // Sort months properly by date
        months.sort((a, b) => {
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

        // Update dashboard stats
        updateWelcomeMessage();
        updateStats(months);
        updateWeightChart(months);
        updateRecentMonths(months.slice(0, 2));

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        showError("Failed to load dashboard data");
    }
}

function updateWelcomeMessage() {
    const now = new Date();
    const hour = now.getHours();
    const userName = document.getElementById('user-name');
    const welcomeMessage = document.getElementById('welcome-message');
    const icon = welcomeMessage.querySelector('i');

    let greeting = "Good evening";
    let iconClass = "bi-moon-stars";

    if (hour < 12) {
        greeting = "Good morning";
        iconClass = "bi-sun";
    } else if (hour < 17) {
        greeting = "Good afternoon";
        iconClass = "bi-sun";
    }

    // Update icon
    icon.className = `bi ${iconClass} me-2 text-warning`;

    // Get user name from auth or use placeholder
    const user = auth.currentUser;
    if (user) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        userName.textContent = displayName;
        userName.classList.remove('skeleton', 'skeleton-text');
        userName.style.width = 'auto';
        userName.style.height = 'auto';
    }

    welcomeMessage.innerHTML = `<i class="bi ${iconClass} me-2 text-warning"></i>${greeting}, <span id="user-name">${userName.textContent}</span>!`;
}

function updateStats(months) {
    // Current Weight
    const currentWeightEl = document.getElementById('current-weight');
    const weightChangeEl = document.getElementById('weight-change');
    const totalMonthsEl = document.getElementById('total-months');
    const avgRatingEl = document.getElementById('avg-rating');

    // Total months
    totalMonthsEl.innerHTML = months.length.toString();
    totalMonthsEl.classList.remove('skeleton', 'skeleton-text');
    totalMonthsEl.style.width = 'auto';
    totalMonthsEl.style.height = 'auto';

    if (months.length === 0) {
        currentWeightEl.innerHTML = '--';
        weightChangeEl.innerHTML = '--';
        avgRatingEl.innerHTML = '--';

        // Remove skeleton classes
        [currentWeightEl, weightChangeEl, avgRatingEl].forEach(el => {
            el.classList.remove('skeleton', 'skeleton-text');
            el.style.width = 'auto';
            el.style.height = 'auto';
        });
        return;
    }

    // Current weight (from most recent month)
    const currentWeight = months[0]?.weight;
    if (currentWeight) {
        currentWeightEl.innerHTML = currentWeight.toString();
    } else {
        currentWeightEl.innerHTML = '--';
    }
    currentWeightEl.classList.remove('skeleton', 'skeleton-text');
    currentWeightEl.style.width = 'auto';
    currentWeightEl.style.height = 'auto';

    // Weight change calculation
    calculateWeightChange(months, weightChangeEl);

    // Average rating
    const ratingsSum = months.reduce((sum, month) => sum + (month.rating || 0), 0);
    const avgRating = months.length > 0 ? (ratingsSum / months.length).toFixed(1) : 0;
    avgRatingEl.innerHTML = avgRating.toString();
    avgRatingEl.classList.remove('skeleton', 'skeleton-text');
    avgRatingEl.style.width = 'auto';
    avgRatingEl.style.height = 'auto';
}

function calculateWeightChange(months, weightChangeEl) {
    const monthsWithWeight = months.filter(month => month.weight);

    if (monthsWithWeight.length < 2) {
        weightChangeEl.innerHTML = '--';
        weightChangeEl.classList.remove('skeleton', 'skeleton-text');
        weightChangeEl.style.width = 'auto';
        weightChangeEl.style.height = 'auto';
        return;
    }

    const currentWeight = monthsWithWeight[0].weight;
    const oldestWeight = monthsWithWeight[monthsWithWeight.length - 1].weight;
    const weightDiff = currentWeight - oldestWeight;

    const changeText = weightDiff >= 0 ? `+${weightDiff.toFixed(1)}` : weightDiff.toFixed(1);
    const changeClass = weightDiff >= 0 ? 'text-success' : 'text-danger';
    const changeIcon = weightDiff >= 0 ? 'bi-arrow-up' : 'bi-arrow-down';

    weightChangeEl.innerHTML = `<span class="${changeClass}"><i class="bi ${changeIcon} me-1"></i>${changeText} kg</span>`;
    weightChangeEl.classList.remove('skeleton', 'skeleton-text');
    weightChangeEl.style.width = 'auto';
    weightChangeEl.style.height = 'auto';

    // Update the period text
    const periodEl = document.getElementById('weight-change-period');
    periodEl.textContent = `Last ${monthsWithWeight.length} months`;
}

function updateWeightChart(months) {
    const ctx = document.getElementById('weightChart').getContext('2d');
    const skeleton = document.getElementById('chart-skeleton');

    // Get months with weight data from last 6 months
    const monthsWithWeight = months
        .filter(month => month.weight)
        .slice(0, 6)
        .reverse(); // Reverse to show chronological order

    if (monthsWithWeight.length === 0) {
        // Hide skeleton and show no data message
        skeleton.style.display = 'none';
        ctx.canvas.style.display = 'block';

        if (weightChart) {
            weightChart.destroy();
        }

        // Show "No data" text on canvas
        ctx.font = '16px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'center';
        ctx.fillText('No weight data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    // Prepare chart data
    const labels = monthsWithWeight.map(month => {
        const monthName = month.month.charAt(0).toUpperCase() + month.month.slice(1);
        return `${monthName} ${month.year}`;
    });

    const weights = monthsWithWeight.map(month => month.weight);

    // Hide skeleton and show chart
    skeleton.style.display = 'none';
    ctx.canvas.style.display = 'block';

    // Destroy existing chart
    if (weightChart) {
        weightChart.destroy();
    }

    // Create new chart
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Weight (kg)',
                data: weights,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0d6efd',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        color: '#6c757d'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6c757d'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function updateRecentMonths(recentMonths) {
    const container = document.getElementById('recent-months-container');
    container.innerHTML = '';

    if (recentMonths.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-calendar-x text-muted" style="font-size: 3rem;"></i>
                <h5 class="mt-3 text-muted">No months tracked yet</h5>
                <p class="text-muted">Start tracking your fitness journey by adding your first month!</p>
                <button class="btn btn-primary mt-2" onclick="document.getElementById('add-month-btn').click()">
                    <i class="bi bi-plus-circle me-2"></i>Add Your First Month
                </button>
            </div>
        `;
        return;
    }

    recentMonths.forEach(month => {
        const monthCard = createRecentMonthCard(month);
        container.appendChild(monthCard);
    });

    // Fill remaining slots with "Add Month" card if less than 2 months
    if (recentMonths.length < 2) {
        const addCard = createAddMonthCard();
        container.appendChild(addCard);
    }
}

function createRecentMonthCard(month) {
    const monthCol = document.createElement('div');
    monthCol.className = 'col-md-6 mb-3';

    const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
    const year = month.year || new Date().getFullYear();
    const rating = month.rating || 5;
    const ratingClass = getRatingBadgeClass(rating);

    // Get cover image
    let coverImage = 'Image/img.jpg';
    if (month.coverURL) {
        coverImage = month.coverURL;
    } else if (month.imageUrls && month.imageUrls.length > 0) {
        coverImage = month.imageUrls[0];
    }

    monthCol.innerHTML = `
        <div class="card border h-100 hover-card" style="cursor: pointer;" onclick="window.location.href='months.html'">
            <div class="row g-0 h-100">
                <div class="col-5">
                    <div class="position-relative h-100">
                        <div class="skeleton" style="width: 100%; height: 100%; border-radius: 8px 0 0 8px;"></div>
                        <img src="${coverImage}" class="img-fluid h-100 w-100 rounded-start" 
                             style="object-fit: cover; display: none;" 
                             onload="this.previousElementSibling.style.display='none'; this.style.display='block';"
                             onerror="this.src='Image/img.jpg'; this.previousElementSibling.style.display='none'; this.style.display='block';"
                             alt="${monthName} ${year}">
                    </div>
                </div>
                <div class="col-7">
                    <div class="card-body p-3 d-flex flex-column h-100">
                        <div class="mb-2">
                            <h6 class="card-title mb-1 fw-bold">${monthName} ${year}</h6>
                            <span class="badge ${ratingClass}">
                                <i class="bi bi-star-fill me-1"></i>${rating}/10
                            </span>
                        </div>
                        <p class="card-text small text-muted flex-grow-1 mb-2" style="font-size: 0.85rem;">
                            ${month.description || 'No description available.'}
                        </p>
                        <div class="d-flex justify-content-between align-items-center small text-muted">
                            ${month.weight ? `<span><i class="bi bi-speedometer2 me-1"></i>${month.weight} kg</span>` : '<span></span>'}
                            ${month.gymVisits ? `<span><i class="bi bi-calendar-check me-1"></i>${month.gymVisits} visits</span>` : '<span></span>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return monthCol;
}

function createAddMonthCard() {
    const addCol = document.createElement('div');
    addCol.className = 'col-md-6 mb-3';

    addCol.innerHTML = `
        <div class="card border h-100 border-dashed hover-card" style="cursor: pointer; border: 2px dashed #dee2e6;" onclick="document.getElementById('add-month-btn').click()">
            <div class="card-body d-flex flex-column justify-content-center align-items-center text-center h-100 p-4">
                <i class="bi bi-plus-circle text-muted mb-3" style="font-size: 2.5rem;"></i>
                <h6 class="text-muted mb-2">Add New Month</h6>
                <p class="text-muted small mb-0">Track your progress</p>
            </div>
        </div>
    `;

    return addCol;
}

function getRatingBadgeClass(rating) {
    const value = parseInt(rating);
    if (value >= 9) return 'bg-success';
    if (value >= 7) return 'bg-info';
    if (value >= 5) return 'bg-warning';
    return 'bg-danger';
}

function setupQuickActions() {
    const addMonthBtn = document.getElementById('add-month-btn');

    addMonthBtn.addEventListener('click', () => {
        // Redirect to months page with a URL parameter to open the modal
        window.location.href = 'months.html?action=add';
    });
}

function updateDateTime() {
    const currentDateEl = document.getElementById('current-date');
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);
}

function showError(message) {
    // Create a simple toast for errors
    const toastContainer = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-header">
            <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
            <strong class="me-auto">Error</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();

    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Add hover effects for cards
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .hover-card {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
    `;
    document.head.appendChild(style);
});

export { auth, db };
