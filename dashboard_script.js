// Global variables
let currentUser = null;
let friendsList = [];
let allUsers = [];
let ws = null; // WebSocket connection

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = Math.random() * 10 + 5 + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = Math.random() * 20 + 15 + 's';
        particlesContainer.appendChild(particle);
    }
}

createParticles();

const LOCALHOST_BASE_URL = "http://localhost:3000";
const backend_BASE_URL = "https://tictoctoe-backend.onrender.com";
const frontend_BASE_URL = "https://tttfront.netlify.app";

// Redirect if not logged in
if (!localStorage.getItem("userId")) {
    window.location.href = "/";
}

// Load all data from MongoDB
async function loadDashboardData() {
    console.log('Loading dashboard data...');
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");
    
    console.log('User ID:', userId);
    console.log('Username:', username);
    
    if (!userId) {
        console.error('No user ID found, redirecting to login');
        window.location.href = "/";
        return;
    }
    
    try {
        // Fetch user profile
        console.log('Fetching user profile...');
        const userResponse = await fetch(`${backend_BASE_URL}/api/user?userId=${userId}`);
        const userData = await userResponse.json();
        
        if (userData.error) {
            console.error('Error loading user:', userData.error);
            alert('Error loading user data: ' + userData.error);
            return;
        }
        
        currentUser = userData.user;
        console.log('User loaded:', currentUser.username);
        
        // Update profile avatar
        const profileAvatar = document.getElementById('profileAvatar');
        if (currentUser.profile && currentUser.profile.avatar) {
            profileAvatar.src = currentUser.profile.avatar;
        } else {
            // Fallback to default avatar
            profileAvatar.src = 'https://i.pravatar.cc/40';
        }
        
        // Update UI with user data
        document.getElementById("userId").innerText = currentUser._id;
        document.getElementById("username").innerText = currentUser.username;
        document.getElementById("rank").innerText = `Rank: ${currentUser.profile.rank}`;
        document.getElementById("gamesPlayed").innerText = currentUser.stats.gamesPlayed;
        document.getElementById("gamesWon").innerText = currentUser.stats.gamesWon;
        document.getElementById("winRate").innerText = currentUser.stats.winRate;
        
        // Load game history
        loadGameHistory(currentUser.gameHistory);
        
        // Load achievements
        loadAchievements(currentUser.achievements);
        
        // Fetch friends list
        console.log('Fetching friends list...');
        const friendsResponse = await fetch(`${backend_BASE_URL}/api/friends?userId=${userId}`);
        const friendsData = await friendsResponse.json();
        
        console.log('Friends API response:', friendsData);
        
        if (!friendsData.error) {
            friendsList = friendsData.friends;
            console.log('Friends loaded:', friendsList.length);
            console.log('First friend structure:', friendsList[0]);
            loadFriends(friendsList);
        } else {
            console.error('Error fetching friends:', friendsData.error);
            document.getElementById('friends').innerHTML = '<div class="card">Error loading friends</div>';
        }
        
        // Fetch all users for challenge modal
        console.log('Fetching all users...');
        const usersResponse = await fetch(`${backend_BASE_URL}/api/users`);
        const usersData = await usersResponse.json();
        
        if (!usersData.error) {
            allUsers = usersData.users;
            console.log('All users loaded:', allUsers.length);
            console.log('Sample user data:', allUsers[0]); // Debug: show structure
        }
        
        console.log('Dashboard data loaded successfully!');
        
        // Connect to WebSocket for real-time challenges
        connectWebSocket(userId);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard. Please refresh the page.');
    }
}

