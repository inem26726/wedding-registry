document.addEventListener('DOMContentLoaded', () => {
    const API_ENDPOINT = '/wedding-registry/api/gifts';
    let allGifts = []; 

    // Fetch Data
    fetch(API_ENDPOINT)
        .then(response => response.json())
        .then(res => {
            allGifts = res.data;
            setupFilters();
            renderGifts('Semua'); 
        })
        .catch(err => {
            document.getElementById('gift-grid').innerHTML = `
                <div class="col-span-full text-center py-12 text-red-400 bg-red-50 rounded-xl">
                    <i class="ri-error-warning-line text-2xl mb-2 block"></i>
                    Gagal memuat data. Coba refresh halaman.
                </div>
            `;
            console.error(err);
        });

    // Setup Filter Buttons
    function setupFilters() {
        const buttons = document.querySelectorAll('.filter-btn');
        
        // Set initial active state
        const firstBtn = buttons[0];
        if(firstBtn) {
            updateActiveButton(buttons, firstBtn);
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                updateActiveButton(buttons, btn);
                const category = btn.getAttribute('data-category');
                renderGifts(category);
            });
        });
    }

    function updateActiveButton(buttons, activeBtn) {
        buttons.forEach(b => {
            b.removeAttribute('data-active');
            b.classList.remove('font-semibold', 'bg-white', 'shadow-sm', 'text-text-dark');
            b.classList.add('text-text-muted');
        });
        
        activeBtn.setAttribute('data-active', 'true');
        activeBtn.classList.add('font-semibold', 'bg-white', 'shadow-sm', 'text-text-dark');
        activeBtn.classList.remove('text-text-muted');
    }

    // Render Function
    function renderGifts(filterCategory) {
        const grid = document.getElementById('gift-grid');
        grid.innerHTML = '';

        const filtered = filterCategory === 'Semua' 
            ? allGifts 
            : allGifts.filter(g => {
                const map = { 'Rumah': 'Home', 'Dapur': 'Kitchen', 'Elektronik': 'Electronics' };
                const target = map[filterCategory] || filterCategory; 
                return (g.category || '').toLowerCase() === target.toLowerCase();
            });
        
        if(filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-16 text-text-muted italic bg-white/50 rounded-2xl border border-dashed border-primary/30">
                    Tidak ada item di kategori ini.
                </div>
            `;
            return;
        }

        filtered.forEach(gift => {
            const price = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(gift.price);
            
            // Fallback Image
            const fallbackImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y2ZjFlYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiNiZmQ2ZTYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

            const isPurchased = !!gift.is_purchased;
            const card = document.createElement('div');
            
            // Apply opacity/grayscale if purchased
            let cardClasses = "group bg-white rounded-2xl overflow-hidden border border-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative";
            if (isPurchased) {
                cardClasses += " opacity-60 grayscale-[80%]";
            }
            card.className = cardClasses;
            
            // Create Card Content
            let buttonHtml = '';
            if (isPurchased) {
                buttonHtml = `
                    <button disabled class="mt-auto inline-flex items-center justify-center gap-2 w-full py-3 bg-gray-200 text-gray-500 cursor-not-allowed rounded-xl text-sm font-medium transition-colors">
                        <i class="ri-checkbox-circle-fill"></i> Sudah Dibeli
                    </button>
                `;
            } else {
                buttonHtml = `
                    <a href="${gift.link_url}" target="_blank" class="mt-auto inline-flex items-center justify-center gap-2 w-full py-3 bg-text-dark text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors duration-200 shadow-sm hover:shadow-md">
                        <i class="ri-gift-line"></i> Kirim Hadiah
                    </a>
                `;
            }

            const purchasedBadge = isPurchased ? 
                '<span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded-lg font-bold text-sm tracking-widest z-20 border border-white/20 shadow-xl uppercase backdrop-blur-sm">Terbeli</span>' : '';

            card.innerHTML = `
                <div class="relative pt-[100%] bg-gray-50 overflow-hidden">
                    <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide text-text-dark z-10 shadow-sm border border-black/5">
                        ${gift.category || 'General'}
                    </span>
                    
                    ${purchasedBadge}

                    <img src="${gift.image_url}" alt="${gift.name}" 
                        class="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        onerror="this.onerror=null; this.src='${fallbackImage}'">
                </div>
                <div class="p-5 flex-grow flex flex-col text-center">
                    <h3 class="font-serif text-xl font-semibold text-text-dark mb-2 leading-tight line-clamp-2 min-h-[3.5rem] flex items-center justify-center">${gift.name}</h3>
                    <div class="text-primary-dark font-sans font-bold text-lg mb-5 tracking-tight">${price}</div>
                    ${buttonHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    }
});