import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    Initialize();
});

function Initialize() {
    document.querySelector("#settings-nav").addEventListener("click", (e) => {
        if (e.target.matches("button[data-section]")) {
            const section = e.target.getAttribute("data-section");
            document.querySelectorAll("#settings-nav button").forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            document.querySelectorAll("#settings-content > div").forEach(div => div.classList.add("d-none"));
            const selectedSection = document.querySelector(`#settings-content > div[data-section="${section}"]`);
            if (selectedSection) selectedSection.classList.remove("d-none");
        }
    });

    setupChangePicture();
    setupProfileForm();
    setupUnitsForm();
    loadCurrentUserData();
    loadPfp();
}

function loadPfp() {
    const profilePic = document.getElementById("settings-profile-avatar");
    profilePic.onload = () => {
        // Hide skeleton background by removing the class
        document.getElementById("profile-pic-wrapper").classList.remove("skeleton-circle");
        profilePic.classList.add("loaded");
    };

    // When loading new image:
    profilePic.src = user.photoURL || "default-avatar.png";

}

let tempUploadedPhotoURL = null;  // Store uploaded image URL before save
let msgElem;

async function isUsernameTaken(username, currentUserId) {
    const db = getFirestore();
    try {
        // Convert to lowercase to ensure consistent checking
        const lowerUsername = username.toLowerCase();
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("account.username", "==", lowerUsername));
        const querySnapshot = await getDocs(q);

        // Check if any document exists with this username
        // If it exists and it's not the current user's document, then it's taken
        for (const doc of querySnapshot.docs) {
            if (doc.id !== currentUserId) {
                return true; // Username is taken by someone else
            }
        }
        return false; // Username is available
    } catch (error) {
        console.error("Error checking username:", error);
        throw error;
    }
}

function validateUsername(username) {
    // Convert to lowercase for validation
    const lowerUsername = username.toLowerCase();

    // Username validation rules
    if (lowerUsername.length < 1) {
        return "Username must be at least 1 characters long.";
    }
    if (!/^[a-z0-9_]+$/.test(lowerUsername)) {
        return "Username can only contain lowercase letters, numbers, and underscores.";
    }
    if (/^[_0-9]/.test(lowerUsername)) {
        return "Username cannot start with a number or underscore.";
    }
    return null; // Valid username
}

function loadCurrentUserData() {
    const auth = getAuth();
    const db = getFirestore();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const profilePicElements = document.querySelectorAll(".profile-pic");
            profilePicElements.forEach(img => {
                img.src = user.photoURL || "Image/img.jpg";
            });

            document.querySelectorAll("#user-avatar").forEach(img => {
                img.src = user.photoURL || "Image/img.jpg";
                img.classList.remove("d-none");
            });

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                const nameInput = document.getElementById("profile-name");
                const nameWrapper = document.getElementById("name-input-wrapper");
                const usernameInput = document.getElementById("profile-username");
                const usernameWrapper = document.getElementById("username-input-wrapper");

                // Units elements
                const weightUnitWrapper = document.getElementById("weight-unit-wrapper");
                const weightUnitOptions = document.getElementById("weight-unit-options");
                const measurementUnitWrapper = document.getElementById("measurement-unit-wrapper");
                const measurementUnitOptions = document.getElementById("measurement-unit-options");

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();

                    // Load name
                    if (userData.account?.name) {
                        nameInput.value = userData.account.name;
                    } else {
                        nameInput.placeholder = user.displayName || "Enter your name";
                    }

                    // Load username
                    if (userData.account?.username) {
                        usernameInput.value = userData.account.username;
                    } else {
                        usernameInput.placeholder = "Enter your username";
                    }

                    // Load units preferences
                    const preferences = userData.preferences || {};
                    const weightUnit = preferences.weightUnit || "kg";
                    const measurementUnit = preferences.measurementUnit || "cm";

                    // Set weight unit radio button
                    const weightRadio = document.querySelector(`input[name="weight-unit"][value="${weightUnit}"]`);
                    if (weightRadio) {
                        weightRadio.checked = true;
                    }

                    // Set measurement unit radio button
                    const measurementRadio = document.querySelector(`input[name="measurement-unit"][value="${measurementUnit}"]`);
                    if (measurementRadio) {
                        measurementRadio.checked = true;
                    }
                } else {
                    nameInput.placeholder = user.displayName || "Enter your name";
                    usernameInput.placeholder = "Enter your username";

                    // Set default units
                    const defaultWeightRadio = document.querySelector(`input[name="weight-unit"][value="kg"]`);
                    const defaultMeasurementRadio = document.querySelector(`input[name="measurement-unit"][value="cm"]`);
                    if (defaultWeightRadio) defaultWeightRadio.checked = true;
                    if (defaultMeasurementRadio) defaultMeasurementRadio.checked = true;
                }

                // Show inputs and remove skeletons
                nameInput.style.display = "block";
                usernameInput.style.display = "block";
                if (nameWrapper) {
                    nameWrapper.classList.remove("skeleton", "skeleton-text");
                }
                if (usernameWrapper) {
                    usernameWrapper.classList.remove("skeleton", "skeleton-text");
                }

                // Show units and remove skeletons
                if (weightUnitOptions) {
                    weightUnitOptions.style.display = "block";
                    if (weightUnitWrapper) {
                        weightUnitWrapper.classList.remove("skeleton", "skeleton-text");
                    }
                }
                if (measurementUnitOptions) {
                    measurementUnitOptions.style.display = "block";
                    if (measurementUnitWrapper) {
                        measurementUnitWrapper.classList.remove("skeleton", "skeleton-text");
                    }
                }

                // Add event listener to convert username to lowercase as user types
                usernameInput.addEventListener("input", (e) => {
                    e.target.value = e.target.value.toLowerCase();
                });
            } catch (error) {
                console.error("Error loading user data:", error);
            }
        }
    });
}