function loadGameHistory(gameHistory) {
    const historyContainer = document.getElementById('history');
    
    if (!gameHistory || gameHistory.length === 0) {
        historyContainer.innerHTML = '<div class="card">No game history available</div>';
        return;
    }
    
    historyContainer.innerHTML = gameHistory.map(game => `
        <div class="card ${game.result}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${game.result === 'won' ? '🏆 Won' : game.result === 'lost' ? '❌ Lost' : '🤝 Draw'}</strong> vs ${game.opponent}
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">${game.date}</div>
                </div>
                <!--ggn-->
                <button class="game-replay-btn" onclick="watchReplay('${game.replayId}')">▶️ Replay</button>
            </div>
        </div>
    `).join('');
}

function loadAchievements(achievements) {
    const achievementsContainer = document.getElementById('achievements');
    
    if (!achievements || achievements.length === 0) {
        achievementsContainer.innerHTML = '<div class="card">No achievements yet</div>';
        return;
    }
    
    achievementsContainer.innerHTML = achievements.map(ach => `
        <div class="achievement-badge ${ach.unlocked ? '' : 'locked'}">
            <span class="achievement-icon">${ach.icon}</span>
            <span>${ach.name}</span>
            ${ach.unlocked ? '<span class="badge">✓</span>' : '<span class="badge" style="background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);">Locked</span>'}
        </div>
    `).join('');
}

function loadFriends(friends) {
    console.log('Loading friends:', friends);
    const friendsContainer = document.getElementById('friends');
    
    if (!friends || friends.length === 0) {
        friendsContainer.innerHTML = '<div class="card">No friends yet. Click "Add Friends" to get started!</div>';
        return;
    }
    
    try {
        friendsContainer.innerHTML = friends.map(friend => {
            console.log('Friend data:', friend);
            
            // Handle both structures: friend.userId (populated) or friend (if already the user object)
            const friendData = friend.userId || friend;
            
            if (!friendData || !friendData.profile) {
                console.error('Friend missing profile data:', friend);
                return '';
            }
            
            return `
                <div class="friend-card">
                    <img src="${friendData.profile.avatar || 'https://i.pravatar.cc/40'}" alt="${friend.username || friendData.username}">
                    <div>
                        <div class="friend-name" onclick="showFriendProfileFromData('${friendData._id}')">${friend.username || friendData.username}</div>
                        <div class="friend-rank">🏅 ${friendData.profile.rank}</div>
                        <div class="friend-status" style="color: ${friendData.profile.status === 'online' ? '#4caf50' : '#999'};">
                            ${friendData.profile.status === 'online' ? '● Online' : '○ Offline'}
                        </div>
                    </div>
                </div>
            `;
        }).filter(html => html !== '').join('');
        
        if (friendsContainer.innerHTML === '') {
            friendsContainer.innerHTML = '<div class="card">Error loading friends</div>';
        }
    } catch (error) {
        console.error('Error rendering friends:', error);
        friendsContainer.innerHTML = '<div class="card">Error loading friends. Please refresh.</div>';
    }
}

// Challenge Modal Functions
function challenge() {
    console.log('Challenge button clicked');
    console.log('currentUser:', currentUser);
    console.log('allUsers:', allUsers);
    
    // Check if data is loaded
    if (!currentUser || !allUsers || allUsers.length === 0) {
        alert('Loading user data... Please wait a moment and try again.');
        console.error('Data not loaded. currentUser:', currentUser, 'allUsers:', allUsers);
        return;
    }
    
    const modal = document.getElementById('challengeModal');
    const friendsList = document.getElementById('challengeFriendsList');
    
    // Clear previous content
    friendsList.innerHTML = '';
    
    // Show all users except current user
    const availableFriends = allUsers.filter(u => u._id !== currentUser._id);
    console.log('Available friends to challenge:', availableFriends.length);
    
    if (availableFriends.length === 0) {
        friendsList.innerHTML = '<div class="card">No friends available to challenge</div>';
    } else {
        // Add all friends with challenge buttons
        availableFriends.forEach((friend, index) => {
            console.log(`Processing friend ${index}:`, friend);
            
            // Ensure friend has profile data
            if (!friend || !friend.profile) {
                console.error('Friend missing profile data:', friend);
                return;
            }
            
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-challenge-item';
            friendItem.innerHTML = `
                <div class="friend-challenge-info">
                    <img src="${friend.profile.avatar}" alt="${friend.username}">
                    <div class="friend-details">
                        <span class="friend-name" onclick="showFriendProfile('${friend._id}')">${friend.username}</span>
                        <span class="friend-status ${friend.profile.status}">${friend.profile.status === 'online' ? '● Online' : '○ Offline'}</span>
                    </div>
                </div>
                <button class="challenge-btn" onclick="sendChallenge('${friend.username}', '${friend._id}')" ${friend.profile.status === 'offline' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    ⚔️ Challenge
                </button>
            `;
            friendsList.appendChild(friendItem);
        });
    }
    
    // Show modal
    modal.classList.add('active');
    console.log('Challenge modal opened');
}

