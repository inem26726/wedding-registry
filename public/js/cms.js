document.addEventListener('DOMContentLoaded', () => {
    // --- State & DOM Elements ---
    let allGifts = [];
    const API_URL = '/wedding-registry/api/gifts';
    const LOGIN_URL = '/wedding-registry/api/auth/login';
    const LOGOUT_URL = '/wedding-registry/api/auth/logout';
    
    // Auth elements
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Dashboard elements
    const giftList = document.getElementById('gift-list');
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');
    
    // --- Initial Check ---
    checkAuthStatus();

    // --- Authentication ---
    async function checkAuthStatus() {
        try {
            const res = await fetch('/wedding-registry/api/auth/me');
            if (res.ok) {
                showDashboard();
            } else {
                showLogin();
            }
        } catch (err) {
            console.error('Auth check failed', err);
            showLogin();
        }
    }

    function showLogin() {
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }

    function showDashboard() {
        loginScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');
        fetchGifts();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch(LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                showDashboard();
            } else {
                const data = await res.json();
                loginError.textContent = data.error || 'Login failed';
                loginError.classList.remove('hidden');
            }
        } catch (err) {
            loginError.textContent = 'Network error';
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch(LOGOUT_URL, { method: 'POST' });
        showLogin();
    });

    // --- Data Management ---
    async function fetchGifts() {
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            allGifts = data.data;
            renderGifts();
        } catch (err) {
            console.error('Failed to fetch gifts', err);
        }
    }

    function renderGifts() {
        giftList.innerHTML = '';
        allGifts.forEach(gift => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50 transition';
            tr.innerHTML = `
                <td class="p-4">
                    <img src="${gift.image_url}" class="w-12 h-12 rounded object-cover border" alt="${gift.name}" onerror="this.src='https://placehold.co/48x48?text=No+Img'">
                </td>
                <td class="p-4 font-medium text-gray-800">${gift.name}</td>
                <td class="p-4 text-gray-600">${gift.category || '-'}</td>
                <td class="p-4 text-gray-800 font-semibold">Rp ${parseInt(gift.price).toLocaleString('id-ID')}</td>
                <td class="p-4 text-center">
                    <button onclick="editItem(${gift.id})" class="text-blue-600 hover:text-blue-800 mr-3 transition" title="Edit">
                        <i class="ri-edit-line text-xl"></i>
                    </button>
                    <button onclick="deleteItem(${gift.id})" class="text-red-500 hover:text-red-700 transition" title="Delete">
                        <i class="ri-delete-bin-line text-xl"></i>
                    </button>
                </td>
            `;
            giftList.appendChild(tr);
        });
    }

    // --- Expose Global Functions ---
    window.openModal = (id = null) => {
        itemModal.classList.remove('hidden');
        if (id) {
            // Edit mode
            const gift = allGifts.find(g => g.id === id);
            if (!gift) return;

            document.getElementById('modal-title').textContent = 'Edit Item';
            document.getElementById('item-id').value = gift.id;
            document.getElementById('item-name').value = gift.name;
            document.getElementById('item-category').value = gift.category;
            document.getElementById('item-price').value = gift.price;
            document.getElementById('item-image').value = gift.image_url;
            document.getElementById('item-link').value = gift.link_url;
        } else {
            // Add mode
            document.getElementById('modal-title').textContent = 'Tambah Item Baru';
            itemForm.reset();
            document.getElementById('item-id').value = '';
        }
    };

    window.closeModal = () => {
        itemModal.classList.add('hidden');
    };

    window.editItem = (id) => {
        window.openModal(id);
    };

    window.deleteItem = async (id) => {
        if (!confirm('Yakin ingin menghapus item ini?')) return;

        try {
            const res = await fetch(`/wedding-registry/api/gifts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchGifts(); // Refresh list
            } else {
                alert('Gagal menghapus item');
            }
        } catch (err) {
            console.error(err);
            alert('Terjadi kesalahan saat menghapus');
        }
    };

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('item-id').value;
        const payload = {
            name: document.getElementById('item-name').value,
            category: document.getElementById('item-category').value,
            price: parseInt(document.getElementById('item-price').value),
            image_url: document.getElementById('item-image').value,
            link_url: document.getElementById('item-link').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/wedding-registry/api/gifts/${id}` : '/wedding-registry/api/gifts';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                closeModal();
                fetchGifts(); // Refresh list
            } else {
                const err = await res.json();
                alert('Gagal menyimpan: ' + (err.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Terjadi kesalahan jaringan');
        }
    });

    // Close modal when clicking outside
    itemModal.addEventListener('click', (e) => {
        if (e.target === itemModal) closeModal();
    });
});
