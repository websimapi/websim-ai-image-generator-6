import confetti from 'https://esm.sh/canvas-confetti';

// DO NOT CHANGE UNLESS USER ASKS YOU TO
const API_URL = "https://eeae.onrender.com/image";
// You can change stuff under this.
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const modelSelect = document.getElementById('modelSelect'); // Now targets the wrapper div
const soraOptions = document.getElementById('soraOptions');
const aspectBtns = document.querySelectorAll('.toggle-btn');
const feedContainer = document.getElementById('feedContainer');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const likePopup = document.getElementById('likePopup');
const closeLikePopup = document.getElementById('closeLikePopup');
const birthdayPopup = document.getElementById('birthdayPopup');
const closeBirthdayPopup = document.getElementById('closeBirthdayPopup');
const apiErrorPopup = document.getElementById('apiErrorPopup');
const apiErrorDontHelp = document.getElementById('apiErrorDontHelp');
const apiErrorHelp = document.getElementById('apiErrorHelp');

// Custom Dropdown Logic
const selectTrigger = modelSelect.querySelector('.select-trigger');
const selectOptions = modelSelect.querySelector('.select-options');
const selectedText = modelSelect.querySelector('.selected-text');
const options = modelSelect.querySelectorAll('.option');

function toggleSelect() {
    modelSelect.classList.toggle('open');
}

function closeSelect(e) {
    if (!modelSelect.contains(e.target)) {
        modelSelect.classList.remove('open');
    }
}

function handleOptionClick(option) {
    const value = option.dataset.value;
    const text = option.textContent;

    // Update UI
    selectedText.textContent = text;
    options.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    modelSelect.classList.remove('open');

    // Logic update
    currentModel = value;
    if (currentModel === 'sora') {
        soraOptions.classList.remove('hidden');
        promptInput.placeholder = "Describe a video you want to see...";
    } else {
        soraOptions.classList.add('hidden');
        promptInput.placeholder = "Describe what you want to see...";
    }
}

selectTrigger.addEventListener('click', toggleSelect);
document.addEventListener('click', closeSelect);

options.forEach(option => {
    option.addEventListener('click', () => handleOptionClick(option));
});

// Share Sheet Elements
const shareSheetOverlay = document.getElementById('shareSheetOverlay');
const sharePreviewImg = document.getElementById('sharePreviewImg');
const sharePreviewText = document.getElementById('sharePreviewText');
const shareOptionComment = document.getElementById('shareOptionComment');
const shareOptionMore = document.getElementById('shareOptionMore');
const shareCancelBtn = document.getElementById('shareCancelBtn');

let currentModel = 'nanobanana';
let currentAspectRatio = 'landscape';
let currentShareMsg = null;
let currentShareFile = null;

const room = new WebsimSocket();
let renderedMsgIds = new Set();
const MAX_VISIBLE_MESSAGES = 100;
let localGenerations = 0;

// Show like popup on load
window.addEventListener('load', () => {
    setTimeout(() => {
        if(likePopup) likePopup.classList.add('visible');
    }, 800);
});

