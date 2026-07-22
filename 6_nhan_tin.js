Object.assign(window.App, {
    async pollForUpdates() {
        if (!this.state.currentUser) return;
        let shouldPlaySound = false;

        try {
            const { data } = await supabaseClient.from('users').select('notifications').eq('email', this.state.currentUser.email).single();

            if (data && data.notifications) {
                let notis = data.notifications;
                
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

                    localStorage.setItem('conversationsData', JSON.stringify(chats));
                    this.state.conversations = chats;
                    this.updateChatBadge();

                    const msgPanel = document.getElementById('messagesPanel');
                    if (msgPanel && msgPanel.classList.contains('active')) {
                        if(typeof this.renderChatListGlobal === 'function') this.renderChatListGlobal();
                        if(typeof this.renderMessagesGlobal === 'function') this.renderMessagesGlobal();
                    }

                    await supabaseClient.from('users').update({ notifications: standardNotis }).eq('email', this.state.currentUser.email);
                }

                const currentUnread = (this.state.currentUser.notifications || []).filter(n => !n.read).length;
                const newUnread = standardNotis.filter(n => !n.read).length;
                
                if (newUnread > currentUnread) shouldPlaySound = true;
                
                this.state.currentUser.notifications = standardNotis;
                this.updateNotiBadge();
            }

            const detailModal = document.getElementById('detailModal');
            if (this.state.activeImageId && detailModal && !detailModal.classList.contains('hidden')) {
                const { data: latestPost } = await supabaseClient
                    .from('posts')
                    .select('comments, likes, liked_by')
                    .eq('id', this.state.activeImageId)
                    .single();

                if (latestPost) {
                    const localPost = this.state.images.find(img => img.id === this.state.activeImageId);
                    if (localPost) {
                        const localCommentsStr = JSON.stringify(localPost.comments || []);
                        const latestCommentsStr = JSON.stringify(latestPost.comments || []);
                        
                        if (localCommentsStr !== latestCommentsStr) {
                            localPost.comments = latestPost.comments;
                            this.renderComments(localPost); 
                        }
                        
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

            const { data: latestImage } = await supabaseClient
                .from('posts')
                .select('id')
                .order('id', { ascending: false })
                .limit(1)
                .single();

            if (latestImage) {
                const isNewer = this.state.images.length === 0 || latestImage.id > this.state.images[0].id;
                
                if (isNewer && !this.state.isLoadingMore) {
                    const { data: newPosts } = await supabaseClient.from('posts').select('*').order('id', { ascending: false });
                    if (newPosts) {
                        this.state.images = newPosts;
                        this.renderGallery(true); 
                    }
                }
            }

            if (shouldPlaySound) this.playSound();
        } catch (error) { 
            console.log("Radar lỗi:", error); 
        }
    },

    async pushNotification(targetEmail, message, imageId = null) {
        try {
            const { data } = await supabaseClient.from('users').select('notifications').eq('email', targetEmail).single();
            let currentNotis = data && data.notifications ? data.notifications : [];

            currentNotis.unshift({ 
                id: Date.now(), text: message, read: false, 
                time: new Date().toLocaleString(), imageId: imageId 
            });
            
            if (this.state.currentUser && targetEmail === this.state.currentUser.email) {
                this.state.currentUser.notifications = currentNotis;
                this.updateNotiBadge();
            }
            
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
                badge.style.display = 'flex'; 
            } else {
                badge.classList.add('hidden'); 
                badge.style.display = 'none'; 
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

        notis.forEach(n => { 
            if (!n.read) { 
                n.read = true; 
                hasUnread = true; 
            } 
        });

        if (hasUnread) {
            this.state.currentUser.notifications = notis;
            this.updateNotiBadge(); 
            this.renderNotifications(); 
            await supabaseClient.from('users').update({ notifications: notis }).eq('email', this.state.currentUser.email);
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
    }
});