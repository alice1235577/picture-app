    Object.assign(window.App, {
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

    renderGallery(reset = false) {
        if (!this.galleryGrid) return;
        if (!this.state.currentUser) return; 

        if (reset) {
            this.galleryGrid.innerHTML = '';
            this.state.page = 1;
            this.state.hasMore = true;
            this.state.isLoadingMore = false; 
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

        const currentLikedBy = item.liked_by || item.likedBy || [];
        const isLiked = currentLikedBy.includes(this.state.currentUser.email);
        
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
        if (!img || !this.state.currentUser) return;

        const myEmail = this.state.currentUser.email;
        let currentLikedBy = img.liked_by || img.likedBy || [];
        if (!Array.isArray(currentLikedBy)) currentLikedBy = [];

        const isCurrentlyLiked = currentLikedBy.includes(myEmail);

        const likeBtn = document.getElementById('likeBtn');
        const likeCountTxt = document.getElementById('likeCountTxt');
        
        let newLikeStatus = !isCurrentlyLiked;
        if (newLikeStatus) {
            currentLikedBy.push(myEmail);
            img.likes = (img.likes || 0) + 1;
        } else {
            currentLikedBy = currentLikedBy.filter(email => email !== myEmail);
            img.likes = Math.max(0, (img.likes || 1) - 1);
        }

        img.liked_by = currentLikedBy;
        img.likedBy = currentLikedBy;
        
        likeBtn.innerHTML = `${newLikeStatus ? '❤️' : '🤍'} <span id="likeCountTxt" class="fs-sm fw-bold ms-1">${img.likes}</span>`;

        await supabaseClient
            .from('posts')
            .update({ 
                likes: img.likes, 
                liked_by: currentLikedBy 
            })
            .eq('id', img.id);

        if (newLikeStatus && img.owner !== myEmail) {
            const myName = this.state.currentUser.name || myEmail.split('@')[0];
            const message = `❤️ ${myName} đã thích ảnh của bạn!`;
            this.pushNotification(img.owner, message, img.id);
        }
        
        this.renderGallery(); 
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
    
    async toggleFollow() {
        const img = this.state.images.find(i => i.id === this.state.activeImageId);
        if(!img || !this.state.currentUser) return;

        const targetEmail = img.owner;
        const myEmail = this.state.currentUser.email;

        if (targetEmail === myEmail) return;

        const targetUser = this.state.allUsers.find(u => u.email === targetEmail);
        if (!targetUser) return;

        if (!this.state.currentUser.following) this.state.currentUser.following = [];
        if (!targetUser.followers) targetUser.followers = [];

        const isFollowing = this.state.currentUser.following.includes(targetEmail);
        const followBtn = document.getElementById('followBtn');

        if (isFollowing) {
            this.state.currentUser.following = this.state.currentUser.following.filter(e => e !== targetEmail);
            targetUser.followers = targetUser.followers.filter(e => e !== myEmail);
            if(followBtn) { followBtn.textContent = 'Theo dõi'; followBtn.className = 'btn-primary rounded-pill'; }
        } else {
            this.state.currentUser.following.push(targetEmail);
            targetUser.followers.push(myEmail);
            if(followBtn) { followBtn.textContent = 'Đang theo dõi'; followBtn.className = 'btn-outline rounded-pill'; }
        }

        this.updateUIWithUser();
        
        await supabaseClient.from('users').update({ following: this.state.currentUser.following }).eq('email', myEmail);
        await supabaseClient.from('users').update({ followers: targetUser.followers }).eq('email', targetEmail);

        if (!isFollowing) this.pushNotification(targetEmail, `👤 ${this.state.currentUser.name} đã bắt đầu theo dõi bạn.`);
    }
});