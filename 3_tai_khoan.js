Object.assign(window.App, {
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
                this.loadData();
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
    }
});
