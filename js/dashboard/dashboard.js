import { app } from "../firebase/config.js";
import { showToast } from "../utils/toast.js";
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
let userMonthsData = [];

document.addEventListener("DOMContentLoaded", () => {
    Initialize();
});

function Initialize() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        // Ensure DOM is fully loaded before accessing elements
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                await loadDashboardData(user.uid);
                setupQuickActions();
                updateDateTime();
            });
        } else {
            await loadDashboardData(user.uid);
            setupQuickActions();
            updateDateTime();
        }
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
        checkCurrentMonthStatus(months);

        // Store months data globally for chart switching
        userMonthsData = months;

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        showError("Failed to load dashboard data");
    }
}

function updateWelcomeMessage() {
    const userName = document.getElementById('user-name');
    if (!userName) return;
    // The greeting itself is set inline in the HTML before first paint; only fill in the name here
    const user = auth.currentUser;
    userName.textContent = (user && (user.displayName || user.email?.split('@')[0])) || 'User';
    userName.classList.remove('skeleton', 'skeleton-text');
    userName.style.width = '';
    userName.style.height = '';
}

function updateStats(months) {
    // Current Weight
    const currentWeightEl = document.getElementById('current-weight');
    const weightChangeEl = document.getElementById('weight-change');
    const totalMonthsEl = document.getElementById('total-months');
    const totalGymVisitsEl = document.getElementById('total-gym-visits');

    // Check if all required elements exist
    if (!currentWeightEl || !weightChangeEl || !totalMonthsEl || !totalGymVisitsEl) {
        console.warn('Stats elements not found:', {
            currentWeight: !!currentWeightEl,
            weightChange: !!weightChangeEl,
            totalMonths: !!totalMonthsEl,
            totalGymVisits: !!totalGymVisitsEl
        });
        return;
    }

    // Total months
    totalMonthsEl.innerHTML = months.length.toString();
    totalMonthsEl.classList.remove('skeleton', 'skeleton-text');
    totalMonthsEl.style.width = 'auto';
    totalMonthsEl.style.height = 'auto';

    if (months.length === 0) {
        currentWeightEl.innerHTML = '--';
        weightChangeEl.innerHTML = '--';
        totalGymVisitsEl.innerHTML = '--';

        // Remove skeleton classes
        [currentWeightEl, weightChangeEl, totalGymVisitsEl].forEach(el => {
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

    // Total gym visits
    const totalVisits = months.reduce((sum, month) => sum + (month.gymVisits || 0), 0);
    totalGymVisitsEl.innerHTML = totalVisits.toString();
    totalGymVisitsEl.classList.remove('skeleton', 'skeleton-text');
    totalGymVisitsEl.style.width = 'auto';
    totalGymVisitsEl.style.height = 'auto';

    // Avg visits per tracked month
    const visitsAvgEl = document.getElementById('visits-avg');
    if (visitsAvgEl) {
        const monthsWithVisits = months.filter(m => typeof m.gymVisits === 'number');
        if (monthsWithVisits.length > 0) {
            const avg = monthsWithVisits.reduce((s, m) => s + m.gymVisits, 0) / monthsWithVisits.length;
            visitsAvgEl.textContent = `${avg.toFixed(1)} avg / month`;
        } else {
            visitsAvgEl.innerHTML = '&nbsp;';
        }
    }

    // Average rating
    const avgRatingEl = document.getElementById('avg-rating');
    const ratingFootEl = document.getElementById('rating-foot');
    if (avgRatingEl) {
        const rated = months.filter(m => typeof m.rating === 'number');
        if (rated.length > 0) {
            const avg = rated.reduce((s, m) => s + m.rating, 0) / rated.length;
            avgRatingEl.textContent = avg.toFixed(1);
        } else {
            avgRatingEl.textContent = '--';
        }
        avgRatingEl.classList.remove('skeleton', 'skeleton-text');
        avgRatingEl.style.width = 'auto';
        avgRatingEl.style.height = 'auto';
        if (ratingFootEl) {
            ratingFootEl.textContent = rated.length > 0
                ? `From ${rated.length} month${rated.length === 1 ? '' : 's'}`
                : '';
        }
    }

}

function calculateWeightChange(months, weightChangeEl) {
    if (!weightChangeEl) {
        console.warn('Weight change element not found');
        return;
    }

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
    if (periodEl) {
        periodEl.textContent = `Last ${monthsWithWeight.length} months`;
    }
}

function updateWeightChart(months) {
    userMonthsData = months;
    renderChart(months);
}

// Re-render when the theme changes so colors stay readable
new MutationObserver(() => { if (userMonthsData.length) renderChart(userMonthsData); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Weight (line, left axis) and gym visits (bars, right axis) over the last 12 months
function renderChart(months) {
    const ctx = document.getElementById('weightChart');
    const skeleton = document.getElementById('chart-skeleton');
    if (!ctx || !skeleton || typeof Chart === 'undefined') return;

    const monthOrder = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const recent = months.slice(0, 12).reverse();
    skeleton.style.display = 'none';
    if (weightChart) weightChart.destroy();

    const panelBody = ctx.parentElement;
    panelBody.querySelector('.chart-empty')?.remove();
    if (!recent.length) {
        panelBody.insertAdjacentHTML('beforeend', '<div class="chart-empty">No data yet. Add a month to see your progress.</div>');
        return;
    }

    const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const text = dark ? '#9ca3af' : '#6b7280';
    const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
    const labels = recent.map(m => {
        const i = monthOrder.indexOf((m.month || '').toLowerCase());
        return i >= 0 ? SHORT_MONTHS[i] + " '" + String(m.year).slice(-2) : '';
    });
    const weights = recent.map(m => m.weight || null);
    const visits = recent.map(m => (typeof m.gymVisits === 'number' ? m.gymVisits : null));

    weightChart = new Chart(ctx.getContext('2d'), {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Visits',
                    data: visits,
                    yAxisID: 'yVisits',
                    backgroundColor: dark ? 'rgba(16,185,129,0.45)' : 'rgba(16,185,129,0.35)',
                    borderRadius: 6,
                    maxBarThickness: 28,
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Weight (kg)',
                    data: weights,
                    yAxisID: 'yWeight',
                    borderColor: '#8b5cf6',
                    backgroundColor: '#8b5cf6',
                    borderWidth: 3,
                    tension: 0.3,
                    spanGaps: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBorderColor: dark ? '#1f2937' : '#fff',
                    pointBorderWidth: 2,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: text, maxRotation: 0, autoSkip: true } },
                yWeight: {
                    position: 'left',
                    grid: { color: grid },
                    ticks: { color: '#8b5cf6' },
                    grace: '10%'
                },
                yVisits: {
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: text, precision: 0 },
                    suggestedMax: 31
                }
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
    monthCol.className = 'col-md-6';

    const monthName = month.month ? month.month.charAt(0).toUpperCase() + month.month.slice(1) : 'Unknown';
    const year = month.year || new Date().getFullYear();
    const rating = month.rating || 5;
    const ratingClass = getRatingBadgeClass(rating);

    let coverImage = 'Image/user.png';
    if (month.coverURL) {
        coverImage = month.coverURL;
    } else if (month.imageUrls && month.imageUrls.length > 0) {
        coverImage = month.imageUrls[0];
    }

    monthCol.innerHTML = `
        <div class="month-mini" onclick="window.location.href='months.html'">
            <img src="${coverImage}" class="month-mini-img" alt="${monthName} ${year}"
                 onerror="this.src='Image/user.png';">
            <div class="month-mini-body">
                <div class="d-flex align-items-center justify-content-between mb-1">
                    <div class="month-mini-title">${monthName} ${year}</div>
                    <span class="badge ${ratingClass}"><i class="bi bi-star-fill me-1"></i>${rating}/10</span>
                </div>
                <p class="text-muted small mb-2" style="font-size: 0.85rem;">
                    ${month.description || 'No description available.'}
                </p>
                <div class="month-mini-meta">
                    ${month.weight ? `<span><i class="bi bi-speedometer2 me-1"></i>${month.weight} kg</span>` : ''}
                    ${month.gymVisits ? `<span><i class="bi bi-calendar-check me-1"></i>${month.gymVisits} visits</span>` : ''}
                </div>
            </div>
        </div>
    `;

    return monthCol;
}

function createAddMonthCard() {
    const addCol = document.createElement('div');
    addCol.className = 'col-md-6';

    addCol.innerHTML = `
        <div class="month-mini-add" onclick="document.getElementById('add-month-btn').click()">
            <i class="bi bi-plus-circle mb-2" style="font-size: 2rem;"></i>
            <div class="fw-semibold">Add new month</div>
            <small>Track your progress</small>
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

function checkCurrentMonthStatus(months) {
    const fillCurrentMonthBtn = document.getElementById('fill-current-month-btn');
    const fillMonthText = document.getElementById('fill-month-text');

    if (!fillCurrentMonthBtn || !fillMonthText) {
        console.warn('Fill current month elements not found');
        return;
    }

    const now = new Date();
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
    const currentYear = now.getFullYear();

    console.log(`Checking for current month: ${currentMonth} ${currentYear}`);
    console.log(`User months:`, months.map(m => `${m.month} ${m.year}`));

    // Check if current month exists in user's months
    const currentMonthExists = months.some(month => {
        const monthMatch = month.month?.toLowerCase() === currentMonth;
        const yearMatch = month.year === currentYear;
        console.log(`Comparing: ${month.month?.toLowerCase()} === ${currentMonth} (${monthMatch}) && ${month.year} === ${currentYear} (${yearMatch})`);
        return monthMatch && yearMatch;
    });

    if (!currentMonthExists) {
        // Show the button and update text
        fillCurrentMonthBtn.style.display = 'flex';
        fillCurrentMonthBtn.style.visibility = 'visible';
        fillCurrentMonthBtn.classList.remove('d-none');
        const monthName = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
        fillMonthText.textContent = `Fill ${monthName} ${currentYear}`;
        console.log(`Current month ${monthName} ${currentYear} not found - showing button`);
    } else {
        // Hide the button using multiple methods to ensure it's hidden
        fillCurrentMonthBtn.style.display = 'none';
        fillCurrentMonthBtn.style.visibility = 'hidden';
        fillCurrentMonthBtn.classList.add('d-none');
        console.log(`Current month ${currentMonth} ${currentYear} already exists - hiding button`);
    }
}

function setupQuickActions() {
    const addMonthBtn = document.getElementById('add-month-btn');
    const fillCurrentMonthBtn = document.getElementById('fill-current-month-btn');

    addMonthBtn.addEventListener('click', () => {
        // Redirect to months page with a URL parameter to open the modal
        window.location.href = 'months.html?action=add';
    });

    if (fillCurrentMonthBtn) {
        fillCurrentMonthBtn.addEventListener('click', () => {
            // Redirect to months page with current month pre-filled
            const now = new Date();
            const currentMonth = now.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
            const currentYear = now.getFullYear();
            window.location.href = `months.html?action=add&month=${currentMonth}&year=${currentYear}`;
        });
    }
}

function updateDateTime() {
    const currentDateEl = document.getElementById('current-date');
    if (!currentDateEl) {
        console.warn('Current date element not found');
        return;
    }

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
    showToast(message, 'error');
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
