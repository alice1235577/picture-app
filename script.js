// Khởi tạo Supabase
const supabaseClient = supabase.createClient(
    'https://zjblnjxziswvmqktmyjj.supabase.co', 
    'sb_publishable_l_iTXPdQjExhFMZtElHjIA_uElx7hKq' 
);

const App = {
    state: {
        currentUser: null,
        allUsers: [],
        theme: localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light',
        currentTag: 'All',
        searchQuery: '',
        activeImageId: null,
        replyingToId: null,
        images: [],
        page: 1,
        limit: 15,
        isLoadingMore: false,
        hasMore: true,
        uploadFilter: 'none', 
        currentBoardView: null, 
        imageToSaveId: null, 
    },

    async init() { 
        try {
            this.autoSmartTheme(); 
            this.cacheDOM();
            this.bindEvents();
            
            await this.loadData(); 
            
            this.applyTheme();
            this.checkAuth();
            this.applyCustomBackground(); 
            this.handleScrollEffect();
            this.setupInfiniteScroll();

            setInterval(() => this.updateGreeting(), 10000);
            setInterval(() => this.pollForUpdates(), 3000); // Tăng tốc độ Radar để nhận tin nhắn cực nhanh
            
        } catch (error) {
            console.error("Lỗi khởi tạo App:", error);
        }
    },    

    autoSmartTheme() {
        const savedTheme = localStorage.getItem('darkMode');
        const hour = new Date().getHours();
        if (savedTheme === null) {
            if (hour >= 19 || hour < 6) this.state.theme = 'dark';
            else this.state.theme = 'light';
        }
    },    
     
    cacheDOM() {
        this.appEl = document.getElementById('app');
        this.authScreen = document.getElementById('authScreen');
        this.galleryGrid = document.getElementById('galleryGrid');
        this.profilePage = document.getElementById('profilePage');
        this.uploadModal = document.getElementById('uploadModal');
        this.detailModal = document.getElementById('detailModal');
        this.notiModal = document.getElementById('notificationsModal');
        this.mainWorkspace = document.getElementById('mainWorkspace');
        this.headerWrapper = document.getElementById('headerWrapper');
    },

    saveRecentSearch(query, imgUrl) {
        if (!query) return;
        let recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        recent = recent.filter(item => item.query !== query);
        recent.unshift({ query, imgUrl });
        if (recent.length > 10) recent.pop();
        localStorage.setItem('recentSearches', JSON.stringify(recent));
    },

    renderRecentSearches() {
        const list = document.getElementById('recentList');
        const dropdown = document.getElementById('recentSearchesDropdown');
        const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        
        if (recent.length === 0) { dropdown.classList.add('hidden'); return; }
        
        list.innerHTML = '';
        recent.forEach(item => {
            const div = document.createElement('div');
            div.className = 'recent-item';
            div.innerHTML = `
                <img src="${item.imgUrl}" class="recent-thumb">
                <span class="fs-sm fw-600 text-primary">${item.query}</span>
            `;
            div.onclick = () => {
                document.getElementById('searchInput').value = item.query;
                this.state.searchQuery = item.query;
                this.renderGallery(true);
                dropdown.classList.add('hidden');
            };
            list.appendChild(div);
        });
        dropdown.classList.remove('hidden');
    },

    bindEvents() {
        // --- AUTH ---
        document.getElementById('toggleAuthMode')?.addEventListener('click', () => this.toggleAuthMode());
        document.getElementById('authForm')?.addEventListener('submit', (e) => this.handleAuth(e));
        document.getElementById('authForm')?.addEventListener('input', () => this.hideAuthMessage());
        
        const togglePasswordBtn = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        if (togglePasswordBtn && passwordInput) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
            });
        }

        // --- BACKGROUND ---
        const themeBtn = document.getElementById('themePaletteBtn');
        const themeDropdown = document.getElementById('themeDropdown');
        if (themeBtn && themeDropdown) {
            themeBtn.addEventListener('click', (e) => { e.stopPropagation(); themeDropdown.classList.toggle('hidden'); });
            window.addEventListener('click', (e) => { if (!themeDropdown.contains(e.target)) themeDropdown.classList.add('hidden'); });
        }
        document.getElementById('bgUploadInput')?.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        document.getElementById('removeBgBtn')?.addEventListener('click', () => this.removeCustomBackground());
        
        // --- NAVIGATION ---
        document.getElementById('navHome')?.addEventListener('click', () => location.reload());
