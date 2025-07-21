import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
    loadCurrentUserData();
}

let tempUploadedPhotoURL = null;  // Store uploaded image URL before save

function loadCurrentUserData() {
    const auth = getAuth();
    const db = getFirestore();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const profilePicElements = document.querySelectorAll(".profile-pic");
            profilePicElements.forEach(img => {
                img.src = user.photoURL || "Image/img.jpg";
            });

            // Also update sidebar avatars (you have 2 elements with id 'user-avatar', fix: use querySelectorAll)
            document.querySelectorAll("#user-avatar").forEach(img => {
                img.src = user.photoURL || "Image/img.jpg";
                img.classList.remove("d-none");
            });

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                const usernameInput = document.getElementById("profile-username");

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.account?.username) {
                        usernameInput.value = userData.account.username;
                    } else {
                        usernameInput.placeholder = user.displayName || "Enter your username";
                    }
                } else {
                    usernameInput.placeholder = user.displayName || "Enter your username";
                }
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

    // Create a message element below the button to show upload status
    let msgElem = document.createElement("div");
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

        // Optional: Validate file type and size here

        try {
            changeBtn.textContent = "Uploading...";
            changeBtn.disabled = true;

            const imageRef = storageRef(storage, `profilePictures/${user.uid}/${file.name}`);
            await uploadBytes(imageRef, file);

            const downloadURL = await getDownloadURL(imageRef);

            // Show preview immediately but do NOT update Firebase yet
            profilePicImg.src = downloadURL;
            document.querySelectorAll(".profile-pic").forEach(img => {
                img.src = downloadURL;
            });

            // Save URL temporarily; only update DB/auth on Save button press
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
    const db = getFirestore();

    const form = document.getElementById("profile-settings-form");
    const usernameInput = document.getElementById("profile-username");
    const changeBtn = document.getElementById("change-picture-btn");

    // Create or reuse a centered message area below the form's Save button
    let formMsg = document.createElement("div");
    formMsg.className = "text-muted small mt-2 text-center";  // centered text
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

            if (tempUploadedPhotoURL) {
                await updateProfile(user, { photoURL: tempUploadedPhotoURL });
                updates["account.photoURL"] = tempUploadedPhotoURL;
            }

            const usernameVal = usernameInput.value.trim();
            if (usernameVal.length > 0 && usernameVal !== user.displayName) {
                await updateProfile(user, { displayName: usernameVal });
                updates["account.username"] = usernameVal;
            }

            if (Object.keys(updates).length > 0) {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, updates);
            }

            // Update all profile pictures on the page after save
            const newPhotoURL = updates["account.photoURL"] || user.photoURL || "Image/img.jpg";
            document.querySelectorAll(".profile-pic").forEach(img => img.src = newPhotoURL);
            document.querySelectorAll("#user-avatar").forEach(img => {
                img.src = newPhotoURL;
                img.classList.remove("d-none");
            });

            tempUploadedPhotoURL = null; // reset temp URL
            msgElem.textContent = "";
            formMsg.textContent = "Profile updated successfully!";
        } catch (error) {
            console.error("Error saving profile:", error);
            formMsg.textContent = "Failed to save profile.";
        } finally {
            changeBtn.disabled = false;
        }
    });
}