function setupChangePicture() {
    const auth = getAuth();
    const storage = getStorage();

    const changeBtn = document.getElementById("change-picture-btn");
    const fileInput = document.getElementById("profile-pic-input");
    const profilePicImg = document.getElementById("settings-profile-avatar");

    msgElem = document.createElement("div");
    msgElem.className = "text-muted small mt-1";
    changeBtn.insertAdjacentElement("afterend", msgElem);

    changeBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
        msgElem.textContent = "";
        const user = auth.currentUser;
        if (!user) {
            msgElem.textContent = "You must be logged in to change your picture.";
            return;
        }
        const file = fileInput.files[0];
        if (!file) return;

        try {
            changeBtn.textContent = "Uploading...";
            changeBtn.disabled = true;

            const imageRef = storageRef(storage, `profilePictures/${user.uid}/${file.name}`);
            await uploadBytes(imageRef, file);

            const downloadURL = await getDownloadURL(imageRef);

            profilePicImg.src = downloadURL;
            document.querySelectorAll(".profile-pic").forEach(img => {
                img.src = downloadURL;
            });

            tempUploadedPhotoURL = downloadURL;

            msgElem.textContent = "Picture uploaded. Don't forget to click Save to apply changes.";

        } catch (error) {
            console.error("Error uploading profile picture:", error);
            msgElem.textContent = "Failed to upload picture.";
        } finally {
            changeBtn.textContent = "Change Picture";
            changeBtn.disabled = false;
            fileInput.value = "";
        }
    });
}