function closeModal() {
    document.getElementById('challengeModal').classList.remove('active');
}

function sendChallenge(friendName, friendId) {
    const friend = allUsers.find(u => u._id === friendId);
    if (!friend || friend.profile.status === 'offline') {
        alert(`${friendName} is currently offline!`);
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Connection lost. Please refresh the page.');
        return;
    }
    
    // Send challenge via WebSocket
    ws.send(JSON.stringify({
        type: 'challenge',
        toUserId: friendId,
        toUsername: friendName,
        fromUsername: currentUser.username
    }));
    
    alert(`⚔️ Challenge sent to ${friendName}! Waiting for response...`);
    closeModal();
}

// Multi-Level Challenge Functions
function multiLevelChallenge() {
    console.log('Multi-level challenge button clicked');
    console.log('currentUser:', currentUser);
    console.log('allUsers:', allUsers);
    
    if (!currentUser || !allUsers || allUsers.length === 0) {
        alert('Loading user data... Please wait a moment and try again.');
        return;
    }
    
    const modal = document.getElementById('challengeModal');
    const friendsList = document.getElementById('challengeFriendsList');
    
    // Clear previous content
    friendsList.innerHTML = '';
    
    // Show all users except current user
    const availableFriends = allUsers.filter(u => u._id !== currentUser._id);
    console.log('Available friends to challenge:', availableFriends.length);
    
    if (availableFriends.length === 0) {
        friendsList.innerHTML = '<div class="card">No friends available to challenge</div>';
    } else {
        availableFriends.forEach((friend, index) => {
            console.log(`Processing friend ${index}:`, friend);
            
            if (!friend || !friend.profile) {
                console.error('Friend missing profile data:', friend);
                return;
            }
            
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-challenge-item';
            friendItem.innerHTML = `
                <div class="friend-challenge-info">
                    <img src="${friend.profile.avatar}" alt="${friend.username}">
                    <div class="friend-details">
                        <span class="friend-name" onclick="showFriendProfile('${friend._id}')">${friend.username}</span>
                        <span class="friend-status ${friend.profile.status}">${friend.profile.status === 'online' ? '● Online' : '○ Offline'}</span>
                    </div>
                </div>
            `;
            friendsList.appendChild(friendItem);
        });
    }
    
    // Update modal header
    const modalHeader = document.querySelector('.modal-header');
    if (modalHeader) {
        modalHeader.innerHTML = '🔥 Multi-Level Battle (3 Levels)';
    }
    
    // Show modal
    modal.classList.add('active');
    console.log('Multi-level challenge modal opened');
}

function sendMultiLevelChallenge(friendName, friendId) {
    const friend = allUsers.find(u => u._id === friendId);
    if (!friend || friend.profile.status === 'offline') {
        alert(`${friendName} is currently offline!`);
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Connection lost. Please refresh the page.');
        return;
    }
    
    // Send multi-level challenge via WebSocket
    ws.send(JSON.stringify({
        type: 'start_multi_level_game',
        toUserId: friendId,
        toUsername: friendName,
        fromUsername: currentUser.username
    }));
    
    alert(`🔥 Multi-Level Challenge sent to ${friendName}!\n\nThis is a 3-level battle:\n- Level 1: 3x3\n- Level 2: 4x4\n- Level 3: 5x5\n\nWin the majority to be the final winner!`);
    closeModal();
}