function checkBirthday() {
    const today = new Date();
    // Month is 0-indexed, 11 is December. Date is 1-indexed.
    if (today.getMonth() === 11 && today.getDate() === 1) {
        if (birthdayPopup) {
            birthdayPopup.classList.add('visible');
            
            // Confetti rain
            const duration = 3000;
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#7c3aed', '#ffffff'] // Theme colors
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#7c3aed', '#ffffff']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
    }
}

if (closeLikePopup && likePopup) {
    closeLikePopup.addEventListener('click', () => {
        likePopup.classList.remove('visible');
        // Check for birthday after initial popup closes
        setTimeout(checkBirthday, 300);
    });
}

if (closeBirthdayPopup && birthdayPopup) {
    closeBirthdayPopup.addEventListener('click', () => {
        birthdayPopup.classList.remove('visible');
    });
}

// API Error Popup Handlers
if (apiErrorDontHelp) {
    apiErrorDontHelp.addEventListener('click', () => {
        apiErrorPopup.classList.remove('visible');
    });
}

if (apiErrorHelp) {
    apiErrorHelp.addEventListener('click', () => {
        window.open('https://fixapi.val.run/', '_blank');
        apiErrorPopup.classList.remove('visible');
    });
}

function showApiErrorPopup() {
    if (apiErrorPopup) apiErrorPopup.classList.add('visible');
}

// Share Sheet Logic
function openShareSheet(msg) {
    currentShareMsg = msg;
    sharePreviewImg.src = msg.imageUrl;
    sharePreviewText.textContent = msg.prompt;
    shareSheetOverlay.classList.add('visible');

    // Reset and start pre-fetching for "More" option to ensure iOS compatibility
    currentShareFile = null;
    fetch(msg.imageUrl)
        .then(res => res.blob())
        .then(blob => {
            // Only update if the user hasn't closed/switched messages
            if (currentShareMsg === msg) {
                currentShareFile = new File([blob], `dream-${Date.now()}.png`, { type: "image/png" });
            }
        })
        .catch(console.error);
    
    // Handle video share preview specifically
    if (msg.type === 'video') {
        sharePreviewImg.style.display = 'none';
        // Create a temporary video element for preview if needed, or just show icon
        // For simplicity in this share sheet, we might leave the image blank or use a placeholder
        // But let's try to set the source if it's an image element
        sharePreviewImg.src = ''; 
        // Ideally we would put a video thumbnail here, but we lack one.
        // Let's just default to the icon behavior or keep the logic simple.
        sharePreviewImg.style.display = 'block';
        sharePreviewImg.src = 'https://images.websim.com/icon/video.png'; // Fallback
    } else {
        sharePreviewImg.style.display = 'block';
    }
}

function closeShareSheet() {
    shareSheetOverlay.classList.remove('visible');
    // Clear after animation
    setTimeout(() => {
        currentShareMsg = null;
        currentShareFile = null;
    }, 300);
}

shareCancelBtn.addEventListener('click', closeShareSheet);
shareSheetOverlay.addEventListener('click', (e) => {
    if (e.target === shareSheetOverlay) closeShareSheet();
});

shareOptionComment.addEventListener('click', async () => {
    if (!currentShareMsg) return;
    const msg = currentShareMsg;
    closeShareSheet(); // Close UI immediately
    
    showToast("Preparing comment...");

    try {
        let file = currentShareFile;
        
        // If not pre-fetched yet, fetch now
        if (!file) {
            const response = await fetch(msg.imageUrl);
            const blob = await response.blob();
            file = new File([blob], "generated-image.png", { type: "image/png" });
        }
        
        // Upload to websim for native embedding
        const uploadedUrl = await window.websim.upload(file);
        
        // Post comment
        await window.websim.postComment({
            content: `Re: "${msg.prompt}"`, // Short context
            images: [uploadedUrl]
        });
        
    } catch (error) {
        console.error("Comment share failed:", error);
        showToast("Failed to share to comments.");
    }
});

shareOptionMore.addEventListener('click', async () => {
    if (!currentShareMsg) return;
    const msg = currentShareMsg;
    closeShareSheet();

    try {
        if (!navigator.share) {
            // Fallback for browsers without Web Share API (Desktop mostly)
            await navigator.clipboard.writeText(msg.imageUrl);
            showToast("Link copied to clipboard");
            return;
        }

        let fileToShare = currentShareFile;

        // If not pre-fetched yet, try to fetch now (might risk gesture loss on strict iOS, but necessary)
        if (!fileToShare) {
            try {
                const response = await fetch(msg.imageUrl);
                const blob = await response.blob();
                fileToShare = new File([blob], `dream-${Date.now()}.png`, { type: "image/png" });
            } catch (e) {
                console.warn("Fetch for share failed", e);
            }
        }

        let shared = false;

        // Strategy 1: Share File
        // iOS requires sharing files WITHOUT text/url mixed in for best compatibility
        if (fileToShare) {
            try {
                const shareData = {
                    files: [fileToShare]
                };
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    shared = true;
                }
            } catch (err) {
                console.warn("File share failed, falling back to URL", err);
            }
        }

        // Strategy 2: Share URL (Fallback)
        if (!shared) {
            await navigator.share({
                url: msg.imageUrl
            });
        }
    } catch (error) {
        console.warn("Share failed:", error);
        // Only show error toast if it wasn't a user cancellation
        if (error.name !== 'AbortError' && !error.message.toLowerCase().includes('cancel')) {
            showToast("Share failed");
        }
    }
});

