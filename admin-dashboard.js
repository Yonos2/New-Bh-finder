// [GI-BALIK] Ibalik ang buildUrl function para sa saktong API requests.
const API_BASE_ROOT = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
const buildUrl = (path = '') => {
  return `${API_BASE_ROOT}/${path.replace(/^\//, '')}`;
};
document.addEventListener('DOMContentLoaded', async () => {
  // --- [BAG-O NGA SOLUSYON] Pagsulbad sa Back-Forward Cache Issue ---
  // Kini ang mosiguro nga kung ang user mo-klik sa "Back" button human sa logout,
  // ang page mo-reload imbis nga magpakita og karaan (cached) nga data.
  window.addEventListener('pageshow', (event) => {
    // Ang `event.persisted` mahimong `true` kung ang page gikuha gikan sa bfcache.
    if (event.persisted) {
      console.log('[Cache] Page was loaded from back-forward cache. Forcing reload.');
      window.location.reload();
    }
  });

  const imageViewerModalEl = document.getElementById('imageViewerModal');
  const imageViewerModal = new bootstrap.Modal(imageViewerModalEl);
  const fullImageView = document.getElementById('fullImageView');
  // [BAG-O] Rejection Modal
  const rejectionModalEl = document.getElementById('rejectionModal');
  const rejectionModal = new bootstrap.Modal(rejectionModalEl);
  const confirmRejectBtn = document.getElementById('confirmRejectBtn');

  /**
   * 🧠 [BAG-O] Function para i-verify ang session sa admin sa server.
   * Kini ang mosulbad sa problema sa pag-load sa data ug mo-secure sa page.
   */
  async function verifyAdminSession(retryCount = 0) {
    try {
      // [GI-AYO] Gidugang ang headers para dili i-cache sa browser ang response.
      // 🔧 FIXED: Use correct endpoint for admin session check
      const response = await fetch(buildUrl('admin/session'), {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'include', // Importante para mapadala ang session cookie
      });
      const result = await response.json();

      if (result.status === 'Success' && result.isLoggedIn && result.user && result.user.role === 'admin') {
        return result.user; // Ibalik ang user data kung valid admin
      } else {
        // [BAG-O] Kung mapakyas sa unang higayon, sulayan pag-usab kausa (retry) human sa 500ms.
        // Kini mosulbad sa "race condition" diin ang session wala pa hingpit ma-save sa server.
        if (retryCount < 3) { // 3 retries is usually enough with the new controller logic
          console.warn(`Session check failed (Attempt ${retryCount + 1}). Retrying in 500ms...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          return verifyAdminSession(retryCount + 1);
        }

        // Kung dili admin o walay session, i-redirect
        sessionStorage.removeItem('currentUser');
        throw new Error(result.message || 'Invalid session for admin.');
      }
    } catch (error) {
      console.error('Admin session verification failed:', error);
      alert('Access denied. Please log in as admin.');
      window.location.replace('admin-login.html');
      return null; // Dili na mopadayon
    }
  }

  // --- 🔑 [GI-AYO] Authentication Check ---
  const user = await verifyAdminSession();
  if (!user) return; // Hunongon ang script kung mapakyas ang verification

  document.getElementById('adminName').textContent = user.full_name || user.username || 'Admin';
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { 
      await fetch(buildUrl('user?action=logout'), {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    sessionStorage.removeItem('currentUser'); // Tangtangon ang user data
    window.location.href = 'index.html'; //I-redirect sa homepage
  });

  // --- Elements ---
  const bhList = document.getElementById('bh-management-list');
  const userList = document.getElementById('user-management-list'); // 🟢 Bag-o
  const loadingSpinner = document.getElementById('loadingSpinner');
  const userLoadingSpinner = document.getElementById('userLoadingSpinner'); // 🟢 Bag-o

  // --- Functions ---

  /**
   * I-render ang usa ka boarding house item sa lista
   * @param {object} house - Ang data sa boarding house
   */
  const renderBhItem = (house) => {
    const statusBadge = {
      pending: '<span class="badge bg-warning text-dark">Pending</span>',
      approved: '<span class="badge bg-success">Approved</span>',
      rejected: '<span class="badge bg-danger">Rejected</span>',
    };

    const pendingButtons = `
      <button class="btn btn-sm btn-success approve-btn" data-id="${house.id}" title="Approve"><i class="bi bi-check-lg"></i></button>
      <button class="btn btn-sm btn-danger reject-btn" data-id="${house.id}" title="Reject"><i class="bi bi-x-lg"></i></button>
    `;

    return `
      <li class="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center bh-list-item status-${house.status}" id="bh-item-${house.id}" data-house-data='${JSON.stringify(house)}'>
        <div class="mb-2 mb-sm-0">
          <h6 class="mb-0">${house.name}</h6>
          <small class="text-muted">${house.address} | Owner: ${house.owner_name}</small>
        </div>
        <div class="d-flex align-items-center flex-shrink-0">
          <div class="me-3">${statusBadge[house.status] || ''}</div>
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-outline-primary view-details-btn" data-id="${house.id}" title="View Details"><i class="bi bi-eye-fill"></i></button>
            ${house.status === 'pending' ? pendingButtons : ''}
          </div>
        </div>
      </li>
    `;
  };

  /**
   * I-load ang tanang boarding houses para sa admin
   */
  const loadAllBoardingHouses = async () => {
    loadingSpinner.classList.remove('d-none');
    bhList.innerHTML = '<li class="list-group-item text-center text-muted">Loading...</li>';

    try {
      // 🔧 FIXED: Use correct endpoint for admin boarding house list
      const res = await fetch(buildUrl('admin/boardinghouses'), {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const houses = await res.json();

      if (!houses || houses.length === 0) {
        bhList.innerHTML = '<li class="list-group-item text-center text-muted">No boarding houses found.</li>';
        return;
      }

      bhList.innerHTML = houses.map(renderBhItem).join('');
    } catch (err) {
      console.error('Failed to load boarding houses:', err);
      bhList.innerHTML = '<li class="list-group-item text-center text-danger">Failed to load data.</li>';
    } finally {
      loadingSpinner.classList.add('d-none');
    }
  };

  /**
   * 🟢 [BAG-O] I-render ang usa ka user item sa lista
   * @param {object} user - Ang data sa user
   */
  const renderUserItem = (user) => {
    const roleBadge = {
      owner: '<span class="badge bg-info text-dark">Owner</span>',
      tenant: '<span class="badge bg-secondary">Tenant</span>',
      user: '<span class="badge bg-secondary">User</span>',
      admin: '<span class="badge bg-primary">Admin</span>',
    };

    // [BAG-O] Idugang ang "New" badge kung ang user.is_new kay true.
    const newBadge = user.is_new ? '<span class="badge bg-success ms-2 new-user-badge">New</span>' : '';

    // I-apil ang View button ug ayaw pagbutang og delete button para sa kaugalingong admin account
    const actionButtons = `
      <div class="btn-group" role="group">
        <button class="btn btn-sm btn-outline-primary view-user-btn" title="View Details"><i class="bi bi-eye-fill"></i></button>
        ${user.role !== 'admin' ? `<button class="btn btn-sm btn-outline-danger delete-user-btn" data-id="${user.id}" data-username="${user.username}" title="Delete User"><i class="bi bi-trash-fill"></i></button>` : ''}
      </div>
    `;

    return `
      <li class="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center" data-user-data='${JSON.stringify(user)}'>
        <div class="mb-2 mb-sm-0">
          <div class="d-flex align-items-center">
            <h6 class="mb-0">${user.full_name || 'N/A'} <small class="text-muted">(@${user.username})</small></h6>
            ${newBadge}
          </div>
          <small class="text-muted">${user.email || 'No email'}</small>
        </div>
        <div class="d-flex align-items-center flex-shrink-0">
          <div class="me-3">${roleBadge[user.role] || ''}</div>
          ${actionButtons}
        </div>
      </li>
    `;
  };

  /**
   *  [BAG-O] I-load ang tanang users para sa admin
   */
  const loadAllUsers = async () => {
    userLoadingSpinner.classList.remove('d-none');
    userList.innerHTML = '<li class="list-group-item text-center text-muted">Loading users...</li>';
    try {
      //  [GI-AYO] I-change ang endpoint para motawag sa saktong controller
      const res = await fetch(buildUrl('admin/users'), {
        // [BAG-O] Idugang ang credentials para ma-authorize sa server
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const users = await res.json();
      
      if (!users || users.length === 0) {
        userList.innerHTML = '<li class="list-group-item text-center text-muted">No users found.</li>';
        return;
      }
      
      userList.innerHTML = users.map(renderUserItem).join('');
    } catch (err) {
      console.error('Failed to load users:', err);
      userList.innerHTML = '<li class="list-group-item text-center text-danger">Failed to load user data.</li>';
    } finally {
      userLoadingSpinner.classList.add('d-none');
    }
  };

  /**
   * 🟢 [BAG-O] Ipakita ang user details sa usa ka modal
   * @param {object} user - Ang data sa user
   */
  const showUserDetailsModal = (user) => {
    // Susiha kung naa nay modal, kung naa, tangtanga daan
    const existingModal = document.getElementById('userDetailModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div class="modal fade" id="userDetailModal" tabindex="-1" aria-labelledby="userDetailModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title" id="userDetailModalLabel">
                <i class="bi bi-person-circle me-2"></i> User Details
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p><strong><i class="bi bi-person-badge-fill text-primary"></i> Full Name:</strong> ${user.full_name || 'N/A'}</p>
              <p><strong><i class="bi bi-at text-primary"></i> Username:</strong> ${user.username || 'N/A'}</p>
              <p><strong><i class="bi bi-envelope-fill text-primary"></i> Email:</strong> ${user.email || 'N/A'}</p>
              <p><strong><i class="bi bi-telephone-fill text-primary"></i> Phone:</strong> ${user.phone || 'Not provided'}</p>
              <p><strong><i class="bi bi-person-lines-fill text-primary"></i> Role:</strong> <span class="text-capitalize">${user.role || 'N/A'}</span></p>
              <p><strong><i class="bi bi-calendar-check-fill text-primary"></i> Joined:</strong> ${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
              <!-- [BAG-O] Ipakita ang mga link sa ID ug Business Permit kung owner -->
              ${user.role === 'owner' ? `
                <hr>
                <h6><i class="bi bi-files text-primary"></i> Documents</h6>
                <p>
                  ${user.id_picture_path ? `<a href="${buildUrl(user.id_picture_path)}" target="_blank">View ID</a>` : 'No ID uploaded'}
                  <br>
                  ${user.business_permit_path ? `<a href="${buildUrl(user.business_permit_path)}" target="_blank">View Business Permit</a>` : 'No Business Permit uploaded'}
                </p>
              ` : ''}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modalEl = document.getElementById('userDetailModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
  };

  /**
   * I-update ang status sa boarding house
   * @param {number} id - Ang ID sa boarding house
   * @param {string} status - Ang bag-ong status ('approved' or 'rejected')
   * @param {string|null} reason - Ang rason sa pag-reject (optional)
   * @param {HTMLElement} btnClicked - Ang button nga gi-click (para sa spinner)
   */
  const updateStatus = async (id, status, reason = null, btnClicked) => {
    // Add spinner to the clicked button
    const originalBtnHtml = btnClicked.innerHTML;
    btnClicked.disabled = true;
    btnClicked.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;

    try {
      const payload = { id, status, action: 'update_status', rejection_reason: reason };
      const res = await fetch(buildUrl('boardinghouse'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      if (result.status === 'Success') {
        alert(`Boarding house ${status}.`);
        loadAllBoardingHouses(); // Refresh the list
      } else {
        throw new Error(result.message || 'Failed to update status.');
      }
    } catch (err) {
      console.error('Update status error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      // Remove spinner and re-enable button
      btnClicked.innerHTML = originalBtnHtml;
      btnClicked.disabled = false;
    }
  };

  // --- 👂 Event Listeners ---

  bhList.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const id = button.dataset.id;
    
    // [GI-AYO] Ipasa ang button element isip `btnClicked` sa `updateStatus`
    if (button.classList.contains('approve-btn')) {
      if (confirm(`Are you sure you want to approve this boarding house (ID: ${id})?`)) {
        await updateStatus(id, 'approved', null, button); // Ibutang ang `null` para sa `reason`
      }
    } else if (button.classList.contains('reject-btn') && !button.closest('.modal')) { // [GI-AYO] Sigurohon nga ang reject button sa lista ra ang mo-trigger ani
      document.getElementById('rejectionBhId').value = id;
      document.getElementById('rejectionReason').value = ''; // Limpyohan ang textarea
      rejectionModal.show();

    } else if (button.classList.contains('view-details-btn')) {
      // [GI-AYO] Gi-ilisdan ang daan nga logic para gamiton ang static modal sa HTML
      const detailsModalEl = document.getElementById('bhDetailsModal-admin');
      const detailsModal = bootstrap.Modal.getInstance(detailsModalEl) || new bootstrap.Modal(detailsModalEl);

      // I-reset ang modal ug ipakita ang loading state
      detailsModalEl.querySelector('.modal-title').textContent = 'Loading Details...';
      detailsModalEl.querySelector('#carousel-container-details-admin').innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div></div>';
      detailsModalEl.querySelector('#modalBhAddressDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhPhoneDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhRoomsDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhBedsDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhGenderDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhPriceDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhAmenitiesDetails-admin').textContent = '...';
      detailsModalEl.querySelector('#modalBhTermsDetails-admin').textContent = '...';
      detailsModal.show();

      try {
        const res = await fetch(buildUrl(`boardinghouse?id=${id}&view=admin`), { credentials: 'include' });
        if (!res.ok) throw new Error(`Server responded with status ${res.status}`);

        const houseData = await res.json();
        if (houseData && houseData.id) {
          // I-populate ang static modal
          detailsModalEl.querySelector('#bhDetailsModalLabel-admin').textContent = houseData.name;

          // Carousel
          const carouselContainer = detailsModalEl.querySelector('#carousel-container-details-admin');
          let carouselHTML = '<p class="text-muted small text-center">No images available.</p>';
          if (Array.isArray(houseData.image_urls) && houseData.image_urls.length > 0) {
            const carouselId = `carousel-admin-${houseData.id}`;
            const indicators = houseData.image_urls.map((_, index) => `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join('');
            const items = houseData.image_urls.map((url, index) => `
              <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img src="${url}" class="d-block w-100 rounded" alt="Image ${index + 1}" style="height: 300px; object-fit: cover;">
              </div>`).join('');
            carouselHTML = `
              <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">
                <div class="carousel-indicators">${indicators}</div>
                <div class="carousel-inner">${items}</div>
                <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
                <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
              </div>`;
          }
          carouselContainer.innerHTML = carouselHTML;

          // Mapa
          const mapContainer = detailsModalEl.querySelector('#detailMapAdmin');
          const mapMessage = detailsModalEl.querySelector('#map-message-details-admin');
          if (window.adminDetailMap) { window.adminDetailMap.remove(); window.adminDetailMap = null; }
          if (houseData.latitude && houseData.longitude) {
            mapContainer.style.display = 'block';
            mapMessage.textContent = '';
            window.adminDetailMap = L.map('detailMapAdmin').setView([houseData.latitude, houseData.longitude], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(window.adminDetailMap);
            L.marker([houseData.latitude, houseData.longitude]).addTo(window.adminDetailMap).bindPopup(houseData.name).openPopup();
            setTimeout(() => window.adminDetailMap.invalidateSize(), 200);
          } else {
            mapContainer.style.display = 'none';
            mapMessage.textContent = 'Location map not available.';
          }

          // Mga Detalye
          detailsModalEl.querySelector('#modalBhAddressDetails-admin').textContent = houseData.address || 'N/A';
          detailsModalEl.querySelector('#modalBhPhoneDetails-admin').textContent = houseData.owner_phone || houseData.phone_number || 'N/A';
          detailsModalEl.querySelector('#modalBhRoomsDetails-admin').textContent = houseData.available_rooms || 'N/A';
          detailsModalEl.querySelector('#modalBhBedsDetails-admin').textContent = houseData.beds_per_room || 'N/A';
          detailsModalEl.querySelector('#modalBhGenderDetails-admin').textContent = houseData.gender_allowed || 'N/A';
          detailsModalEl.querySelector('#modalBhPriceDetails-admin').textContent = (houseData.price_per_month || 0).toLocaleString();
          
          const fbLinkAdmin = detailsModalEl.querySelector('#modalBhFacebookDetails-admin');
          if (houseData.facebook_link) {
            fbLinkAdmin.innerHTML = `<p><i class="bi bi-facebook text-primary"></i> <strong>Facebook:</strong> <a href="${houseData.facebook_link}" target="_blank" rel="noopener noreferrer">View Profile</a></p>`;
            fbLinkAdmin.classList.remove('d-none');
          } else {
            fbLinkAdmin.classList.add('d-none');
          }

          // Amenities
          let amenitiesText = houseData.amenities || 'No amenities listed.';
          if (typeof amenitiesText === 'string' && amenitiesText.startsWith('[')) {
            try { amenitiesText = JSON.parse(amenitiesText).join(', '); } catch(e) { /* ignore */ }
          }
          detailsModalEl.querySelector('#modalBhAmenitiesDetails-admin').textContent = amenitiesText;

          // Terms & Regulations
          detailsModalEl.querySelector('#modalBhTermsDetails-admin').textContent = houseData.terms_and_regulations || 'No terms and regulations provided.';

          // Mga butones sa footer
          detailsModalEl.querySelector('#modalBhId-admin').value = houseData.id;
          const approveBtn = detailsModalEl.querySelector('#modalApproveBtn-admin');
          const rejectBtn = detailsModalEl.querySelector('#modalRejectBtn-admin');
          
          if (houseData.status === 'pending') {
            approveBtn.style.display = 'inline-block';
            rejectBtn.style.display = 'inline-block';
          } else {
            approveBtn.style.display = 'none';
            rejectBtn.style.display = 'none';
          }

        } else {
          alert('Could not load boarding house details. ' + (houseData.message || ''));
        }
      } catch (err) {
        console.error('Failed to fetch details:', err);
        alert('Network error while fetching details.');
        detailsModal.hide();
      }
    }
  });


  //  [BAG-O] Event listener para sa User Management
  userList.addEventListener('click', async (e) => {
    const userItem = e.target.closest('.list-group-item');
    if (!userItem) return;

    const userData = JSON.parse(userItem.dataset.userData);

    // View User Details
    if (e.target.closest('.view-user-btn')) {
      showUserDetailsModal(userData);

      // [BAG-O] Kung ang user kay "new", tawagon ang API para i-update ang status
      // ug tangtangon ang "New" badge sa UI.
      if (userData.is_new) {
        try {
          const payload = { user_id: userData.id, action: 'mark_user_viewed' };
          const res = await fetch(buildUrl('admin'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const result = await res.json();
          if (result.status === 'Success') {
            // Kung malampuson, tangtangon ang badge sa UI nga dili na mag-reload.
            const newBadgeEl = userItem.querySelector('.new-user-badge');
            if (newBadgeEl) newBadgeEl.remove();
          }
        } catch (err) {
          console.error('Failed to mark user as viewed:', err);
        }
      }
    }
    // Delete User
    else if (e.target.closest('.delete-user-btn')) {
      const { id, username } = userData;
      if (confirm(`Are you sure you want to DELETE the user "${username}" (ID: ${id})? This action cannot be undone.`)) {
        try {
          // [GI-AYO] I-point sa AdminController para sa user deletion
          const res = await fetch(buildUrl(`user?id=${id}`), { 
            method: 'DELETE',
            credentials: 'include'
          });
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          
          const result = await res.json();
          if (result.status === 'Success') {
            alert('User deleted successfully.');
            loadAllUsers(); // I-refresh ang user list human sa pag-delete
          } else {
            throw new Error(result.message || 'Failed to delete user.');
          }
        } catch (err) {
          console.error('Delete user error:', err);
          alert(`Error: ${err.message}`);
        }
      }
    }
  });

  // [BAG-O] Event listener para sa "Confirm Rejection" button sa modal
  confirmRejectBtn.addEventListener('click', async () => {
    const id = document.getElementById('rejectionBhId').value;
    const reason = document.getElementById('rejectionReason').value.trim();

    if (!reason) {
      alert('Please provide a reason for rejection.');
      return;
    }

    // Pangitaon ang original "Reject" button sa list para sa spinner
    const originalBtn = bhList.querySelector(`.reject-btn[data-id="${id}"]`);
    
    await updateStatus(id, 'rejected', reason, confirmRejectBtn);
    rejectionModal.hide();
  });

  // --- 🚀 Initial Load ---
  loadAllBoardingHouses();
  loadAllUsers();

  // [BAG-O] Event listener para sa mga butones sa sulod sa details modal
  const detailsModalEl = document.getElementById('bhDetailsModal-admin');
  if (detailsModalEl) {
    detailsModalEl.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const bhId = detailsModalEl.querySelector('#modalBhId-admin').value;

      if (button.id === 'modalApproveBtn-admin') {
        if (confirm(`Are you sure you want to APPROVE this boarding house (ID: ${bhId})?`)) {
          await updateStatus(bhId, 'approved', null, button);
          bootstrap.Modal.getInstance(detailsModalEl).hide();
        }
      } else if (button.id === 'modalRejectBtn-admin') {
        // Ipakita ang rejection modal
        document.getElementById('rejectionBhId').value = bhId;
        document.getElementById('rejectionReason').value = '';
        rejectionModal.show();
      }
    });
  }
});