function showFriendProfile(userId) {
    const friend = allUsers.find(u => u._id === userId);
    if (!friend) return;
    
    const profileData = document.getElementById('friendProfileData');
    const modal = document.getElementById('friendProfileModal');
    
    // Build profile HTML
    const achievementsHTML = friend.achievements.map(ach => `
        <div class="achievement-badge ${ach.unlocked ? '' : 'locked'}">
            <span class="achievement-icon">${ach.icon}</span>
            <span>${ach.name}</span>
            ${ach.unlocked ? '<span class="badge">✓</span>' : '<span class="badge" style="background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);">Locked</span>'}
        </div>
    `).join('');
    
    const gameHistoryHTML = friend.gameHistory.map(game => `
        <div class="card ${game.result}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${game.result === 'won' ? '🏆 Won' : game.result === 'lost' ? '❌ Lost' : '🤝 Draw'}</strong> vs ${game.opponent}
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">${game.date}</div>
                </div>
                <button class="game-replay-btn" onclick="watchReplay('${game.replayId}')">▶️ Replay</button>
            </div>
        </div>
    `).join('');
    
    profileData.innerHTML = `
        <div class="profile-header">
            <img src="${friend.profile.avatar}" alt="${friend.username}" class="profile-avatar">
            <div class="profile-title">
                <h2>${friend.username}</h2>
                <span class="status-badge ${friend.profile.status}">${friend.profile.status === 'online' ? '● Online' : '○ Offline'}</span>
                <div class="rank-text">🏅 Rank: ${friend.profile.rank}</div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${friend.stats.gamesPlayed}</div>
                <div class="stat-label">Games Played</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${friend.stats.gamesWon}</div>
                <div class="stat-label">Games Won</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${friend.stats.winRate}</div>
                <div class="stat-label">Win Rate</div>
            </div>
        </div>
        
        <div class="profile-section">
            <h3>📊 Game History</h3>
            ${gameHistoryHTML}
        </div>
        
        <div class="profile-section">
            <h3>🏅 Achievements</h3>
            <div style="margin-top: 15px;">
                ${achievementsHTML}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

function showFriendProfileFromData(userId) {
    showFriendProfile(userId);
}

function closeFriendProfile() {
    document.getElementById('friendProfileModal').classList.remove('active');
}

function watchReplay(replayId) {
    alert(`▶️ Loading game replay ${replayId}...\n\nThis feature will show the complete game moves!`);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const challengeModal = document.getElementById('challengeModal');
    const profileModal = document.getElementById('friendProfileModal');
    const addFriendsModal = document.getElementById('addFriendsModal');
    
    if (event.target === challengeModal) {
        closeModal();
    }
    if (event.target === profileModal) {
        closeFriendProfile();
    }
    if (event.target === addFriendsModal) {
        closeAddFriendsModal();
    }
}

function tournament() {
    alert("Tournament feature coming soon 🔥");
}

// Add Friends Modal Functions
function openAddFriendsModal() {
    const modal = document.getElementById('addFriendsModal');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    // Clear previous search
    searchInput.value = '';
    searchResults.innerHTML = '<div class="card">Type to search for users...</div>';
    
    // Show modal
    modal.classList.add('active');
    
    // Focus on search input
    setTimeout(() => searchInput.focus(), 100);
}

function closeAddFriendsModal() {
    document.getElementById('addFriendsModal').classList.remove('active');
}

async function searchUsers() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const searchResults = document.getElementById('searchResults');
    
    if (!searchTerm) {
        searchResults.innerHTML = '<div class="card">Type to search for users...</div>';
        return;
    }
    
    // Filter users by username or ID
    const filteredUsers = allUsers.filter(user => {
        const usernameMatch = user.username.toLowerCase().includes(searchTerm);
        const idMatch = user._id.toLowerCase().includes(searchTerm);
        const isNotSelf = user._id !== currentUser._id;
        const isNotAlreadyFriend = !friendsList.some(f => f.userId._id === user._id);
        
        return (usernameMatch || idMatch) && isNotSelf && isNotAlreadyFriend;
    });
    
    if (filteredUsers.length === 0) {
        searchResults.innerHTML = '<div class="card">No users found</div>';
        return;
    }
    
    searchResults.innerHTML = filteredUsers.map(user => `
        <div class="search-result-item">
            <div class="friend-challenge-info">
                <img src="${user.profile.avatar}" alt="${user.username}">
                <div class="friend-details">
                    <span class="friend-name">${user.username}</span>
                    <span class="friend-status" style="color: #666; font-size: 12px;">Rank: ${user.profile.rank} • ${user.profile.status === 'online' ? '🟢 Online' : '⚫ Offline'}</span>
                </div>
            </div>
            <button class="add-friend-btn" onclick="addFriend('${user._id}', '${user.username}')">➕ Add Friend</button>
        </div>
    `).join('');
}

async function addFriend(friendId, friendName) {
    try {
        const response = await fetch(`${backend_BASE_URL}/api/add-friend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser._id,
                friendId: friendId
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        alert(`✅ ${friendName} has been added to your friends list!`);
        
        // Refresh friends list
        const friendsResponse = await fetch(`${backend_BASE_URL}/api/friends?userId=${currentUser._id}`);
        const friendsData = await friendsResponse.json();
        
        if (!friendsData.error) {
            friendsList = friendsData.friends;
            loadFriends(friendsList);
        }
        
        // Clear search
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '<div class="card">Type to search for users...</div>';
        
    } catch (error) {
        console.error('Error adding friend:', error);
        alert('Error adding friend. Please try again.');
    }
}