async function initRoom() {
    await room.initialize();
    
    // Initialize presence
    room.updatePresence({ isGenerating: false });

    room.collection('image_logs').subscribe((messages) => {
        updateFeed(messages);
    });

    // Manual polling every 10s as requested to ensure updates
    setInterval(async () => {
        try {
            const messages = await room.collection('image_logs').getList();
            updateFeed(messages);
        } catch (e) {
            // fail silently
        }
    }, 10000);
}

// Initialize room
initRoom();

function updateFeed(messages) {
    if (!messages) return;

    // Optimization: Identify new messages first
    const msgList = Array.isArray(messages) ? messages : Object.values(messages);
    const newMessages = [];
    for (const msg of msgList) {
        if (!renderedMsgIds.has(msg.id)) {
            newMessages.push(msg);
        }
    }

    if (newMessages.length === 0) return;

    if (emptyState) {
        emptyState.style.display = 'none';
    }

    // Sort new messages: Newest First
    newMessages.sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp).getTime();
        const timeB = new Date(b.created_at || b.timestamp).getTime();
        return timeB - timeA; // Descending (Newest first)
    });

    // Disable animation for large batches (initial load) to reduce lag
    const enableAnimation = newMessages.length < 5;

    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    newMessages.forEach(msg => {
        const card = createMessageCard(msg, enableAnimation);
        fragment.appendChild(card);
        renderedMsgIds.add(msg.id);
    });

    // Insert at the TOP of the feed
    feedContainer.prepend(fragment);

    // DOM Pruning: Remove old messages (now at the bottom) to keep memory usage low
    const cards = feedContainer.querySelectorAll('.message-card');
    if (cards.length > MAX_VISIBLE_MESSAGES) {
        const toRemove = cards.length - MAX_VISIBLE_MESSAGES;
        // Remove from the end (bottom of the list)
        for (let i = cards.length - 1; i >= cards.length - toRemove; i--) {
            cards[i].remove();
        }
    }
}

function createMessageCard(msg, animate = true) {
    const card = document.createElement('div');
    card.className = 'message-card';
    if (!animate) {
        card.style.animation = 'none';
    }
    
    // Format time
    const timestamp = new Date(msg.created_at || msg.timestamp);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const rawAvatarUrl = msg.avatarUrl || `https://images.websim.com/avatar/${msg.username}`;
    
    // Handle legacy records where imageUrl was the key and type didn't exist
    const mediaUrl = msg.url || msg.imageUrl;
    const mediaType = msg.type || 'image';

    // Sanitize all inputs to prevent XSS
    const safeAvatar = escapeHtml(rawAvatarUrl);
    const safeUser = escapeHtml(msg.username);
    const safePrompt = escapeHtml(msg.prompt);
    const safeUrl = escapeHtml(mediaUrl);
    const safeElapsed = escapeHtml(String(msg.elapsed));

    const mediaHtml = mediaType === 'video' 
        ? `<video src="${safeUrl}" class="generated-media" controls loop playsinline preload="metadata"></video>`
        : `<img src="${safeUrl}" class="generated-media" loading="lazy">`;

    card.innerHTML = `
        <div class="message-header">
            <img src="${safeAvatar}" class="user-avatar" alt="User">
            <span class="user-name">${safeUser}</span>
            <span class="timestamp">${timeStr}</span>
        </div>
        <div class="message-prompt">${safePrompt}</div>
        ${mediaHtml}
        <div class="message-footer">
            <div class="execution-tag">Generated in ${safeElapsed}s</div>
            <button class="share-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                Share
            </button>
        </div>
    `;

    const shareBtn = card.querySelector('.share-btn');
    shareBtn.addEventListener('click', () => {
        // Normalize msg for share sheet
        msg.imageUrl = mediaUrl; // Ensure compatibility with existing share logic
        openShareSheet(msg);
    });

    return card;
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Auto-resize textarea
promptInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.value === '') {
        this.style.height = 'auto';
    }
});

