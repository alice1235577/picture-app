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
            // Gọi hàm render từ method chuẩn để đồng bộ dữ liệu
            this.renderProfileBoards();
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

                if (container.id === 'uploadCategoryTags' && target.dataset.val === 'Khác') {
                    const customCat = prompt("Vui lòng nhập tên thể loại mới:");
                    if (customCat && customCat.trim() !== '') {
                        const newCat = customCat.trim();
                        
                        const newBtn = document.createElement('button');
                        newBtn.className = 'tag-pill active solid-tag';
                        newBtn.dataset.val = newCat;
                        newBtn.textContent = newCat;
                        
                        container.querySelectorAll('.tag-pill').forEach(b => {
                            b.classList.remove('active', 'solid-tag');
                            b.classList.add('outline-tag');
                        });
                        
                        newBtn.addEventListener('click', (ev) => {
                            container.querySelectorAll('.tag-pill').forEach(b => {
                                b.classList.remove('active', 'solid-tag');
                                b.classList.add('outline-tag');
                            });
                            ev.currentTarget.classList.remove('outline-tag');
                            ev.currentTarget.classList.add('active', 'solid-tag');
                        });

                        container.insertBefore(newBtn, target);
                        
                        const homeTags = document.getElementById('categoryTags');
                        if (homeTags && !homeTags.querySelector(`[data-filter="${newCat}"]`)) {
                            const newHomeBtn = document.createElement('button');
                            newHomeBtn.className = 'tag-pill';
                            newHomeBtn.setAttribute('data-filter', newCat);
                            newHomeBtn.textContent = newCat;
                            newHomeBtn.addEventListener('click', (ev) => {
                                homeTags.querySelectorAll('.tag-pill').forEach(b => b.classList.remove('active'));
                                ev.currentTarget.classList.add('active');
                                this.state.currentTag = newCat;
                                this.renderGallery(true);
                            });
                            homeTags.appendChild(newHomeBtn);
                        }
                    }
                    return; 
                }

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

        const getMsgKey = (m) => m.msgId || m.id || (m.time + '_' + m.text);

        const handleDeleteMessage = async (chatId, msgKey, targetEmail) => {
            if(!confirm("Thu hồi tin nhắn này ở cả hai bên?")) return;
            
            let chats = JSON.parse(localStorage.getItem('conversationsData') || '[]');
            const chatIdx = chats.findIndex(c => c.id === chatId);
            if(chatIdx > -1) {
                chats[chatIdx].messages = chats[chatIdx].messages.filter(m => getMsgKey(m) !== msgKey);
                localStorage.setItem('conversationsData', JSON.stringify(chats));
                this.state.conversations = chats;
                
                if (typeof renderMessages === 'function') renderMessages();
                if (typeof renderChatList === 'function') renderChatList();
                
                if (targetEmail) {
                    const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
                    let currentNotis = data ? (data.notifications || []) : [];
                    currentNotis.push({ id: Date.now(), type: 'chat_msg', action: 'delete', msgId: msgKey, sender: this.state.currentUser.email, read: false });
                    await supabaseClient.from('users').update({ notifications: currentNotis }).eq('email', targetEmail);
                }
            }
        };

        const handleReactMessage = async (chatId, msgKey, targetEmail, reaction) => {
            let chats = JSON.parse(localStorage.getItem('conversationsData') || '[]');
            const chatIdx = chats.findIndex(c => c.id === chatId);
            if(chatIdx > -1) {
                let msg = chats[chatIdx].messages.find(m => getMsgKey(m) === msgKey);
                if(msg) {
                    msg.reaction = msg.reaction === reaction ? null : reaction; 
                    localStorage.setItem('conversationsData', JSON.stringify(chats));
                    this.state.conversations = chats;
                    if (typeof renderMessages === 'function') renderMessages();
                    
                    if (targetEmail) {
                        const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
                        let currentNotis = data ? (data.notifications || []) : [];
                        currentNotis.push({ id: Date.now(), type: 'chat_msg', action: 'react', msgId: msgKey, reaction: msg.reaction, sender: this.state.currentUser.email, read: false });
                        await supabaseClient.from('users').update({ notifications: currentNotis }).eq('email', targetEmail);
                    }
                }
            }
        };

        const renderMessages = () => {
            const area = document.getElementById('chatMessagesArea');
            area.innerHTML = '';
            const chat = this.state.conversations.find(c => c.id === this.state.activeChatId);
            if (!chat) return;
            
            const myEmail = this.state.currentUser.email;
            const targetEmail = chat.participants.find(p => p !== myEmail);

            chat.messages.forEach(msg => {
                const isMe = msg.sender === myEmail;
                const msgKey = getMsgKey(msg); 
                
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = isMe ? 'row-reverse' : 'row';
                wrapper.style.alignItems = 'center';
                wrapper.style.gap = '8px';
                wrapper.style.marginBottom = '16px'; 
                
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;
                bubble.style.position = 'relative';
                
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
                
                if (msg.reaction) {
                    const reactionBadge = document.createElement('div');
                    reactionBadge.textContent = msg.reaction;
                    reactionBadge.style.position = 'absolute';
                    reactionBadge.style.bottom = '-12px';
                    reactionBadge.style.right = isMe ? '12px' : 'auto';
                    reactionBadge.style.left = isMe ? 'auto' : '12px';
                    reactionBadge.style.background = 'var(--bg-surface)';
                    reactionBadge.style.border = '1px solid var(--border-color)';
                    reactionBadge.style.borderRadius = '20px';
                    reactionBadge.style.padding = '2px 6px';
                    reactionBadge.style.fontSize = '12px';
                    reactionBadge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    reactionBadge.style.zIndex = '2';
                    bubble.appendChild(reactionBadge);
                }
                
                const toolbar = document.createElement('div');
                toolbar.style.display = 'flex';
                toolbar.style.gap = '4px';
                toolbar.style.opacity = '0'; 
                toolbar.style.transition = 'opacity 0.2s';
                
                const reactContainer = document.createElement('div');
                reactContainer.style.position = 'relative';
                
                const reactBtn = document.createElement('button');
                reactBtn.innerHTML = '😀'; 
                reactBtn.className = 'icon-btn shadow-sm bg-surface';
                reactBtn.style.width = '28px';
                reactBtn.style.height = '28px';
                reactBtn.style.fontSize = '12px';
                reactBtn.title = "Thả cảm xúc";
                
                const picker = document.createElement('div');
                picker.className = 'shadow-large bg-surface border-standard';
                picker.style.position = 'absolute';
                picker.style.bottom = '100%';
                picker.style.right = isMe ? '0' : 'auto';
                picker.style.left = isMe ? 'auto' : '0';
                picker.style.display = 'none'; 
                picker.style.gap = '4px';
                picker.style.padding = '4px 8px';
                picker.style.borderRadius = '20px';
                picker.style.zIndex = '10';
                picker.style.marginBottom = '4px';
                picker.style.whiteSpace = 'nowrap';
                
                const emojis = ['❤️', '😆', '😯', '😢', '😡', '👍'];
                emojis.forEach(emoji => {
                    const eBtn = document.createElement('button');
                    eBtn.innerHTML = emoji;
                    eBtn.style.background = 'none';
                    eBtn.style.border = 'none';
                    eBtn.style.fontSize = '16px';
                    eBtn.style.cursor = 'pointer';
                    eBtn.style.transition = 'transform 0.2s';
                    eBtn.onmouseenter = () => eBtn.style.transform = 'scale(1.2)';
                    eBtn.onmouseleave = () => eBtn.style.transform = 'scale(1)';
                    
                    eBtn.onclick = (e) => {
                        e.stopPropagation();
                        handleReactMessage(chat.id, msgKey, targetEmail, emoji);
                        picker.style.display = 'none';
                    };
                    picker.appendChild(eBtn);
                });
                
                reactBtn.onclick = (e) => {
                    e.stopPropagation();
                    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
                };

                reactContainer.appendChild(reactBtn);
                reactContainer.appendChild(picker);
                toolbar.appendChild(reactContainer);

                if (isMe) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.className = 'icon-btn shadow-sm bg-surface text-danger';
                    deleteBtn.style.width = '28px';
                    deleteBtn.style.height = '28px';
                    deleteBtn.style.fontSize = '12px';
                    deleteBtn.title = "Thu hồi tin nhắn";
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        handleDeleteMessage(chat.id, msgKey, targetEmail);
                    };
                    toolbar.appendChild(deleteBtn);
                }

                wrapper.onmouseenter = () => toolbar.style.opacity = '1';
                wrapper.onmouseleave = () => {
                    toolbar.style.opacity = '0';
                    picker.style.display = 'none'; 
                };

                wrapper.appendChild(bubble);
                wrapper.appendChild(toolbar);
                area.appendChild(wrapper);
            });
            area.scrollTop = area.scrollHeight; 
        };
        this.renderMessagesGlobal = renderMessages;

        document.getElementById('backFromNewMessageBtn')?.addEventListener('click', () => {
            const newMessageView = document.getElementById('newMessageView');
            if(newMessageView) newMessageView.classList.add('hidden');
            document.getElementById('chatListView').classList.remove('hidden');
        });
        
        document.getElementById('newMessageBtn')?.addEventListener('click', () => {
            const chatListView = document.getElementById('chatListView');
            if (chatListView) {
                chatListView.classList.add('hidden');
            }
            
            const newMessageView = document.getElementById('newMessageView');
            if (newMessageView) {
                newMessageView.classList.remove('hidden');
            }
            
            const searchInput = document.getElementById('searchUserInput');
            if (searchInput) {
                searchInput.focus();
            }
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

                const msgId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);

                chats[chatIdx].messages.push({ msgId: msgId, sender: myEmail, text: text, time: Date.now(), reaction: null });
                localStorage.setItem('conversationsData', JSON.stringify(chats));
                this.state.conversations = chats; 
                
                if (typeof renderMessages === 'function') renderMessages();
                if (typeof renderChatList === 'function') renderChatList();
                
                input.value = ''; 

                if (targetEmail) {
                    const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
                    let currentNotis = data ? (data.notifications || []) : [];
                    
                    currentNotis.push({
                        id: Date.now(), type: 'chat_msg', action: 'send', msgId: msgId, sender: myEmail, text: text, read: false, time: Date.now()
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

        // --- SỰ KIỆN CHO CÁC MODAL BẢNG ---
        document.getElementById('closeBoardDetailBtn')?.addEventListener('click', () => {
            document.getElementById('boardDetailModal').classList.add('hidden');
        });
        
        document.getElementById('closeBoardDetailModalBtn')?.addEventListener('click', () => {
            document.getElementById('boardDetailModal').classList.add('hidden');
        });
        
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('boardDetailModal');
            if (e.target === modal) modal.classList.add('hidden');
        });

        document.getElementById('closeBoardModalBtn')?.addEventListener('click', () => {
            document.getElementById('boardModal').classList.add('hidden');
        });

        document.getElementById('createNewBoardBtn')?.addEventListener('click', () => {
            if (typeof this.createNewBoard === 'function') this.createNewBoard();
        });

        document.getElementById('newBoardName')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof this.createNewBoard === 'function') this.createNewBoard();
            }
        });
        
        // --- LOGIC CHO MODAL DANH SÁCH THEO DÕI ---
        const openFollowStatsBtn = document.getElementById('openFollowStatsBtn');
        const followStatsModal = document.getElementById('followStatsModal');
        const tabFollowers = document.getElementById('tabFollowers');
        const tabFollowing = document.getElementById('tabFollowing');
        const followStatsContent = document.getElementById('followStatsContent');

        if (openFollowStatsBtn) {
            openFollowStatsBtn.addEventListener('click', () => {
                followStatsModal.classList.remove('hidden');
                renderFollowStatsList('followers'); 
            });
        }

        document.addEventListener('click', (e) => {
            const clickedFollowStatsBtn = e.target.closest('#openFollowStatsBtn') || e.target.closest('.profile-header-card p.text-muted.mt-2');
            if (clickedFollowStatsBtn) {
                const followStatsModal = document.getElementById('followStatsModal');
                if (followStatsModal) {
                    followStatsModal.classList.remove('hidden');
                    const tabFollowers = document.getElementById('tabFollowers');
                    const tabFollowing = document.getElementById('tabFollowing');
                    if (tabFollowers && tabFollowing) {
                        tabFollowers.classList.add('active');
                        tabFollowing.classList.remove('active');
                    }
                    if (typeof renderFollowStatsList === 'function') {
                        renderFollowStatsList('followers'); 
                    }
                }
            }

            const clickedCloseBtn = e.target.closest('#closeFollowStatsBtn');
            if (clickedCloseBtn) {
                const followStatsModal = document.getElementById('followStatsModal');
                if (followStatsModal) {
                    followStatsModal.classList.add('hidden');
                }
            }
            
        });
        window.addEventListener('click', (e) => {
            if (e.target === followStatsModal) followStatsModal.classList.add('hidden');
        });

        tabFollowers?.addEventListener('click', () => {
            tabFollowers.classList.add('active');
            tabFollowing.classList.remove('active');
            renderFollowStatsList('followers');
        });

        tabFollowing?.addEventListener('click', () => {
            tabFollowing.classList.add('active');
            tabFollowers.classList.remove('active');
            renderFollowStatsList('following');
        });

        function renderFollowStatsList(type) {
            if (!followStatsContent) return;
            followStatsContent.innerHTML = '';
            
            const currentUser = window.App.state.currentUser;
            if (!currentUser) return;
            
            const listToRender = type === 'followers' ? (currentUser.followers || []) : (currentUser.following || []);
            
            if (listToRender.length === 0) {
                followStatsContent.innerHTML = `<p class="text-muted text-center mt-4 fs-sm">Chưa có ai ở đây cả.</p>`;
                return;
            }

            listToRender.forEach(email => {
                const user = (typeof window.App.getUserFromEmail === 'function') 
                    ? window.App.getUserFromEmail(email) 
                    : { name: email.split('@')[0], avatar: null, email: email };
                
                const item = document.createElement('div');
                item.className = 'chat-item flex-align-center gap-3 bg-surface shadow-sm';
                item.style.padding = '10px 12px';
                item.style.borderRadius = '12px';
                item.style.cursor = 'pointer';
                
                let avatarHtml = `<div class="avatar-circle bg-accent text-inverse" style="width: 44px; height: 44px; flex-shrink: 0;">${user.name.charAt(0).toUpperCase()}</div>`;
                if (user.avatar) {
                    avatarHtml = `<div class="avatar-circle" style="width: 44px; height: 44px; flex-shrink: 0;"><img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;"></div>`;
                }

                item.innerHTML = `
                    ${avatarHtml}
                    <div style="flex: 1; overflow: hidden;">
                        <strong class="text-primary fs-md d-block notranslate text-truncate">${user.name}</strong>
                        <span class="text-muted fs-sm notranslate text-truncate">@${user.email.split('@')[0]}</span>
                    </div>
                `;
                
                item.onclick = () => {
                    console.log("Xem trang cá nhân của:", user.email);
                };
                
                followStatsContent.appendChild(item);
            });
        }
    },

    // ĐÃ FIX: CHUYỂN HÀM RENDER PROFILE BOARD RA CHUẨN METHOD CỦA APP
