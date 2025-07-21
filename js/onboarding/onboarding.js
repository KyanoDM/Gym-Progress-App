import { app } from "../firebase/config.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const db = getFirestore(app);
const auth = getAuth(app);
let currentOnboardingSection = 1;

document.addEventListener('DOMContentLoaded', () => {
    initializeOnboarding();
});

function initializeOnboarding() {
    const termsCheckBox = document.querySelector("#terms");
    const userNameInput = document.querySelector("#username");
    const submitButton = document.querySelector("#submit");
    const unitsForm = document.querySelector("#units-form");

    const userNameError = document.querySelector("#username-error");
    const termsError = document.querySelector("#terms-error");

    termsCheckBox.addEventListener('change', () => updateSubmitButtonState(termsCheckBox, userNameInput, submitButton));
    userNameInput.addEventListener('input', (e) => {
        // Convert to lowercase in real-time
        const cursorPosition = e.target.selectionStart;
        e.target.value = e.target.value.toLowerCase();
        e.target.setSelectionRange(cursorPosition, cursorPosition);

        updateSubmitButtonState(termsCheckBox, userNameInput, submitButton);
    });

    submitButton.addEventListener('click', (event) => {
        event.preventDefault();
        saveUserName(userNameInput, termsCheckBox, userNameError, termsError);
    });

    if (unitsForm) {
        unitsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await saveUnits();
        });
    }
}

function updateSubmitButtonState(termsCheckBox, userNameInput, submitButton) {
    submitButton.disabled = !(termsCheckBox.checked && userNameInput.value.trim() !== "");
}

async function saveUserName(userNameInput, termsCheckBox, userNameError, termsError) {
    const username = userNameInput.value.trim();

    if (username.length <= 2) {
        userNameError.textContent = "Username must be longer than 2 characters.";
        userNameError.style.display = "block";
        return;
    }

    if (!termsCheckBox.checked) {
        termsError.textContent = "You must accept the terms.";
        termsError.style.display = "block";
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        userNameError.textContent = "You must be signed in first.";
        userNameError.style.display = "block";
        return;
    }

    const uid = user.uid;
    const userRef = doc(db, "users", uid);

    try {
        // Always use lowercase for the username
        const lowerUsername = username.toLowerCase();

        // Check if username is already taken
        const usersRef = collection(db, "users");
        const usernameQuery = query(usersRef, where("account.username", "==", lowerUsername));
        const querySnapshot = await getDocs(usernameQuery);

        let usernameTaken = false;
        querySnapshot.forEach(docSnap => {
            if (docSnap.id !== uid) {
                usernameTaken = true;
            }
        });

        if (usernameTaken) {
            userNameError.textContent = "This username is already taken.";
            userNameError.style.display = "block";
            return;
        }

        await updateDoc(userRef, {
            "account.username": lowerUsername,
            "onboarding.usernameSet": true
        });

        nextOnboardingSection();

    } catch (error) {
        userNameError.textContent = "An error occurred. Please try again.";
        userNameError.style.display = "block";
        console.error("Firestore error:", error.code, error.message, error);
    }
}

async function saveUnits() {
    const unitsError = document.querySelector("#units-error");
    const weightUnit = document.querySelector('input[name="weight-unit"]:checked')?.value;
    const measurementUnit = document.querySelector('input[name="measurement-unit"]:checked')?.value;

    if (!weightUnit || !measurementUnit) {
        unitsError.textContent = "Please select both units.";
        unitsError.style.display = "block";
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        unitsError.textContent = "You must be signed in first.";
        unitsError.style.display = "block";
        return;
    }

    const uid = user.uid;
    const userRef = doc(db, "users", uid);

    try {
        await updateDoc(userRef, {
            "preferences.weightUnit": weightUnit,
            "preferences.measurementUnit": measurementUnit,
            "onboarding.unitsSet": true
        });
        nextOnboardingSection();
    } catch (error) {
        unitsError.textContent = "An error occurred. Please try again.";
        unitsError.style.display = "block";
        console.error("Firestore error:", error.code, error.message, error);
    }
}

function onboardingComplete() {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const userRef = doc(db, "users", uid);

    updateDoc(userRef, {
        "onboarding.onboardingComplete": true
    });
}

function nextOnboardingSection() {
    const onboardingSections = document.querySelectorAll('.d-flex.justify-content-center.vh-100.mt-5');
    const progressbar = document.querySelector('#progress-onboarding');

    if (currentOnboardingSection === 1 && onboardingSections.length > 1) {
        onboardingSections[0].classList.add("hidden");
        onboardingSections[1].classList.remove("hidden");
        progressbar.innerHTML = 'Username &gt; <strong>Units</strong> &gt; Get Started';
    }

    if (currentOnboardingSection === 2 && onboardingSections.length > 2) {
        onboardingSections[1].classList.add("hidden");
        onboardingSections[2].classList.remove("hidden");
        progressbar.innerHTML = 'Username &gt; Units &gt; <strong>Get Started</strong>';
    }
    currentOnboardingSection++;

    if (currentOnboardingSection === 3) {
        onboardingComplete();
    }


}