function setupProfileForm() {
    const auth = getAuth();
    const storage = getStorage();
    const db = getFirestore();

    const form = document.getElementById("profile-settings-form");
    const nameInput = document.getElementById("profile-name");
    const usernameInput = document.getElementById("profile-username");
    const changeBtn = document.getElementById("change-picture-btn");

    let formMsg = document.createElement("div");
    formMsg.className = "text-muted small mt-2 text-center";
    form.querySelector("button[type='submit']").insertAdjacentElement("afterend", formMsg);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            formMsg.textContent = "You must be logged in to save changes.";
            return;
        }

        formMsg.textContent = "";
        changeBtn.disabled = true;

        try {
            const updates = {};

            // Delete old photo if uploading new one
            if (tempUploadedPhotoURL) {
                const oldPhotoURL = user.photoURL;
                if (oldPhotoURL && !oldPhotoURL.includes("Image/img.jpg")) { // assuming this is default image URL
                    try {
                        const url = new URL(oldPhotoURL);
                        const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
                        const oldPhotoRef = storageRef(storage, path);
                        await deleteObject(oldPhotoRef);
                        console.log("Old profile picture deleted");
                    } catch (delError) {
                        console.warn("Failed to delete old profile picture:", delError);
                    }
                }
                await updateProfile(user, { photoURL: tempUploadedPhotoURL });
                updates["account.photoURL"] = tempUploadedPhotoURL;
            }

            // Handle name update
            const nameVal = nameInput.value.trim();
            if (nameVal.length > 0) {
                await updateProfile(user, { displayName: nameVal });
                updates["account.name"] = nameVal;
            }

            // Handle username update
            const usernameVal = usernameInput.value.trim().toLowerCase();
            if (usernameVal.length > 0) {
                // Validate username format
                const validationError = validateUsername(usernameVal);
                if (validationError) {
                    formMsg.textContent = validationError;
                    formMsg.className = "text-danger small mt-2 text-center";
                    return;
                }

                // Check if username is already taken
                try {
                    const isTaken = await isUsernameTaken(usernameVal, user.uid);
                    if (isTaken) {
                        formMsg.textContent = "Username is already taken. Please choose a different one.";
                        formMsg.className = "text-danger small mt-2 text-center";
                        return;
                    }
                } catch (error) {
                    console.error("Error checking username availability:", error);
                    formMsg.textContent = "Error checking username availability. Please try again.";
                    formMsg.className = "text-danger small mt-2 text-center";
                    return;
                }

                await updateProfile(user, { displayName: nameVal });
                updates["account.username"] = usernameVal;
            }

            if (Object.keys(updates).length > 0) {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, updates);
            }

            const newPhotoURL = updates["account.photoURL"] || user.photoURL || "Image/img.jpg";
            document.querySelectorAll(".profile-pic").forEach(img => img.src = newPhotoURL);
            document.querySelectorAll("#user-avatar").forEach(img => {
                img.src = newPhotoURL;
                img.classList.remove("d-none");
            });

            // Update navigation avatars specifically
            const navAvatar = document.getElementById("nav-user-avatar");
            const sidebarAvatar = document.getElementById("sidebar-user-avatar");
            const settingsAvatar = document.getElementById("settings-profile-avatar");

            if (navAvatar) navAvatar.src = newPhotoURL;
            if (sidebarAvatar) sidebarAvatar.src = newPhotoURL;
            if (settingsAvatar) settingsAvatar.src = newPhotoURL;

            tempUploadedPhotoURL = null;
            msgElem.textContent = "";
            formMsg.textContent = "Profile updated successfully!";
            formMsg.className = "text-success small mt-2 text-center";
        } catch (error) {
            console.error("Error saving profile:", error);
            formMsg.textContent = "Failed to save profile.";
            formMsg.className = "text-danger small mt-2 text-center";
        } finally {
            changeBtn.disabled = false;
        }
    });
}

function setupUnitsForm() {
    const auth = getAuth();
    const db = getFirestore();

    const unitsForm = document.getElementById("units-settings-form");
    if (!unitsForm) return;

    let unitsMsg = document.createElement("div");
    unitsMsg.className = "text-muted small mt-2 text-center";
    unitsForm.querySelector("button[type='submit']").insertAdjacentElement("afterend", unitsMsg);

    unitsForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            unitsMsg.textContent = "You must be logged in to save units.";
            unitsMsg.className = "text-danger small mt-2 text-center";
            return;
        }

        unitsMsg.textContent = "";

        try {
            // Get selected units
            const weightUnit = document.querySelector('input[name="weight-unit"]:checked')?.value;
            const measurementUnit = document.querySelector('input[name="measurement-unit"]:checked')?.value;

            if (!weightUnit || !measurementUnit) {
                unitsMsg.textContent = "Please select both weight and measurement units.";
                unitsMsg.className = "text-danger small mt-2 text-center";
                return;
            }

            // Update units in database
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                "preferences.weightUnit": weightUnit,
                "preferences.measurementUnit": measurementUnit
            });

            unitsMsg.textContent = "Units updated successfully!";
            unitsMsg.className = "text-success small mt-2 text-center";

        } catch (error) {
            console.error("Error saving units:", error);
            unitsMsg.textContent = "Failed to save units.";
            unitsMsg.className = "text-danger small mt-2 text-center";
        }
    });
}