// --- FIX NÚT MỞ THÔNG BÁO ---
        document.getElementById('openNotificationsBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const notiModal = document.getElementById('notificationsModal');
            if (notiModal) {
                notiModal.classList.toggle('hidden');
                
                // Nếu bảng vừa được mở ra
                if (!notiModal.classList.contains('hidden')) {
                    this.renderNotifications(); 
                    this.markNotificationsAsRead(); // Hàm này sẽ ép tắt chấm đỏ ngay lập tức
                }
            }
        });        document.getElementById('openProfileBtn')?.addEventListener('click', () => {
            this.galleryGrid.classList.add('hidden');
            document.getElementById('headerWrapper').classList.add('hidden'); 
            this.profilePage.classList.remove('hidden'); 
            this.switchProfileTab('created'); 
        });

        document.getElementById('closeProfileBtn')?.addEventListener('click', () => {
            this.profilePage.classList.add('hidden');
            this.galleryGrid.classList.remove('hidden');
            document.getElementById('headerWrapper').classList.remove('hidden');
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            location.reload();
        });

        // --- MODALS ---
        document.getElementById('openCreateModalBtn')?.addEventListener('click', () => this.uploadModal.classList.remove('hidden'));
        document.getElementById('closeUploadModalBtn')?.addEventListener('click', () => this.uploadModal.classList.add('hidden'));
        document.getElementById('cancelUploadBtn')?.addEventListener('click', () => this.uploadModal.classList.add('hidden'));
        
        document.getElementById('closeDetailModalBtn')?.addEventListener('click', () => {
            this.detailModal.classList.add('hidden');
            document.getElementById('detailImg').classList.remove('is-zoomed');
            document.getElementById('pinOptionsDropdown').classList.add('hidden'); 
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.uploadModal.classList.add('hidden');
                this.detailModal.classList.add('hidden');
                this.notiModal.classList.add('hidden');
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === this.uploadModal) this.uploadModal.classList.add('hidden');
            if (e.target === this.detailModal) this.detailModal.classList.add('hidden');
            if (e.target === this.notiModal) this.notiModal.classList.add('hidden');
            const menu = document.getElementById('pinOptionsDropdown');
            const btn = document.getElementById('moreOptionsBtn');
            if (menu && !menu.classList.contains('hidden') && e.target !== btn && !btn.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        // --- LỌC TAGS ---
        document.querySelectorAll('.tag-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const container = target.closest('.tags-container');
                container.querySelectorAll('.tag-pill').forEach(b => {
                    b.classList.remove('active', 'solid-tag');
                    if (container.id === 'uploadCategoryTags') b.classList.add('outline-tag');
                });
                target.classList.add('active');
                if (container.id === 'uploadCategoryTags') {
                    target.classList.add('solid-tag');
                    target.classList.remove('outline-tag');
                }
                if (container.id === 'categoryTags') {
                    this.state.currentTag = target.dataset.filter;
                    this.renderGallery(true); 
                }
            });
        });

        // --- TÌM KIẾM ---
        const searchInput = document.getElementById('searchInput');
        const searchDropdown = document.getElementById('searchDropdown');
        const dropdownContent = document.getElementById('dropdownContent');

        const renderDropdown = (type, list) => {
            dropdownContent.innerHTML = `<div class="dropdown-header">${type === 'recent' ? 'Tìm kiếm gần đây' : 'Gợi ý tìm kiếm'}</div>`;
            list.forEach(item => {
                const text = typeof item === 'object' ? item.query : item;
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> <span>${text}</span>`;
                div.onclick = () => {
                    searchInput.value = text;
                    this.state.searchQuery = text;
                    this.renderGallery(true);
                    searchDropdown.classList.add('hidden');
                };
                dropdownContent.appendChild(div);
            });
            searchDropdown.classList.remove('hidden');
        };

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            if (!val) { searchDropdown.classList.add('hidden'); return; }
            const suggestions = [...new Set(this.state.images.filter(img => img.title.toLowerCase().includes(val)).map(img => img.title))].slice(0, 5);
            if (suggestions.length > 0) renderDropdown('suggestions', suggestions);
            else searchDropdown.classList.add('hidden');
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // CHỐNG LOAD LẠI TRANG
                const query = e.target.value.trim();
                if (query) {
                    let recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
                    recents = [query, ...recents.filter(i => i !== query)].slice(0, 5);
                    localStorage.setItem('recentSearches', JSON.stringify(recents));
                    this.state.searchQuery = query;
                    this.renderGallery(true);
                    searchDropdown.classList.add('hidden');
                }
            }
        });

        searchInput.addEventListener('focus', () => {
            const recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
            if (recents.length > 0 && !searchInput.value) renderDropdown('recent', recents);
        });

        window.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) searchDropdown.classList.add('hidden');
        });

        // --- PHOTOSHOP MINI ---
        const fileInput = document.getElementById('uploadFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.openImageEditor(ev.target.result); 
                        e.target.value = ''; 
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        document.getElementById('cancelEditorBtn')?.addEventListener('click', () => document.getElementById('imageEditorModal').classList.add('hidden'));
        document.getElementById('saveEditorBtn')?.addEventListener('click', () => this.saveEditedImage());
        document.getElementById('resetEditorBtn')?.addEventListener('click', () => {
            this.resetCanvas();
            document.getElementById('freeCropBtn').className = 'btn-outline notranslate';
            document.getElementById('freeCropBtn').textContent = '✂️ Cắt Tự Do';
            document.getElementById('drawModeBtn').className = 'btn-outline notranslate';
            document.getElementById('drawModeBtn').textContent = '🖌️ Bật Vẽ';
            document.getElementById('colorPalette').classList.add('hidden');
            document.getElementById('imageCanvas').style.cursor = 'default';
        });
        
        const freeCropBtn = document.getElementById('freeCropBtn');
        const drawBtn = document.getElementById('drawModeBtn');
        const colorPalette = document.getElementById('colorPalette');
        const brushColor = document.getElementById('brushColor');
        
        freeCropBtn?.addEventListener('click', () => {
            this.state.isCropModeActive = !this.state.isCropModeActive;
            if (this.state.isCropModeActive) {
                freeCropBtn.className = 'btn-primary notranslate';
                freeCropBtn.textContent = '✂️ Kéo chuột để cắt...';
                this.state.isDrawModeActive = false; 
                drawBtn.className = 'btn-outline notranslate';
                drawBtn.textContent = '🖌️ Bật Vẽ';
                colorPalette.classList.add('hidden');
                document.getElementById('imageCanvas').style.cursor = 'crosshair';
            } else {
                freeCropBtn.className = 'btn-outline notranslate';
                freeCropBtn.textContent = '✂️ Cắt Tự Do';
                document.getElementById('imageCanvas').style.cursor = 'default';
            }
        });

        drawBtn?.addEventListener('click', () => {
            this.state.isDrawModeActive = !this.state.isDrawModeActive;
            if (this.state.isDrawModeActive) {
                drawBtn.className = 'btn-primary notranslate';
                drawBtn.textContent = '🖌️ Đang Vẽ';
                colorPalette.classList.remove('hidden');
                this.state.isCropModeActive = false; 
                freeCropBtn.className = 'btn-outline notranslate';
                freeCropBtn.textContent = '✂️ Cắt Tự Do';
                document.getElementById('imageCanvas').style.cursor = 'crosshair';
            } else {
                drawBtn.className = 'btn-outline notranslate';
                drawBtn.textContent = '🖌️ Bật Vẽ';
                colorPalette.classList.add('hidden');
                document.getElementById('imageCanvas').style.cursor = 'default';
            }
        });

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                brushColor.value = e.target.dataset.color;
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        const canvas = document.getElementById('imageCanvas');
        if(canvas) {
            canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
            canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
            canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
            canvas.addEventListener('mouseout', (e) => this.handleCanvasMouseUp(e)); 
        }
        
        // ===================================================================
        // HỆ THỐNG NHẮN TIN (CẬP NHẬT ĐỂ ĐỒNG BỘ SUPABASE)
        // ===================================================================
        const messagesPanel = document.getElementById('messagesPanel');
        const chatListView = document.getElementById('chatListView');
        const inviteView = document.getElementById('inviteView');
        const chatDetailView = document.getElementById('chatDetailView');
        const openChatBtn = document.getElementById('openChatBtn');
        
        if (!App.state.conversations) App.state.conversations = JSON.parse(localStorage.getItem('conversationsData') || '[]');
        const saveConversations = () => localStorage.setItem('conversationsData', JSON.stringify(App.state.conversations));

        const renderChatList = () => {
            const listEl = document.getElementById('dynamicChatList');
            if (!listEl) return;
            listEl.innerHTML = '';
            if (!App.state.currentUser) return;
            
            const myEmail = App.state.currentUser.email;
            const myChats = App.state.conversations.filter(c => c.participants.includes(myEmail));
            
            if (myChats.length === 0) {
                listEl.innerHTML = '<p class="text-muted fs-sm py-2">Bạn chưa có tin nhắn nào. Bấm "Tin nhắn mới" để bắt đầu!</p>';
                return;
            }

            myChats.forEach(chat => {
                const otherEmail = chat.participants.find(e => e !== myEmail);
                const otherUser = App.getUserFromEmail(otherEmail) || { name: otherEmail.split('@')[0], avatar: null };
                const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : 'Bắt đầu trò chuyện...';
                const isUnread = chat.unreadFor && chat.unreadFor.includes(myEmail);
                
                const item = document.createElement('div');
                item.className = 'chat-item bg-hover flex-align-center gap-3';
                let avatarHtml = `<div class="avatar-circle bg-accent text-inverse" style="width: 44px; height: 44px;">${otherUser.name.charAt(0).toUpperCase()}</div>`;
                if (otherUser.avatar) avatarHtml = `<div class="avatar-circle" style="width: 44px; height: 44px;"><img src="${otherUser.avatar}" style="width:100%;height:100%;object-fit:cover;"></div>`;

                item.innerHTML = `
                    ${avatarHtml}
                    <div style="flex: 1; overflow: hidden;">
                        <strong class="text-primary fs-md" style="${isUnread ? 'color: var(--danger-color);' : ''}">${otherUser.name}</strong>
                        <span class="text-muted fs-sm" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; ${isUnread ? 'font-weight: 800; color: var(--text-primary);' : ''}">${lastMsg}</span>
                    </div>
                    ${isUnread ? '<div style="width: 10px; height: 10px; background: var(--danger-color); border-radius: 50%;"></div>' : ''}
                `;
                item.onclick = () => openChatRoom(chat.id, otherUser, otherEmail);
                listEl.appendChild(item);
            });
        };
        this.renderChatListGlobal = renderChatList; 

        const openChatRoom = (chatId, otherUser, otherEmail) => {
            App.state.activeChatId = chatId;
            document.getElementById('chatRecipientName').textContent = otherUser.name;
            const avatarEl = document.getElementById('chatRecipientAvatar');
            if (otherUser.avatar) {
                avatarEl.innerHTML = `<img src="${otherUser.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
                avatarEl.style.background = 'transparent';
            } else {
                avatarEl.innerHTML = otherUser.name.charAt(0).toUpperCase();
                avatarEl.style.background = 'var(--accent-color)';
            }
            
            const chat = App.state.conversations.find(c => c.id === chatId);
            if (chat && chat.unreadFor && chat.unreadFor.includes(App.state.currentUser.email)) {
                chat.unreadFor = chat.unreadFor.filter(e => e !== App.state.currentUser.email);
                saveConversations();
                App.updateChatBadge();
            }

            renderMessages();
            chatListView.classList.add('hidden');
            chatDetailView.classList.remove('hidden');
        };

        const renderMessages = () => {
            const area = document.getElementById('chatMessagesArea');
            area.innerHTML = '';
            const chat = App.state.conversations.find(c => c.id === App.state.activeChatId);
            if (!chat) return;

            chat.messages.forEach(msg => {
                const isMe = msg.sender === App.state.currentUser.email;
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;
                bubble.textContent = msg.text;
                area.appendChild(bubble);
            });
            area.scrollTop = area.scrollHeight; 
        };
        this.renderMessagesGlobal = renderMessages; 

        const newMessageView = document.getElementById('newMessageView');
        let selectedUserForChat = null;

        document.getElementById('newMessageBtn')?.addEventListener('click', () => {
            if (!App.state.currentUser) return;
            document.getElementById('chatListView').classList.add('hidden');
            if(newMessageView) newMessageView.classList.remove('hidden');
            
            const searchInput = document.getElementById('searchUserInput');
            if(searchInput) searchInput.value = '';
            selectedUserForChat = null;
            
            const nextBtn = document.getElementById('nextNewMessageBtn');
            if (nextBtn) {
                nextBtn.style.background = 'var(--bg-hover)';
                nextBtn.style.color = 'var(--text-secondary)';
                nextBtn.style.pointerEvents = 'none';
            }
            renderSuggestedUsers(''); 
        });

        document.getElementById('backFromNewMessageBtn')?.addEventListener('click', () => {
            if(newMessageView) newMessageView.classList.add('hidden');
            document.getElementById('chatListView').classList.remove('hidden');
        });

        const renderSuggestedUsers = (searchQuery = '') => {
            const listEl = document.getElementById('suggestedUsersList');
            if (!listEl) return;
            listEl.innerHTML = '';
            
            const users = App.state.allUsers || [];
            const myEmail = App.state.currentUser.email;            
            
            const filteredUsers = users.filter(u => 
                u.email !== myEmail && 
                (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            if (filteredUsers.length === 0) {
                listEl.innerHTML = '<p class="text-muted fs-sm mt-3">Không tìm thấy tài khoản nào.</p>';
                return;
            }

            filteredUsers.forEach(user => {
                const item = document.createElement('div');
                item.className = 'chat-item flex-align-center gap-3 user-suggestion-item';
                item.style.padding = '10px 8px';
                item.style.borderRadius = '16px';
                
                let avatarHtml = `<div class="avatar-circle bg-accent text-inverse" style="width: 48px; height: 48px; font-size: 1.2rem; flex-shrink: 0;">${user.name.charAt(0).toUpperCase()}</div>`;
                if (user.avatar) avatarHtml = `<div class="avatar-circle" style="width: 48px; height: 48px; flex-shrink: 0;"><img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;"></div>`;

                item.innerHTML = `
                    ${avatarHtml}
                    <div style="flex: 1;">
                        <strong class="text-primary fs-md d-block">${user.name}</strong>
                        <span class="text-muted fs-sm">@${user.email.split('@')[0]}</span>
                    </div>
                `;

                item.onclick = () => {
                    document.querySelectorAll('.user-suggestion-item').forEach(el => el.style.background = 'transparent');
                    item.style.background = 'var(--bg-hover)';
                    selectedUserForChat = user;
                    
                    const nextBtn = document.getElementById('nextNewMessageBtn');
                    if (nextBtn) {
                        nextBtn.style.background = 'var(--danger-color)';
                        nextBtn.style.color = '#fff';
                        nextBtn.style.pointerEvents = 'auto';
                    }
                };
                listEl.appendChild(item);
            });
        };

        document.getElementById('searchUserInput')?.addEventListener('input', (e) => {
            renderSuggestedUsers(e.target.value.trim());
        });

        document.getElementById('nextNewMessageBtn')?.addEventListener('click', () => {
            if (!selectedUserForChat) return;
            
            let chat = App.state.conversations.find(c => c.participants.includes(App.state.currentUser.email) && c.participants.includes(selectedUserForChat.email));
            if (!chat) {
                chat = { id: Date.now(), participants: [App.state.currentUser.email, selectedUserForChat.email], messages: [] };
                App.state.conversations.push(chat);
                saveConversations();
            }
            if(typeof renderChatList === 'function') renderChatList();
            if(newMessageView) newMessageView.classList.add('hidden');
            openChatRoom(chat.id, selectedUserForChat, selectedUserForChat.email);
        });

        const chatEmojiBtn = document.getElementById('chatEmojiBtn');
        const chatEmojiPicker = document.getElementById('chatEmojiPicker');
        if (chatEmojiBtn && chatEmojiPicker) {
            chatEmojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chatEmojiPicker.classList.toggle('hidden');
            });
            document.querySelectorAll('.chat-emoji-item').forEach(em => {
                em.addEventListener('click', (e) => {
                    const input = document.getElementById('chatMessageInput');
                    input.value += e.target.textContent;
                    chatEmojiPicker.classList.add('hidden');
                    input.focus();
                });
            });
            window.addEventListener('click', (e) => {
                if (!chatEmojiBtn.contains(e.target) && !chatEmojiPicker.contains(e.target)) {
                    chatEmojiPicker.classList.add('hidden');
                }
            });
        }

        // LÕI NHẮN TIN - ĐÃ HACK ĐỂ ĐỒNG BỘ QUA SUPABASE
        const sendMessage = async () => {
            const input = document.getElementById('chatMessageInput');
            const text = input.value.trim();
            if (!text || !App.state.activeChatId) return;

            let chats = JSON.parse(localStorage.getItem('conversationsData') || '[]');
            const chatIdx = chats.findIndex(c => c.id === App.state.activeChatId);
            
            if (chatIdx > -1) {
                const myEmail = App.state.currentUser.email;
                const targetEmail = chats[chatIdx].participants.find(p => p !== myEmail);

                chats[chatIdx].messages.push({ sender: myEmail, text: text, time: Date.now() });
                localStorage.setItem('conversationsData', JSON.stringify(chats));
                App.state.conversations = chats; 
                
                if (typeof renderMessages === 'function') renderMessages();
                if (typeof renderChatList === 'function') renderChatList();
                
                input.value = ''; 

                // Hack: Bắn gói tin nhắn qua hệ thống Notifications của Supabase
                if (targetEmail) {
                    const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
                    let currentNotis = data ? (data.notifications || []) : [];
                    
                    // CHỈ GIỮ LẠI GÓI TIN NHẮN TÀNG HÌNH (Để đồng bộ Chat, không báo chuông)
                    currentNotis.push({
                        id: Date.now(), type: 'chat_msg', sender: myEmail, text: text, read: false, time: Date.now()
                    });
                    
                    // ĐÃ XÓA ĐOẠN TẠO THÔNG BÁO CHUÔNG "vừa gửi cho bạn một tin nhắn" Ở ĐÂY

                    await supabaseClient.from('users').update({ notifications: currentNotis }).eq('email', targetEmail);
                }
            }
        };
        document.getElementById('sendChatMessageBtn')?.addEventListener('click', sendMessage);
        document.getElementById('chatMessageInput')?.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } // CHỐNG F5 KHI NHẤN ENTER
        });
        
        if (openChatBtn) {
            openChatBtn.onclick = function(e) {
                e.preventDefault(); e.stopPropagation();
                const msgPanel = document.getElementById('messagesPanel');
                const aiPanel = document.getElementById('aiPanel');
                if (aiPanel) aiPanel.classList.remove('active');

                if (msgPanel) {
                    msgPanel.classList.toggle('active');
                    msgPanel.classList.remove('hidden');
                    if (typeof renderChatList === 'function') renderChatList(); 
                    
                    document.querySelectorAll('#chatListView').forEach(v => v.classList.remove('hidden'));
                    document.querySelectorAll('#inviteView').forEach(v => v.classList.add('hidden'));
                    document.querySelectorAll('#chatDetailView').forEach(v => v.classList.add('hidden'));
                    document.querySelectorAll('#newMessageView').forEach(v => v.classList.add('hidden'));
                }
            };
        }

        document.getElementById('closeMessagesBtn')?.addEventListener('click', () => {
            const msgPanel = document.getElementById('messagesPanel');
            if (msgPanel) msgPanel.classList.remove('active');
        });

        document.getElementById('openInviteViewBtn')?.addEventListener('click', () => { chatListView.classList.add('hidden'); inviteView.classList.remove('hidden'); });
        document.getElementById('backToChatListBtn')?.addEventListener('click', () => { inviteView.classList.add('hidden'); chatListView.classList.remove('hidden'); });
        document.getElementById('backFromChatDetailBtn')?.addEventListener('click', () => { chatDetailView.classList.add('hidden'); chatListView.classList.remove('hidden'); App.state.activeChatId = null; });

        document.getElementById('copyProfileLinkBtn')?.addEventListener('click', () => {
            if (!App.state.currentUser) return;
            const profileLink = `${window.location.origin}/profile?user=${encodeURIComponent(App.state.currentUser.email)}`;
            navigator.clipboard.writeText(profileLink).then(() => {
                alert("Đã sao chép liên kết trang cá nhân của bạn!\nHãy gửi cho bạn bè để kết nối nhé.");
            }).catch(() => prompt("Chép thủ công tại đây:", profileLink));
        });

        window.addEventListener('click', (e) => {
            const msgPanel = document.getElementById('messagesPanel');
            if (msgPanel && msgPanel.classList.contains('active')) {
                if (!msgPanel.contains(e.target) && openChatBtn && !openChatBtn.contains(e.target)) {
                    msgPanel.classList.remove('active');
                }
            }
        });

        document.getElementById('submitUploadBtn')?.addEventListener('click', () => this.saveNewIdea());

        // --- CHI TIẾT ẢNH TƯƠNG TÁC ---
        document.getElementById('likeBtn')?.addEventListener('click', () => this.toggleLikeDetail());
        document.getElementById('savePinBtn')?.addEventListener('click', () => this.toggleSaveDetail());
        
        document.getElementById('sendCommentBtn')?.addEventListener('click', () => this.addComment());
        document.getElementById('mainCommentInput')?.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') { e.preventDefault(); this.addComment(); } // CHỐNG F5 KHI NHẤN ENTER
        });

        const emojiBtn = document.getElementById('emojiBtn');
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiBtn && emojiPicker) {
            emojiBtn.addEventListener('click', () => emojiPicker.classList.toggle('hidden'));
            document.querySelectorAll('.emoji-item').forEach(em => {
                em.addEventListener('click', (e) => {
                    const input = document.getElementById('mainCommentInput');
                    input.value += e.target.textContent;
                    emojiPicker.classList.add('hidden');
                    input.focus();
                });
            });
        }

        document.getElementById('aiSearchBtn')?.addEventListener('click', () => this.performAISearch());
        document.getElementById('expandImgBtn')?.addEventListener('click', () => document.getElementById('detailImg').classList.toggle('is-zoomed'));
        document.getElementById('detailImg')?.addEventListener('click', () => document.getElementById('detailImg').classList.toggle('is-zoomed'));
        document.getElementById('downloadBtn')?.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = document.getElementById('detailImg').src;
            a.download = 'picture_' + Date.now() + '.jpg';
            a.click();
        });

        document.getElementById('followBtn')?.addEventListener('click', () => this.toggleFollow());
        document.getElementById('moreOptionsBtn')?.addEventListener('click', () => {
            document.getElementById('pinOptionsDropdown').classList.toggle('hidden');
        });
        document.getElementById('deletePinBtn')?.addEventListener('click', () => this.deleteIdea());
        document.getElementById('editPinBtn')?.addEventListener('click', () => this.editIdea());

        document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
            this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
            localStorage.setItem('darkMode', this.state.theme === 'dark');
            this.applyTheme();
        });

        document.querySelectorAll('.profile-tabs .tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchProfileTab(e.currentTarget.dataset.tab);
            });
        });
        
        document.getElementById('settingAvatarInput')?.addEventListener('change', (e) => this.handleAvatarUpload(e));
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
        
        this.setupGlobalAi();
    },
    
    async loadData() {
        const { data: postsData, error: postsError } = await supabaseClient.from('posts').select('*').order('id', { ascending: false });
        const { data: usersData, error: usersError } = await supabaseClient.from('users').select('email, name, avatar');

        if (postsError || usersError) {
            console.error("Lỗi tải dữ liệu:", postsError || usersError);
        } else {
            this.state.images = postsData || [];
            this.state.allUsers = usersData || []; 
            this.renderGallery(true);
        }
    },

    saveImages() {
        // Tắt hàm này đi để tránh lỗi QuotaExceededError làm sập trang khi comment
    },

    compressImage(file, maxWidth, quality) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/webp', quality);
                    resolve(compressedBase64);
                };
            };
        });
    },

    handleBackgroundUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.compressImage(file, 1920, 0.6).then(base64Data => {
            if (!this.state.currentUser) return;
            const userEmail = this.state.currentUser.email;

            localStorage.setItem(`bg_${userEmail}`, base64Data);
            this.state.currentUser.customBackground = base64Data; 

            this.applyCustomBackground();
            const dropdown = document.getElementById('themeDropdown');
            if (dropdown) dropdown.classList.add('hidden');
        });
    },

    applyCustomBackground() {
        if (!this.state.currentUser) return;
        const userEmail = this.state.currentUser.email;
        const bgData = localStorage.getItem(`bg_${userEmail}`) || this.state.currentUser.customBackground;
        let bgEl = document.getElementById('customBackground');
        
        if (!bgEl) {
            bgEl = document.createElement('div');
            bgEl.id = 'customBackground';
            bgEl.className = 'custom-bg hidden';
            document.body.prepend(bgEl); 
        }

        if (bgData) {
            bgEl.style.backgroundImage = `url(${bgData})`;
            bgEl.classList.remove('hidden');
            document.body.classList.add('has-custom-bg');
        } else {
            bgEl.classList.add('hidden');
            bgEl.style.backgroundImage = '';
            document.body.classList.remove('has-custom-bg');
        }
    },

    removeCustomBackground() {
        if (!this.state.currentUser) return;
        const userEmail = this.state.currentUser.email;

        localStorage.removeItem(`bg_${userEmail}`);
        this.state.currentUser.customBackground = null;
            
        const input = document.getElementById('bgUploadInput');
        if(input) input.value = '';
        this.applyCustomBackground();
        
        const dropdown = document.getElementById('themeDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    applyTheme() {
        const isDark = this.state.theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        
        const sun = document.querySelector('.icon-sun');
        const moon = document.querySelector('.icon-moon');
        if (sun) sun.classList.toggle('hidden', isDark);
        if (moon) moon.classList.toggle('hidden', !isDark);
    },

    handleScrollEffect() {
        if (this.mainWorkspace && this.headerWrapper) {
            this.mainWorkspace.addEventListener('scroll', () => {
                if (this.mainWorkspace.scrollTop > 10) this.headerWrapper.classList.add('scrolled');
                else this.headerWrapper.classList.remove('scrolled');
            });
        }
    },

    async checkAuth() { 
        const userEmail = localStorage.getItem('currentUser');
        if (userEmail) {
            const { data: user, error } = await supabaseClient.from('users').select('*').eq('email', userEmail).single();

            if (user) {
                this.state.currentUser = user; 

                if (!this.state.currentUser.boards) this.state.currentUser.boards = [];
                if (!this.state.currentUser.followers) this.state.currentUser.followers = [];
                if (!this.state.currentUser.following) this.state.currentUser.following = [];
                if (!this.state.currentUser.notifications) this.state.currentUser.notifications = [];
                if (!this.state.currentUser.savedIds) this.state.currentUser.savedIds = [];

                this.authScreen.classList.add('hidden');
                this.appEl.classList.remove('hidden');
                this.updateUIWithUser();
                this.renderGallery(true); 
                this.applyCustomBackground(); 
                
                this.updateNotiBadge();
                if(typeof this.updateChatBadge === 'function') this.updateChatBadge();
                return;
            }
        }
        
        this.appEl.classList.add('hidden');
        this.authScreen.classList.remove('hidden');
        this.state.currentUser = null;
        this.applyCustomBackground(); 
    },

    hideAuthMessage() {
        const msgEl = document.getElementById('authMessage');
        if (msgEl) msgEl.classList.add('hidden');
    },

    toggleAuthMode() {
        const authSubmit = document.getElementById('authSubmit');
        const isLogin = authSubmit.textContent === 'Đăng nhập';
        document.getElementById('nameGroupWrapper').style.display = isLogin ? 'flex' : 'none';
        authSubmit.textContent = isLogin ? 'Đăng ký' : 'Đăng nhập';
        document.getElementById('toggleAuthMode').textContent = isLogin ? 'Đăng nhập ngay' : 'Đăng ký ngay';
        this.hideAuthMessage();
    },

    async handleAuth(e) {
        e.preventDefault();
        const isLogin = document.getElementById('authSubmit').textContent === 'Đăng nhập';
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value.trim();
        const msgEl = document.getElementById('authMessage');

        if (!email || !password) {
            msgEl.textContent = "Vui lòng điền đủ thông tin!";
            msgEl.classList.remove('hidden');
            return;
        }

        if (isLogin) {
            const { data, error } = await supabaseClient.from('users').select('*').eq('email', email).eq('password', password).single();
            if (data) {
                localStorage.setItem('currentUser', email);
                this.checkAuth();
            } else {
                msgEl.textContent = "Sai email hoặc mật khẩu!";
                msgEl.classList.remove('hidden');
            }
        } else {
            const { error } = await supabaseClient.from('users').insert([{ email, password, name: name || email.split('@')[0], boards: [] }]);
            if (error) {
                msgEl.textContent = "Email này đã tồn tại hoặc có lỗi!";
                msgEl.classList.remove('hidden');
            } else {
                alert("Đăng ký thành công!");
                this.toggleAuthMode();
            }
        }
    },

    renderAvatar(user, elId) {
        const el = document.getElementById(elId);
        if(!el || !user) return;
        if (user.avatar) {
            el.innerHTML = `<img src="${user.avatar}" style="width:100%; height:100%; object-fit:cover;">`;
            el.style.backgroundColor = 'transparent';
        } else {
            el.innerHTML = user.name ? user.name.charAt(0).toUpperCase() : 'A';
            el.style.backgroundColor = 'var(--accent-color)';
        }
    },

    updateUIWithUser() {
        if (!this.state.currentUser) return;
        const name = this.state.currentUser.name;
        
        document.getElementById('topName').textContent = name;
        document.getElementById('topEmail').textContent = this.state.currentUser.email;
        this.renderAvatar(this.state.currentUser, 'topAvatar');
        
        document.getElementById('profileName').textContent = name;
        document.getElementById('profileEmail').textContent = this.state.currentUser.email;
        this.renderAvatar(this.state.currentUser, 'profileAvatar');

        const followersCount = (this.state.currentUser.followers || []).length;
        const followingCount = (this.state.currentUser.following || []).length;
        const emailEl = document.getElementById('profileEmail');
        if (emailEl && emailEl.nextElementSibling) {
            emailEl.nextElementSibling.textContent = `${followersCount} người theo dõi • ${followingCount} đang theo dõi`;
        }

        this.updateGreeting();
    },

    updateGreeting() {
        const greetingEl = document.getElementById('greetingText');
        if (!greetingEl) return;

        const hour = new Date().getHours();
        let userName = this.state.currentUser ? this.state.currentUser.name : 'BẠN';
        userName = userName.split(' ')[0].toUpperCase(); 
        
        let safeName = `<span class="notranslate">${userName}</span>`;
        let greetingMsg = "KHÁM PHÁ Ý TƯỞNG ✨";
        
        if (hour >= 5 && hour < 11) greetingMsg = `CHÀO BUỔI SÁNG,&nbsp;${safeName}&nbsp; CÙNG TÌM Ý TƯỞNG NHÉ ☕`;
        else if (hour >= 11 && hour < 14) greetingMsg = `TRƯA RỒI,&nbsp;${safeName}&nbsp; NGHỈ NGƠI THƯ GIÃN NHÉ 🌤️`;
        else if (hour >= 14 && hour < 18) greetingMsg = `CHÀO BUỔI CHIỀU,&nbsp;${safeName}&nbsp; TIẾP TỤC SÁNG TẠO NÀO 🎨`;
        else if (hour >= 18 && hour < 22) greetingMsg = `CHÀO BUỔI TỐI,&nbsp;${safeName}&nbsp; THƯ GIÃN VÀ TẬN HƯỞNG NHÉ 🥂`;
        else greetingMsg = `ĐÃ KHUYA RỒI,&nbsp;${safeName}&nbsp; CHÚC BẠN MỘT ĐÊM YÊN TĨNH 🌙`;
        
        greetingEl.innerHTML = greetingMsg;
    },

    getUserFromEmail(email) {
        if (!this.state.allUsers) return null;
        return this.state.allUsers.find(u => u.email === email) || null;
    },

    renderGallery(reset = false) {
        if (!this.galleryGrid) return;
        if (!this.state.currentUser) return; 

        if (reset) {
            this.galleryGrid.innerHTML = '';
            this.state.page = 1;
            this.state.hasMore = true;
        }

        if (!this.state.hasMore || this.state.isLoadingMore) return;
        this.state.isLoadingMore = true;

        const filtered = this.state.images.filter(img => {
            const matchTag = this.state.currentTag === 'All' || img.category === this.state.currentTag;
            const matchSearch = img.title.toLowerCase().includes(this.state.searchQuery.toLowerCase());
            return matchTag && matchSearch;
        });

        const start = (this.state.page - 1) * this.state.limit;
        const end = start + this.state.limit;
        const paginatedItems = filtered.slice(start, end);

        if (start >= filtered.length && !reset) {
            this.state.hasMore = false;
            this.state.isLoadingMore = false;
            return;
        }

        const skeletonIds = [];
        const loadCount = paginatedItems.length > 0 ? paginatedItems.length : 15;
        
        if (paginatedItems.length > 0) {
            for(let i=0; i < loadCount; i++) {
                const sid = 'skel_' + Date.now() + i;
                skeletonIds.push(sid);
                const s = document.createElement('div');
                s.id = sid;
                s.className = 'skeleton-card shadow-large';
                const h = Math.floor(Math.random() * (350 - 200 + 1) + 200);
                s.style.gridRowEnd = `span ${Math.ceil((h + 16) / 26)}`;
                this.galleryGrid.appendChild(s);
            }
        }

        setTimeout(() => {
            skeletonIds.forEach(id => document.getElementById(id)?.remove());

            paginatedItems.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card shadow-large';
                
                const isSaved = (this.state.currentUser.boards || []).some(b => b.ids.includes(item.id)) || (this.state.currentUser.savedIds || []).includes(item.id);
                const authorUser = this.getUserFromEmail(item.owner);
                const authorName = authorUser ? authorUser.name : item.owner.split('@')[0];

                card.innerHTML = `
                    <img src="${item.url}" loading="lazy" style="filter: ${item.filter || 'none'};">
                    <div class="card-overlay"></div>
                    <button class="card-save-btn ${isSaved ? 'saved' : ''}" onclick="App.openBoardModal(${item.id}, event)">
                        ${isSaved ? 'Đã lưu' : 'Lưu'}
                    </button>
                    <div class="card-details">
                        <div class="fw-bold mb-1 card-title">${item.title}</div>
                        <div class="fs-sm">Tác giả: <span class="notranslate">${authorName}</span></div>
                    </div>
                `;

                card.onclick = () => this.openDetailModal(item);
                card.querySelector('img').onload = (e) => {
                    const img = e.target;
                    const width = img.getBoundingClientRect().width || 260; 
                    const height = (img.naturalHeight / img.naturalWidth) * width;
                    card.style.gridRowEnd = `span ${Math.ceil((height + 16) / 26)}`; 
                };
                this.galleryGrid.appendChild(card);
            });

            this.state.isLoadingMore = false;
            if (end >= filtered.length) this.state.hasMore = false;
        }, 800);
    },

    async saveNewIdea() {
        const submitBtn = document.getElementById('submitUploadBtn');
        if (submitBtn && submitBtn.disabled) return; 
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang đăng...'; }

        const title = document.getElementById('uploadTitle').value.trim();
        const desc = document.getElementById('uploadDesc').value.trim();
        const imgEl = document.getElementById('uploadPreviewImg');
        const activeTag = document.querySelector('#uploadCategoryTags .tag-pill.active');
        
        if (!title || imgEl.classList.contains('hidden')) {
            alert("Vui lòng tải ảnh và nhập tiêu đề!");
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
            return;
        }

        const newPost = {
            id: Date.now(), url: imgEl.src, title: title, description: desc,
            category: activeTag ? activeTag.dataset.val : 'Du lịch',
            owner: this.state.currentUser.email, likes: 0, liked_by: [], comments: []
        };

        const { error } = await supabaseClient.from('posts').insert([newPost]);

        if (error) {
            console.error("Lỗi đăng bài:", error); alert("Có lỗi xảy ra khi đăng bài!");
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
            return;
        }

        this.state.images.unshift(newPost);
        this.uploadModal.classList.add('hidden');
        this.renderGallery(true); 
        
        document.getElementById('uploadTitle').value = '';
        document.getElementById('uploadDesc').value = '';
        imgEl.src = '';
        imgEl.classList.add('hidden');
        document.getElementById('uploadPlaceholder').classList.remove('hidden');
        
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
    },
    
    openDetailModal(item) {
        this.state.activeImageId = item.id;
        this.state.replyingToId = null; 
        
        document.getElementById('detailImg').src = item.url;
        document.getElementById('detailTitle').textContent = item.title;
        
        const descEl = document.getElementById('detailDesc');
        if (descEl) {
            descEl.textContent = item.desc || '';
            descEl.style.display = item.desc ? 'block' : 'none';
        }
        
        const authorUser = this.getUserFromEmail(item.owner);
        document.getElementById('detailAuthorName').textContent = authorUser ? authorUser.name : item.owner.split('@')[0];
        this.renderAvatar(authorUser, 'detailAuthorAvatar');
        
        const isOwner = item.owner === this.state.currentUser.email;
        const moreBtn = document.getElementById('moreOptionsBtn');
        if (moreBtn) moreBtn.parentElement.classList.toggle('hidden', !isOwner);

        const isLiked = (item.likedBy || []).includes(this.state.currentUser.email);
        document.getElementById('likeBtn').innerHTML = `${isLiked ? '❤️' : '🤍'} <span id="likeCountTxt" class="fs-sm fw-bold ms-1">${item.likes || 0}</span>`;

        const isSaved = (this.state.currentUser.savedIds || []).includes(item.id);
        const saveBtn = document.getElementById('savePinBtn');
        saveBtn.textContent = isSaved ? 'Đã lưu' : 'Lưu';
        saveBtn.style.backgroundColor = isSaved ? 'var(--text-secondary)' : 'var(--accent-color)';
        
        const followBtn = document.getElementById('followBtn');
        if(followBtn) {
            if (isOwner) followBtn.classList.add('hidden'); 
            else {
                followBtn.classList.remove('hidden');
                const isFollowing = (this.state.currentUser.following || []).includes(item.owner);
                if (isFollowing) { followBtn.textContent = 'Đang theo dõi'; followBtn.className = 'btn-outline rounded-pill'; } 
                else { followBtn.textContent = 'Theo dõi'; followBtn.className = 'btn-primary rounded-pill'; }
            }
        }
        document.getElementById('mainCommentInput').value = ''; 
        document.getElementById('mainCommentInput').placeholder = "Thêm bình luận...";
        document.getElementById('aiSimilarSection')?.classList.add('hidden');

        this.renderComments(item);
        this.detailModal.classList.remove('hidden');
    },

    async deleteIdea() {
        if(confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) {
            const { error } = await supabaseClient.from('posts').delete().eq('id', this.state.activeImageId);
            if (error) { alert("Lỗi xóa bài viết!"); return; }

            this.state.images = this.state.images.filter(img => img.id !== this.state.activeImageId);
            this.renderGallery(true);
            this.detailModal.classList.add('hidden');
        }
    },

    async editIdea() {
        const img = this.state.images.find(i => i.id === this.state.activeImageId);
        if(!img) return;
        const newTitle = prompt("Nhập tiêu đề mới:", img.title);
        if(newTitle !== null && newTitle.trim() !== '') {
            img.title = newTitle;
            document.getElementById('detailTitle').textContent = newTitle;
            await supabaseClient.from('posts').update({ title: newTitle }).eq('id', img.id);
            
            this.renderGallery(true);
            if (!this.profilePage.classList.contains('hidden')) {
                this.renderProfileData('created');
                this.renderProfileData('saved'); 
            }
        }
        document.getElementById('pinOptionsDropdown').classList.add('hidden');
    },

    async toggleSave(id, btnEl, event) {
        if (event) event.stopPropagation();
        if (!this.state.currentUser) return;
        
        let savedList = this.state.currentUser.savedIds || [];
        const pos = savedList.indexOf(id);
        
        if (pos === -1) {
            savedList.push(id);
            if (btnEl) {
                btnEl.textContent = 'Đã lưu'; btnEl.classList.add('saved');
                if(btnEl.id === 'savePinBtn') btnEl.style.backgroundColor = 'var(--text-secondary)';
            }
        } else {
            savedList.splice(pos, 1);
            if (btnEl) {
                btnEl.textContent = 'Lưu'; btnEl.classList.remove('saved');
                if(btnEl.id === 'savePinBtn') btnEl.style.backgroundColor = 'var(--accent-color)';
            }
        }
        
        this.state.currentUser.savedIds = savedList;
        await supabaseClient.from('users').update({ savedIds: savedList }).eq('email', this.state.currentUser.email);
    },
    
    toggleSaveDetail() {
        this.toggleSave(this.state.activeImageId, document.getElementById('savePinBtn'));
        this.renderGallery();
        if (!this.profilePage.classList.contains('hidden')) this.renderProfileData('saved');
    },

    async toggleLikeDetail() {
        const img = this.state.images.find(i => i.id === this.state.activeImageId);
        if(!img) return;
        
        const userEmail = this.state.currentUser.email;
        const likedBy = new Set(img.likedBy || []);
        let isLiked = false;

        if (likedBy.has(userEmail)) {
            likedBy.delete(userEmail);
            img.likes = Math.max(0, (img.likes || 1) - 1);
        } else {
            likedBy.add(userEmail);
            img.likes = (img.likes || 0) + 1;
            isLiked = true;
        }
        
        img.likedBy = Array.from(likedBy);
        
        // Cập nhật lên Supabase
        await supabaseClient.from('posts').update({ likes: img.likes, liked_by: img.likedBy }).eq('id', img.id);

        document.getElementById('likeBtn').innerHTML = `${isLiked ? '❤️' : '🤍'} <span id="likeCountTxt" class="fs-sm fw-bold ms-1">${img.likes}</span>`;
        this.renderGallery(); 

        // TÍNH NĂNG MỚI: Bắn thông báo khi Thả tim (Không tự thông báo cho chính mình)
        if (isLiked && img.owner !== userEmail) {
            const authorName = this.state.currentUser.name || this.state.currentUser.email.split('@')[0];
            this.pushNotification(img.owner, `❤️ ${authorName} vừa thả tim ảnh "${img.title}" của bạn.`, img.id);
        }
    },
    renderComments(item) {
        const area = document.getElementById('commentsListArea');
        area.innerHTML = '';
        
        const comments = item.comments || [];
        if (comments.length === 0) {
            area.innerHTML = '<p class="text-muted fs-sm text-center py-3">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';
            return;
        }

        comments.forEach(c => {
            const replies = c.replies || [];
            area.innerHTML += `
                <div class="comment-block">
                    <div class="flex-align-center" style="gap: 8px;">
                        <strong class="fs-sm text-primary notranslate">${c.user}</strong>
                        <span class="fs-sm text-secondary">${c.text}</span>
                    </div>
                    <div class="flex-align-center mt-1" style="gap: 16px;">
                        <span class="fs-sm text-muted" style="font-size: 11px;">${c.time}</span>
                        <button class="btn-text fs-sm fw-bold p-0 text-primary" onclick="App.prepareReply(${c.id}, '${c.user}')">Trả lời</button>
                    </div>
                    
                    ${replies.length > 0 ? `
                        <div class="ps-3 border-start mt-2">
                            ${replies.map(r => `
                                <div class="mt-2">
                                    <div class="flex-align-center" style="gap: 8px;">
                                        <strong class="fs-sm text-primary notranslate">${r.user}</strong>
                                        <span class="fs-sm text-secondary">${r.text}</span>
                                    </div>
                                    <div class="flex-align-center mt-1">
                                        <span class="fs-sm text-muted" style="font-size: 11px;">${r.time}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });
    },

    prepareReply(commentId, userName) {
        this.state.replyingToId = commentId;
        const input = document.getElementById('mainCommentInput');
        input.value = `@${userName} `;
        input.focus();
    },

    async addComment() {
        const input = document.getElementById('mainCommentInput');
        const text = input.value.trim();
        if(!text) return;

        const img = this.state.images.find(i => i.id === this.state.activeImageId);
        if(!img) return;

        const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        const authorName = this.state.currentUser.name || this.state.currentUser.email.split('@')[0];

        let targetEmail = img.owner; 
        let notiMessage = `💬 ${authorName} vừa bình luận: "${text}" vào ảnh "${img.title}"`;

        if (this.state.replyingToId && text.startsWith('@')) {
            const parentComment = img.comments.find(c => c.id === this.state.replyingToId);
            if (parentComment) {
                if(!parentComment.replies) parentComment.replies = [];
                parentComment.replies.push({ user: authorName, text: text, time: timeStr });

                const targetUserObj = this.state.allUsers.find(u => u.name === parentComment.user || u.email.split('@')[0] === parentComment.user);
                if (targetUserObj) {
                    targetEmail = targetUserObj.email;
                    notiMessage = `↩️ ${authorName} vừa trả lời bình luận của bạn: "${text}"`;
                }
            }
            this.state.replyingToId = null; 
        } else {
            if(!img.comments) img.comments = [];
            img.comments.push({ id: Date.now(), user: authorName, text: text, time: timeStr, replies: [] });
            this.state.replyingToId = null;
        }

        const { error } = await supabaseClient.from('posts').update({ comments: img.comments }).eq('id', img.id);

        if (error) { alert("Không thể lưu bình luận, vui lòng thử lại!"); return; }
        
        this.renderComments(img);
        input.value = '';
        
        if (targetEmail !== this.state.currentUser.email) {
            this.pushNotification(targetEmail, notiMessage, img.id);
        }
    },
    
    performAISearch() {
        const currentImg = this.state.images.find(i => i.id === this.state.activeImageId);
        if (!currentImg) return;

        const aiSection = document.getElementById('aiSimilarSection');
        const aiGrid = document.getElementById('aiSimilarGrid');
        
        if (!aiSection.classList.contains('hidden')) { aiSection.classList.add('hidden'); return; }

        aiSection.classList.remove('hidden');
        aiGrid.innerHTML = '';

        const similarImages = this.state.images.filter(img => img.category === currentImg.category && img.id !== currentImg.id);

        if (similarImages.length === 0) {
            aiGrid.innerHTML = '<p class="text-muted fs-sm py-2">Không tìm thấy ý tưởng tương tự nào.</p>';
        } else {
            similarImages.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card shadow-large';
                card.style.cursor = 'zoom-in';

                const img = document.createElement('img');
                img.src = item.url;
                img.loading = 'lazy';
                
                const overlay = document.createElement('div');
                overlay.className = 'card-overlay';

                card.appendChild(img);
                card.appendChild(overlay);

                card.onclick = () => {
                    this.openDetailModal(item);
                    document.querySelector('.detail-scrollable').scrollTop = 0; 
                };
                
                img.onload = (e) => {
                    const width = img.getBoundingClientRect().width || 180; 
                    const height = (img.naturalHeight / img.naturalWidth) * width;
                    card.style.gridRowEnd = `span ${Math.ceil((height + 10) / 26)}`; 
                };

                aiGrid.appendChild(card);
            });
        }
        setTimeout(() => { aiSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    },

    switchProfileTab(tabName) {
        document.querySelectorAll('.profile-tabs .tab-item').forEach(t => t.classList.remove('active'));
        document.querySelector(`.profile-tabs .tab-item[data-tab="${tabName}"]`).classList.add('active');
        
        document.querySelectorAll('.profile-page .tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        if (tabName === 'created') this.renderProfileData('created');
        if (tabName === 'saved') this.renderProfileData('saved');

        if (tabName === 'settings') {
            document.getElementById('settingName').value = this.state.currentUser.name;
            document.getElementById('settingEmail').value = this.state.currentUser.email;
            document.getElementById('setting2FA').checked = this.state.currentUser.twoFactor || false;
            const msg = document.getElementById('settingMessage');
            if(msg) { msg.textContent = ''; msg.style.display = 'none'; }
        }
    },

    renderProfileData(type) {
        const grid = document.getElementById(type === 'created' ? 'createdGrid' : 'savedGrid');
        const emptyState = document.getElementById(type === 'created' ? 'createdEmpty' : 'savedEmpty');
        if (!grid) return;

        let filtered = [];
        if (type === 'created') {
            filtered = this.state.images.filter(img => img.owner === this.state.currentUser.email);
        } else {
            const savedIds = this.state.currentUser.savedIds || [];
            filtered = this.state.images.filter(img => savedIds.includes(img.id));
        }

        grid.innerHTML = '';
        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card shadow-large';
                card.style.cursor = 'zoom-in';

                const img = document.createElement('img');
                img.src = item.url;
                img.loading = 'lazy';
                
                const overlay = document.createElement('div');
                overlay.className = 'card-overlay';
                
                card.appendChild(img);
                card.appendChild(overlay);
                card.onclick = () => this.openDetailModal(item);
                
                img.onload = (e) => {
                    const width = img.getBoundingClientRect().width || 260; 
                    const height = (img.naturalHeight / img.naturalWidth) * width;
                    card.style.gridRowEnd = `span ${Math.ceil((height + 16) / 26)}`; 
                };

                grid.appendChild(card);
            });
        }
    },
    
    handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.compressImage(file, 200, 0.8).then(base64Data => {
                this.state.pendingAvatar = base64Data;
                document.getElementById('profileAvatar').innerHTML = `<img src="${base64Data}" style="width:100%; height:100%; object-fit:cover;">`;
            });
        }
    },

    async saveSettings() {
        const newName = document.getElementById('settingName').value.trim();
        const newEmail = document.getElementById('settingEmail').value.trim();
        const oldPass = document.getElementById('settingOldPass').value;
        const newPass = document.getElementById('settingNewPass').value;
        const msg = document.getElementById('settingMessage');

        if (!newEmail || !newName) {
            msg.textContent = "Tên và Email không được bỏ trống!";
            msg.className = "fs-sm fw-bold text-danger"; msg.style.display = 'block';
            return;
        }

        if (oldPass && oldPass !== this.state.currentUser.password) {
            msg.textContent = "Mật khẩu hiện tại không đúng!";
            msg.className = "fs-sm fw-bold text-danger"; msg.style.display = 'block';
            return;
        }

        const saveBtn = document.getElementById('saveSettingsBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Đang lưu...'; saveBtn.disabled = true;

        const updates = { name: newName, email: newEmail };
        if (newPass) updates.password = newPass;
        if (this.state.pendingAvatar) updates.avatar = this.state.pendingAvatar;

        const { error } = await supabaseClient.from('users').update(updates).eq('email', this.state.currentUser.email);

        if (error) {
            msg.textContent = "Có lỗi xảy ra, không thể lưu!";
            msg.className = "fs-sm fw-bold text-danger"; msg.style.display = 'block';
        } else {
            this.state.currentUser.name = newName;
            this.state.currentUser.email = newEmail;
            if (newPass) this.state.currentUser.password = newPass;
            if (this.state.pendingAvatar) {
                this.state.currentUser.avatar = this.state.pendingAvatar;
                this.state.pendingAvatar = null; 
            }
            localStorage.setItem('currentUser', newEmail);
            
            await this.loadData(); 
            this.updateUIWithUser();

            msg.textContent = "Lưu cài đặt thành công!";
            msg.className = "fs-sm fw-bold"; msg.style.color = "#10b981"; msg.style.display = 'block';
            document.getElementById('settingOldPass').value = '';
            document.getElementById('settingNewPass').value = '';
        }
        saveBtn.textContent = originalText; saveBtn.disabled = false;
    },

    setupGlobalAi() {
        const aiPanel = document.getElementById('aiPanel');
        const openAiBtn = document.getElementById('openAiBtn');
        const messagesPanel = document.getElementById('messagesPanel');

        if (openAiBtn) {
            openAiBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (messagesPanel) messagesPanel.classList.remove('active'); 
                if (aiPanel) { aiPanel.classList.toggle('active'); aiPanel.classList.remove('hidden'); }
            };
        }

        document.getElementById('closeAiBtn')?.addEventListener('click', () => {
            if (aiPanel) aiPanel.classList.remove('active');
        });

        window.addEventListener('click', (e) => {
            if (aiPanel && aiPanel.classList.contains('active')) {
                if (!aiPanel.contains(e.target) && openAiBtn && !openAiBtn.contains(e.target)) {
                    aiPanel.classList.remove('active');
                }
            }
        });

        document.getElementById('sendGlobalAiBtn')?.addEventListener('click', () => this.handleGlobalAiChat());
        document.getElementById('aiGlobalInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleGlobalAiChat(); });
    },

    handleGlobalAiChat() {
        const input = document.getElementById('aiGlobalInput');
        const query = input.value.trim();
        if (!query) return;

        const historyArea = document.getElementById('aiGlobalChatHistory');
        historyArea.innerHTML += `<div class="chat-bubble sent" style="align-self: flex-end; background: var(--accent-color); color: var(--text-inverse); border-radius: 20px 20px 4px 20px; padding: 10px 16px; max-width: 85%;">${query}</div>`;
        input.value = ''; historyArea.scrollTop = historyArea.scrollHeight;

        setTimeout(() => {
            const lowerQuery = query.toLowerCase();
            const contextDictionary = {
                "xanh biển": ["biển", "đại dương", "nước", "trời", "blue", "xanh", "phong cảnh", "du lịch"],
                "xanh lá": ["rừng", "cây", "thảo nguyên", "lá", "thiên nhiên", "green", "cỏ", "phong cảnh", "bò", "động vật"],
                "đỏ": ["lửa", "nóng", "mặt trời", "hoàng hôn", "red", "phong cảnh"],
                "vàng": ["nắng", "cát", "mặt trời", "yellow", "mèo", "chó", "ẩm thực", "phong cảnh"],
                "trắng": ["tuyết", "mây", "sáng", "white", "mèo", "chó", "bò", "động vật", "nội thất", "kiến trúc"],
                "đen": ["đêm", "tối", "vũ trụ", "dark", "black", "mèo", "chó", "bò", "động vật", "nội thất", "xe"],
                "động vật": ["chó", "mèo", "chim", "bò", "thú", "pet"],
                "phong cảnh": ["núi", "biển", "rừng", "thiên nhiên", "cảnh", "trời", "mây", "nắng"],
                "nội thất": ["phòng", "nhà", "giường", "bàn", "sofa", "ghế", "kiến trúc", "sang trọng"]
            };

            let expandedKeywords = [];
            for (const [key, synonyms] of Object.entries(contextDictionary)) {
                if (lowerQuery.includes(key)) {
                    expandedKeywords = expandedKeywords.concat(synonyms);
                    expandedKeywords.push(key);
                }
            }

            const stopWords = ['hãy', 'tìm', 'những', 'hình', 'ảnh', 'cho', 'tôi', 'các', 'cái', 'về', 'có', 'màu', 'ngữ', 'cảnh', 'nào'];
            let originalKeywords = lowerQuery.split(' ').filter(word => !stopWords.includes(word) && word.trim().length > 0);
            const searchKeywords = [...new Set([...originalKeywords, ...expandedKeywords])];

            let results = this.state.images.filter(img => {
                const textData = (img.title + " " + (img.desc || "") + " " + img.category).toLowerCase();
                const exactMatchStr = lowerQuery.replace('tìm ảnh', '').replace('màu', '').trim();
                if (exactMatchStr.length > 1 && textData.includes(exactMatchStr)) { img.tempScore = 100; return true; }
                
                let matchScore = 0;
                searchKeywords.forEach(k => {
                    if (k && textData.includes(k)) matchScore += 1;
                    if (k && img.category.toLowerCase().includes(k)) matchScore += 2;
                });
                img.tempScore = matchScore; return matchScore > 0;
            });

            results.sort((a, b) => b.tempScore - a.tempScore);

            let aiResponseHtml = '';
            if (results.length > 0) {
                aiResponseHtml = `Tôi tìm thấy ${results.length} kết quả liên quan đến yêu cầu của bạn:`;
                let gridHtml = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">';
                results.forEach(img => {
                    gridHtml += `
                        <div style="position: relative; border-radius: 8px; overflow: hidden; cursor: zoom-in;" onclick="App.openDetailModal(${img.id})">
                            <img src="${img.url}" style="width: 100%; height: 110px; object-fit: cover; display: block;">
                            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.05);"></div>
                        </div>
                    `;
                });
                gridHtml += '</div>'; aiResponseHtml += gridHtml;
                if (results.length > 4) aiResponseHtml += `<p class="fs-sm text-muted mt-2 mb-0" style="font-style: italic;">*Còn nhiều kết quả khác ở ngoài trang chủ.</p>`;
            } else {
                aiResponseHtml = `Xin lỗi bạn, tôi đã quét nhưng không tìm thấy ảnh nào liên quan đến từ khóa/màu sắc này.`;
            }

            historyArea.innerHTML += `
                <div class="chat-bubble received shadow-large" style="align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 20px 20px 20px 4px; padding: 12px 16px; max-width: 90%;">
                    ${aiResponseHtml}
                </div>
            `;
            historyArea.scrollTop = historyArea.scrollHeight;
        }, 800); 
    },

    setupInfiniteScroll() {
        if (!this.mainWorkspace) return;
        this.mainWorkspace.addEventListener('scroll', () => {
            if (!this.profilePage.classList.contains('hidden') || !this.detailModal.classList.contains('hidden')) return;
            if (this.mainWorkspace.scrollTop + this.mainWorkspace.clientHeight >= this.mainWorkspace.scrollHeight - 100) {
                if (this.state.hasMore && !this.state.isLoadingMore) {
                    this.state.page++; this.renderGallery(false);
                }
            }
        });
    },

async pushNotification(targetEmail, message, imageId = null) {
        try {
            // TUYỆT CHIÊU GIỮ THÔNG BÁO CŨ: Lấy danh sách mới nhất từ Supabase về trước
            const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
            let currentNotis = data && data.notifications ? data.notifications : [];

            // Nhét thông báo mới lên trên cùng
            currentNotis.unshift({ 
                id: Date.now(), text: message, read: false, 
                time: new Date().toLocaleString(), imageId: imageId 
            });
            
            // Cập nhật UI nếu đang gửi cho chính mình
            if (this.state.currentUser && targetEmail === this.state.currentUser.email) {
                this.state.currentUser.notifications = currentNotis;
                this.updateNotiBadge();
            }
            
            // Bắn danh sách đã gộp lên lại Supabase
            await supabaseClient.from('users').update({ notifications: currentNotis }).eq('email', targetEmail);
        } catch (error) {
            console.error("Lỗi đẩy thông báo:", error);
        }
    },
    
    updateNotiBadge() {
        if(!this.state.currentUser) return;
        const unread = (this.state.currentUser.notifications || []).filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        if(badge) {
            if(unread > 0) {
                badge.textContent = unread > 9 ? '9+' : unread; 
                badge.classList.remove('hidden'); 
                badge.style.display = 'flex'; // Ép bằng CSS cứng cho hiện
            } else {
                badge.classList.add('hidden'); 
                badge.style.display = 'none'; // Ép bằng CSS cứng cho ẩn hoàn toàn
            }
        }
    },
    
    renderNotifications() {
        const listEl = document.getElementById('notificationsList');
        if(!listEl) return;
        
        const notis = this.state.currentUser.notifications || [];
        listEl.innerHTML = '';
        
        if(notis.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Chưa có thông báo nào.</div>';
            return;
        }
        
        notis.forEach(n => {
            let iconHtml = '🔔';
            if(n.text.includes('thả tim')) iconHtml = '❤️';
            else if(n.text.includes('bình luận') || n.text.includes('nhắn tin')) iconHtml = '💬';
            else if(n.text.includes('đăng')) iconHtml = '🎉';

            const item = document.createElement('div');
            item.className = `noti-item ${n.read ? 'read' : 'unread'}`;
            
            if (n.imageId) {
                item.style.cursor = 'pointer';
                item.onclick = () => {
                    const targetImg = this.state.images.find(img => img.id === n.imageId);
                    if (targetImg) {
                        document.getElementById('notificationsModal').classList.add('hidden'); 
                        this.openDetailModal(targetImg); 
                    } else alert("Ảnh này đã bị xóa hoặc không còn tồn tại!");
                };
            }

            item.innerHTML = `
                <div class="noti-icon">${iconHtml}</div>
                <div style="flex:1">
                    <div class="noti-text" style="font-weight: 500; font-size: 14px; margin-bottom: 4px;">${n.text}</div>
                    <div style="font-size: 11px; color: #888;">${n.time}</div>
                </div>
            `;
            listEl.appendChild(item);
        });
    },
            
async markNotificationsAsRead() {
        if (!this.state.currentUser) return;
        const notis = this.state.currentUser.notifications || [];
        let hasUnread = false;

        // Quét và chuyển tất cả thành Đã đọc
        notis.forEach(n => { 
            if (!n.read) { 
                n.read = true; 
                hasUnread = true; 
            } 
        });

        if (hasUnread) {
            this.state.currentUser.notifications = notis;
            this.updateNotiBadge(); // CỤC ĐỎ SẼ BIẾN MẤT TỨC THÌ TẠI DÒNG NÀY
            
            // Vẽ lại danh sách để bỏ in đậm các dòng chưa đọc
            this.renderNotifications(); 

            // Âm thầm lưu trạng thái đã đọc lên Supabase
            await supabaseClient.from('users').update({ notifications: notis }).eq('email', this.state.currentUser.email);
        }
    },
    
    openBoardModal(imgId, event = null) {
        if(event) event.stopPropagation();
        this.state.imageToSaveId = imgId;
        this.renderBoardList();
        document.getElementById('boardModal').classList.remove('hidden');
    },

    renderBoardList() {
        const list = document.getElementById('boardList');
        list.innerHTML = '';
        this.state.currentUser.boards.forEach(board => {
            const hasImg = board.ids.includes(this.state.imageToSaveId);
            const row = document.createElement('div');
            row.className = 'flex-align-center bg-hover rounded-pill px-3 py-2';
            row.style.justifyContent = 'space-between';
            row.innerHTML = `
                <strong class="text-primary">${board.name}</strong>
                <button class="btn-primary" style="padding: 6px 12px; background: ${hasImg ? 'var(--text-secondary)' : 'var(--accent-color)'}">
                    ${hasImg ? 'Bỏ lưu' : 'Lưu'}
                </button>
            `;
            row.querySelector('button').onclick = () => this.toggleImageInBoard(board.id);
            list.appendChild(row);
        });
    },

    async toggleImageInBoard(boardId) {
        if (!this.state.currentUser) return;
        const b = this.state.currentUser.boards.find(x => x.id === boardId);
        if (!b) return;

        const pos = b.ids.indexOf(this.state.imageToSaveId);
        if (pos > -1) b.ids.splice(pos, 1); else b.ids.push(this.state.imageToSaveId);

        this.renderBoardList();
        await supabaseClient.from('users').update({ boards: this.state.currentUser.boards }).eq('email', this.state.currentUser.email);
    },

    async createNewBoard() {
        const nameInput = document.getElementById('newBoardName');
        const name = nameInput.value.trim();
        if(!name || !this.state.currentUser) return;
        
        if (!this.state.currentUser.boards) this.state.currentUser.boards = [];
        this.state.currentUser.boards.push({ id: 'b_' + Date.now(), name: name, ids: [this.state.imageToSaveId] });
        
        nameInput.value = '';
        this.renderBoardList();
        await supabaseClient.from('users').update({ boards: this.state.currentUser.boards }).eq('email', this.state.currentUser.email);
    },
    
    playSound() {
        const audio = new Audio('https://actions.google.com/sounds/v1/ui/message_notification.ogg');
        audio.play().catch(() => console.log("Trình duyệt tạm thời chặn âm báo động"));
    },

// ==========================================
    // TRÁI TIM CỦA ỨNG DỤNG - RADAR QUÉT REAL-TIME
    // ==========================================
    async pollForUpdates() {
        if (!this.state.currentUser) return;
        let shouldPlaySound = false;

        try {
            // Tải thông báo mới nhất từ Supabase
            const { data } = await supabaseClient.from('users').select('notifications').eq('email', this.state.currentUser.email).single();

            if (data && data.notifications) {
                let notis = data.notifications;
                
                // 1. TÁCH TIN NHẮN CHAT ẨN DANH VÀ THÔNG BÁO CHUÔNG
                const chatMsgs = notis.filter(n => n.type === 'chat_msg');
                const standardNotis = notis.filter(n => n.type !== 'chat_msg');

                if (chatMsgs.length > 0) {
                    shouldPlaySound = true;
                    let chats = JSON.parse(localStorage.getItem('conversationsData') || '[]');
                    
                    chatMsgs.forEach(msg => {
                        let chat = chats.find(c => c.participants.includes(this.state.currentUser.email) && c.participants.includes(msg.sender));
                        if (!chat) {
                            chat = { id: Date.now() + Math.floor(Math.random()*1000), participants: [this.state.currentUser.email, msg.sender], messages: [] };
                            chats.push(chat);
                        }
                        chat.messages.push({ sender: msg.sender, text: msg.text, time: msg.time });
                        chat.unreadFor = [this.state.currentUser.email];
                    });

                    // Cập nhật lại UI Chat
                    localStorage.setItem('conversationsData', JSON.stringify(chats));
                    this.state.conversations = chats;
                    this.updateChatBadge();

                    const msgPanel = document.getElementById('messagesPanel');
                    if (msgPanel && msgPanel.classList.contains('active')) {
                        if(typeof this.renderChatListGlobal === 'function') this.renderChatListGlobal();
                        if(typeof this.renderMessagesGlobal === 'function') this.renderMessagesGlobal();
                    }

                    // Tự dọn dẹp các "gói tin nhắn ẩn" trên Supabase sau khi đã nhận
                    await supabaseClient.from('users').update({ notifications: standardNotis }).eq('email', this.state.currentUser.email);
                }

                // 2. XỬ LÝ THÔNG BÁO CHUÔNG BÌNH THƯỜNG
                const currentUnread = (this.state.currentUser.notifications || []).filter(n => !n.read).length;
                const newUnread = standardNotis.filter(n => !n.read).length;
                
                if (newUnread > currentUnread) shouldPlaySound = true;
                
                this.state.currentUser.notifications = standardNotis;
                this.updateNotiBadge();
            }

            // ---------------------------------------------------------
            // BƯỚC MỚI: QUÉT BÌNH LUẬN & TIM CỦA ẢNH ĐANG MỞ (REAL-TIME)
            // ---------------------------------------------------------
            const detailModal = document.getElementById('detailModal');
            // CHỈ quét ảnh nếu Modal chi tiết đang được mở (Để web không bị lag)
            if (this.state.activeImageId && detailModal && !detailModal.classList.contains('hidden')) {
                const { data: latestPost } = await supabaseClient
                    .from('posts')
                    .select('comments, likes, liked_by')
                    .eq('id', this.state.activeImageId)
                    .single();

                if (latestPost) {
                    const localPost = this.state.images.find(img => img.id === this.state.activeImageId);
                    if (localPost) {
                        // Kiểm tra xem có ai đó vừa Comment/Reply không
                        const localCommentsStr = JSON.stringify(localPost.comments || []);
                        const latestCommentsStr = JSON.stringify(latestPost.comments || []);
                        
                        if (localCommentsStr !== latestCommentsStr) {
                            localPost.comments = latestPost.comments;
                            this.renderComments(localPost); // Tự động vẽ lại bình luận ngay lập tức!
                        }
                        
                        // Cập nhật luôn cả số người Thả tim (nếu có ai đó vừa nhấn thích)
                        if (localPost.likes !== latestPost.likes) {
                            localPost.likes = latestPost.likes;
                            localPost.likedBy = latestPost.liked_by;
                            const isLiked = (localPost.likedBy || []).includes(this.state.currentUser.email);
                            const likeBtn = document.getElementById('likeBtn');
                            if(likeBtn) likeBtn.innerHTML = `${isLiked ? '❤️' : '🤍'} <span id="likeCountTxt" class="fs-sm fw-bold ms-1">${localPost.likes || 0}</span>`;
                        }
                    }
                }
            }

            if (shouldPlaySound) this.playSound();
        } catch (error) { 
            console.log("Radar lỗi:", error); 
        }
    },    
    updateChatBadge() {
        if(!this.state.currentUser) return;
        const myChats = (this.state.conversations || []).filter(c => c.participants.includes(this.state.currentUser.email));
        const unreadCount = myChats.filter(c => c.unreadFor && c.unreadFor.includes(this.state.currentUser.email)).length;
        
        const badge = document.getElementById('chatBadge');
        if(badge) {
            if(unreadCount > 0) { badge.textContent = unreadCount > 9 ? '9+' : unreadCount; badge.classList.remove('hidden'); } 
            else badge.classList.add('hidden');
        }
    },
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