function logout() {
    // Clear user session
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    
    // Close WebSocket connection
    if (ws) {
        ws.close();
    }
    
    // Redirect to login page
    window.location.href = "/";
}

// WebSocket Connection for Real-time Challenges
function connectWebSocket(userId) {
    const wsUrl = backend_BASE_URL.replace('https://', 'wss://') + `?userId=${userId}`;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('WebSocket message parse error:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'challenge_received':
            showChallengePopup(data);
            break;
        case 'challenge_sent':
            console.log('Challenge sent:', data.message);
            break;
        case 'challenge_accepted':
            alert(`🎉 ${data.message}`);
            break;
        case 'challenge_rejected':
            alert(`❌ ${data.message}`);
            break;
        case 'game_start':
            console.log('Game start data:', data);
            // Check if it's a multi-level game
            if (data.isMultiLevel) {
                alert(`🔥 Multi-Level Battle Started!\n\nLevel 1: 3x3\nLevel 2: 4x4\nLevel 3: 5x5\n\nWin the majority to be the final winner!`);
            }
            // Navigate to game page with game ID
            window.location.href = `game.html?gameId=${data.gameId}`;
            break;
        case 'game_error':
            alert(`❌ ${data.message}`);
            break;
        case 'user_status_change':
            console.log(`User ${data.userId} status changed to ${data.status}`);
            updateUserStatusInUI(data.userId, data.status);
            break;
        case 'rank_change':
            console.log(`User ${data.userId} rank changed to ${data.rank} (${data.rankPoints} points)`);
            updateUserRankInUI(data.userId, data.rank, data.rankPoints);
            break;
        case 'level_transition':
            // Show level transition notification
            if (data.message) {
                showNotification(data.message, 'success');
            }
            console.log('Level transition:', data);
            break;
        default:
            console.log('Unknown WebSocket message type:', data.type);
    }
}

