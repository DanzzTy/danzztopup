let allProducts = [];
        let groupedGames = {};
        let savedNotifs = []; 
        let currentActiveGame = null;
        let unreadCount = 0;

        const BLACKLIST = ['rules of survival', 'ros', 'ragnarok', 'love nikki', 'magic chess', 'point blank', 'pb', 'auto chess', 'legacy of discord'];

        const PROVIDER_MAP = {
            'free fire': 'Free Fire', 'mobile legends': 'Mobile Legends',
            'pubg mobile': 'PUBG Mobile', 'genshin impact': 'Genshin Impact',
            'honkai': 'Honkai Star Rail', 'valorant': 'Valorant', 
            'higgs domino': 'Higgs Domino', 'call of duty': 'Call of Duty Mobile'
        };

        async function init() {
            await loadUiData(); 
            await fetchProducts(); 
        }

        async function loadUiData() {
            try {
                const res = await axios.get('/api/ui-data');
                const { banners, notifs } = res.data;
                
                // --- RENDER BANNERS (SLIDE KANAN KE KIRI TANPA MUNDUR) ---
                const bannerCont = document.getElementById('bannerContainer');
                if (banners && banners.length > 0) {
                    bannerCont.innerHTML = banners.map(b => `
                        <div class="w-full flex-shrink-0 h-full bg-cover bg-center" style="background-image: url('${b.image_url}');"></div>
                    `).join('');

                    if (banners.length > 1) {
                        setInterval(() => {
                            bannerCont.style.transition = 'transform 0.5s ease-in-out';
                            bannerCont.style.transform = 'translateX(-100%)';
                            
                            setTimeout(() => {
                                bannerCont.style.transition = 'none';
                                bannerCont.appendChild(bannerCont.firstElementChild);
                                bannerCont.style.transform = 'translateX(0)';
                            }, 500); 
                        }, 5000); 
                    }
                } else {
                    bannerCont.innerHTML = `<div class="w-full flex-shrink-0 h-full flex flex-col items-center justify-center bg-gradient-to-r from-green-400 to-emerald-500 text-white p-6 text-center"><h2 class="text-3xl font-bold">RAMADHAN BIG SALE</h2></div>`;
                }

                // --- RENDER NOTIFIKASI ---
                if(notifs && notifs.length > 0) {
                    savedNotifs = notifs;
                    
                    const imgNotif = notifs.find(n => n.message.match(/\.(jpeg|jpg|gif|png)$/i) != null);
                    const textNotifs = notifs.filter(n => n !== imgNotif);

                    document.getElementById('runningText').innerHTML = textNotifs.map(n => n.message).join(' &nbsp;&bull;&nbsp; ');
                    
                    if(imgNotif) {
                        document.getElementById('imageNotifSrc').src = imgNotif.message;
                        document.getElementById('imageNotifModal').classList.remove('hidden');
                    }

                    if(textNotifs.length > 0) {
                        unreadCount = textNotifs.length;
                        const badge = document.getElementById('notifBadge');
                        badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
                        badge.classList.remove('hidden');
                        badge.classList.add('badge-pop'); 
                        
                        renderNotifPanel(textNotifs);
                    }
                }
            } catch (err) {}
        }

        function closeImageNotif() {
            document.getElementById('imageNotifModal').classList.add('hidden');
        }

        function toggleNotifPanel() {
            const panel = document.getElementById('notifPanel');
            const badge = document.getElementById('notifBadge');
            if (panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
                unreadCount = 0; badge.classList.add('hidden'); 
            } else { panel.classList.add('hidden'); }
        }

        function renderNotifPanel(texts) {
            const list = document.getElementById('notifList');
            if(texts && texts.length > 0) {
                list.innerHTML = texts.map(n => `
                    <div class="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                        <div class="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0 animate-pulse"></div>
                        <p class="text-xs text-gray-600 leading-relaxed">${n.message}</p>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs">Kosong</div>`;
            }
        }

        function clearNotifs() { 
            savedNotifs = []; 
            document.getElementById('notifList').innerHTML = `<div class="text-center py-8 text-gray-400 text-xs">Kosong</div>`;
            document.getElementById('notifPanel').classList.add('hidden'); 
        }

        // --- BACKEND LOGIC: FORMAT HARGA MARKUP + DEPOSIT + ADMIN ---
        async function fetchProducts() {
            try {
                // Di backend index.js, /api/products/prabayar sudah menambahkan margin profit (settings.margin_rupiah)
                // ke dalam price_selling. 
                const res = await axios.get('/api/products/prabayar');
                
                if(res.data.status) {
                    allProducts = res.data.data.filter(p => {
                        const cat = (p.category || '').toLowerCase();
                        const nameLower = (p.name || '').toLowerCase();
                        const providerLower = (p.provider || p.brand || '').toLowerCase();

                        if (!cat.includes('games') && !cat.includes('voucher game')) return false;
                        if (BLACKLIST.some(b => nameLower.includes(b) || providerLower.includes(b))) return false;
                        return true;
                    });

                    // Modifikasi price_selling (Terapkan + 1.4% + 200)
                    allProducts = allProducts.map(p => {
                        let currentPrice = parseInt(p.price_selling);
                        // Hitung fee QRIS 1.4%
                        let feeQris = currentPrice * 0.014;
                        // Harga Jual = Harga saat ini + Fee QRIS + 200 Admin
                        let finalMarkupPrice = Math.ceil(currentPrice + feeQris + 200);

                        return {
                            ...p,
                            price_selling: finalMarkupPrice
                        };
                    });

                    groupedGames = {};
                    allProducts.forEach(p => {
                        let providerRaw = (p.provider || p.brand || '').trim();
                        let nameRaw = p.name.toLowerCase();

                        if (!providerRaw || providerRaw === '-' || providerRaw === 'null') {
                            if(nameRaw.includes('free fire')) providerRaw = 'Free Fire';
                            else if(nameRaw.includes('mobile legends')) providerRaw = 'Mobile Legends';
                            else providerRaw = 'Unknown Game';
                        }

                        let cleanProvider = providerRaw;
                        Object.keys(PROVIDER_MAP).forEach(key => { if (providerRaw.toLowerCase().includes(key)) cleanProvider = PROVIDER_MAP[key]; });
                        const groupKey = cleanProvider.toLowerCase().replace(/[^a-z0-9]/g, '');

                        if(!groupedGames[groupKey]) {
                            groupedGames[groupKey] = { name: cleanProvider, image: p.img_url || 'https://cdn-icons-png.flaticon.com/512/686/686589.png', items: [] };
                        }
                        if(!groupedGames[groupKey].items.find(i => i.code === p.code)) groupedGames[groupKey].items.push(p);
                    });
                    renderGamesGrid(groupedGames);
                } else { document.getElementById('gamesGrid').innerHTML = `<p class="col-span-full text-center text-red-500 font-bold">Gagal mengambil data.</p>`; }
            } catch (err) { document.getElementById('gamesGrid').innerHTML = `<p class="col-span-full text-center text-red-500 font-bold">Terjadi kesalahan koneksi.</p>`; }
        }

        function renderGamesGrid(gamesObj) {
            const grid = document.getElementById('gamesGrid');
            grid.innerHTML = '';
            const gameKeys = Object.keys(gamesObj).sort();
            if(gameKeys.length === 0) { grid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">Kosong.</p>`; return; }

            gameKeys.forEach(key => {
                const game = gamesObj[key];
                if(game.items.length === 0) return;
                const card = document.createElement('div');
                card.className = 'game-card bg-white rounded-2xl p-4 cursor-pointer border border-green-50 flex flex-col items-center gap-3 relative overflow-hidden group';
                card.onclick = () => openGameModal(key);
                card.innerHTML = `<div class="relative w-full aspect-[1/1] rounded-xl overflow-hidden bg-gray-50 shadow-inner p-1 border border-gray-100"><img src="${game.image}" class="w-full h-full object-contain transition duration-500 group-hover:scale-110" loading="lazy"></div><div class="text-center w-full"><h3 class="font-bold text-gray-800 text-sm md:text-base truncate px-1">${game.name}</h3><p class="text-xs text-green-500 mt-0.5 font-medium">${game.items.length} Layanan</p></div>`;
                grid.appendChild(card);
            });
        }

        function filterGames() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            const filteredObj = {};
            Object.keys(groupedGames).forEach(key => {
                if(groupedGames[key].name.toLowerCase().includes(query)) filteredObj[key] = groupedGames[key];
            });
            renderGamesGrid(filteredObj);
        }

        function openGameModal(gameKey) {
            currentActiveGame = groupedGames[gameKey];
            
            document.getElementById('modalGameTitle').innerText = currentActiveGame.name;
            document.getElementById('modalGameImg').src = currentActiveGame.image;
            
            filterModalTab('reguler'); // Default load reguler items

            const modal = document.getElementById('productModal');
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; 
        }

        function filterModalTab(type) {
            document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`tab-${type}`).classList.add('active');

            const grid = document.getElementById('modalItemsGrid');
            grid.innerHTML = '';

            let items = currentActiveGame.items;
            items.sort((a, b) => a.price_selling - b.price_selling);

            let filteredItems = items.filter(p => {
                const n = p.name.toLowerCase();
                const isMem = n.includes('member') || n.includes('weekly') || n.includes('monthly') || n.includes('starlight') || n.includes('pass') || n.includes('twilight');
                return type === 'member' ? isMem : !isMem;
            });

            if(filteredItems.length === 0) {
                grid.innerHTML = `<p class="col-span-full text-center text-gray-400 py-6 text-sm">Tidak ada item di kategori ini.</p>`;
                return;
            }

            filteredItems.forEach(item => {
                const isAvailable = item.status === 'available';
                let cleanName = item.name.replace(new RegExp(currentActiveGame.name, 'gi'), '').replace(/[-–:|]/g, '').trim(); 
                if(cleanName.length < 2) cleanName = item.name;

                const cardClass = isAvailable ? 'item-card bg-white' : 'item-disabled';
                const el = document.createElement('div');
                el.className = `${cardClass} p-3 rounded-xl relative flex flex-col justify-between h-full group`;
                
                if(isAvailable) {
                    el.onclick = () => goToPayment(item.code, item.name, item.price_selling, currentActiveGame.image, currentActiveGame.name);
                }

                el.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-1">
                            <span class="${isAvailable?'bg-green-500':'bg-red-500'} w-2 h-2 rounded-full mt-1.5 shadow-sm"></span>
                            ${!isAvailable ? `<span class="text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">GANGGUAN</span>` : ''}
                        </div>
                        <h4 class="font-semibold text-gray-700 text-sm leading-tight mb-2 group-hover:text-green-600 transition">${cleanName}</h4>
                    </div>
                    <p class="text-green-600 font-bold text-sm">Rp ${parseInt(item.price_selling).toLocaleString('id-ID')}</p>
                `;
                grid.appendChild(el);
            });
        }

        // --- REDIRECT LOGIC ---
        function goToPayment(code, name, price, imgUrl, providerName) {
            const data = { 
                code, 
                name, 
                price, // Price ini sudah termarkup dengan 1.4% + 200 
                img_url: imgUrl,
                provider: providerName,
                category: "Games",
                type: "prabayar"
            };
            localStorage.setItem('selectedProduct', JSON.stringify(data));
            window.location.href = '/payment';
        }

        function closeModal() {
            document.getElementById('productModal').classList.add('hidden');
            document.body.style.overflow = 'auto'; 
        }

        async function trackVisitor() {
    grecaptcha.ready(function() {
        grecaptcha.execute('SITE_KEY_ANDA_DISINI', {action: 'homepage'}).then(async function(token) {
            try {
                // Kirim request track visitor beserta tokennya
                await axios.post('/api/track-visitor', { recaptcha_token: token });
            } catch(e) {
                console.log("Gagal mencatat visitor");
            }
        });
    });
}

// Jalankan saat halaman dimuat
trackVisitor();
init();
