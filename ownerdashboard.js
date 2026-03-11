// 🧠 [GI-AYO] JavaScript para sa Owner Dashboard

// [GI-BALIK] Ibalik ang buildUrl function para sa saktong API requests.
const API_BASE_ROOT = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
const buildUrl = (path = '') => {
  return `${API_BASE_ROOT}/${path.replace(/^\//, '')}`;
};

async function geocodeAddress(address) {
  const proxyGeocodeUrl = buildUrl(`geocode?q=${encodeURIComponent(address)}`);
  try {
    const response = await fetch(proxyGeocodeUrl);
    const data = await response.json(); // This will be an array of potential addresses
    if (data && data.length > 0) {
      // For a single geocode, we'll take the first result
      const firstResult = data[0];
      return {
        latitude: parseFloat(firstResult.lat),
        longitude: parseFloat(firstResult.lon),
        display_name: firstResult.display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
}

function createImageUploader(uploaderEl, currentFilesArray, maxCount) {
  console.log("createImageUploader called with:", uploaderEl);
  if (!uploaderEl) {
    console.error("Uploader element not found.");
    return;
  }

  // Create a single hidden file input for the uploader
  const hiddenFileInput = document.createElement('input');
  hiddenFileInput.type = 'file';
  hiddenFileInput.accept = 'image/*';
  hiddenFileInput.multiple = true; // Allow multiple selection if adding to empty slots
  hiddenFileInput.style.display = 'none';
  uploaderEl.appendChild(hiddenFileInput);

  function renderUploader() {
    uploaderEl.innerHTML = ''; // Clear existing content
    uploaderEl.appendChild(hiddenFileInput); // Re-add the hidden input

    // Render current image previews
    currentFilesArray.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item position-relative border rounded';
        previewItem.style.cssText = 'width: 100px; height: 100px; background-size: cover; background-position: center; border-radius: 5px; margin: 5px; cursor: pointer;';
        previewItem.style.backgroundImage = `url(${e.target.result})`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-sm position-absolute top-0 end-0 rounded-circle p-0';
        removeBtn.style.cssText = 'width: 20px; height: 20px; font-size: 0.75rem; line-height: 1;';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent triggering the file input
          currentFilesArray.splice(index, 1);
          renderUploader(); // Re-render to update previews
        });
        previewItem.appendChild(removeBtn);
        uploaderEl.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    });

    // Render empty "plus boxes" up to maxCount
    for (let i = currentFilesArray.length; i < maxCount; i++) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'image-uploader-box d-flex justify-content-center align-items-center border rounded p-3';
      emptyBox.style.cssText = 'width: 100px; height: 100px; cursor: pointer; margin: 5px;';
      emptyBox.innerHTML = '<i class="bi bi-plus-lg fs-3 text-muted"></i>';
      emptyBox.addEventListener('click', () => {
        hiddenFileInput.click();
      });
      uploaderEl.appendChild(emptyBox);
    }
  }

  hiddenFileInput.addEventListener('change', (event) => {
    const newFiles = Array.from(event.target.files);
    for (const file of newFiles) {
      if (currentFilesArray.length < maxCount) {
        currentFilesArray.push(file);
      } else {
        alert(`Maximum ${maxCount} images allowed.`);
        break;
      }
    }
    hiddenFileInput.value = ''; // Clear the input so same file can be selected again
    renderUploader(); // Re-render to update previews
  });

  renderUploader(); // Initial render
}

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

  const bhAddressInput = document.getElementById('bhAddress');
  const addressSuggestionsContainer = document.getElementById('addressSuggestions');
  let geocodeDebounceTimer;
  let currentSuggestions = []; // To store suggestions with lat/lng

  if (bhAddressInput && addressSuggestionsContainer) {
    bhAddressInput.addEventListener('input', () => {
      clearTimeout(geocodeDebounceTimer);
      const address = bhAddressInput.value.trim();
      addressSuggestionsContainer.innerHTML = ''; // Clear previous suggestions

      if (address.length > 3) { // Only geocode if a reasonable length is typed
        geocodeDebounceTimer = setTimeout(async () => {
          console.log("Geocoding input for suggestions:", address);
          // The geocodeAddress function now returns an array of results, not just one.
          // We need to modify geocodeAddress to return multiple if possible,
          // or adapt to the current single result. For now, assume it returns one if found.
          // Let's modify geocodeAddress to return all results from the proxy, then process them here.
          
          // Temporary modification for this block: call the proxy directly
          const proxyGeocodeUrl = buildUrl(`geocode?q=${encodeURIComponent(address)}`);
          try {
            const response = await fetch(proxyGeocodeUrl);
            const data = await response.json(); // This will be an array of potential addresses
            currentSuggestions = []; // Reset current suggestions

            if (data && data.length > 0) {
              addressSuggestionsContainer.style.display = 'block';
              data.forEach(item => {
                currentSuggestions.push({ // Store full item for lat/lng
                  display_name: item.display_name,
                  latitude: parseFloat(item.lat),
                  longitude: parseFloat(item.lon)
                });
                const suggestionItem = document.createElement('a');
                suggestionItem.href = '#';
                suggestionItem.className = 'list-group-item list-group-item-action';
                suggestionItem.textContent = item.display_name;
                suggestionItem.addEventListener('click', (e) => {
                  e.preventDefault();
                  bhAddressInput.value = item.display_name;
                  selectedLatitude = parseFloat(item.lat);
                  selectedLongitude = parseFloat(item.lon);
                  addressSuggestionsContainer.innerHTML = ''; // Clear suggestions
                  addressSuggestionsContainer.style.display = 'none';
                  console.log("Selected coordinates from suggestion:", selectedLatitude, selectedLongitude);
                });
                addressSuggestionsContainer.appendChild(suggestionItem);
              });
            } else {
              addressSuggestionsContainer.style.display = 'none';
              selectedLatitude = null;
              selectedLongitude = null;
              console.log("No geocoding suggestions found for input.");
            }
          } catch (error) {
            console.error("Error fetching geocoding suggestions:", error);
            addressSuggestionsContainer.style.display = 'none';
            selectedLatitude = null;
            selectedLongitude = null;
          }
        }, 1000); // Debounce for 1000ms for responsiveness
      } else {
        addressSuggestionsContainer.style.display = 'none';
        selectedLatitude = null;
        selectedLongitude = null;
      }
    });

    // Hide suggestions when input loses focus (with a slight delay to allow click on suggestion)
    bhAddressInput.addEventListener('blur', () => {
      setTimeout(() => { // [GI-AYO] Gidugangan ang delay para masiguro nga ma-click ang suggestion
        addressSuggestionsContainer.style.display = 'none';
      }, 200);
    });

    // Show suggestions again if input is focused and there are current suggestions
    bhAddressInput.addEventListener('focus', () => {
      if (currentSuggestions.length > 0 && bhAddressInput.value.trim().length > 3) {
        addressSuggestionsContainer.style.display = 'block';
      }
    });
  }
  const imageViewerModalEl = document.getElementById('imageViewerModal');
  const imageViewerModal = new bootstrap.Modal(imageViewerModalEl);
  const fullImageView = document.getElementById('fullImageView');

  /**
   * 🧠 [BAG-O] Function para i-verify ang session sa user sa server.
   * Kini ang mosulbad sa "Session expired" error.
   */
  async function verifyUserSession() {
    try {
      const response = await fetch(buildUrl('user/session'), {
        method: 'GET',
        credentials: 'include', // Importante para mapadala ang session cookie
      });
      const result = await response.json();
      console.log('[ownerdashboard.js] verifyUserSession API response:', result);
      console.log('[ownerdashboard.js] verifyUserSession result.user:', result.user, 'result.user.role:', result.user ? result.user.role : 'N/A');

      if (result.status === 'Success' && result.isLoggedIn && result.user && result.user.role === 'owner') {
        // Kung success, logged in, ug owner ang role, i-return ang user data
        return result.user;
      } else if (result.status === 'Success' && !result.isLoggedIn) {
        // Kung success ang API call pero dili logged in, i-redirect direkta sa login page.
        // Walay error o alert, kay expected kini nga scenario.
        window.location.replace('user-login.html');
        return null; // Dili na mopadayon
      } else {
        // Kung dili success ang status, o walay user/role match, itambog ang error
        // [GI-USAB] Gigamit ang sessionStorage para sa pag-clear sa session data.
        sessionStorage.removeItem('currentUser');
        throw new Error(result.message || 'Invalid session.');
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      // Remove alert - only redirect the user
      window.location.replace('user-login.html');
      return null; // Dili na mopadayon
    }
  }

  // --- 🔑 Authentication Check ---
  const user = await verifyUserSession();
  if (!user) {
    return;
  }

  // --- Initialize App ---
  const nameEl = document.getElementById('tenantName');
  if (nameEl) {
    nameEl.textContent = user.full_name || 'Owner';
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault(); // Pugngan ang default behavior
      try {
          const response = await fetch(buildUrl('user?action=logout'), {
              method: 'DELETE',
              credentials: 'include'
          });
          const result = await response.json();
          if (result.status === 'Success') {
              window.location.href = 'index.html'; // I-redirect sa login page human sa successful logout
          }
      } catch (error) {
          console.error('Logout failed:', error);
      }
    });
  }

  // --- [BAG-O] Logic para sa Details Modal ug Mapa ---
  const detailsModalEl = document.getElementById('bhDetailsModal');
  const detailsModal = new bootstrap.Modal(detailsModalEl);
  let map = null;

  // 🧠 [BAG-O] Variables para sa Manage Rooms Modal
  const manageRoomsModalEl = document.getElementById('manageRoomsModal');
  const manageRoomsModal = new bootstrap.Modal(manageRoomsModalEl);
  const modalBhName = document.getElementById('modalBhName');
  const modalBhId = document.getElementById('modalBhId');
  const addRoomForm = document.getElementById('addRoomForm');
  const roomImageUploader = document.getElementById('roomImageUploader');
  const roomImageInputModal = document.getElementById('roomImageInputModal');
  const existingRoomsList = document.getElementById('existingRoomsList');
  const addRoomSpinner = document.getElementById('addRoomSpinner');

  // Global array para sa images sa sulod sa "Add a New Room" form sa Manage Rooms Modal
  let currentRoomImageFiles = [];

  // 🧠 [BAG-O] Variables para sa Image Uploader sa Add BH Form
  const imageUploaderEl = document.getElementById('imageUploader');
  const bhImageInput = document.getElementById('bhImageInput');
  let currentBhImageFiles = [];

  // 🧠 [BAG-O] Array para temporaryong i-store ang mga room nga gi-add gikan sa modal
  // sa dili pa i-submit ang tibuok Add BH Form.
  let tempAddedRooms = [];

  // Initialize Image Uploader for Add BH Form
  if (imageUploaderEl && bhImageInput) {
    createImageUploader(imageUploaderEl, currentBhImageFiles, 8); // Max 8 images
  } else {
    console.warn("Could not find imageUploader or bhImageInput for Add BH Form.");
  }

  // [GI-AYO] Ibalhin ang render function sa taas para ma-access sa `loadMyBoardingHouses`
  const renderBhCard = (house) => {
    const item = document.createElement('div');
    item.className = 'col-md-6 col-lg-4 mb-4';
    
    const statusBadge = {
      pending: '<span class="badge bg-warning text-dark">Pending</span>',
      approved: '<span class="badge bg-success">Approved</span>',
      rejected: '<span class="badge bg-danger">Rejected</span>',
    };

    // I-check kung naay rejection reason ug andamon ang HTML para niini.
    let rejectionInfo = '';
    if (house.status === 'rejected' && house.rejection_reason) {
      rejectionInfo = `
        <div class="alert alert-danger small p-2 mt-2">
          <strong>Admin's Comment:</strong>
          <p class="mb-0 fst-italic">"${house.rejection_reason}"</p>
        </div>
      `;
    }

    const firstImage = (Array.isArray(house.image_urls) && house.image_urls.length > 0 && house.image_urls[0])
        ? house.image_urls[0]
        : 'images/sample-bh.jpg';

    item.innerHTML = `
        <div class="card h-100" data-house-data='${JSON.stringify(house)}'>
            <img src="${firstImage}" class="card-img-top" alt="${house.name}" style="height: 200px; object-fit: cover;">
            <div class="card-body d-flex flex-column">
                <h5 class="card-title mb-1">${house.name}</h5>
                <p class="card-text text-muted small mb-2"><i class="bi bi-geo-alt-fill"></i> ${house.address || 'No address'}</p>
                <!-- Dinhi ibutang ang rejection info para mugawas gyud sa card -->
                ${rejectionInfo}

                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <p class="card-text h5 fw-bold text-primary mb-0">
                            ₱${(house.price_per_month || 'N/A').toLocaleString()}
                            <span class="fw-normal fs-6 text-muted">/month</span>
                        </p>
                        ${statusBadge[house.status] || ''}
                    </div>
                    <!-- [GI-AYO] Gihimong responsive ang button group para sa gagmay nga screens -->
                    <div class="btn-group-vertical btn-group-sm-horizontal w-100" role="group">
                        <button class="btn btn-sm btn-outline-primary view-details-btn" title="View Details"><i class="bi bi-eye-fill"></i> View</button>
                        <button class="btn btn-sm btn-outline-info manage-rooms-btn" title="Manage Rooms"><i class="bi bi-door-open"></i> Rooms</button>
                        <button class="btn btn-sm btn-outline-secondary edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i> Edit</button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash-fill"></i> Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    return item;
  };

  // --- Functions para sa pag-load sa data ---
  const loadMyBoardingHouses = async () => {
    // [GI-AYO] I-target ang tulo ka container para sa tabs
    const approvedList = document.getElementById('approvedBhList');
    const pendingList = document.getElementById('pendingBhList');
    const rejectedList = document.getElementById('rejectedBhList');
    const spinner = document.getElementById('myBhListSpinner');
    
    if (!approvedList || !pendingList || !rejectedList || !spinner) return;

    spinner.classList.remove('d-none');
    
    // I-set ang loading message sa tanang tabs
    const loadingMsg = '<div class="col-12 text-center text-muted py-3">Loading your properties...</div>';
    approvedList.innerHTML = loadingMsg;
    pendingList.innerHTML = loadingMsg;
    rejectedList.innerHTML = loadingMsg;

    try {
    console.log('Fetching boarding houses for owner ID:', user.id);
      const res = await fetch(buildUrl(`boardinghouse?owner_id=${user.id}`), {
        credentials: 'include'
      });
      const houses = await res.json();
      
      // Limpyohan ang mga listahan
      approvedList.innerHTML = '';
      pendingList.innerHTML = '';
      rejectedList.innerHTML = '';

      if (Array.isArray(houses) && houses.length > 0) {
        let countApproved = 0;
        let countPending = 0;
        let countRejected = 0;

        houses.forEach(house => {
          const card = renderBhCard(house);
          if (house.status === 'approved') {
            approvedList.appendChild(card);
            countApproved++;
          } else if (house.status === 'pending') {
            pendingList.appendChild(card);
            countPending++;
          } else if (house.status === 'rejected') {
            rejectedList.appendChild(card);
            countRejected++;
          }
        });

        // Ibutang ang empty state message kung walay sulod ang tab
        if (countApproved === 0) approvedList.innerHTML = '<div class="col-12 text-center text-muted py-3">No approved boarding houses.</div>';
        if (countPending === 0) pendingList.innerHTML = '<div class="col-12 text-center text-muted py-3">No pending boarding houses.</div>';
        if (countRejected === 0) rejectedList.innerHTML = '<div class="col-12 text-center text-muted py-3">No rejected boarding houses.</div>';
      } else {
        const noDataMsg = '<div class="col-12 text-center text-muted py-3">No boarding houses found. You can add one using the form above.</div>';
        approvedList.innerHTML = noDataMsg;
        pendingList.innerHTML = noDataMsg;
        rejectedList.innerHTML = noDataMsg;
      }
    } catch (err) {
      console.error('Failed to load my boarding houses:', err);
      const errorMsg = '<div class="col-12 text-center text-danger py-3">Failed to load properties. Please try again later.</div>';
      approvedList.innerHTML = errorMsg;
      pendingList.innerHTML = errorMsg;
      rejectedList.innerHTML = errorMsg;
    } finally {
      spinner.classList.add('d-none');
    }
  };


  // --- Event Listeners ---
  // [GI-AYO] Gibalhin ang event listener sa tab content container (myBhTabContent)
  // kay wala na ang 'myBhList' nga container.
  const tabContent = document.getElementById('myBhTabContent');
  if (tabContent) {
    tabContent.addEventListener('click', async (e) => {
    const itemCard = e.target.closest('.card');
    if (!itemCard) return;

    const houseData = JSON.parse(itemCard.dataset.houseData);
    const houseId = houseData.id;

    if (e.target.closest('.edit-btn')) {
      document.getElementById('updBhId').value = houseId;
      document.getElementById('updAmenities').value = houseData.amenities || '';
      document.getElementById('updRooms').value = houseData.available_rooms || '';
      document.getElementById('updBeds').value = houseData.beds_per_room || '';
      document.getElementById('updFacebook').value = houseData.facebook_link || '';
      document.getElementById('updWebsite').value = houseData.website_link || ''; // [BAG-O] I-populate ang website field
      document.getElementById('updBhPhoneNumber').value = houseData.phone_number || '';
      document.getElementById('updGender').value = houseData.gender_allowed || 'both';
      document.getElementById('updTerms').value = houseData.terms_and_regulations || ''; // [BAG-O] I-populate ang terms field
      
      const updForm = document.getElementById('updateBhForm');
      updForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('updAmenities').focus();
    }

    if (e.target.closest('.delete-btn')) {
      if (confirm(`Are you sure you want to delete "${houseData.name}"?`)) {
        try {
          const res = await fetch(buildUrl(`boardinghouse?id=${houseId}`), { method: 'DELETE' });
          const result = await res.json();
          if (result.status === 'Success') {
            alert('Boarding house deleted.');
            loadMyBoardingHouses();
          } else {
            throw new Error(result.message || 'Failed to delete.');
          }
        } catch (err) {
          alert(`Error: ${err.message}`);
        }
      }
    }
    if (e.target.closest('.view-details-btn')) {
        const viewBtn = e.target.closest('.view-details-btn');
        
        // I-populate ang modal content
        document.getElementById('bhDetailsModalLabel').textContent = houseData.name; // Update modal title
        document.getElementById('modalBhAddressDetails').textContent = houseData.address || 'N/A';
        // [GI-AYO] Gi-target ang sakto nga span para sa phone number
        document.getElementById('modalBhPhoneSpan').textContent = houseData.phone_number || 'N/A';
        document.getElementById('modalBhRoomsDetails').textContent = houseData.available_rooms || 'N/A';
        document.getElementById('modalBhBedsDetails').textContent = houseData.beds_per_room || 'N/A';
        document.getElementById('modalBhGenderDetails').textContent = houseData.gender_allowed || 'N/A';
        
        // [GI-AYO] I-populate ang monthly rate
        document.getElementById('modalBhPriceDetails').textContent = (houseData.price_per_month || 'N/A').toLocaleString();
        
        // [BAG-O] I-populate ang terms and regulations
        document.getElementById('modalBhTermsDetails').textContent = houseData.terms_and_regulations || 'No terms and regulations provided.';

        let amenitiesDisplay = houseData.amenities || 'No amenities listed.';
        if (typeof amenitiesDisplay === 'string' && amenitiesDisplay.startsWith('[')) {
            try {
                amenitiesDisplay = JSON.parse(amenitiesDisplay).join(', ');
            } catch (e) {
                console.error("Failed to parse amenities:", e);
            }
        } else if (Array.isArray(amenitiesDisplay)) {
            amenitiesDisplay = amenitiesDisplay.join(', ');
        }
        document.getElementById('modalBhAmenitiesDetails').textContent = amenitiesDisplay;
        
        // Facebook Link
        const fbLink = document.getElementById('modalBhFacebookDetails');
        if (houseData.facebook_link) {
          fbLink.innerHTML = `<p><i class="bi bi-facebook text-primary"></i> <strong>Facebook:</strong> <a href="${houseData.facebook_link}" target="_blank" rel="noopener noreferrer">View Profile/Page</a></p>`;
          fbLink.classList.remove('d-none');
        } else {
          fbLink.classList.add('d-none');
        }
  
        // [BAG-O] Website Link
        const websiteLink = document.getElementById('modalBhWebsiteDetails');
        if (houseData.website_link) {
          websiteLink.innerHTML = `<p><i class="bi bi-globe text-primary"></i> <strong>Website:</strong> <a href="${houseData.website_link}" target="_blank" rel="noopener noreferrer">Visit Website</a></p>`;
        } else {
          websiteLink.innerHTML = ''; // Limpyohan kung walay link
        }
        // [GI-ULI] Handle Carousel
        const carouselContainer = document.getElementById('carousel-container-details');
        let carouselHTML = '';
        if (Array.isArray(houseData.image_urls) && houseData.image_urls.length > 0 && houseData.image_urls[0]) {
          const carouselInnerId = `carousel-bh-${houseData.id}`; // Unique ID for carousel
          const indicators = houseData.image_urls.map((_, index) => `
            <button type="button" data-bs-target="#${carouselInnerId}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}" aria-current="${index === 0 ? 'true' : 'false'}"></button>
          `).join('');
  
          const items = houseData.image_urls.map((url, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${url}" class="d-block w-100 rounded" alt="Image ${index + 1}" style="height: 300px; object-fit: cover;">
            </div>
          `).join('');
  
          carouselHTML = `
            <div id="${carouselInnerId}" class="carousel slide mb-3" data-bs-ride="carousel">
              <div class="carousel-indicators">${indicators}</div>
              <div class="carousel-inner">${items}</div>
              <button class="carousel-control-prev" type="button" data-bs-target="#${carouselInnerId}" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
              <button class="carousel-control-next" type="button" data-bs-target="#${carouselInnerId}" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
            </div>
          `;
        } else {
          carouselHTML = '<p class="text-muted small">No images available.</p>';
        }
        carouselContainer.innerHTML = carouselHTML;
  
        // [GI-ULI] Ipasa ang address ug ngalan sa modal event para sa mapa
        viewBtn.dataset.address = houseData.address;
        viewBtn.dataset.name = houseData.name;
        viewBtn.dataset.latitude = houseData.latitude; // Ensure latitude and longitude are passed for the map
        viewBtn.dataset.longitude = houseData.longitude;
  
        // Ipakita ang modal
        detailsModal.show(viewBtn);
    }

    // [BAG-O] I-reset ang room rates collapse kung mo-abli ug bag-ong modal
    const existingCollapse = document.getElementById('roomRatesCollapse-owner-modal');
    if (existingCollapse) {
      const bsCollapse = bootstrap.Collapse.getInstance(existingCollapse);
      if (bsCollapse) {
        bsCollapse.hide();
      }
    }

    // [BAG-O] Logic para sa "View Room Rates" button sulod sa modal
    const viewRatesBtn = document.getElementById('viewRoomRatesBtn-owner-modal');
    const ratesCollapseEl = document.getElementById('roomRatesCollapse-owner-modal');
    const ratesContainer = document.getElementById('roomRatesContainer-owner-modal');

    // Gamit og .cloneNode(true) para malikayan ang multiple event listeners sa samang button
    const newViewRatesBtn = viewRatesBtn.cloneNode(true);
    viewRatesBtn.parentNode.replaceChild(newViewRatesBtn, viewRatesBtn);

    newViewRatesBtn.addEventListener('click', async () => {
      const collapse = new bootstrap.Collapse(ratesCollapseEl, { toggle: false });
      if (ratesCollapseEl.classList.contains('show')) {
        collapse.hide();
        return;
      }
      ratesContainer.innerHTML = '<p class="text-muted">Loading room rates...</p>';
      try {
        // I-fetch pag-usab ang data apan naay `view=admin` para makuha ang room details
        const res = await fetch(buildUrl(`boardinghouse?id=${houseData.id}&view=admin`));
        const bhWithRooms = await res.json();
        let rooms = [];
        if (bhWithRooms.rooms) rooms = typeof bhWithRooms.rooms === 'string' ? JSON.parse(bhWithRooms.rooms) : bhWithRooms.rooms;

        if (!rooms || rooms.length === 0) {
          ratesContainer.innerHTML = '<p class="text-muted">No specific room rates available.</p>';
        } else {
          ratesContainer.innerHTML = '';
          rooms.forEach(r => {
            const price = (typeof r.price === 'number' ? r.price : parseFloat(r.price)) || r.price_per_month || 0;
            const name = r.name || r.room_name || 'Room';
            
            // [GI-ULI] I-proseso ang mga hulagway sa kwarto para sa thumbnails
            const imageUrls = Array.isArray(r.image_urls) ? r.image_urls.filter(Boolean) : [];
            const thumbs = imageUrls.length
              ? `<div class="d-flex flex-wrap gap-2 me-3">
                  ${imageUrls.slice(0, 6).map(url => `<img src="${url}" alt="${name} image" class="room-thumbnail" style="width:96px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer;">`).join('')}
                 </div>`
              : '';

            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
              <div class="d-flex align-items-center">
                ${thumbs}
                <div>
                  <strong>${name}</strong>
                  <div class="text-muted small">${r.description || ''}</div>
                </div>
              </div>
              <span class="text-primary fw-semibold">₱${(price || 0).toLocaleString()}</span>
            `;
            ratesContainer.appendChild(item);
          });
        }
        collapse.show();
      } catch (err) {
        console.error('Failed to load room rates:', err);
        ratesContainer.innerHTML = '<p class="text-danger">Failed to load room rates.</p>';
        collapse.show();
      }
    });

    // [GI-ULI] Event listener para sa pag-click sa mga room thumbnails para ipakita sa image viewer modal
    ratesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('room-thumbnail')) {
        fullImageView.src = e.target.src;
        imageViewerModal.show();
      }
    });
    // 🧠 [BAG-O] Handle Manage Rooms button click
    if (e.target.closest('.manage-rooms-btn')) {
      modalBhName.textContent = houseData.name;
      modalBhId.value = houseId; // Store the BH ID in a hidden input
      manageRoomsModal.show();
      loadExistingRooms(houseId); // Load existing rooms for this BH
      // Reset the add room form and image uploader
      addRoomForm.reset();
      currentRoomImageFiles = [];
      console.log("roomImageUploader element before call:", roomImageUploader);
      createImageUploader(roomImageUploader, currentRoomImageFiles, 6);
    }
    });
  }

  // Function para sa pag-load sa existing rooms sa usa ka BH
  const loadExistingRooms = async (bhId) => {
    existingRoomsList.innerHTML = '<p class="text-center text-muted">Loading rooms...</p>';

    try {
      const res = await fetch(buildUrl(`room?bh_id=${bhId}`), {
        credentials: 'include'
      });
      const rooms = await res.json();

      existingRoomsList.innerHTML = ''; // Clear previous content
      if (Array.isArray(rooms) && rooms.length > 0) {
        rooms.forEach(room => {
          const roomItem = document.createElement('div');
          roomItem.className = 'card mb-2';
          roomItem.dataset.roomId = room.id; // Store room ID

          let imagePreviewsHTML = '';
          if (Array.isArray(room.image_urls) && room.image_urls.length > 0) {
            imagePreviewsHTML = room.image_urls.map((url, index) => `
              <div class="room-image-preview-thumbnail" style="background-image: url('${url}')" data-index="${index}">
                <button class="remove-room-image-btn" data-room-id="${room.id}" data-image-url="${url}">&times;</button>
              </div>
            `).join('');
          } else {
            imagePreviewsHTML = '<p class="text-muted small">No images</p>';
          }

          roomItem.innerHTML = `
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="card-title mb-0">${room.name || 'Untitled Room'}</h6>
                <!-- [GI-AYO] Gidugang ang data-bh-id para sa delete request -->
                <button class="btn btn-sm btn-outline-danger delete-room-btn" data-room-id="${room.id}" data-bh-id="${bhId}">Delete Room</button>
              </div>
              <p class="card-text mb-1"><strong>Price:</strong> ₱${room.price_per_month}</p>
              <p class="card-text small text-muted mb-2">${room.description || 'No description provided.'}</p>
              <div class="d-flex flex-wrap gap-2">
                ${imagePreviewsHTML}
              </div>
            </div>
          `;
          existingRoomsList.appendChild(roomItem);
        });
      } else {
        existingRoomsList.innerHTML = '<p class="text-center text-muted">No rooms added yet for this boarding house.</p>';
      }
    } catch (err) {
      console.error('Failed to load existing rooms:', err);
      existingRoomsList.innerHTML = '<p class="text-center text-danger">Failed to load rooms. Please try again.</p>';
    }
  };

  // [GI-AYO] I-deklara ang submit listener sa usa lang ka higayon.
  // Gamit ug flag para masiguro nga dili mag-doble.
  let isAddRoomListenerAttached = false;
  if (!isAddRoomListenerAttached) {
    addRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bhId = modalBhId.value;
      const roomName = document.getElementById('roomName').value;
      const roomPrice = document.getElementById('roomPrice').value;
      const roomDescription = document.getElementById('roomDescription').value;

      if (!bhId || !roomName || !roomPrice || parseFloat(roomPrice) <= 0) {
        alert('Please fill in all required room details (Name and a valid Price).');
        return;
      }

      addRoomSpinner.classList.remove('d-none');
      const submitBtn = addRoomForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        const roomImageBase64s = await Promise.all(currentRoomImageFiles.map(fileToBase64));
        const roomData = { bh_id: bhId, name: roomName, price_per_month: parseFloat(roomPrice), description: roomDescription, image_urls: roomImageBase64s };

        const res = await fetch(buildUrl('room'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(roomData) });
        const result = await res.json();

        if (result.status === 'Success') {
          alert('Room added successfully!');
          addRoomForm.reset();
          currentRoomImageFiles.length = 0;
          createImageUploader(roomImageUploader, currentRoomImageFiles, 6);
          loadExistingRooms(bhId);
        } else {
          throw new Error(result.message || 'Failed to add room.');
        }
      } catch (err) {
        console.error('Error adding room:', err);
        alert(`Error: ${err.message}`);
      } finally {
        addRoomSpinner.classList.add('d-none');
        submitBtn.disabled = false;
      }
    });
    isAddRoomListenerAttached = true; // I-set ang flag para dili na mag-attach pag-usab.
  }



  // Event listener para sa pag-delete sa room gikan sa listahan
  existingRoomsList.addEventListener('click', async (e) => {
    // [BAG-O] Logic para sa pag-delete sa usa ka kwarto
    if (e.target.classList.contains('delete-room-btn')) {
      const roomId = e.target.dataset.roomId;
      const bhId = e.target.dataset.bhId;

      if (confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
        try {
          const res = await fetch(buildUrl(`room?bh_id=${bhId}&room_id=${roomId}`), {
            method: 'DELETE',
            credentials: 'include'
          });

          const result = await res.json();
          if (result.status === 'Success') {
            alert('Room deleted successfully!');
            loadExistingRooms(bhId); // I-refresh ang lista sa mga kwarto
          } else {
            throw new Error(result.message || 'Failed to delete room.');
          }
        } catch (err) {
          alert(`Error deleting room: ${err.message}`);
        }
      }
    }

    if (e.target.closest('.manage-rooms-btn')) {
      modalBhName.textContent = houseData.name;
      modalBhId.value = houseId; // Store the BH ID in a hidden input
      manageRoomsModal.show();
      loadExistingRooms(houseId); // Load existing rooms for this BH
      // Reset the add room form and image uploader
      addRoomForm.reset();
      currentRoomImageFiles = [];
      console.log("roomImageUploader element before call:", roomImageUploader);
      createImageUploader(roomImageUploader, currentRoomImageFiles, 6);
    }
  });


  // 🧠 [BAG-O] Initialize Image Uploader for Add Room Details Modal
  const addRoomDetailsModalEl = document.getElementById('addRoomDetailsModal');
  const modalRoomImageUploader = document.getElementById('modalRoomImageUploader');
  const modalRoomImageInput = document.getElementById('modalRoomImage');
  let currentModalRoomImageFiles = [];

  if (addRoomDetailsModalEl) {
    addRoomDetailsModalEl.addEventListener('shown.bs.modal', () => {
      if (modalRoomImageUploader && modalRoomImageInput) {
        currentModalRoomImageFiles = []; // Reset files when modal is shown
        createImageUploader(modalRoomImageUploader, currentModalRoomImageFiles, 6); // Max 6 images
      } else {
        console.warn("Could not find modalRoomImageUploader or modalRoomImageInput for Add Room Details Modal.");
      }
    });
  }

  // 🧠 [BAG-O] Logic para sa "Add Room" button sulod sa "Add Room Details" modal
  const addRoomToListBtn = document.getElementById('addRoomToListBtn');
  const addedRoomsListContainer = document.getElementById('addedRoomsList');
  const addBhForm = document.getElementById('addBhForm'); // Get the main add BH form
  const addRoomDetailsModalForm = document.getElementById('roomDetailsForm');
  const addRoomDetailsModalInstance = new bootstrap.Modal(document.getElementById('addRoomDetailsModal'));

  if (addRoomToListBtn) {
    addRoomToListBtn.addEventListener('click', () => {
      const roomName = document.getElementById('modalRoomName').value;
      const roomPrice = document.getElementById('modalRoomPrice').value;
      const roomDescription = document.getElementById('modalRoomDescription').value;

      // Basic validation
      if (!roomPrice || parseFloat(roomPrice) <= 0) {
        alert('Please enter a valid price for the room.');
        return;
      }

      // I-save ang room details (including ang image files) sa temporary array
      const newRoom = {
        name: roomName || 'Untitled Room',
        price: parseFloat(roomPrice),
        description: roomDescription,
        files: [...currentModalRoomImageFiles] // Kopyahon ang files gikan sa modal uploader
      };
      tempAddedRooms.push(newRoom);

      // I-render ang updated list sa mga gi-add nga rooms
      renderTempAddedRooms();

      // I-reset ang form sa sulod sa modal ug i-hide
      addRoomDetailsModalForm.reset();
      currentModalRoomImageFiles = []; // I-clear ang array para sa sunod nga pag-add
      // Re-initialize image uploader for modal to show empty slots
      if (modalRoomImageUploader && modalRoomImageInput) {
        createImageUploader(modalRoomImageUploader, currentModalRoomImageFiles, 6);
      }
      addRoomDetailsModalInstance.hide();
    });
  }

  // Function para i-display ang mga temporaryong gi-add nga rooms
  function renderTempAddedRooms() {
    addedRoomsListContainer.innerHTML = ''; // I-clear daan ang container
    if (tempAddedRooms.length === 0) {
      addedRoomsListContainer.innerHTML = '<p class="text-muted small">No rooms added yet. Click "+ Add Room Details" to begin.</p>';
      return;
    }

    tempAddedRooms.forEach((room, index) => {
      const roomItem = document.createElement('div');
      roomItem.className = 'card card-body mb-2 p-2';

      // Maghimo og preview sa mga hulagway
      let imagePreviewsHTML = room.files.map(file => {
        const objectURL = URL.createObjectURL(file);
        return `<div class="temp-room-img-preview" style="background-image: url('${objectURL}')"></div>`;
      }).join('');

      if (!imagePreviewsHTML) {
        imagePreviewsHTML = '<span class="small text-muted">No images</span>';
      }

      roomItem.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="mb-0">${room.name} - ₱${Number(room.price).toLocaleString()}</h6>
            <div class="d-flex flex-wrap gap-1 mt-1">
              ${imagePreviewsHTML}
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeTempRoom(${index})">&times;</button>
        </div>
      `;
      addedRoomsListContainer.appendChild(roomItem);
    });
  }

  /**
   * 🧠 [BAG-O] Function para i-remove ang temporaryong gi-add nga room gikan sa listahan.
   * Ibutang sa `window` object para ma-access sa `onclick` attribute nga gi-generate sa `renderTempAddedRooms`.
   * @param {number} index - Ang index sa room sulod sa `tempAddedRooms` array.
   */
  window.removeTempRoom = function(index) {
    // I-remove ang room gikan sa array gamit ang iyang index.
    tempAddedRooms.splice(index, 1);
    // I-render pag-usab ang listahan para ma-update ang display.
    renderTempAddedRooms();
  }

  // 🧠 [GI-AYO] Event listener para sa pag-abli sa details modal.
  // Gamiton na karon ang latitude ug longitude gikan sa dataset para sa mapa.
  detailsModalEl.addEventListener('shown.bs.modal', (event) => {
    const { latitude, longitude, name } = event.relatedTarget.dataset;
    const mapContainer = document.getElementById('detailMapOwner');
    const mapMessage = document.getElementById('map-message-details');

    // I-remove ang daan nga mapa kung naa para malikayan ang error.
    if (map) {
      map.remove();
      map = null;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // Susiha kung valid ba ang coordinates.
    if (mapContainer && !isNaN(lat) && !isNaN(lon)) {
      mapContainer.style.display = 'block';
      mapMessage.textContent = '';

      // I-initialize ang mapa sa 'detailMapOwner' div.
      map = L.map('detailMapOwner').setView([lat, lon], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      L.marker([lat, lon]).addTo(map)
        .bindPopup(`<b>${name}</b>`)
        .openPopup();

      // I-adjust ang size sa mapa para sakto ang pag-render sulod sa modal.
      setTimeout(() => map.invalidateSize(), 10);
    } else {
      // Kung walay coordinates, itago ang mapa ug magpakita og mensahe.
      mapContainer.style.display = 'none';
      mapMessage.textContent = 'Location map not available.';
    }
  });

  // 🧠 [BAG-O] Function to convert File object to Base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // 🧠 [BAG-O] Event listener for Add BH Form submission
  addBhForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = addBhForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      // 1. Gather BH Data
      const bhData = {
        name: document.getElementById('bhName').value,
        address: bhAddressInput.value,
        phone_number: document.getElementById('bhPhoneNumber').value,
        available_rooms: parseInt(document.getElementById('bhRooms').value),
        beds_per_room: parseInt(document.getElementById('bhBeds').value),
        price_per_month: parseFloat(document.getElementById('bhPrice').value),
        gender_allowed: document.getElementById('bhGender').value,
        amenities: document.getElementById('bhAmenities').value,
        facebook_link: document.getElementById('bhFacebook').value,
        website_link: document.getElementById('bhWebsite').value, // [BAG-O] Kuhaon ang value sa website
        terms_and_regulations: document.getElementById('bhTerms').value, // [BAG-O] Kuhaon ang value sa terms
        latitude: selectedLatitude, // Use the stored latitude
        longitude: selectedLongitude, // Use the stored longitude
      };

      // [GI-AYO] Gi-usa ang validation ug gidugangan og visual indicators
      const allInputs = addBhForm.querySelectorAll('.form-control, .form-select');
      allInputs.forEach(input => input.classList.remove('is-invalid'));
      imageUploaderEl.classList.remove('is-invalid', 'border-danger');

      const requiredFields = {
        'Boarding House Name': bhData.name,
        'Address': bhData.address,
        'Phone Number': bhData.phone_number,
        'Available Rooms': bhData.available_rooms,
        'Beds per Room': bhData.beds_per_room,
        'Price per Month': bhData.price_per_month,
        'Amenities': bhData.amenities,
        'Facebook Link': bhData.facebook_link,
        // Ang terms and regulations kay optional, so dili i-apil sa required fields
      };

      const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key] || (typeof requiredFields[key] === 'number' && isNaN(requiredFields[key])));

      if (currentBhImageFiles.length !== 8) {
        missingFields.push('Exactly 8 Boarding House Images');
      }

      if (missingFields.length > 0) {
        const fieldIdMap = {
          'Boarding House Name': 'bhName',
          'Address': 'bhAddress',
          'Phone Number': 'bhPhoneNumber',
          'Available Rooms': 'bhRooms',
          'Beds per Room': 'bhBeds',
          'Price per Month': 'bhPrice',
          'Amenities': 'bhAmenities',
          'Facebook Link': 'bhFacebook',
          'Exactly 8 Boarding House Images': 'imageUploader'
        };

        missingFields.forEach(fieldName => {
          const elementId = fieldIdMap[fieldName];
          const element = document.getElementById(elementId);
          if (element) {
            element.classList.add('is-invalid');
            // Special styling for the image uploader container
            if (elementId === 'imageUploader') {
              element.classList.add('border-danger');
            }
          }
        });

        alert(`Please fill in all required fields:\n- ${missingFields.join('\n- ')}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add';
        return;
      }

      // 2. Process BH Images
      const bhImageBase64s = await Promise.all(currentBhImageFiles.map(fileToBase64));
      bhData.images = bhImageBase64s;

      // 3. Process Rooms
      const processedRooms = await Promise.all(tempAddedRooms.map(async (room) => {
        const roomImageBase64s = await Promise.all(room.files.map(fileToBase64));
        return {
          name: room.name,
          price: room.price,
          description: room.description,
          files: roomImageBase64s, // Send base64 strings for room images
        };
      }));
      bhData.rooms = processedRooms;

      // 4. Send Request
      const response = await fetch(buildUrl('boardinghouse'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bhData),
        credentials: 'include',
      });

      const result = await response.json();

      if (result.status === 'Success') {
        alert(result.message);
        addBhForm.reset();
        currentBhImageFiles = []; // Clear BH images
        createImageUploader(imageUploaderEl, currentBhImageFiles, 8); // Re-render BH image uploader
        tempAddedRooms = []; // Clear temporary rooms
        renderTempAddedRooms(); // Re-render temporary room list
        selectedLatitude = null; // Reset coordinates
        selectedLongitude = null; // Reset coordinates
        loadMyBoardingHouses(); // Refresh the list of boarding houses
      } else {
        throw new Error(result.message || 'Failed to add boarding house.');
      }

    } catch (error) {
      console.error('Error adding boarding house:', error);
      alert('Error adding boarding house: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add';
    }
  });

  // [GI-AYO] Event listener para sa pag-submit sa Update BH Form
  const updateBhForm = document.getElementById('updateBhForm');
  if (updateBhForm) {
    updateBhForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const bhId = document.getElementById('updBhId').value;
      if (!bhId) {
        alert('Please click the "Edit" button on a boarding house first to select it.');
        return;
      }

      const submitBtn = updateBhForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...`;

      // Kuhaon lang ang mga fields nga naay sulod para i-update
      const dataToUpdate = { id: bhId };
      const fields = {
        amenities: document.getElementById('updAmenities').value,
        facebook_link: document.getElementById('updFacebook').value,
        website_link: document.getElementById('updWebsite').value, // [BAG-O] Kuhaon ang value sa website para sa update
        phone_number: document.getElementById('updBhPhoneNumber').value,
        available_rooms: document.getElementById('updRooms').value,
        beds_per_room: document.getElementById('updBeds').value,
        gender_allowed: document.getElementById('updGender').value,
        terms_and_regulations: document.getElementById('updTerms').value, // [BAG-O] Kuhaon ang value sa terms para sa update
      };

      for (const [key, value] of Object.entries(fields)) {
        if (value) { // I-apil lang sa request kung naay sulod ang field
          if (key === 'available_rooms' || key === 'beds_per_room') {
            dataToUpdate[key] = parseInt(value, 10);
          } else {
            dataToUpdate[key] = value;
          }
        }
      }

      if (Object.keys(dataToUpdate).length <= 1) {
        alert('Please fill in at least one field to update.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }

      try {
        const res = await fetch(buildUrl('boardinghouse'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(dataToUpdate) });
        const result = await res.json();
        if (result.status === 'Success') {
          alert('Boarding house updated successfully!');
          updateBhForm.reset();
          loadMyBoardingHouses(); // I-refresh ang lista para makita ang kausaban
        } else { throw new Error(result.message || 'Failed to update.'); }
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }

  // --- 🚀 Initial Load ---
  // [GI-AYO] Sigurohon nga ang user object naa sa dili pa i-load ang data.
  if (user) {
    loadOwnerBookings(); // [BAG-O] Tawagon ang function para i-load ang bookings
    loadMyBoardingHouses();
  }

  // [BAG-O] Function para i-update ang status sa booking (approve/reject)
  async function updateBookingStatus(bookingId, newStatus, button) {
    const originalBtnHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;

    try {
      const res = await fetch(buildUrl('booking'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ booking_id: bookingId, status: newStatus }) });
      const result = await res.json();
      if (!res.ok || result.status !== 'Success') throw new Error(result.message || 'Failed to update status.');
      alert(`Booking has been ${newStatus}.`);
      loadOwnerBookings(); // I-refresh ang listahan
    } catch (err) {
      alert(`Error: ${err.message}`);
      button.disabled = false;
      button.innerHTML = originalBtnHTML;
    }
  }

  // [BAG-O] Function para i-load ang mga bookings para sa owner
  async function loadOwnerBookings() {
    const container = document.getElementById('ownerBookingsList');
    const spinner = document.getElementById('ownerBookingSpinner');
    if (!container || !spinner) return;

    spinner.classList.remove('d-none');
    container.innerHTML = '';

    try {
      const res = await fetch(buildUrl('booking?view=owner'), { credentials: 'include' });
      const bookings = await res.json();

      if (!Array.isArray(bookings) || bookings.length === 0) {
        container.innerHTML = '<p class="text-muted">No tenants have booked your properties yet.</p>';
        return;
      }

      bookings.forEach(booking => {
        const expiryDate = new Date(booking.expiry_date);
        const isExpired = new Date() > expiryDate && booking.status !== 'approved';
        // [GI-AYO] Kung expired na ang booking, dili na ni nato ipakita.
        if (isExpired) {
          return; // Laktawan ang pag-render aning booking item.
        }
        let statusBadge;
        let actionButtons = '';
        if (booking.status === 'pending') {
            statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
            actionButtons = `
                <div class="btn-group ms-3" role="group">
                    <button class="btn btn-sm btn-success approve-booking-btn" data-booking-id="${booking.id}">Approve</button>
                    <button class="btn btn-sm btn-danger reject-booking-btn" data-booking-id="${booking.id}">Reject</button>
                </div>`;
        } else {
            const statusColors = { approved: 'bg-success', rejected: 'bg-secondary', cancelled: 'bg-dark' };
            statusBadge = `<span class="badge ${statusColors[booking.status] || 'bg-info'}">${booking.status}</span>`;
            // [BAG-O] Delete button para sa mga processed bookings
            actionButtons = `
                <button class="btn btn-sm btn-outline-danger ms-3 delete-booking-btn" data-booking-id="${booking.id}" title="Delete Record">
                    <i class="bi bi-trash"></i>
                </button>`;
        }

        const bookingItem = document.createElement('div');
        bookingItem.className = 'list-group-item';
        bookingItem.innerHTML = `
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1"><strong>${booking.bh_name}</strong></h6>
            <small>Expires: ${expiryDate.toLocaleString()}</small>
          </div>
          <p class="mb-1">Booked by: <strong>${booking.tenant_name}</strong> (${booking.tenant_email})</p>
          <div class="d-flex justify-content-between align-items-center">
             <small>Contact: ${booking.tenant_phone || 'N/A'}</small>
             <div class="d-flex align-items-center">
                ${statusBadge}
                ${actionButtons}
             </div>
          </div>
        `;
        container.appendChild(bookingItem);
      });
    } catch (err) {
      console.error('Failed to load owner bookings:', err);
      container.innerHTML = '<p class="text-danger">Could not load booking data.</p>';
    } finally {
      spinner.classList.add('d-none');
    }
  }

  // [BAG-O] Event listener para sa approve/reject buttons
  const bookingsContainer = document.getElementById('ownerBookingsList');
  if (bookingsContainer) {
    bookingsContainer.addEventListener('click', async (e) => {
      const button = e.target;
      const bookingId = button.dataset.bookingId;

      if (button.classList.contains('approve-booking-btn')) {
        if (confirm(`Are you sure you want to APPROVE this booking?`)) {
          await updateBookingStatus(bookingId, 'approved', button);
        }
      } else if (button.classList.contains('reject-booking-btn')) {
        if (confirm(`Are you sure you want to REJECT this booking?`)) {
          await updateBookingStatus(bookingId, 'rejected', button);
        }
      } else if (button.closest('.delete-booking-btn')) {
        // [BAG-O] Logic para sa delete button
        const delBtn = button.closest('.delete-booking-btn');
        const delId = delBtn.dataset.bookingId;
        
        if (confirm('Are you sure you want to delete this booking record? This cannot be undone.')) {
            delBtn.disabled = true;
            try {
                const res = await fetch(buildUrl(`booking?id=${delId}`), { 
                    method: 'DELETE', 
                    credentials: 'include' 
                });
                const result = await res.json();
                if (result.status === 'Success') {
                    alert('Booking record deleted.');
                    loadOwnerBookings(); // Refresh list
                } else {
                    throw new Error(result.message);
                }
            } catch (err) {
                alert('Error: ' + err.message);
                delBtn.disabled = false;
            }
        }
      }
    });
  }
}); // Add this to close the DOMContentLoaded listener and script