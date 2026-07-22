Object.assign(window.App, {
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

            setInterval(() => this.updateGreeting(), 60000); 
            setInterval(() => this.pollForUpdates(), 3500);  
            
        } catch (error) {
            console.error("Lỗi khởi tạo App:", error);
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

    bindEvents() {
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

        const themeBtn = document.getElementById('themePaletteBtn');
        const themeDropdown = document.getElementById('themeDropdown');
        if (themeBtn && themeDropdown) {
            themeBtn.addEventListener('click', (e) => { e.stopPropagation(); themeDropdown.classList.toggle('hidden'); });
            window.addEventListener('click', (e) => { if (!themeDropdown.contains(e.target)) themeDropdown.classList.add('hidden'); });
        }
        document.getElementById('bgUploadInput')?.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        document.getElementById('removeBgBtn')?.addEventListener('click', () => this.removeCustomBackground());
        
        const handleHomeClick = () => {
            this.profilePage.classList.add('hidden');
            this.detailModal.classList.add('hidden');
            this.uploadModal.classList.add('hidden');
            document.getElementById('messagesPanel')?.classList.remove('active');
            document.getElementById('aiPanel')?.classList.remove('active');

            this.galleryGrid.classList.remove('hidden');
            document.getElementById('headerWrapper').classList.remove('hidden');

            this.state.currentTag = 'All';
            this.state.searchQuery = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';

            document.querySelectorAll('#categoryTags .tag-pill').forEach(btn => btn.classList.remove('active'));
            document.querySelector('#categoryTags .tag-pill[data-filter="All"]')?.classList.add('active');

            this.renderGallery(true);
            
            const mainWorkspace = document.getElementById('mainWorkspace');
            if (mainWorkspace) {
                mainWorkspace.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        document.getElementById('navHome')?.addEventListener('click', handleHomeClick);
        document.getElementById('sidebarLogoBtn')?.addEventListener('click', handleHomeClick);

        document.getElementById('openNotificationsBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const notiModal = document.getElementById('notificationsModal');
            if (notiModal) {
                notiModal.classList.toggle('hidden');
                if (!notiModal.classList.contains('hidden')) {
                    this.renderNotifications(); 
                    this.markNotificationsAsRead(); 
                }
            }
        });

        document.getElementById('openProfileBtn')?.addEventListener('click', () => {
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
                e.preventDefault(); 
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

        const fileInput = document.getElementById('uploadFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    window.App.compressImage(file, 1200, 0.6).then(compressedBase64 => {
                        if (typeof window.App.openImageEditor === 'function') {
                            window.App.openImageEditor(compressedBase64); 
                        } else {
                            alert("Lỗi: Không tìm thấy hệ thống xử lý ảnh!");
                        }
                        e.target.value = ''; 
                    });
                }
            });
        }        
        document.getElementById('cancelEditorBtn')?.addEventListener('click', () => document.getElementById('imageEditorModal').classList.add('hidden'));
        document.getElementById('saveEditorBtn')?.addEventListener('click', () => this.saveEditedImage());
        
        document.getElementById('resetEditorBtn')?.addEventListener('click', () => {
            this.resetCanvas();
            const cropBtn = document.getElementById('freeCropBtn');
            const drawBtn = document.getElementById('drawModeBtn');
            const palette = document.getElementById('colorPalette');
            
            if(cropBtn) { cropBtn.className = 'btn-outline notranslate'; cropBtn.textContent = '✂️ Cắt Tự Do'; }
            if(drawBtn) { drawBtn.className = 'btn-outline notranslate'; drawBtn.textContent = '🖌️ Bật Vẽ'; }
            if(palette) palette.classList.add('hidden');
            
            this.state.isCropModeActive = false;
            this.state.isDrawModeActive = false;
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
                freeCropBtn.textContent = '✂️ Đang Cắt...';
                
                this.state.isDrawModeActive = false; 
                if(drawBtn) { drawBtn.className = 'btn-outline notranslate'; drawBtn.textContent = '🖌️ Bật Vẽ'; }
                if(colorPalette) colorPalette.classList.add('hidden');
                
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
                if(colorPalette) colorPalette.classList.remove('hidden');
                
                this.state.isCropModeActive = false; 
                if(freeCropBtn) { freeCropBtn.className = 'btn-outline notranslate'; freeCropBtn.textContent = '✂️ Cắt Tự Do'; }
                
                document.getElementById('imageCanvas').style.cursor = 'crosshair';
            } else {
                drawBtn.className = 'btn-outline notranslate';
                drawBtn.textContent = '🖌️ Bật Vẽ';
                if(colorPalette) colorPalette.classList.add('hidden');
                document.getElementById('imageCanvas').style.cursor = 'default';
            }
        });

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(brushColor) brushColor.value = e.target.dataset.color;
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
        
        const messagesPanel = document.getElementById('messagesPanel');
        const chatListView = document.getElementById('chatListView');
        const inviteView = document.getElementById('inviteView');
        const chatDetailView = document.getElementById('chatDetailView');
        const openChatBtn = document.getElementById('openChatBtn');
        
        if (!this.state.conversations) this.state.conversations = JSON.parse(localStorage.getItem('conversationsData') || '[]');
        const saveConversations = () => localStorage.setItem('conversationsData', JSON.stringify(this.state.conversations));

        const renderChatList = () => {
            const listEl = document.getElementById('dynamicChatList');
            if (!listEl) return;
            listEl.innerHTML = '';
            if (!this.state.currentUser) return;
            
            const myEmail = this.state.currentUser.email;
            const myChats = this.state.conversations.filter(c => c.participants.includes(myEmail));
            
            if (myChats.length === 0) {
                listEl.innerHTML = '<p class="text-muted fs-sm py-2">Bạn chưa có tin nhắn nào. Bấm "Tin nhắn mới" để bắt đầu!</p>';
                return;
            }

            myChats.forEach(chat => {
                const otherEmail = chat.participants.find(e => e !== myEmail);
                const otherUser = this.getUserFromEmail(otherEmail) || { name: otherEmail.split('@')[0], avatar: null };
                const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : 'Bắt đầu trò chuyện...';
                const isUnread = chat.unreadFor && chat.unreadFor.includes(myEmail);
                
                const item = document.createElement('div');
                item.className = 'chat-item bg-hover flex-align-center gap-3';
                let avatarHtml = `<div class="avatar-circle bg-accent text-inverse" style="width: 44px; height: 44px;">${otherUser.name.charAt(0).toUpperCase()}</div>`;
                if (otherUser.avatar) avatarHtml = `<div class="avatar-circle" style="width: 44px; height: 44px;"><img src="${otherUser.avatar}" style="width:100%;height:100%;object-fit:cover;"></div>`;

                item.innerHTML = `
                    ${avatarHtml}
                    <div style="flex: 1; overflow: hidden;">
                        <strong class="text-primary fs-md notranslate" style="${isUnread ? 'color: var(--danger-color);' : ''}">${otherUser.name}</strong>
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
            this.state.activeChatId = chatId;
            const nameEl = document.getElementById('chatRecipientName');
            nameEl.textContent = otherUser.name;
            nameEl.classList.add('notranslate'); 

            const avatarEl = document.getElementById('chatRecipientAvatar');
            if (otherUser.avatar) {
                avatarEl.innerHTML = `<img src="${otherUser.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
                avatarEl.style.background = 'transparent';
            } else {
                avatarEl.innerHTML = otherUser.name.charAt(0).toUpperCase();
                avatarEl.style.background = 'var(--accent-color)';
            }
            
            const chat = this.state.conversations.find(c => c.id === chatId);
            if (chat && chat.unreadFor && chat.unreadFor.includes(this.state.currentUser.email)) {
                chat.unreadFor = chat.unreadFor.filter(e => e !== this.state.currentUser.email);
                saveConversations();
                this.updateChatBadge();
            }

            renderMessages();
            chatListView.classList.add('hidden');
            chatDetailView.classList.remove('hidden');
        };

        const renderMessages = () => {
            const area = document.getElementById('chatMessagesArea');
            area.innerHTML = '';
            const chat = this.state.conversations.find(c => c.id === this.state.activeChatId);
            if (!chat) return;

            chat.messages.forEach(msg => {
                const isMe = msg.sender === this.state.currentUser.email;
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;
                
                const textDiv = document.createElement('div');
                textDiv.style.wordBreak = 'break-word';
                textDiv.textContent = msg.text;
                bubble.appendChild(textDiv);

                if (msg.time) {
                    const dateObj = new Date(msg.time);
                    const timeString = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                    
                    const timeDiv = document.createElement('div');
                    timeDiv.style.fontSize = '10.5px';
                    timeDiv.style.opacity = '0.6';
                    timeDiv.style.marginTop = '6px';
                    timeDiv.style.textAlign = isMe ? 'right' : 'left'; 
                    timeDiv.textContent = timeString;
                    
                    bubble.appendChild(timeDiv);
                }

                area.appendChild(bubble);
            });
            area.scrollTop = area.scrollHeight; 
        };
        this.renderMessagesGlobal = renderMessages;

        document.getElementById('backFromNewMessageBtn')?.addEventListener('click', () => {
            const newMessageView = document.getElementById('newMessageView');
            if(newMessageView) newMessageView.classList.add('hidden');
            document.getElementById('chatListView').classList.remove('hidden');
        });

        let selectedUserForChat = null;
        const renderSuggestedUsers = (searchQuery = '') => {
            const listEl = document.getElementById('suggestedUsersList');
            if (!listEl) return;
            listEl.innerHTML = '';
            
            const users = this.state.allUsers || [];
            const myEmail = this.state.currentUser.email;            
            
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
                        <strong class="text-primary fs-md d-block notranslate">${user.name}</strong>
                        <span class="text-muted fs-sm notranslate">@${user.email.split('@')[0]}</span>
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
            
            let chat = this.state.conversations.find(c => c.participants.includes(this.state.currentUser.email) && c.participants.includes(selectedUserForChat.email));
            if (!chat) {
                chat = { id: Date.now(), participants: [this.state.currentUser.email, selectedUserForChat.email], messages: [] };
                this.state.conversations.push(chat);
                saveConversations();
            }
            if(typeof renderChatList === 'function') renderChatList();
            const newMessageView = document.getElementById('newMessageView');
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

        const sendMessage = async () => {
            const input = document.getElementById('chatMessageInput');
            const text = input.value.trim();
            if (!text || !this.state.activeChatId) return;

            let chats = JSON.parse(localStorage.getItem('conversationsData') || '[]');
            const chatIdx = chats.findIndex(c => c.id === this.state.activeChatId);
            
            if (chatIdx > -1) {
                const myEmail = this.state.currentUser.email;
                const targetEmail = chats[chatIdx].participants.find(p => p !== myEmail);

                chats[chatIdx].messages.push({ sender: myEmail, text: text, time: Date.now() });
                localStorage.setItem('conversationsData', JSON.stringify(chats));
                this.state.conversations = chats; 
                
                if (typeof renderMessages === 'function') renderMessages();
                if (typeof renderChatList === 'function') renderChatList();
                
                input.value = ''; 

                if (targetEmail) {
                    const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
                    let currentNotis = data ? (data.notifications || []) : [];
                    
                    currentNotis.push({
                        id: Date.now(), type: 'chat_msg', sender: myEmail, text: text, read: false, time: Date.now()
                    });

                    await supabaseClient.from('users').update({ notifications: currentNotis }).eq('email', targetEmail);
                }
            }
        };
        
        document.getElementById('sendChatMessageBtn')?.addEventListener('click', sendMessage);
        document.getElementById('chatMessageInput')?.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } 
        });
        
        if (openChatBtn) {
            openChatBtn.onclick = (e) => {
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
        document.getElementById('backFromChatDetailBtn')?.addEventListener('click', () => { chatDetailView.classList.add('hidden'); chatListView.classList.remove('hidden'); this.state.activeChatId = null; });

        document.getElementById('copyProfileLinkBtn')?.addEventListener('click', () => {
            if (!this.state.currentUser) return;
            const profileLink = `${window.location.origin}/profile?user=${encodeURIComponent(this.state.currentUser.email)}`;
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

        document.getElementById('likeBtn')?.addEventListener('click', () => this.toggleLikeDetail());
        document.getElementById('savePinBtn')?.addEventListener('click', () => this.toggleSaveDetail());
        
        document.getElementById('sendCommentBtn')?.addEventListener('click', () => this.addComment());
        document.getElementById('mainCommentInput')?.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') { e.preventDefault(); this.addComment(); } 
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
    }
});

// KÍCH HOẠT TOÀN BỘ ỨNG DỤNG SAU KHI LOAD XONG GIAO DIỆN
document.addEventListener('DOMContentLoaded', () => window.App.init());