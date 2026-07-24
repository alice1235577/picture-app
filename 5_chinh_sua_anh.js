Object.assign(window.App, {
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

    openImageEditor(src) {
        if(!this.state.editorImage) this.state.editorImage = new Image();
        this.state.editorImage.onload = () => {
            this.resetCanvas();
            document.getElementById('imageEditorModal').classList.remove('hidden');
        };
        this.state.editorImage.src = src;
    },

    resetCanvas() {
        const canvas = document.getElementById('imageCanvas');
        const ctx = canvas.getContext('2d');
        this.state.drawContext = ctx;
        this.state.isDrawModeActive = false; 
        this.state.isCropModeActive = false;
        
        const MAX_WIDTH = 1200;
        let width = this.state.editorImage.width;
        let height = this.state.editorImage.height;
        
        if (width > MAX_WIDTH) {
            height = (MAX_WIDTH / width) * height;
            width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(this.state.editorImage, 0, 0, width, height);
    },

    handleCanvasMouseDown(e) {
        if (this.state.isDrawModeActive) {
            this.state.isDrawing = true;
            this.state.drawContext.beginPath();
            const rect = e.target.getBoundingClientRect();
            const scaleX = e.target.width / rect.width;
            const scaleY = e.target.height / rect.height;
            this.state.lastX = (e.clientX - rect.left) * scaleX;
            this.state.lastY = (e.clientY - rect.top) * scaleY;
            return;
        }
        
        if (this.state.isCropModeActive) {
            this.state.isDraggingCrop = true;
            const rect = e.target.getBoundingClientRect();
            this.state.cropStartX = e.clientX - rect.left;
            this.state.cropStartY = e.clientY - rect.top;

            const selection = document.getElementById('cropSelection');
            selection.style.left = this.state.cropStartX + 'px';
            selection.style.top = this.state.cropStartY + 'px';
            selection.style.width = '0px';
            selection.style.height = '0px';
            selection.classList.remove('hidden');
        }
    },

    handleCanvasMouseMove(e) {
        if (this.state.isDrawModeActive && this.state.isDrawing) {
            const canvas = document.getElementById('imageCanvas');
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            const ctx = this.state.drawContext;
            const brushSizeEl = document.getElementById('brushSize');
            ctx.lineWidth = brushSizeEl ? brushSizeEl.value : 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = document.getElementById('brushColor').value;
            
            ctx.moveTo(this.state.lastX, this.state.lastY);
            ctx.lineTo(x, y);
            ctx.stroke(); 
            
            this.state.lastX = x;
            this.state.lastY = y;
            return;
        }

        if (this.state.isCropModeActive && this.state.isDraggingCrop) {
            const rect = e.target.getBoundingClientRect();
            let currentX = e.clientX - rect.left;
            let currentY = e.clientY - rect.top;

            currentX = Math.max(0, Math.min(currentX, rect.width));
            currentY = Math.max(0, Math.min(currentY, rect.height));

            const x = Math.min(this.state.cropStartX, currentX);
            const y = Math.min(this.state.cropStartY, currentY);
            const w = Math.abs(currentX - this.state.cropStartX);
            const h = Math.abs(currentY - this.state.cropStartY);

            const selection = document.getElementById('cropSelection');
            selection.style.left = x + 'px';
            selection.style.top = y + 'px';
            selection.style.width = w + 'px';
            selection.style.height = h + 'px';
        }
    },

    handleCanvasMouseUp(e) {
        if (this.state.isDrawModeActive && this.state.isDrawing) {
            this.state.isDrawing = false;
            this.state.drawContext.closePath();
            return;
        }

        if (this.state.isCropModeActive && this.state.isDraggingCrop) {
            this.state.isDraggingCrop = false;
            const selection = document.getElementById('cropSelection');
            selection.classList.add('hidden');

            const canvas = document.getElementById('imageCanvas');
            const rect = canvas.getBoundingClientRect();

            const domW = parseFloat(selection.style.width);
            const domH = parseFloat(selection.style.height);

            if (domW > 20 && domH > 20) {
                const domX = parseFloat(selection.style.left);
                const domY = parseFloat(selection.style.top);

                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                this.executeFreeCrop(domX * scaleX, domY * scaleY, domW * scaleX, domH * scaleY);
            }
            
            const freeCropBtn = document.getElementById('freeCropBtn');
            if(freeCropBtn) freeCropBtn.click(); // Tắt chế độ cắt
        }
    },

    executeFreeCrop(x, y, w, h) {
        const canvas = document.getElementById('imageCanvas');
        const ctx = canvas.getContext('2d');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCanvas.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
        
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(tempCanvas, 0, 0);
    },

    saveEditedImage() {
        const canvas = document.getElementById('imageCanvas');
        const finalDataUrl = canvas.toDataURL('image/webp', 0.5); 
        
        const img = document.getElementById('uploadPreviewImg');
        const placeholder = document.getElementById('uploadPlaceholder');
        
        if (img) {
            img.src = finalDataUrl;
            img.classList.remove('hidden');
            img.style.display = 'block'; 
        }
        if (placeholder) {
            placeholder.classList.add('hidden');
            placeholder.style.display = 'none';
        }
        
        const modal = document.getElementById('imageEditorModal');
        if (modal) modal.classList.add('hidden');
    },

    async saveNewIdea() {
        const submitBtn = document.getElementById('submitUploadBtn');
        if (submitBtn && submitBtn.disabled) return; 
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang đăng...'; }

        try {
            const titleEl = document.getElementById('uploadTitle');
            const descEl = document.getElementById('uploadDesc');
            const imgEl = document.getElementById('uploadPreviewImg');
            const activeTag = document.querySelector('#uploadCategoryTags .tag-pill.active');
            
            const title = titleEl ? titleEl.value.trim() : '';
            const desc = descEl ? descEl.value.trim() : '';
            
            let category = 'Du lịch';
            if (activeTag) {
                category = activeTag.dataset.val || activeTag.dataset.filter || activeTag.textContent.trim();
            }

            if (!title || !imgEl || imgEl.classList.contains('hidden') || !imgEl.src) {
                alert("Vui lòng chọn ảnh và nhập tiêu đề!");
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
                return;
            }

            const imageUrl = imgEl.src;
            if (imageUrl.length > 500000) { 
                alert("Ảnh quá nặng! Vui lòng chọn ảnh khác hoặc cắt nhỏ ảnh trước khi đăng.");
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
                return;
            }

            const newPost = {
                id: Date.now(), 
                url: imageUrl, 
                title: title, 
                desc: desc, 
                category: category,
                owner: this.state.currentUser.email, 
                likes: 0, 
                liked_by: [], 
                comments: []
            };

            const { error } = await supabaseClient.from('posts').insert([newPost]);

            if (error) {
                console.error("Lỗi Supabase:", error);
                alert("Lỗi lưu dữ liệu. Hãy kiểm tra lại cột 'description' trong bảng 'posts' trên Supabase!");
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
                return;
            }

            await this.loadData(); 
            
            const uploadModal = document.getElementById('uploadModal');
            if (uploadModal) uploadModal.classList.add('hidden');
            if (titleEl) titleEl.value = '';
            if (descEl) descEl.value = '';
            imgEl.src = '';
            imgEl.classList.add('hidden');
            document.getElementById('uploadPlaceholder').classList.remove('hidden');
            
        } catch (err) {
            console.error("Lỗi hệ thống:", err);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Đăng ý tưởng'; }
        }
    }
});