renderProfileBoards() {
        const boardItemsContainer = document.getElementById('profileBoardItems');
        if (!boardItemsContainer) return;
        
        boardItemsContainer.innerHTML = '';
        
        // DÙNG DỮ LIỆU CHUẨN TỪ SUPABASE (this.state.currentUser.boards)
        const userBoards = this.state.currentUser?.boards || [];
        
        if (userBoards.length === 0) {
            boardItemsContainer.innerHTML = '<p class="text-muted fs-sm">Bạn chưa tạo bảng nào.</p>';
            return;
        }

        userBoards.forEach(board => {
            const boardImages = (board.ids || []).map(id => this.state.images.find(img => img.id === id)).filter(Boolean);
            const coverImgSrc = boardImages.length > 0 ? boardImages[0].url : 'https://placehold.co/300x300/e0e0e0/a0a0a0';

            const boardDiv = document.createElement('div');
            boardDiv.style.display = 'flex';
            boardDiv.style.flexDirection = 'column';
            boardDiv.style.gap = '8px';
            boardDiv.style.width = '160px';
            boardDiv.style.cursor = 'pointer';
            boardDiv.style.transition = 'transform 0.2s ease';
            
            boardDiv.onmouseenter = () => boardDiv.style.transform = 'scale(1.03)';
            boardDiv.onmouseleave = () => boardDiv.style.transform = 'scale(1)';
            
            boardDiv.innerHTML = `
                <div style="width: 100%; height: 160px; border-radius: 16px; overflow: hidden; background-color: var(--bg-hover); border: 1px solid var(--border-color);">
                    <img src="${coverImgSrc}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.9;" alt="Bìa bảng">
                </div>
                <strong class="text-primary notranslate" style="font-size: 15px; padding-left: 4px;">${board.name}</strong>
            `;
            
            boardDiv.onclick = () => {
                const detailModal = document.getElementById('boardDetailModal');
                document.getElementById('boardDetailTitle').textContent = board.name;
                
                const grid = document.getElementById('boardDetailGrid');
                const emptyState = document.getElementById('boardDetailEmpty');
                
                grid.classList.remove('masonry-grid'); 
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
                grid.style.gap = '16px';
                grid.style.alignItems = 'start';
                
                // --- ĐÃ FIX: HÀM RENDER LẠI LƯỚI ẢNH SAU KHI XÓA ---
                const renderGrid = () => {
                    grid.innerHTML = '';
                    const updatedBoardImages = (board.ids || []).map(id => this.state.images.find(img => img.id === id)).filter(Boolean);
                    
                    if (updatedBoardImages.length === 0) {
                        emptyState.classList.remove('hidden');
                    } else {
                        emptyState.classList.add('hidden');
                        updatedBoardImages.forEach(imgObj => {
                            const itemWrapper = document.createElement('div');
                            itemWrapper.style.position = 'relative';
                            itemWrapper.style.borderRadius = '16px';
                            itemWrapper.style.overflow = 'hidden';
                            itemWrapper.style.backgroundColor = 'var(--bg-hover)';
                            itemWrapper.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            itemWrapper.style.cursor = 'zoom-in';
                            itemWrapper.style.width = '100%'; 
                            
                            const imgEl = document.createElement('img');
                            imgEl.src = imgObj.url;
                            imgEl.style.width = '100%';
                            imgEl.style.height = '240px'; 
                            imgEl.style.objectFit = 'cover';
                            imgEl.style.display = 'block';
                            
                            const deleteBtn = document.createElement('button');
                            deleteBtn.innerHTML = '✕';
                            deleteBtn.style.position = 'absolute';
                            deleteBtn.style.top = '8px';
                            deleteBtn.style.right = '8px';
                            deleteBtn.style.background = 'rgba(239, 68, 68, 0.9)';
                            deleteBtn.style.color = 'white';
                            deleteBtn.style.border = 'none';
                            deleteBtn.style.width = '28px';
                            deleteBtn.style.height = '28px';
                            deleteBtn.style.borderRadius = '50%';
                            deleteBtn.style.cursor = 'pointer';
                            deleteBtn.style.opacity = '0';
                            deleteBtn.style.transition = 'opacity 0.2s';
                            
                            itemWrapper.onmouseenter = () => deleteBtn.style.opacity = '1';
                            itemWrapper.onmouseleave = () => deleteBtn.style.opacity = '0';
                            
                            deleteBtn.onclick = async (e) => {
                                e.stopPropagation();
                                if(confirm(`Xóa ảnh này khỏi bảng?`)) {
                                    const pos = board.ids.indexOf(imgObj.id);
                                    if (pos > -1) {
                                        board.ids.splice(pos, 1);
                                        await supabaseClient.from('users').update({ boards: this.state.currentUser.boards }).eq('email', this.state.currentUser.email);
                                        
                                        // Gọi hàm renderGrid để cập nhật ngay lập tức
                                        renderGrid();
                                        
                                        // Cập nhật lại danh sách bảng ngoài trang cá nhân (để cập nhật ảnh bìa bảng)
                                        this.renderProfileBoards();
                                    }
                                }
                            };
                            
                            imgEl.onclick = () => {
                                if (typeof this.openDetailModal === 'function') {
                                    this.openDetailModal(imgObj);
                                } else {
                                    document.getElementById('detailImg').src = imgObj.url;
                                    document.getElementById('detailModal').classList.remove('hidden');
                                }
                                document.getElementById('boardDetailModal').classList.add('hidden');
                            };
                            
                            itemWrapper.appendChild(imgEl);
                            itemWrapper.appendChild(deleteBtn);
                            grid.appendChild(itemWrapper);
                        });
                    }
                };
                
                // Gọi hàm renderGrid khi mở modal
                renderGrid();
                detailModal.classList.remove('hidden');
            };
            boardItemsContainer.appendChild(boardDiv);
        });
    }
});

// KÍCH HOẠT TOÀN BỘ ỨNG DỤNG SAU KHI LOAD XONG GIAO DIỆN
document.addEventListener('DOMContentLoaded', () => window.App.init());
