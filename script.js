// --- LÕI XỬ LÝ BACKGROUND ---
    handleBackgroundUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.compressImage(file, 1920, 0.6).then(base64Data => {
            if (!this.state.currentUser) return;
            const userEmail = this.state.currentUser.email;

            // FIX: Lưu trực tiếp ảnh nền vào bộ nhớ trình duyệt, gắn với tên Email
            localStorage.setItem(`bg_${userEmail}`, base64Data);
            this.state.currentUser.customBackground = base64Data; // Cập nhật state tạm

            this.applyCustomBackground();
            
            const dropdown = document.getElementById('themeDropdown');
            if (dropdown) dropdown.classList.add('hidden');
        });
    },

    applyCustomBackground() {
        if (!this.state.currentUser) return;
        const userEmail = this.state.currentUser.email;
        
        // FIX: Ưu tiên lấy ảnh nền từ bộ nhớ theo Email
        const bgData = localStorage.getItem(`bg_${userEmail}`) || this.state.currentUser.customBackground;
        let bgEl = document.getElementById('customBackground');
        
        if (!bgEl) {
            bgEl = document.createElement('div');
            bgEl.id = 'customBackground';
            bgEl.className = 'custom-bg hidden';
            document.body.prepend(bgEl); // Nhét vào sau thẻ body
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

        // FIX: Xóa ảnh nền của đúng email đó khỏi bộ nhớ
        localStorage.removeItem(`bg_${userEmail}`);
        this.state.currentUser.customBackground = null;
            
        const input = document.getElementById('bgUploadInput');
        if(input) input.value = '';
        this.applyCustomBackground();
        
        const dropdown = document.getElementById('themeDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },
