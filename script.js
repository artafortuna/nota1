/* ==============================================================
   0. INDEXED DB - SISTEM PENYIMPANAN LOKAL (AUTO-SAVE)
   ============================================================== */
let db;
const requestDB = indexedDB.open("ArtaFortunaDB", 1);

requestDB.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("appState")) {
        db.createObjectStore("appState", { keyPath: "key" });
    }
};

requestDB.onsuccess = function(event) {
    db = event.target.result;
    loadFromDB();
};

function saveToDB(key, data) {
    if (!db) return;
    const tx = db.transaction("appState", "readwrite");
    const store = tx.objectStore("appState");
    store.put({ key: key, data: data });
}

function loadFromDB() {
    if (!db) return;
    const tx = db.transaction("appState", "readonly");
    const store = tx.objectStore("appState");
    
    // Load Logo
    const reqLogo = store.get("posLogo");
    reqLogo.onsuccess = function() {
        if (reqLogo.result && reqLogo.result.data) {
            const output = document.getElementById('outLogo');
            output.src = reqLogo.result.data;
            output.style.display = 'block';
        }
    };

    // Load POS Settings
    const reqPos = store.get("posSettings");
    reqPos.onsuccess = function() {
        if (reqPos.result && reqPos.result.data) {
            const s = reqPos.result.data;
            if(s.nama) document.getElementById('inNama').value = s.nama;
            if(s.subNama) document.getElementById('inSubNama').value = s.subNama;
            if(s.kasir) document.getElementById('inKasir').value = s.kasir;
            if(s.prefix) document.getElementById('inPrefix').value = s.prefix;
            if(s.nota) document.getElementById('inNota').value = s.nota;
            if(s.footer) document.getElementById('inFooter').value = s.footer;
            if(s.metode) document.getElementById('inBayarMetode').value = s.metode;
        }
        render(); // Render ulang dengan data yang diload
    };

    // Load Cart
    const reqCart = store.get("cart");
    reqCart.onsuccess = function() {
        if (reqCart.result && reqCart.result.data) {
            cart = reqCart.result.data;
        }
        render();
    };

    // Load Sosmed Draft & Table
    const reqSosmed = store.get("sosmed");
    reqSosmed.onsuccess = function() {
        if (reqSosmed.result && reqSosmed.result.data) {
            const d = reqSosmed.result.data;
            // Kembalikan ke form input
            document.getElementById('in-order-id').value = d.orderId || '';
            document.getElementById('in-layanan').value = d.layanan || '';
            document.getElementById('in-target').value = d.target || '';
            document.getElementById('in-jumlah').value = d.jumlah || '';
            document.getElementById('in-start').value = d.start || '';
            document.getElementById('in-remains').value = d.remains || '';
            document.getElementById('in-status').value = d.status || 'Success';
            document.getElementById('in-tanggal').value = d.rawTanggal || '';
            
            // Kembalikan ke tampilan tabel
            document.getElementById('val-order-id').textContent = d.orderId || '';
            document.getElementById('val-layanan').textContent = d.layanan || '';
            document.getElementById('val-target').textContent = d.target || '';
            document.getElementById('val-jumlah').textContent = d.jumlah || '';
            document.getElementById('val-start').textContent = d.start || '';
            document.getElementById('val-remains').textContent = d.remains || '';
            document.getElementById('val-status').textContent = d.status || 'Success';
            document.getElementById('val-status').style.backgroundColor = statusColors[d.status] || '#30c696';
            document.getElementById('val-tanggal').textContent = formatDateIndo(d.rawTanggal) || '';
        } else {
            // Kosongkan tabel jika tidak ada data tersimpan
            document.getElementById('val-status').textContent = 'Success';
            document.getElementById('val-status').style.backgroundColor = '#30c696';
        }
    };
}

/* ==============================================================
   1. SISTEM NAVIGATION (TABS)
   ============================================================== */
function switchTab(targetId, navElement) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    navElement.classList.add('active');
}

/* ==============================================================
   2. SISTEM CUSTOM POPUP (PENGGANTI ALERT BROWSER)
   ============================================================== */
