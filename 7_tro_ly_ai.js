Object.assign(window.App, {
setupGlobalAi() {
        const aiPanel = document.getElementById('aiPanel');
        const floatingAiBtn = document.getElementById('floatingAiBtn'); 
        const historyArea = document.getElementById('aiGlobalChatHistory');
        
        // --- 1. TẢI LỊCH SỬ TỪ BỘ NHỚ TRÌNH DUYỆT ---
        let aiMemory = JSON.parse(localStorage.getItem('ai_chat_memory')) || [];
        
        // Vẽ lại các tin nhắn cũ ra màn hình
        aiMemory.forEach(msg => {
            if (msg.role === 'user') {
                historyArea.innerHTML += `<div class="chat-bubble sent" style="align-self: flex-end; background: var(--accent-color); color: var(--text-inverse); border-radius: 20px 20px 4px 20px; padding: 10px 16px; max-width: 85%; margin-bottom: 12px;">${msg.content}</div>`;
            } else if (msg.role === 'assistant') {
                historyArea.innerHTML += `<div class="chat-bubble received shadow-large" style="align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 20px 20px 20px 4px; padding: 12px 16px; max-width: 90%; margin-bottom: 12px;">${msg.content.replace(/\n/g, '<br>')}</div>`;
            }
        });
        if (historyArea) historyArea.scrollTop = historyArea.scrollHeight;

        // --- HỆ THỐNG KÉO THẢ MƯỢT MÀ ---
        let isDragging = false;
        let isMouseDown = false;
        let offsetX, offsetY;

        if (floatingAiBtn) {
            const greetingBubble = document.getElementById('aiGreetingBubble'); // Khai báo lời chào

            // 1. Khi nhấn chuột xuống
            floatingAiBtn.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                isDragging = false;
                
                // 💥 ẨN LỜI CHÀO NGAY KHI TƯƠNG TÁC VỚI ROBOT
                if (greetingBubble) greetingBubble.classList.add('hidden-bubble'); 

                // Lấy vị trí click chuột so với góc của bong bóng
                const rect = floatingAiBtn.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                
                // Tắt hiệu ứng CSS tạm thời để kéo không bị giật/delay
                floatingAiBtn.style.transition = 'none';
                floatingAiBtn.style.animation = 'none';
            });

            // 2. Khi di chuyển chuột
            document.addEventListener('mousemove', (e) => {
                if (!isMouseDown) return;
                
                isDragging = true; // Đánh dấu là đang kéo
                
                let newX = e.clientX - offsetX;
                let newY = e.clientY - offsetY;

                // Xóa bỏ vị trí mặc định ở góc phải
                floatingAiBtn.style.bottom = 'auto';
                floatingAiBtn.style.right = 'auto';
                // Áp dụng tọa độ mới đi theo chuột
                floatingAiBtn.style.left = `${newX}px`;
                floatingAiBtn.style.top = `${newY}px`;
            });

            // 3. Khi thả chuột ra
            document.addEventListener('mouseup', () => {
                isMouseDown = false;
                // Bật lại hiệu ứng mượt mà khi hover
                if(floatingAiBtn) floatingAiBtn.style.transition = '0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            });

            // 4. Khi Click để mở bảng Chat
            floatingAiBtn.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                
                // 💥 ẨN LỜI CHÀO NẾU CLICK MÀ CHƯA DRAG
                if (greetingBubble) greetingBubble.classList.add('hidden-bubble');

                // Nếu đang kéo thì KHÔNG mở bảng chat
                if (isDragging) {
                    isDragging = false;
                    return; 
                }
                
                if (aiPanel) { 
                    aiPanel.classList.toggle('active'); 
                }
            });
        }

        // Nút X đóng bảng Chat
        document.getElementById('closeAiBtn')?.addEventListener('click', () => {
            if (aiPanel) aiPanel.classList.remove('active');
        });

        // Click vùng ngoài để đóng bảng Chat
        window.addEventListener('click', (e) => {
            if (aiPanel && aiPanel.classList.contains('active')) {
                if (!aiPanel.contains(e.target) && floatingAiBtn && !floatingAiBtn.contains(e.target)) {
                    aiPanel.classList.remove('active');
                }
            }
        });

        // Xử lý gửi tin nhắn AI
        document.getElementById('sendGlobalAiBtn')?.addEventListener('click', () => this.handleGlobalAiChat());
        document.getElementById('aiGlobalInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleGlobalAiChat(); });
    },
    
    async handleGlobalAiChat() {
        const input = document.getElementById('aiGlobalInput');
        const query = input.value.trim();
        if (!query) return;

        const historyArea = document.getElementById('aiGlobalChatHistory');
        
        historyArea.innerHTML += `<div class="chat-bubble sent" style="align-self: flex-end; background: var(--accent-color); color: var(--text-inverse); border-radius: 20px 20px 4px 20px; padding: 10px 16px; max-width: 85%;">${query}</div>`;
        input.value = ''; 
        historyArea.scrollTop = historyArea.scrollHeight;

        const typingId = 'typing_' + Date.now();
        historyArea.innerHTML += `
            <div id="${typingId}" class="chat-bubble received shadow-large" style="align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-muted); border-radius: 20px 20px 20px 4px; padding: 12px 16px; max-width: 90%; font-style: italic;">
                Trợ lý AI đang suy nghĩ... ⏳
            </div>
        `;
        historyArea.scrollTop = historyArea.scrollHeight;

try {
            // 1. Lấy lại bộ nhớ hiện tại
            let aiMemory = JSON.parse(localStorage.getItem('ai_chat_memory')) || [];
            
            // 2. Thêm câu hỏi mới của User vào bộ nhớ
            aiMemory.push({ "role": "user", "content": query });
            
            // Chỉ giữ lại khoảng 10 tin nhắn gần nhất để AI không bị quá tải bộ nhớ
            if (aiMemory.length > 10) aiMemory = aiMemory.slice(aiMemory.length - 10);

            // 3. Chuẩn bị dữ liệu gửi đi (Bao gồm Prompt cài đặt gốc + Lịch sử chat)
            let messagesToSend = [
                { 
                    "role": "system", 
                    "content": "Bạn là trợ lý ảo siêu thông minh. Hãy trả lời cực kỳ chính xác, ngắn gọn, thân thiện, xưng 'mình' và gọi người dùng là 'bạn'." 
                },
                ...aiMemory // Gắn toàn bộ trí nhớ vào đây
            ];

            // 4. Gọi API Groq
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer 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`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "llama-3.3-70b-versatile",
                    "messages": messagesToSend
                })
            });

            const data = await response.json();
            
            let aiTextAnswer = "Xin lỗi, hệ thống AI đang bận!";
            if (data && data.choices && data.choices[0].message) {
                aiTextAnswer = data.choices[0].message.content;
                
                // 5. Lưu câu trả lời của AI vào bộ nhớ
                aiMemory.push({ "role": "assistant", "content": aiTextAnswer });
                localStorage.setItem('ai_chat_memory', JSON.stringify(aiMemory)); // Cập nhật lại trình duyệt
            }
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

            const stopWords = ['hãy', 'tìm', 'những', 'hình', 'ảnh', 'cho', 'tôi', 'các', 'cái', 'về', 'có', 'màu', 'ngữ', 'cảnh', 'nào', 'với'];
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

            let finalHtml = `<p style="margin-bottom: 12px; line-height: 1.5;">${aiTextAnswer.replace(/\n/g, '<br>')}</p>`;
            
            if (results.length > 0) {
                finalHtml += `<div style="font-size: 13px; color: var(--accent-color); margin-bottom: 8px; font-weight: bold;">🖼️ Mình cũng tìm thấy ${results.length} ảnh liên quan trong kho nè:</div>`;
                let gridHtml = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">';
                results.forEach(img => {
                    gridHtml += `
                        <div style="position: relative; border-radius: 8px; overflow: hidden; cursor: zoom-in;" onclick="App.openDetailModal(${img.id})">
                            <img src="${img.url}" style="width: 100%; height: 110px; object-fit: cover; display: block;">
                            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.05);"></div>
                        </div>
                    `;
                });
                gridHtml += '</div>'; 
                finalHtml += gridHtml;
            }

            const typingBubble = document.getElementById(typingId);
            if (typingBubble) typingBubble.remove();
            
            historyArea.innerHTML += `
                <div class="chat-bubble received shadow-large" style="align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 20px 20px 20px 4px; padding: 12px 16px; max-width: 90%;">
                    ${finalHtml}
                </div>
            `;
            historyArea.scrollTop = historyArea.scrollHeight;

        } catch (error) {
            console.error("Lỗi AI:", error);
            const typingBubble = document.getElementById(typingId);
            if (typingBubble) {
                typingBubble.innerHTML = "Opps! Trợ lý ảo đang mất kết nối Internet. Bạn thử lại nhé!";
                typingBubble.style.color = "var(--danger-color)";
                typingBubble.style.fontStyle = "normal";
            }
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
    }
});
