Object.assign(window.App, {
    autoSmartTheme() {
        const savedTheme = localStorage.getItem('darkMode');
        const hour = new Date().getHours();
        if (savedTheme === null) {
            this.state.theme = (hour >= 19 || hour < 6) ? 'dark' : 'light';
        }
    },    

    applyTheme() {
        const isDark = this.state.theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        
        const sun = document.querySelector('.icon-sun');
        const moon = document.querySelector('.icon-moon');
        if (sun) sun.classList.toggle('hidden', isDark);
        if (moon) moon.classList.toggle('hidden', !isDark);
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

    handleScrollEffect() {
        if (this.mainWorkspace && this.headerWrapper) {
            this.mainWorkspace.addEventListener('scroll', () => {
                if (this.mainWorkspace.scrollTop > 10) this.headerWrapper.classList.add('scrolled');
                else this.headerWrapper.classList.remove('scrolled');
            });
        }
    }
});