function showChallengePopup(data) {
    const popup = document.getElementById('challengePopup');
    const challengerName = document.getElementById('challengerName');
    const challengerAvatar = document.getElementById('challengerAvatar');
    
    // Store challenge data for response functions
    popup.challengeId = data.challengeId;
    popup.challengerId = data.challengerId;
    popup.gameType = data.gameType || 'single'; // Store game type
    
    // Update popup content
    challengerName.textContent = data.challengerName || 'Unknown Player';
    challengerAvatar.src = data.challengerAvatar || 'https://i.pravatar.cc/40';
    
    // Update challenge message based on game type
    const challengeMessage = document.querySelector('.challenge-message');
    if (data.gameType === 'multi_level') {
        challengeMessage.innerHTML = `🔥 ${data.challengerName} challenged you to a <strong>3-Level Battle!</strong><br><small>Win the majority to be the final winner!</small>`;
    } else {
        challengeMessage.innerHTML = `${data.challengerName} challenged you to a Tic Tac Toe game!`;
    }
    
    // Show popup
    popup.style.display = 'block';
    
    // Auto-hide after 30 seconds if not responded to
    setTimeout(() => {
        if (popup.style.display !== 'none') {
            popup.classList.add('fade-out');
            setTimeout(() => {
                popup.style.display = 'none';
                popup.classList.remove('fade-out');
            }, 500);
        }
    }, 30000);
}

function acceptChallenge() {
    const popup = document.getElementById('challengePopup');
    if (!popup.challengeId) return;
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Connection lost. Please refresh the page.');
        return;
    }
    
    // Send challenge response with game type
    ws.send(JSON.stringify({
        type: 'challenge_response',
        challengeId: popup.challengeId,
        accepted: true,
        gameType: popup.gameType || 'single'
    }));
    
    // Hide popup immediately - game will start via WebSocket
    popup.classList.add('fade-out');
    setTimeout(() => {
        popup.style.display = 'none';
        popup.classList.remove('fade-out');
    }, 500);
    
    // Note: Navigation to game page will happen when receiving 'game_start' message
}

function rejectChallenge() {
    const popup = document.getElementById('challengePopup');
    if (!popup.challengeId) return;
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Connection lost. Please refresh the page.');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'challenge_response',
        challengeId: popup.challengeId,
        accepted: false
    }));
    
    // Hide popup
    popup.classList.add('fade-out');
    setTimeout(() => {
        popup.style.display = 'none';
        popup.classList.remove('fade-out');
    }, 500);
}

// Update user status in the UI dynamically
function updateUserStatusInUI(userId, status) {
    // Update friend cards in the friends list
    const friendCards = document.querySelectorAll('.friend-card');
    friendCards.forEach(card => {
        const friendName = card.querySelector('.friend-name').textContent;
        
        // Find the friend in the friends list
        const friend = friendsList.find(f => {
            const name = f.userId?.username || f.username;
            const id = f.userId?._id || f._id;
            return id === userId || name === friendName;
        });
        
        if (friend && (friend.userId?._id === userId || friend._id === userId)) {
            const statusElement = card.querySelector('.friend-status');
            if (statusElement) {
                statusElement.textContent = status === 'online' ? '● Online' : '○ Offline';
                statusElement.style.color = status === 'online' ? '#4caf50' : '#999';
            }
        }
    });
    
    // Update friends in the challenge modal
    const friendItems = document.querySelectorAll('.friend-challenge-item');
    friendItems.forEach(item => {
        // Find friend button in this item
        const button = item.querySelector('.challenge-btn');
        
        // Find matching friend
        const friend = allUsers.find(u => u._id === userId);
        if (friend) {
            if (status === 'online') {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            } else {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            }
            
            // Update status text
            const statusElement = item.querySelector('.friend-status');
            if (statusElement) {
                statusElement.textContent = status === 'online' ? '● Online' : '○ Offline';
                statusElement.classList.remove('online', 'offline');
                statusElement.classList.add(status);
            }
        }
    });
    
    // Update all users in allUsers array
    const userToUpdate = allUsers.find(u => u._id === userId);
    if (userToUpdate) {
        userToUpdate.profile.status = status;
    }
}