// Aspect ratio logic
aspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        aspectBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAspectRatio = btn.dataset.value;
    });
});

generateBtn.addEventListener('click', handleGeneration);

// Handle Enter key (without shift) to submit
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGeneration();
    }
});

async function handleGeneration() {
    if (currentModel === 'sora') {
        await generateVideo();
    } else {
        await generateImage();
    }
}

async function generateVideo() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    if (localGenerations >= 2) {
        showToast("You can only generate 2 items at a time.");
        return;
    }

    localGenerations++;
    const startTime = Date.now();
    
    promptInput.value = '';
    promptInput.style.height = 'auto';
    if (emptyState) emptyState.style.display = 'none';

    // Pending Card
    const pendingCard = document.createElement('div');
    pendingCard.className = 'message-card pending';
    const currentUser = await window.websim.getCurrentUser();
    const avatarUrl = currentUser.avatar_url || `https://images.websim.com/avatar/${currentUser.username}`;
    
    const safeAvatar = escapeHtml(avatarUrl);
    const safeUser = escapeHtml(currentUser.username);
    const safePrompt = escapeHtml(prompt);

    pendingCard.innerHTML = `
        <div class="message-header">
            <img src="${safeAvatar}" class="user-avatar" alt="User">
            <span class="user-name">${safeUser}</span>
            <span class="timestamp">Dreaming Video...</span>
        </div>
        <div class="message-prompt">${safePrompt}</div>
        <div class="card-loader">
            <div class="mini-spinner"></div>
            <span class="loading-status">Directing scenes...</span>
        </div>
    `;
    
    feedContainer.prepend(pendingCard);

    try {
        const response = await fetch("https://eeae.onrender.com/sora2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                size: currentAspectRatio
            })
        });

        if (response.status === 503 || response.status === 500) {
            showApiErrorPopup();
            throw new Error(`Service Error (${response.status})`);
        }

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        let videoUrl = null;
        
        if (data.result) {
            videoUrl = data.result;
        } else {
            throw new Error("No video URL in response");
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        // Persist
        await room.collection('image_logs').create({
            prompt: prompt,
            url: videoUrl,
            imageUrl: videoUrl, // Backward compatibility
            type: 'video',
            elapsed: elapsed
        });

    } catch (error) {
        console.error("Video generation failed:", error);
        showToast("Failed to generate video: " + error.message);
        promptInput.value = prompt;
    } finally {
        localGenerations--;
        pendingCard.remove();
    }
}