const CustomUI = {
    show: function(title, message, type, isConfirm, onConfirmCallback) {
        const overlay = document.getElementById('custom-ui-overlay');
        const iconEl = document.getElementById('custom-ui-icon');
        const titleEl = document.getElementById('custom-ui-title');
        const messageEl = document.getElementById('custom-ui-message');
        const btnCancel = document.getElementById('custom-ui-btn-cancel');
        const btnConfirm = document.getElementById('custom-ui-btn-confirm');

        if (type === 'success') {
            iconEl.innerHTML = '✅';
            btnConfirm.style.backgroundColor = '#30c696';
        } else if (type === 'error') {
            iconEl.innerHTML = '⚠️';
            btnConfirm.style.backgroundColor = '#e74c3c';
        } else {
            iconEl.innerHTML = '🔔';
            btnConfirm.style.backgroundColor = '#20b2aa';
        }

        titleEl.innerText = title;
        messageEl.innerText = message;

        btnConfirm.replaceWith(btnConfirm.cloneNode(true));
        btnCancel.replaceWith(btnCancel.cloneNode(true));
        const newBtnConfirm = document.getElementById('custom-ui-btn-confirm');
        const newBtnCancel = document.getElementById('custom-ui-btn-cancel');

        if (isConfirm) {
            newBtnCancel.classList.remove('hidden');
            newBtnCancel.addEventListener('click', () => this.close());
        } else {
            newBtnCancel.classList.add('hidden');
        }

        newBtnConfirm.addEventListener('click', () => {
            this.close();
            if (onConfirmCallback) onConfirmCallback();
        });

        overlay.classList.remove('hidden');
    },
    close: function() { document.getElementById('custom-ui-overlay').classList.add('hidden'); },
    alert: function(title, message, type = 'info') { this.show(title, message, type, false, null); },
    confirm: function(title, message, onConfirmCallback) { this.show(title, message, 'warning', true, onConfirmCallback); }
};

/* ==============================================================
   3. LOGIKA SKRIP 1: POS STRUK KASIR
   ============================================================== */
let cart = [];
const usedRandomNumbers = new Set();

function updateNota() {
    const prefix = document.getElementById('inPrefix').value;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    const dateStr = `${dd}${mm}${yyyy}`;
    const timeStr = `${hh}${min}${ss}`;
    
    let randomNum;
    do {
        randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    } while (usedRandomNumbers.has(randomNum));
    
    usedRandomNumbers.add(randomNum);
    if (usedRandomNumbers.size >= 10000) usedRandomNumbers.clear();

    document.getElementById('inNota').value = `${prefix}${dateStr}${timeStr}${randomNum}`;
    render();
}

function previewLogo(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const output = document.getElementById('outLogo');
        output.src = reader.result;
        output.style.display = 'block';
        saveToDB("posLogo", reader.result);
    };
    if(event.target.files[0]) reader.readAsDataURL(event.target.files[0]);
}

function addItem() {
    const namaProduk = document.getElementById('inItem').value;
    const hargaStr = document.getElementById('inHarga').value;
    const qtyStr = document.getElementById('inQty').value;
    
    if (!namaProduk || !hargaStr || !qtyStr) {
        CustomUI.alert("Gagal Menambahkan", "Harap isi Nama Produk, Harga, dan Qty dengan benar!", "error");
        return;
    }

    const item = {
        name: namaProduk,
        note: document.getElementById('inNote').value,
        price: parseInt(hargaStr),
        qty: parseInt(qtyStr)
    };
    
    cart.push(item); 
    saveToDB("cart", cart);
    render(); 
    
    document.getElementById('inItem').value = '';
    document.getElementById('inNote').value = '';
    document.getElementById('inHarga').value = '';
    document.getElementById('inQty').value = '';
}

function hapusItem(index) {
    CustomUI.confirm("Hapus Item", "Yakin ingin menghapus produk ini dari keranjang?", () => {
        cart.splice(index, 1);
        saveToDB("cart", cart);
        render();
    });
}

function render() {
    document.getElementById('outNama').innerText = document.getElementById('inNama').value;
    document.getElementById('outSubNama').innerText = document.getElementById('inSubNama').value || "Kediri - Jawa Timur - Indonesia";
    document.getElementById('outKasir').innerText = document.getElementById('inKasir').value;
    document.getElementById('outNota').innerText = document.getElementById('inNota').value;
    document.getElementById('outFooter').innerText = document.getElementById('inFooter').value || "Terima kasih telah berbelanja di HYRA STORE";
    document.getElementById('outMetode').innerText = document.getElementById('inBayarMetode').value;
    
    let html = '', total = 0;
    cart.forEach((i, index) => {
        total += (i.price * i.qty);
        html += `<div>
                    <div class="flex-row">
                        <span>${i.name} x ${i.qty} 
                            <button class="item-delete-btn" onclick="hapusItem(${index})">Hapus</button>
                        </span> 
                        <span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
                    </div>
                    ${i.note ? `<div class="item-note">${i.note}</div>` : ''}
                 </div>`;
    });
    document.getElementById('itemList').innerHTML = html;
    document.getElementById('outTotal').innerText = "Rp " + total.toLocaleString('id-ID');
    document.getElementById('outBayar').innerText = "Rp " + total.toLocaleString('id-ID');
    document.getElementById('outKembali').innerText = "Rp 0 ";

    // Simpan semua input ke DB agar tidak hilang saat refresh
    saveToDB("posSettings", {
        nama: document.getElementById('inNama').value,
        subNama: document.getElementById('inSubNama').value,
        kasir: document.getElementById('inKasir').value,
        prefix: document.getElementById('inPrefix').value,
        nota: document.getElementById('inNota').value,
        footer: document.getElementById('inFooter').value,
        metode: document.getElementById('inBayarMetode').value
    });
}