// Update user rank in the UI dynamically
function updateUserRankInUI(userId, newRank, newRankPoints) {
    // Update current user's rank if it's them
    if (currentUser && currentUser._id === userId) {
        currentUser.profile.rank = newRank;
        currentUser.profile.rankPoints = newRankPoints;
        // Update the profile rank display in the header
        document.getElementById("rank").innerText = `Rank: ${newRank}`;
    }

    // Update friend cards in the friends list
    const friendCards = document.querySelectorAll('.friend-card');
    friendCards.forEach(card => {
        const friendName = card.querySelector('.friend-name').textContent;

        // Find the friend in the friends list
        const friend = friendsList.find(f => {
            const name = f.userId?.username || f.username;
            return name === friendName;
        });

        if (friend && (friend.userId?._id === userId || friend._id === userId)) {
            const rankElement = card.querySelector('.friend-rank');
            if (rankElement) {
                rankElement.textContent = `🏅 ${newRank}`;
            }
        }
    });

    // Update friends in the challenge modal
    const friendItems = document.querySelectorAll('.friend-challenge-item');
    friendItems.forEach(item => {
        // Find friend button in this item
        const button = item.querySelector('.challenge-btn');

        // Find matching friend
        const friend = allUsers.find(u => u._id === userId);
        if (friend) {
            friend.profile.rank = newRank;
            friend.profile.rankPoints = newRankPoints;

            // Update rank text in the modal
            const rankText = item.querySelector('.rank-text');
            if (rankText) {
                rankText.textContent = `🏅 Rank: ${newRank}`;
            }
        }
    });

    // Update all users in allUsers array
    const userToUpdate = allUsers.find(u => u._id === userId);
    if (userToUpdate) {
        userToUpdate.profile.rank = newRank;
        userToUpdate.profile.rankPoints = newRankPoints;
    }
}

// Profile Image Upload Function
async function uploadProfileImage() {
    const fileInput = document.getElementById('avatarUpload');
    const file = fileInput.files[0];
    
    if (!file) {
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB.');
        return;
    }
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('User not logged in.');
        return;
    }
    
    // Show loading state
    const profileAvatar = document.getElementById('profileAvatar');
    const originalSrc = profileAvatar.src;
    profileAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHBhdGggZD0iTTIwIDIwSDIwVjIwSDB2MEgyMFoiIGZpbGw9IndoaXRlIi8+Cjx0ZXh0IHg9IjIwIiB5PSIyNSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTIiPkxvYWRpbmcuLi48L3RleHQ+Cjwvc3ZnPgo=';
    
    try {
        const formData = new FormData();
        formData.append('profileImage', file);
        formData.append('userId', userId);
        
        const response = await fetch(`${backend_BASE_URL}/api/upload-profile-image`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Update the profile image in the UI
            profileAvatar.src = result.avatarUrl;
            
            // Update the avatar in local storage or current user data
            if (currentUser) {
                currentUser.profile.avatar = result.avatarUrl;
            }
            
            // Show success message
            showNotification('Profile image updated successfully!', 'success');
        } else {
            throw new Error(result.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Show specific error messages
        let errorMessage = 'Failed to upload image. Please try again.';
        if (error.message.includes('Image upload service not configured')) {
            errorMessage = 'Image upload service not configured. Please contact the administrator.';
        } else if (error.message.includes('cloud_name mismatch')) {
            errorMessage = 'Image upload service configuration error. Please contact the administrator.';
        }
        
        alert(errorMessage);
        
        // Restore original image on error
        profileAvatar.src = originalSrc;
    }
    
    // Clear the file input
    fileInput.value = '';
}

// Simple notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Load dashboard data on page load
loadDashboardData();