async function generateImage() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Check local limit (max 2 concurrent generations per user)
    if (localGenerations >= 2) {
        showToast("You can only generate 2 images at a time.");
        return;
    }

    // Start Generation
    localGenerations++;
    const startTime = Date.now();
    
    // Clear input immediately to allow next prompt
    promptInput.value = '';
    promptInput.style.height = 'auto';
    if (emptyState) emptyState.style.display = 'none';

    // Create optimistic pending card
    const pendingCard = document.createElement('div');
    pendingCard.className = 'message-card pending';
    // Get current user info for the pending card
    const currentUser = await window.websim.getCurrentUser();
    const avatarUrl = currentUser.avatar_url || `https://images.websim.com/avatar/${currentUser.username}`;
    
    // Sanitize
    const safeAvatar = escapeHtml(avatarUrl);
    const safeUser = escapeHtml(currentUser.username);
    const safePrompt = escapeHtml(prompt);

    pendingCard.innerHTML = `
        <div class="message-header">
            <img src="${safeAvatar}" class="user-avatar" alt="User">
            <span class="user-name">${safeUser}</span>
            <span class="timestamp">Dreaming...</span>
        </div>
        <div class="message-prompt">${safePrompt}</div>
        <div class="card-loader">
            <div class="mini-spinner"></div>
            <span class="loading-status">Dreaming...</span>
        </div>
    `;
    
    // Insert at top
    feedContainer.prepend(pendingCard);

    // Animate status text
    const messages = ["Checking list...", "Wrapping gifts...", "Decorating tree...", "Brewing cocoa...", "Catching snowflakes..."];
    const statusSpan = pendingCard.querySelector('.loading-status');
    let msgInterval = setInterval(() => {
        if(statusSpan) statusSpan.textContent = messages[Math.floor(Math.random() * messages.length)];
    }, 2000);

    try {
        const creator = await window.websim.getCreator();
        const encodedKey = btoa(creator.username);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                prompt: prompt,
                key: encodedKey 
            })
        });

        if (response.status === 503 || response.status === 500) {
            showApiErrorPopup();
            throw new Error(`Service Error (${response.status})`);
        }

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        // Extract image data
        const contentType = response.headers.get('content-type');
        let imageUrl = null;
        let elapsed = '0';
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            // Check for the specific proxy format: { result: "https://..." }
            if (data.result) {
                imageUrl = data.result;
            } else {
                // Fallback attempt
                const res = extractDataFromJson(data);
                if (res) imageUrl = res.url;
            }
            
            elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        } else {
            // Blob fallback (In case proxy changes back to binary)
            const blob = await response.blob();
            const file = new File([blob], "image.png", { type: "image/png" });
            imageUrl = await websim.upload(file);
            elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        }

        if (imageUrl) {
            // Persist to DB
            await room.collection('image_logs').create({
                prompt: prompt,
                imageUrl: imageUrl,
                url: imageUrl, // New standard
                type: 'image',
                elapsed: elapsed
            });
        } else {
            throw new Error("Could not parse image URL from response");
        }

    } catch (error) {
        console.error("Generation failed:", error);
        showToast("Failed to generate: " + error.message);
        // Put the prompt back if it failed so they can retry
        promptInput.value = prompt;
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
    } finally {
        localGenerations--;
        clearInterval(msgInterval);
        // Remove pending card (Real one will come via subscription/updateFeed)
        pendingCard.remove();
    }
}

function extractDataFromJson(data) {
    let url = null;

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        url = data.images[0].url;
    } else if (data.url) {
        url = data.url;
    } else if (data.image) {
        if (data.image.startsWith('http')) {
            url = data.image;
        }
    } else if (data.output && data.output[0]) {
        url = data.output[0];
    }
    
    return url ? { url } : null;
}

function setLoading(isLoading) {
    if (isLoading) {
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

// Snow effect
const snowflakes = ['❄', '❅', '❆', '•'];
function createSnow() {
    // Reduce snow if tab hidden or too many elements
    if (document.hidden || document.getElementsByClassName('snowflake').length > 50) return;

    const el = document.createElement('div');
    el.className = 'snowflake';
    el.textContent = snowflakes[Math.floor(Math.random() * snowflakes.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (Math.random() * 5 + 3) + 's';
    el.style.opacity = Math.random() * 0.7 + 0.3;
    el.style.fontSize = (Math.random() * 14 + 10) + 'px';
    
    document.body.appendChild(el);
    
    setTimeout(() => {
        el.remove();
    }, 8000);
}

// Start snow
setInterval(createSnow, 400);

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger reflow
    toast.offsetHeight;
    
    toast.classList.add('visible');
    
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}