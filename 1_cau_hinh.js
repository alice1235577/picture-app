// Khởi tạo Supabase
const supabaseClient = supabase.createClient(
    'https://zjblnjxziswvmqktmyjj.supabase.co', 
    'sb_publishable_l_iTXPdQjExhFMZtElHjIA_uElx7hKq' 
);

// Khởi tạo App gốc
window.App = {
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

    saveImages() {
    },

    playSound() {
        const audio = new Audio('https://actions.google.com/sounds/v1/ui/message_notification.ogg');
        audio.play().catch(() => console.log("Trình duyệt tạm thời chặn âm báo động"));
    }
};
