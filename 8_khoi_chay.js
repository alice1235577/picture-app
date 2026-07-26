// MỞ MODAL CHI TIẾT KHI CLICK VÀO BẢNG
                boardDiv.onclick = () => {
                    const detailModal = document.getElementById('boardDetailModal');
                    document.getElementById('boardDetailTitle').textContent = boardName;
                    
                    const grid = document.getElementById('boardDetailGrid');
                    const emptyState = document.getElementById('boardDetailEmpty');
                    
                    // --- ĐÃ FIX: CHỐNG LỖI CHỒNG ẢNH BẰNG CSS GRID CHUẨN ---
                    grid.classList.remove('masonry-grid'); 
                    grid.style.display = 'grid';
                    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
                    grid.style.gap = '16px';
                    grid.style.alignItems = 'start';
                    // -------------------------------------------------------
                    
                    grid.innerHTML = '';
                    const images = getBoardContents()[boardName] || [];
                    
                    if (images.length === 0) {
                        emptyState.classList.remove('hidden');
                    } else {
                        emptyState.classList.add('hidden');
                        images.forEach(imgSrc => {
                            const itemWrapper = document.createElement('div');
                            itemWrapper.style.position = 'relative';
                            itemWrapper.style.borderRadius = '16px';
                            itemWrapper.style.overflow = 'hidden';
                            itemWrapper.style.backgroundColor = 'var(--bg-hover)';
                            itemWrapper.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            itemWrapper.style.cursor = 'zoom-in';
                            itemWrapper.style.width = '100%'; // Ép chiều rộng lấp đầy ô lưới
                            
                            const imgEl = document.createElement('img');
                            imgEl.src = imgSrc;
                            imgEl.style.width = '100%';
                            imgEl.style.height = '240px'; 
                            imgEl.style.objectFit = 'cover';
                            imgEl.style.display = 'block';
                            
                            // Nút Xóa (✕)
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
                            
                            deleteBtn.onclick = (e) => {
                                e.stopPropagation();
                                if(confirm(`Xóa ảnh này khỏi bảng?`)) {
                                    const contents = getBoardContents();
                                    contents[boardName] = contents[boardName].filter(src => src !== imgSrc);
                                    saveBoardContents(contents);
                                    renderProfileBoards();
                                    boardDiv.click();
                                }
                            };
                            
                            imgEl.onclick = () => {
                                document.getElementById('detailImg').src = imgSrc;
                                document.getElementById('detailModal').classList.remove('hidden');
                                document.getElementById('boardDetailModal').classList.add('hidden');
                            };
                            
                            itemWrapper.appendChild(imgEl);
                            itemWrapper.appendChild(deleteBtn);
                            grid.appendChild(itemWrapper);
                        });
                    }
                    detailModal.classList.remove('hidden');
                };
