// [GI-AYO] Gi-usab ang base URL para mas flexible.
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_OVERRIDE)
  ? window.API_BASE_OVERRIDE.replace(/\/$/, '')
  : 'http://localhost:8000';
const buildUrl = (path = '') => `${API_BASE}/${path.replace(/^\//, '')}`;

/**
 * Function para i-check ang login status sa user.
 */
async function checkLoginStatus() {
  try {
    const response = await fetch(buildUrl('user/session'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    const data = await response.json();
    return { isLoggedIn: data.isLoggedIn, role: data.role };
  } catch (error) {
    console.error("Error checking login status:", error);
    return { isLoggedIn: false, role: null };
  }
}

/**
 * [BAG-O] Function para i-verify ang session sa user sa dili pa i-load ang dashboard.
 * Kini ang mosulbad sa "failed to load bookings" error sa unang login.
 */
async function verifyTenantSession() {
  try {
    const response = await fetch(buildUrl('user/session'), {
      method: 'GET',
      credentials: 'include', // Importante para mapadala ang session cookie
    });
    const result = await response.json();

    // Susiha kung successful, logged in, ug ang role kay 'tenant' o 'owner' (kay pareho silang user)
    if (result.status === 'Success' && result.isLoggedIn && result.user && (result.user.role === 'tenant' || result.user.role === 'owner')) {
      // I-return ang user data kung balido ang session
      return result.user;
    } else {
      // Kung dili, itambog ang error para ma-redirect sa login page
      // [GI-USAB] Gigamit ang sessionStorage para sa pag-clear sa session data.
      sessionStorage.removeItem('currentUser');
      throw new Error(result.message || 'Invalid session for tenant.');
    }
  } catch (error) {
    console.error('Tenant session verification failed:', error);
    // I-redirect sa login page kung mapakyas ang verification
    window.location.replace('user-login.html');
    return null; // Dili na mopadayon
  }
}

/**
 * Function para mag-load sa mga boarding house.
 */
window.loadBoardingHouses = async function(filters = {}) {
  // Pangitaon ang #bh-list sa tibuok document para mugana sa index.html ug tenant-dashboard.html
  const bhList = document.querySelector("#bh-list");
  if (!bhList) {
    console.error("[DEBUG] Wala makit-an ang element nga naay ID '#bh-list'. Gihunong ang pag-load sa BH list.");
    return;
  }

  const { minPrice, maxPrice } = filters;

  bhList.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2 text-muted">Loading boarding houses...</div>`;

  let apiUrl = buildUrl('boardinghouse');
  // I-construct ang URL parameters para sa filtering
  const params = new URLSearchParams();

  if (minPrice != null && minPrice > 0) params.append('min_price', minPrice);
  if (maxPrice != null && maxPrice < 999999) params.append('max_price', maxPrice);

  if (params.toString()) {
    apiUrl += `?${params.toString()}`;
  }

  try {
    const response = await fetch(apiUrl);
    
    let data;
    try {
      data = await response.json();
    } catch (jsonParseError) {
      // If response is not valid JSON, it's a critical error
      console.error("Failed to parse JSON response:", jsonParseError);
      bhList.innerHTML = `<div class="col-12 text-center text-danger py-5"><p>Error: Server returned invalid data format.</p></div>`;
      return;
    }

    if (!response.ok) {
      // Server returned an error status (e.g., 500, 404)
      console.error("Backend error response:", data);
      let errorMessage = 'Failed to load boarding houses.';
      if (data && data.message) {
          errorMessage += ` Error: ${data.message}`;
      } else if (data && data.error) {
          errorMessage += ` Error: ${data.error}`;
      }
      bhList.innerHTML = `<div class="col-12 text-center text-danger py-5"><p>${errorMessage}</p></div>`;
      return;
    }

    // If response is OK but data is not an array (e.g., for non-existent BHs returning an object)
    if (!Array.isArray(data)) {
        console.error("Backend returned non-array data where an array was expected:", data);
        let errorMessage = 'Failed to load boarding houses: Unexpected data format from server.';
        if (data && data.message) {
            errorMessage += ` ${data.message}`;
        } else if (data && data.error) {
            errorMessage += ` ${data.error}`;
        }
        bhList.innerHTML = `<div class="col-12 text-center text-danger py-5"><p>${errorMessage}</p></div>`;
        return;
    }

    if (data.length === 0) {
      // Mas specific nga mensahe kung walay makit-an
      let message = '';
      const hasPriceFilter = (minPrice != null && minPrice > 0) || (maxPrice != null && maxPrice < 999999);

      if (hasPriceFilter) {
        const formattedMin = `₱${parseInt(minPrice, 10).toLocaleString()}`;
        if (maxPrice < 999999) {
          const formattedMax = `₱${parseInt(maxPrice, 10).toLocaleString()}`;
          message = `No boarding houses found in the price range of <strong>${formattedMin} - ${formattedMax}</strong>.`;
        } else {
          message = `No boarding houses found with a price of <strong>${formattedMin}</strong> or more.`;
        }
      } else {
        message = 'No available boarding houses found at the moment.';
      }
      bhList.innerHTML = `<div class="col-12 text-center text-muted py-5"><p>${message}</p></div>`;
      return;
    }

    bhList.innerHTML = "";

    data.forEach(house => {
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4 mb-4";
      const firstImage = (Array.isArray(house.image_urls) && house.image_urls.length > 0 && house.image_urls[0])
        ? house.image_urls[0]
        : 'images/sample-bh.jpg';

      col.innerHTML = `
        <div class="card h-100">
          <img src="${firstImage}" class="card-img-top" alt="${house.name}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${house.name}</h5>
            <p class="card-text text-muted small mb-2"><i class="bi bi-geo-alt-fill"></i> ${house.address || 'Dapitan City'}</p>
            <div class="mt-auto">
              <p class="card-text h5 fw-bold text-primary mb-3">
                ₱${(house.price_per_month || 'N/A').toLocaleString()}
                <span class="fw-normal fs-6 text-muted">/month</span>
              </p>
              <button class="btn btn-outline-primary w-100 view-details-btn" data-bh-id="${house.id || ''}">View Details</button>
            </div>
          </div>
        </div>
      `;
      bhList.appendChild(col);
    });
  } catch (err) {
    console.error("Network or unexpected error loading boarding houses:", err);
    bhList.innerHTML = `<div class="col-12 text-center text-danger py-5"><p>Failed to load boarding houses. Please check your internet connection.</p></div>`;
  }
}

/**
 * [GI-ORGANISAR] Function para sa tanang logic sa Tenant Dashboard.
 */
async function initializeTenantDashboard() {
  console.log("[DEBUG] Nagsugod ang initializeTenantDashboard().");

  // --- 🔑 [BAG-O] Authentication Check ---
  const user = await verifyTenantSession();
  if (!user) return; // Hunongon ang script kung mapakyas ang verification

  const detailModalInstance = new bootstrap.Modal(document.getElementById('bhDetailModal'));

  // [BAG-O] I-handle ang "Book Now" button click dinhi para sa tenant dashboard
  const bookNowBtn = document.getElementById('bookNowBtn');
  if (bookNowBtn) {
    bookNowBtn.addEventListener('click', async () => {
      const agreeTermsCheck = document.getElementById('agreeTermsCheck');
      // [BAG-O] Susiha kung gi-check ba ang terms and regulations
      if (!agreeTermsCheck.checked) {
        alert('please read and check the terms and regulations first.');
        return;
      }

      const bhId = bookNowBtn.dataset.bhId;
      if (!bhId) {
        alert('Error: Boarding House ID not found.');
        return;
      }

      if (!confirm('Are you sure you want to book this boarding house? This will reserve your slot for 3 days.')) {
        return;
      }

      // [GI-AYO] I-disable ang button ug magpakita og spinner para malikayan ang dobleng pag-klik.
      const originalBtnHTML = bookNowBtn.innerHTML;
      bookNowBtn.disabled = true;
      bookNowBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Booking...`;

      try {
        const res = await fetch(buildUrl('booking'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ bh_id: bhId })
        });

        // [GI-AYO] I-check una kung successful ang HTTP response (e.g., 200 OK).
        // Kung dili (e.g., 500 Internal Server Error), i-handle dayon ang error.
        if (!res.ok) {
          // Sulayan pagkuha og error message gikan sa server, kung naa man.
          const errorData = await res.json().catch(() => ({ message: `Server responded with status: ${res.status}` }));
          throw new Error(errorData.message || `HTTP error! Status: ${res.status}`);
        }

        const result = await res.json();

        if (result.status === 'Success') {
          alert('Booking successful! Your reservation is valid for 3 days. Please check "My Bookings" for details.');
          detailModalInstance.hide();
          loadTenantBookings(); // [GI-AYO] I-refresh ang booking list human sa successful booking.
        } else {
          throw new Error(result.message || 'Failed to create booking.');
        }
      } catch (err) {
        console.error('Booking error:', err);
        alert(`Booking Failed: ${err.message}`);
      } finally {
        bookNowBtn.disabled = false;
        bookNowBtn.innerHTML = originalBtnHTML;
      }
    });
  }

  const nameEl = document.getElementById('tenantName');
    const adminNameEl = document.getElementById('adminName');
    const logoutBtn = document.getElementById('logoutBtn');

    const targetNameEl = nameEl || adminNameEl;

    // [GI-AYO] Gamiton ang user object gikan sa session verification imbis sa localStorage
    if (targetNameEl) {
        targetNameEl.textContent = user.full_name || user.username || 'Tenant';
    }

    if (logoutBtn) {
      // [GI-AYO] I-implementar ang saktong logout process pinaagi sa pagtawag sa server.
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // Pugngan ang default behavior sa link/button
        try {
          const response = await fetch(buildUrl('user?action=logout'), {
            method: 'DELETE',
            credentials: 'include' // Importante para ma-apil ang session cookie
          });
          const result = await response.json();
          // Dili na kinahanglan i-check ang result.status, basta mo-proceed ta sa finally block.
        } catch (error) {
          console.error('Error during server logout:', error);
        } finally {
          // [SAKTONG PAG-AYO] Ibutang ang cleanup ug redirection sa sulod sa 'finally' block.
          // Kini ang mosiguro nga kanunay kining mo-dagan, bisan unsa pay mahitabo sa 'try' block.
          // [GI-USAB] Gigamit ang sessionStorage para sa pag-clear sa session data.
          sessionStorage.removeItem('currentUser');
          window.location.href = 'index.html';
        }
      });
    }

  // I-initialize ang mapa
  initializeTenantMap();


  // I-load ang BH list ug i-setup ang search para sa tenant dashboard.
  const bhListWrapper = document.getElementById('tenant-bh-list-wrapper');
  const detailModalEl = document.getElementById('bhDetailModal');

    if (bhListWrapper && detailModalEl) {
      let detailMap = null; // Variable para sa mapa sulod sa modal

      // [GI-AYO] I-attach ang event listener sa modal para i-handle ang mapa.
      // Kini ang mosiguro nga ang mapa mo-render sa saktong paagi human hingpit nga mapakita ang modal.
      detailModalEl.addEventListener('shown.bs.modal', () => {
        if (detailMap) {
          detailMap.invalidateSize();
        }
      });

      // [BAG-O] I-reset ang "agree to terms" checkbox inig close sa modal
      detailModalEl.addEventListener('hidden.bs.modal', () => {
        const agreeTermsCheck = document.getElementById('agreeTermsCheck');
        if (agreeTermsCheck) {
          agreeTermsCheck.checked = false;
        }
      });

      // [BAG-O] Image viewer modal logic
      const imageViewerModalEl = document.getElementById('imageViewerModal');
      const imageViewerModal = imageViewerModalEl ? new bootstrap.Modal(imageViewerModalEl) : null;
      const fullImageView = document.getElementById('fullImageView');

      bhListWrapper.addEventListener('click', async (e) => {
        const viewButton = e.target.closest('.view-details-btn');
        if (!viewButton) return;

        e.preventDefault();
        const bhId = viewButton.dataset.bhId;
        if (!bhId) {
          console.error("View details button walay 'data-bh-id'.");
          return;
        }

        // Ipakita ang modal ug i-set ang title sa "Loading..."
        document.getElementById('bhDetailModalLabel').textContent = 'Loading Details...';
        detailModalInstance.show();

        try {
          // Gamiton ang `view=tenant` para masiguro nga makuha ang saktong data
          const res = await fetch(buildUrl(`boardinghouse?id=${bhId}&view=tenant`));
          if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
          const house = await res.json();

          if (!house) throw new Error('Boarding house not found.');

          // I-populate ang modal sa tenant-dashboard.html
          document.getElementById('bhDetailModalLabel').textContent = house.name || 'Boarding House Details';
          document.getElementById('bhDetailAddress').textContent = house.address || 'N/A';
          document.getElementById('bhDetailRooms').textContent = house.available_rooms || 'N/A';

          // [BAG-O] I-set ang bh_id sa book now button
          const bookNowBtn = document.getElementById('bookNowBtn');
          bookNowBtn.dataset.bhId = house.id;
          document.getElementById('bhDetailGender').textContent = house.gender_allowed || 'N/A';
          document.getElementById('bhDetailBeds').textContent = house.beds_per_room || 'N/A';
          document.getElementById('bhDetailPrice').textContent = `₱${(house.price_per_month || 0).toLocaleString()}`;
          document.getElementById('bhDetailPhone').textContent = house.owner_phone || house.phone_number || 'Not provided.';
          const facebookEl = document.getElementById('bhDetailFacebook');
          const websiteEl = document.getElementById('bhDetailWebsite');

          if (facebookEl) {
            facebookEl.innerHTML = house.facebook_link 
              ? `<i class="bi bi-facebook text-primary me-2"></i><strong>Facebook:</strong> <a href="${house.facebook_link}" target="_blank" rel="noopener noreferrer">View Profile/Page</a>` 
              : '';
          }
          if (websiteEl) {
            websiteEl.innerHTML = house.website_link 
              ? `<i class="bi bi-globe me-2"></i><strong>Website:</strong> <a href="${house.website_link}" target="_blank" rel="noopener noreferrer">Visit Website</a>` 
              : '';
          }

          let amenities = house.amenities || 'No details provided.';
          if (typeof amenities === 'string' && amenities.startsWith('[')) {
            try { amenities = JSON.parse(amenities).join(', '); } catch (e) { /* ignore parse error */ }
          } else if (Array.isArray(amenities)) {
            amenities = amenities.join(', ');
          }
          document.getElementById('bhDetailAmenities').textContent = amenities;

          // [BAG-O] I-populate ang terms and regulations
          const termsEl = document.getElementById('bhDetailTerms');
          if (termsEl) {
            termsEl.textContent = house.terms_and_regulations || 'No terms and regulations provided.';
          }

          // I-populate ang image carousel
          const carouselContainer = document.getElementById('bhDetailCarousel');
          carouselContainer.innerHTML = ''; // Limpyohan daan
          if (Array.isArray(house.image_urls) && house.image_urls.length > 0) {
            const carouselId = `carousel-bh-tenant-${house.id}`;
            const indicators = house.image_urls.map((_, index) => `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join('');
            const items = house.image_urls.map((url, index) => `
              <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img src="${url}" class="d-block w-100 rounded" alt="Image ${index + 1}" style="height: 300px; object-fit: cover;">
              </div>`).join('');
            carouselContainer.innerHTML = `
              <div id="${carouselId}" class="carousel slide mb-3" data-bs-ride="carousel">
                <div class="carousel-indicators">${indicators}</div>
                <div class="carousel-inner">${items}</div>
                <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
                <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
              </div>`;
          } else {
            carouselContainer.innerHTML = '<p class="text-muted small">No images available.</p>';
          }

          // I-handle ang mapa sa modal
          const mapContainer = document.getElementById('bhDetailMap');
          const mapMessage = document.getElementById('map-message-details');
          if (detailMap) { detailMap.remove(); detailMap = null; }

          if (house.latitude && house.longitude) {
            mapContainer.style.display = 'block';
            if (mapMessage) mapMessage.textContent = '';
            detailMap = L.map('bhDetailMap').setView([house.latitude, house.longitude], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);
            L.marker([house.latitude, house.longitude]).addTo(detailMap).bindPopup(house.name).openPopup();
          } else {
            mapContainer.style.display = 'none';
            if (mapMessage) mapMessage.textContent = 'Location map not available.';
          }

          // [GI-DUGANG] I-handle ang "View Room Rates" button
          const viewRatesBtn = document.getElementById('viewRoomRatesBtn');
          const ratesCollapseEl = document.getElementById('roomRatesCollapse');
          const ratesContainer = document.getElementById('roomRatesContainer');
          
          // I-reset ang collapse para sa bag-ong data
          const bsCollapse = bootstrap.Collapse.getInstance(ratesCollapseEl) || new bootstrap.Collapse(ratesCollapseEl, { toggle: false });
          bsCollapse.hide();
          ratesContainer.innerHTML = ''; // Limpyohan ang sulod

          // I-clone ang button para malikayan ang multiple listeners
          const newViewRatesBtn = viewRatesBtn.cloneNode(true);
          viewRatesBtn.parentNode.replaceChild(newViewRatesBtn, viewRatesBtn);

          // [GI-AYO] I-implementar ang logic para sa "View Room Rates" button
          newViewRatesBtn.addEventListener('click', async () => {
            if (ratesCollapseEl.classList.contains('show')) {
              bsCollapse.hide();
              return;
            }
            ratesContainer.innerHTML = '<p class="text-muted p-2">Loading room rates...</p>';
            bsCollapse.show();
            
            try {
              // Ang 'house' object gikan sa unang fetch naa nay room details tungod sa `view=tenant`
              const rooms = house.rooms || house.room_details || [];

              if (!rooms || rooms.length === 0) {
                ratesContainer.innerHTML = '<p class="text-muted p-2">No specific room rates available for this boarding house.</p>';
              } else {
                ratesContainer.innerHTML = ''; // Limpyohan para sa bag-ong data
                rooms.forEach(room => {
                  const price = (room.price_per_month || room.price || 0).toLocaleString();
                  const name = room.name || room.room_name || 'Room';
                  const description = room.description || 'No description.';
                  
                  // I-proseso ang mga hulagway sa kwarto para sa thumbnails
                  const imageUrls = Array.isArray(room.image_urls) ? room.image_urls.filter(Boolean) : [];
                  const thumbs = imageUrls.length > 0
                    ? `<div class="d-flex flex-wrap gap-2 mt-2">
                        ${imageUrls.slice(0, 6).map(url => `<img src="${url}" alt="${name} image" class="room-thumbnail" style="width:96px; height:72px; object-fit:cover; border-radius:6px; cursor:pointer;">`).join('')}
                       </div>`
                    : '';

                  const roomItem = document.createElement('div');
                  roomItem.className = 'list-group-item';
                  roomItem.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 class="mb-1"><strong>${name}</strong></h6>
                        <small class="text-muted">${description}</small>
                      </div>
                      <span class="text-primary fw-semibold ms-3">₱${price}</span>
                    </div>
                    ${thumbs}
                  `;
                  ratesContainer.appendChild(roomItem);
                });
              }
            } catch (err) {
              console.error('Failed to display room rates:', err);
              ratesContainer.innerHTML = '<p class="text-danger p-2">Error loading room rates.</p>';
            }
          });

          // [BAG-O] Event listener para sa pag-klik sa thumbnail sa kwarto
          ratesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('room-thumbnail') && imageViewerModal && fullImageView) {
              fullImageView.src = e.target.src;
              imageViewerModal.show();
            }
          });

        } catch (err) {
          console.error('Failed to fetch BH details for tenant dashboard:', err);
          alert('Could not load boarding house details. Please try again.');
          detailModalInstance.hide();
        }
      });
    }

    // I-setup ang search para sa price range filter buttons.
    setupSearch();
    // [BAG-O] Tawagon ang function para i-load ang bookings sa tenant
    loadTenantBookings();
    loadBoardingHouses();
}

/**
 * [BAG-O] Function para i-load ang bookings sa tenant
 */
async function loadTenantBookings() {
  const container = document.getElementById('my-bookings-container');
  const spinner = document.getElementById('booking-spinner');
  if (!container || !spinner) return;

  spinner.classList.remove('d-none');
  container.innerHTML = '<p class="text-muted">Loading your bookings...</p>';

  try {
    const res = await fetch(buildUrl('booking?view=tenant'), { credentials: 'include' });

    // [GI-AYO] I-check una kung successful ba ang response sa dili pa i-parse ang JSON.
    if (!res.ok) {
      // [GI-AYO] I-log ang raw text response gikan sa server para sa mas lawom nga debugging.
      // Kini ang mokuha sa HTML error page kung mao man ang gipadala sa server.
      const rawErrorText = await res.text();
      console.groupCollapsed(`%c[DEBUG] Server Error Details (Status: ${res.status})`, 'color: red; font-weight: bold;');
      console.log('Raw Server Response:', rawErrorText);
      console.groupEnd();

      let errorMessage = `Server Error (Status ${res.status})`;
      try {
        const errorJson = JSON.parse(rawErrorText);
        errorMessage += `: ${errorJson.message || 'No specific message.'}`;
      } catch (e) {
        errorMessage += '. Failed to parse server response as JSON. Check the raw response above for details (it might be an HTML error page).';
      }
      throw new Error(errorMessage);
    }

    const bookings = await res.json();

    if (!Array.isArray(bookings) || bookings.length === 0) {
      container.innerHTML = '<p class="text-muted">You have no active bookings.</p>';
      return;
    }

    container.innerHTML = '';
    bookings.forEach(booking => {
      const expiryDate = new Date(booking.expiry_date);
      const isExpired = new Date() > expiryDate;
      
      // [GI-AYO] I-update ang logic para sa status badge para mahimong yellow ang 'pending'.
      let statusBadge;
      if (isExpired && booking.status !== 'approved' && booking.status !== 'cancelled') {
        statusBadge = '<span class="badge bg-danger">Expired</span>';
      } else if (booking.status === 'pending') {
        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
      } else {
        const statusColors = { approved: 'bg-success', rejected: 'bg-secondary', cancelled: 'bg-dark' };
        statusBadge = `<span class="badge ${statusColors[booking.status] || 'bg-info'}">${booking.status}</span>`;
      }

      // [GI-AYO] I-usab ang logic para sa action button.
      let actionButton = '';
      if (isExpired || booking.status === 'cancelled' || booking.status === 'rejected') {
        actionButton = `<button class="btn btn-sm btn-outline-secondary mt-2 remove-booking-btn" data-booking-id="${booking.id}">Remove</button>`;
      } else if (booking.status === 'pending' || booking.status === 'approved') {
        actionButton = `<button class="btn btn-sm btn-outline-danger mt-2 cancel-booking-btn" data-booking-id="${booking.id}">Cancel Booking</button>`;
      }

      const bookingCard = document.createElement('div');
      bookingCard.className = 'card mb-3';
      bookingCard.innerHTML = `
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <div>
                <h5 class="card-title mb-1">${booking.bh_name}</h5>
                <p class="card-text small text-muted mb-1">Booked on: ${new Date(booking.booking_date).toLocaleDateString()}</p>
                <p class="card-text small text-muted">Expires on: <strong>${expiryDate.toLocaleString()}</strong></p>
              </div>
              <div class="text-end d-flex flex-column align-items-end">
                ${statusBadge}
                <p class="h5 fw-bold text-primary mt-2">₱${Number(booking.price_per_month).toLocaleString()}</p>
              </div>
            </div>
          </div>
        `;
      container.appendChild(bookingCard);

      // [BAG-O] Ibutang ang cancel button sa lahi nga column para sa layout
      if (actionButton) {
        bookingCard.querySelector('.card-body > .d-flex').insertAdjacentHTML('beforeend', `<div class="ms-3 d-flex align-items-center">${actionButton}</div>`);
      }
    });
  } catch (err) {
    console.error('Failed to load bookings:', err);
    // [GI-AYO] Magpakita og "Retry" button para sa mas maayo nga user experience kung naay error.
    container.innerHTML = `
      <div class="text-center text-danger">
        <p class="fw-bold">Failed to load your bookings.</p>
        <p class="small fst-italic">
          Error: ${err.message.replace('Server Error (Status 500):', '').trim()}
        </p>
        <button class="btn btn-sm btn-primary" onclick="loadTenantBookings()">Retry</button>
      </div>`;
  } finally {
    spinner.classList.add('d-none');
  }

  // [BAG-O] Event listener para sa cancel button (gamit ang event delegation)
  container.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('cancel-booking-btn') && !e.target.classList.contains('remove-booking-btn')) {
      return;
    }

    const button = e.target;
    const bookingId = button.dataset.bookingId;

    const isRemoving = button.classList.contains('remove-booking-btn');
    const confirmMessage = isRemoving
      ? 'Are you sure you want to remove this from your list?'
      : 'Are you sure you want to cancel this booking?';

    if (!confirm(confirmMessage)) {
      return;
    }

    // I-disable ang button ug magpakita og spinner
    button.disabled = true;
    const originalText = button.textContent;
    button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;

    try {
      const res = await fetch(buildUrl(`booking?id=${bookingId}&action=${isRemoving ? 'remove' : 'cancel'}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      const result = await res.json();
      if (!res.ok || result.status !== 'Success') {
        throw new Error(result.message || 'Failed to cancel booking.');
      }

      alert(isRemoving ? 'Booking removed from list.' : 'Booking cancelled successfully!');
      loadTenantBookings(); // I-refresh ang listahan

    } catch (err) {
      alert(`Error: ${err.message}`);
      button.disabled = false; // I-enable balik ang button kung naay error
      button.textContent = originalText;
    }
  });
}

/**
 * [GI-ORGANISAR] Function para sa tanang logic sa Home Page (index.html).
 */
function initializeHomePage() {
  // [GI-AYO] Gi-usab ang selector para sa bh-list-container para mas mo-match sa index.html
  const bhListContainer = document.getElementById("bh-list-container");
  const detailModalEl = document.getElementById('bhDetailModal'); // Modal sa index.html

  if (bhListContainer && detailModalEl) {
    console.log("[DEBUG] Naa sa Home Page. I-setup ang 'View Details' button logic.");

    const detailModal = new bootstrap.Modal(detailModalEl);
    const loginRequiredModalEl = document.getElementById('loginRequiredModal');
    const loginRequiredModal = loginRequiredModalEl ? new bootstrap.Modal(loginRequiredModalEl) : null;
    let detailMap = null; // Variable para sa mapa sulod sa modal

    // [BAG-O] Logic para sa "Book Now" button sa Home Page
    const homeBookNowBtn = document.getElementById('homeBookNowBtn');
    if (homeBookNowBtn) {
      homeBookNowBtn.addEventListener('click', async () => {
        const loginState = await checkLoginStatus();
        if (!loginState.isLoggedIn) {
          if (loginRequiredModal) {
            // Update message to specific booking requirement
            const modalBody = loginRequiredModal._element.querySelector('.modal-body p');
            if (modalBody) modalBody.textContent = 'You need to sign up or log in first before you can book.';
            loginRequiredModal.show();
          } else {
            alert('You need to sign up or login first before you can book.');
          }
        } else {
          // Kung naka-login, i-redirect sa dashboard (kay didto ang booking logic)
          if (loginState.role === 'tenant') {
            window.location.href = 'tenant-dashboard.html';
          } else {
            alert('Only tenants can book boarding houses.');
          }
        }
      });
    }

    // Gamiton ang event delegation sa container
    bhListContainer.addEventListener('click', async (e) => {
      const viewButton = e.target.closest('.view-details-btn');
      if (!viewButton) return;

      e.preventDefault();


      // Kung naka-login, padayon sa pagpakita sa details
      const bhId = viewButton.dataset.bhId;
      if (!bhId) {
        console.error("View details button walay 'data-bh-id'.");
        return;
      }

      // Ipakita ang modal ug i-set ang title sa "Loading..."
      document.getElementById('bhDetailModalLabel').textContent = 'Loading Details...';
      detailModal.show();

      try {
        const res = await fetch(buildUrl(`boardinghouse?id=${bhId}`));
        if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
        const house = await res.json();

        if (!house) throw new Error('Boarding house not found.');

        // I-populate ang modal sa index.html
        document.getElementById('bhDetailModalLabel').textContent = house.name || 'Boarding House Details';
        document.getElementById('bhDetailName').textContent = house.name || 'N/A';
        document.getElementById('bhDetailAddress').textContent = house.address || 'N/A';
        document.getElementById('bhDetailPrice').textContent = `₱${(house.price_per_month || 0).toLocaleString()} / month`;
        
        let amenities = house.amenities || 'No details provided.';
        if (typeof amenities === 'string' && amenities.startsWith('[')) {
          try { amenities = JSON.parse(amenities).join(', '); } catch (e) { /* ignore parse error */ }
        } else if (Array.isArray(amenities)) {
          amenities = amenities.join(', ');
        }
        document.getElementById('bhDetailAmenities').textContent = amenities;

        // [BAG-O] I-populate ang terms and regulations
        const termsEl = document.getElementById('bhDetailTerms');
        if (termsEl) {
          termsEl.textContent = house.terms_and_regulations || 'No terms and regulations provided.';
        }

        document.getElementById('bhDetailRooms').textContent = house.available_rooms || 'N/A';
        document.getElementById('bhDetailBeds').textContent = house.beds_per_room || 'N/A';
        document.getElementById('bhDetailGender').textContent = house.gender_allowed || 'N/A';
        document.getElementById('bhDetailPhone').textContent = house.owner_phone || house.phone_number || 'Not provided.';

        // I-populate ang image carousel
        const carouselContainer = document.getElementById('bhDetailCarousel');
        carouselContainer.innerHTML = ''; // Limpyohan daan
        if (Array.isArray(house.image_urls) && house.image_urls.length > 0) {
          const carouselId = `carousel-bh-home-${house.id}`;
          const indicators = house.image_urls.map((_, index) => `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join('');
          const items = house.image_urls.map((url, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${url}" class="d-block w-100 rounded" alt="Image ${index + 1}" style="height: 300px; object-fit: cover;">
            </div>`).join('');
          
          carouselContainer.innerHTML = `
            <div id="${carouselId}" class="carousel slide mb-3" data-bs-ride="carousel">
              <div class="carousel-indicators">${indicators}</div>
              <div class="carousel-inner">${items}</div>
              <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
              <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
            </div>`;
        } else {
          carouselContainer.innerHTML = '<p class="text-muted small">No images available.</p>';
        }

        // I-handle ang mapa sa modal
        const mapContainer = document.getElementById('bhDetailMap');
        if (detailMap) { detailMap.remove(); detailMap = null; }

        if (house.latitude && house.longitude) {
          mapContainer.style.display = 'block';
          detailMap = L.map('bhDetailMap').setView([house.latitude, house.longitude], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);
          L.marker([house.latitude, house.longitude]).addTo(detailMap).bindPopup(house.name).openPopup();
          // I-refresh ang size sa mapa human mapakita ang modal
          setTimeout(() => detailMap.invalidateSize(), 10);
        } else {
          mapContainer.innerHTML = '<p class="text-muted text-center">Location map not available.</p>';
        }

      } catch (err) {
        console.error('Failed to fetch BH details for index page:', err);
        alert('Could not load boarding house details. Please try again.');
        detailModal.hide();
      }
    });
    /*
    const detailModal = new bootstrap.Modal(detailModalEl);
    
    const loginRequiredModalEl = document.getElementById('loginRequiredModal');
    const loginRequiredModal = loginRequiredModalEl ? new bootstrap.Modal(loginRequiredModalEl) : null;

    const imageViewerModalEl = document.getElementById('imageViewerModal');
    let imageViewerModal = null;
    if (imageViewerModalEl) {
      imageViewerModal = new bootstrap.Modal(imageViewerModalEl);
    }
    let detailMap = null;

    bhListContainer.addEventListener('click', async (e) => {
      const viewButton = e.target.closest('.view-details-btn');
      if (!viewButton) return;

      e.preventDefault();

      // Susiha kung naka-login ba ang user
      const loginState = await checkLoginStatus();
      if (!loginState.isLoggedIn && loginRequiredModal) {
        const signupBtn = loginRequiredModal._element.querySelector('.btn-primary');
        if (signupBtn) signupBtn.href = 'user-signup.html'; // I-set ang link sa signup
        loginRequiredModal.show();
        return;
      }

      const bhId = viewButton.dataset.bhId;
      if (!bhId) return;

      document.getElementById('bhDetailModalLabel').textContent = 'Loading...';
      detailModal.show(viewButton);

      try {
        const res = await fetch(buildUrl(`boardinghouse?id=${bhId}`));
        const house = await res.json();

        if (!house) throw new Error('Boarding house not found.');

        // I-populate ang modal
        document.getElementById('bhDetailModalLabel').textContent = house.name;
        document.getElementById('bhDetailAddress').textContent = house.address;
        document.getElementById('bhDetailPrice').textContent = `₱${(house.price_per_month || 0).toLocaleString()}`;
        
        let amenities = house.amenities || 'No details provided.';
        if(typeof amenities === 'string' && amenities.startsWith('[')) {
          try { amenities = JSON.parse(amenities).join(', '); } catch (e) {}
        } else if(Array.isArray(amenities)) {
          amenities = amenities.join(', ');
        }
        document.getElementById('bhDetailAmenities').textContent = amenities;

        // [BAG-O] I-populate ang terms and regulations
        const termsEl = document.getElementById('bhDetailTerms');
        if (termsEl) {
          termsEl.textContent = house.terms_and_regulations || 'No terms and regulations provided.';
        }

        document.getElementById('bhDetailRooms').textContent = house.available_rooms || 'N/A';
        document.getElementById('bhDetailBeds').textContent = house.beds_per_room || 'N/A';
        document.getElementById('bhDetailGender').textContent = house.gender_allowed || 'N/A';
        document.getElementById('bhDetailPhone').textContent = house.owner_phone || house.phone_number || 'Not provided.';

        // I-populate ang image carousel
        const carouselContainer = document.getElementById('bhDetailCarousel');
        carouselContainer.innerHTML = ''; // Limpyohan daan
        if (Array.isArray(house.image_urls) && house.image_urls.length > 0) {
          const carouselId = `carousel-bh-${house.id}`;
          const indicators = house.image_urls.map((_, index) => `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}"></button>`).join('');
          const items = house.image_urls.map((url, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${url}" class="d-block w-100 rounded" alt="Image ${index + 1}" style="height: 300px; object-fit: cover;">
            </div>
          `).join('');
          
          carouselContainer.innerHTML = `
            <div id="${carouselId}" class="carousel slide mb-3" data-bs-ride="carousel">
              <div class="carousel-indicators">${indicators}</div>
              <div class="carousel-inner">${items}</div>
              <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
              <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
            </div>
          `;
        } else {
          carouselContainer.innerHTML = '<p class="text-muted small">No images available.</p>';
        }

        // I-handle ang mapa sa modal
        const mapContainer = document.getElementById('bhDetailMap');
        const mapMessage = document.getElementById('map-message-details');
        if (detailMap) { detailMap.remove(); detailMap = null; }

        if (house.latitude && house.longitude) {
          mapContainer.style.display = 'block';
          if (mapMessage) mapMessage.textContent = '';
          detailMap = L.map('bhDetailMap').setView([house.latitude, house.longitude], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);
          L.marker([house.latitude, house.longitude]).addTo(detailMap).bindPopup(house.name).openPopup();
          setTimeout(() => detailMap.invalidateSize(), 10);
        } else {
          mapContainer.style.display = 'none';
          if (mapMessage) mapMessage.textContent = 'Location map not available.';
        }

        // I-handle ang "View Room Rates" button
        const viewRatesBtn = document.getElementById('viewRoomRatesBtn');
        const ratesCollapseEl = document.getElementById('roomRatesCollapse');
        const ratesContainer = document.getElementById('roomRatesContainer');
        
        if (viewRatesBtn && ratesCollapseEl && ratesContainer) {
          const bsCollapse = bootstrap.Collapse.getInstance(ratesCollapseEl) || new bootstrap.Collapse(ratesCollapseEl, { toggle: false });
          bsCollapse.hide();

          const newViewRatesBtn = viewRatesBtn.cloneNode(true);
          viewRatesBtn.parentNode.replaceChild(newViewRatesBtn, viewRatesBtn);

          newViewRatesBtn.addEventListener('click', async () => {
            if (ratesCollapseEl.classList.contains('show')) {
              bsCollapse.hide();
              return;
            }
            ratesContainer.innerHTML = '<p class="text-muted">Loading room rates...</p>';
            bsCollapse.show();
            
            const roomRes = await fetch(buildUrl(`boardinghouse?id=${bhId}`), { credentials: 'include' });
            const bhDataWithRooms = await roomRes.json();
            const rooms = bhDataWithRooms.rooms || bhDataWithRooms.room_details || [];

            if (Array.isArray(rooms) && rooms.length > 0) {
              ratesContainer.innerHTML = '';
              rooms.forEach(room => {
                const imageUrls = Array.isArray(room.image_urls) ? room.image_urls.filter(Boolean) : [];
                const thumbs = imageUrls.length
                  ? `<div class="d-flex flex-wrap gap-2 mb-2">
                      ${imageUrls.slice(0, 6).map(url => `<img src="${url}" alt="${room.name || 'Room'} image" class="room-thumbnail" style="width:96px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer;">`).join('')}
                     </div>`
                  : '';

                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.innerHTML = `
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>${room.name || 'Room'}</strong>
                      <div class="text-muted small">${room.description || ''}</div>
                    </div>
                    <span class="text-primary fw-semibold ms-3">₱${(room.price_per_month || 0).toLocaleString()}</span>
                  </div>
                  ${thumbs}
                `;
                ratesContainer.appendChild(item);
              });
            } else {
              ratesContainer.innerHTML = '<p class="text-muted">No specific room rates available.</p>';
            }
          });

          // Event listener para sa pag-click sa thumbnail sa kwarto
          ratesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('room-thumbnail') && imageViewerModal) {
              const fullImageView = document.getElementById('fullImageView');
              if (fullImageView) {
                fullImageView.src = e.target.src;
                imageViewerModal.show();
              }
            }
          });
        }

      } catch (err) {
        console.error('Failed to fetch BH details:', err);
        alert('Could not load boarding house details. Please try again.');
      }
    });
    */
  }

  if (document.querySelector('.price-range-btn')) {
    setupSearch();
    loadBoardingHouses();
  }
}

/**
 * [GI-AYO] Gibalhin ang setupSearch sa gawas para ma-access sa tanang functions.
 * Function para sa pag-setup sa search/filter buttons.
 */
function setupSearch() {
  let currentFilters = {};
  const priceRangeButtons = document.querySelectorAll('.price-range-btn');
  
  priceRangeButtons.forEach(button => {
    button.addEventListener('click', () => {
      priceRangeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const min = button.dataset.min;
      const max = button.dataset.max;

      currentFilters.minPrice = min;
      currentFilters.maxPrice = max;

      loadBoardingHouses(currentFilters);
    });
  });

  const allButton = document.querySelector('.price-range-btn[data-min="0"]');
  if (allButton) allButton.classList.add('active');
}

/**
 * [GI-ORGANISAR] Function para sa tanang logic sa Full-Screen Map sa Tenant Dashboard.
 */
function initializeTenantMap() {
  console.log('[LOG] initializeTenantMap: Nagsugod ang function.');
  const listView = document.getElementById('list-view-container');
  const mapView = document.getElementById('map-view');
  const mapViewBtn = document.getElementById('mapViewBtn');
  const backToListBtn = document.getElementById('backToListBtn');
  const findMeBtn = document.getElementById('findMeBtn');

  console.log('[LOG] Nag-check kung naa ba ang mga elements sa page...');
  if (!listView || !mapView || !mapViewBtn) {
    console.log('[LOG] Wala makit-i ang mga gikinahanglan nga elements (listView, mapView, mapViewBtn). Gihunong ang map logic.');
    return;
  }
  console.log('[LOG] Nakit-an ang mga elements. Nagpadayon...');

  let map = null;
  let userMarker = null;
  // [GI-AYO] Gamiton ang MarkerClusterGroup imbis nga LayerGroup para i-handle ang mga nagpatong nga markers.
  let bhMarkersLayer = L.markerClusterGroup();

  // [GI-USAB] Function para i-initialize ang mapa. Tawagon ra ni kung i-klik ang button.
  const initializeMap = () => {
      console.log('[LOG] initializeMap: Gitawag ang function.');
  
      // Kung naa nay mapa, i-refresh lang.
      if (map) {
          console.log('[LOG] Naa nay mapa. I-invalidate ang size.');
          map.invalidateSize();
          return;
      }
  
      // Kung wala pay mapa, i-create.
      try {
          const mapContainer = document.getElementById('full-map-container');
          const containerWidth = mapContainer.offsetWidth;
          const containerHeight = mapContainer.offsetHeight;
          console.log(`[LOG] Pagsukod sa container: Width=${containerWidth}px, Height=${containerHeight}px`);
  
          if (containerWidth === 0 || containerHeight === 0) {
              console.error('[ERROR] Ang map container naay 0px nga gidak-on. Dili ma-initialize ang mapa.');
              alert('Error: Could not display the map. Please check for CSS conflicts.');
              return;
          }
  
          console.log('[LOG] Wala pay mapa. Mag-create og bag-o.');
          map = L.map('full-map-container').setView([8.593, 123.422], 14);
          console.log('[LOG] Malampuson nga na-create ang Leaflet map object.');
  
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(map);
          bhMarkersLayer.addTo(map);
          loadBoardingHousesOnMap();
  
      } catch (error) {
          console.error('[ERROR] Naay error sa pag-create sa mapa!', error);
      }
  };

  const loadBoardingHousesOnMap = async () => {
    console.log('[LOG] loadBoardingHousesOnMap: Nagsugod pag-fetch sa data sa mga boarding house para sa mapa.');
    // [GI-AYO] Gi-update ang coordinates para sa Jose Rizal Memorial State University Dapitan para sa pinakasakto nga distansya.
    const jrmsuMainCampusCoords = L.latLng(8.65639, 123.42278);

    try {
        const response = await fetch(buildUrl('boardinghouse?view=map'));
        if (!response.ok) throw new Error('Failed to fetch boarding houses');
        
        const boardingHouses = await response.json();
        bhMarkersLayer.clearLayers(); // Limpyohan ang daan nga markers

        console.log(`[LOG] loadBoardingHousesOnMap: Nakakuha og ${boardingHouses.length} ka boarding houses para sa mapa.`);
        boardingHouses.forEach(bh => {
            if (bh.latitude && bh.longitude) {
                const bhCoords = L.latLng(bh.latitude, bh.longitude);
                const marker = L.marker(bhCoords);
                
                // [BAG-O] Kalkulahon ang distansya gikan sa JRMSU
                const distanceInMeters = bhCoords.distanceTo(jrmsuMainCampusCoords);
                let distanceText = '';
                if (distanceInMeters < 1000) {
                  // Kung ubos sa 1km, ipakita sa meters
                  distanceText = `${Math.round(distanceInMeters)}m from JRMSU`;
                } else {
                  // Kung 1km o sobra, ipakita sa kilometers
                  const distanceInKm = distanceInMeters / 1000;
                  distanceText = `${distanceInKm.toFixed(1)}km from JRMSU`;
                }
                
                const popupContent = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                        <h6 style="margin-bottom: 5px; font-weight: bold;">${bh.name}</h6>
                        <p style="margin: 0; font-size: 12px; color: #555;"><i class="bi bi-pin-map-fill"></i> ${distanceText}</p>
                        <p style="margin: 0; font-size: 13px;">
                            ₱${(bh.price_per_month || 0).toLocaleString()}/month
                        </p>
                        <a href="#" class="view-details-link" data-bh-id="${bh.id}" style="font-size: 12px; color: #007bff;">View Details</a>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
                bhMarkersLayer.addLayer(marker);
            }
        });

    } catch (error) {
        console.error("[ERROR] loadBoardingHousesOnMap: Napakyas pag-load sa data sa mapa!", error);
        alert("Could not load boarding houses on the map. Please try again later.");
    }
  };

  // Event listener para sa "View Details" link sa popup sa mapa
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('view-details-link')) {
        e.preventDefault();
        const bhId = e.target.dataset.bhId;
        
        // [GI-AYO] I-trigger ang click sa usa ka temporaryo nga button sa list view
        // para ma-re-use ang existing logic sa pagpakita sa details modal.
        const bhListWrapper = document.getElementById('tenant-bh-list-wrapper');
        if (bhListWrapper) {
          const tempBtn = document.createElement('button');
          tempBtn.className = 'view-details-btn'; // Gamiton ang class sa list view buttons
          tempBtn.dataset.bhId = bhId;
          tempBtn.style.display = 'none'; // Itago ang button
          bhListWrapper.appendChild(tempBtn); // Idugang sa list view wrapper
          tempBtn.click(); // I-trigger ang click
          bhListWrapper.removeChild(tempBtn); // Tangtangon dayon
        } else {
          console.error("[ERROR] tenant-bh-list-wrapper not found. Cannot trigger view details.");
        }
    }
  });

  const findUserLocation = () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const userLatLng = [latitude, longitude];

            map.setView(userLatLng, 16);

            if (userMarker) {
                map.removeLayer(userMarker);
            }

            userMarker = L.circleMarker(userLatLng, {
                radius: 8, color: '#fff', weight: 2, fillColor: '#0d6efd', fillOpacity: 1
            }).addTo(map).bindPopup("<b>You are here</b>").openPopup();
        },
        (error) => {
            alert(`Error getting your location: ${error.message}`);
        }
    );
  };

  mapViewBtn.addEventListener('click', () => {
    console.log('[LOG] mapViewBtn: Gi-klik ang "Map" button.');
    document.body.classList.add('map-is-active');
    // Maghulat og gamay (katugbang sa CSS transition) sa dili pa i-initialize ang mapa
    // para masiguro nga ang container hingpit na nga makita.
    initializeMap();
  });

  backToListBtn.addEventListener('click', () => {
    console.log('[LOG] backToListBtn: Gi-klik ang "Back to List" button.');
    document.body.classList.remove('map-is-active');
    // Dili na kinahanglan i-manipulate ang display/visibility dinhi, ang CSS na ang bahala.
  });

  findMeBtn.addEventListener('click', findUserLocation);
}

// --- [GI-ORGANISAR] Main Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
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

  // Susiha kung asa nga page ta karon base sa presensya sa usa ka talagsaon nga element.
  console.log("[DEBUG] DOMContentLoaded: Nagsugod ang script.");
  const isTenantDashboard = document.getElementById('tenant-bh-list-wrapper'); // Kini nga wrapper naa ra sa tenant-dashboard.html
  const isHomePage = document.getElementById('bh-list-container'); // Kini nga container naa ra sa index.html

  // [GI-AYO] Klarohon ang pagsusi kung asa nga page.
  // Kung naa sa tenant dashboard, padagana ang dashboard logic.
  // Kung dili, ug naa sa home page, padagana ang home page logic.
  if (isTenantDashboard) {
    console.log("[DEBUG] Nakit-an ang 'tenant-bh-list-wrapper'. Gi-ila isip Tenant Dashboard. Magsugod sa session verification.");
    initializeTenantDashboard();
  } else if (isHomePage) {
    console.log("[DEBUG] Nakit-an ang 'bh-list-container'. Gi-ila isip Home Page.");
    initializeHomePage();
  } else {
    console.error("[DEBUG] Wala ma-ila ang page. Walay 'tenant-bh-list-wrapper' o 'bh-list-container' nga nakit-an.");
  }
});