/* ==============================================================
   4. LOGIKA SKRIP 2: SOSMED BOOSTER
   ============================================================== */
const statusColors = {
    'Success': '#30c696', 'In Progress': '#3c9bf1', 'Processing': '#30a7b5',
    'Pending': '#dfb425', 'Partial': '#dc3b4f', 'Error': '#dc3545', 'Refill': '#3c9bf1'
};

function formatDateIndo(dateString) {
    if (!dateString) return "";
    const dateObj = new Date(dateString);
    const trueMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = trueMonths[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
}

// Fitur simpan draft sosmed otomatis saat mengetik
document.getElementById('orderForm').addEventListener('input', function() {
    saveToDB("sosmed", {
        orderId: document.getElementById('in-order-id').value,
        layanan: document.getElementById('in-layanan').value,
        target: document.getElementById('in-target').value,
        jumlah: document.getElementById('in-jumlah').value,
        start: document.getElementById('in-start').value,
        remains: document.getElementById('in-remains').value,
        status: document.getElementById('in-status').value,
        rawTanggal: document.getElementById('in-tanggal').value
    });
});

function processUpdateTable() {
    const orderId = document.getElementById('in-order-id').value;
    if(!orderId) {
        CustomUI.alert("Validasi Gagal", "Order ID tidak boleh kosong!", "error");
        return;
    }
    updateTable();
    CustomUI.alert("Berhasil", "Data berhasil diupdate ke tabel laporan.", "success");
}

function updateTable() {
    const orderId = document.getElementById('in-order-id').value;
    const layanan = document.getElementById('in-layanan').value;
    const target = document.getElementById('in-target').value;
    const jumlah = document.getElementById('in-jumlah').value;
    const start = document.getElementById('in-start').value;
    const remains = document.getElementById('in-remains').value;
    const status = document.getElementById('in-status').value;
    const rawTanggal = document.getElementById('in-tanggal').value;

    document.getElementById('val-order-id').textContent = orderId;
    document.getElementById('val-layanan').textContent = layanan;
    document.getElementById('val-target').textContent = target;
    document.getElementById('val-jumlah').textContent = jumlah;
    document.getElementById('val-start').textContent = start;
    document.getElementById('val-remains').textContent = remains;
    document.getElementById('val-tanggal').textContent = formatDateIndo(rawTanggal);
    
    const statusBadge = document.getElementById('val-status');
    statusBadge.textContent = status;
    statusBadge.style.backgroundColor = statusColors[status] || '#777'; 

    saveToDB("sosmed", {
        orderId, layanan, target, jumlah, start, remains, status, rawTanggal
    });
}

/* ==============================================================
   5. INISIALISASI SAAT HALAMAN DIMUAT
   ============================================================== */
window.onload = function() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    document.getElementById('outTgl').innerText = `${dd}/${mm}/${yyyy} ${hh}.${min} WIB`;
    
    // Beri waktu sejenak untuk IndexedDB load, jika nota kosong maka buat nota baru
    setTimeout(() => {
        if (!document.getElementById('inNota').value) {
            updateNota();
        }
    }, 300);
};

/* ==============================================================
   6. FITUR DOWNLOAD JPG HD (HTML2CANVAS)
   ============================================================== */
function downloadStruk() {
    const element = document.getElementById('printable');
    // Matikan shadow sementara agar hasil JPG lebih rapi di tepiannya
    const originalShadow = element.style.boxShadow;
    element.style.boxShadow = 'none';

    html2canvas(element, { 
        scale: 3, // Resolusi HD (3x lipat)
        backgroundColor: '#ffffff', 
        useCORS: true 
    }).then(canvas => {
        const link = document.createElement('a');
        const notaName = document.getElementById('inNota').value || 'HYRA';
        link.download = `Struk_${notaName}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0);
        link.click();
        
        // Kembalikan shadow
        element.style.boxShadow = originalShadow;
    });
}

function downloadSosmed() {
    const element = document.getElementById('printable-sosmed');
    const originalShadow = element.style.boxShadow;
    element.style.boxShadow = 'none';

    html2canvas(element, { 
        scale: 3, 
        backgroundColor: '#ffffff', 
        useCORS: true 
    }).then(canvas => {
        const link = document.createElement('a');
        const orderId = document.getElementById('in-order-id').value || 'Sosmed';
        link.download = `Laporan_${orderId}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0);
        link.click();
        
        element.style.boxShadow = originalShadow;
    });
}
