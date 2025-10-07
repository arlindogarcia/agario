// Server URL
const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `https://${window.location.hostname}`;

// Socket will be initialized after page loads
let socket;

// DOM Elements
const joinForm = document.getElementById('joinForm');
const playerNameInput = document.getElementById('playerName');
const uploadArea = document.getElementById('uploadArea');
const avatarUploadInput = document.getElementById('avatarUpload');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const previewContainer = document.getElementById('previewContainer');
const avatarPreview = document.getElementById('avatarPreview');
const removeAvatarBtn = document.getElementById('removeAvatar');
const avatarGallery = document.getElementById('avatarGallery');
const btnFight = document.getElementById('btnFight');
const matchmakingStatus = document.getElementById('matchmakingStatus');
const queueCount = document.getElementById('queueCount');
const btnCancel = document.getElementById('btnCancel');

// State
let selectedAvatar = null;
let uploadedAvatar = null;
let isInQueue = false;

// Load avatars gallery
async function loadAvatarGallery() {
  try {
    console.log('Carregando avatares...');
    const response = await fetch('../gotargario/avatars/avatars.json');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const avatars = await response.json();
    console.log('Avatares carregados:', avatars);

    avatarGallery.innerHTML = '';

    avatars.forEach((avatar, index) => {
      const img = document.createElement('img');
      img.src = `../gotargario/avatars/${avatar.file}`;
      img.alt = avatar.name || `Avatar ${index + 1}`;
      img.className = 'avatar-option';
      img.dataset.index = index;
      img.dataset.path = `../gotargario/avatars/${avatar.file}`;

      img.addEventListener('click', () => {
        // Remove previous selection
        document.querySelectorAll('.avatar-option').forEach(el => {
          el.classList.remove('selected');
        });

        // Select this avatar
        img.classList.add('selected');
        selectedAvatar = `../gotargario/avatars/${avatar.file}`;
        uploadedAvatar = null;

        // Hide upload preview
        previewContainer.style.display = 'none';
        uploadPlaceholder.style.display = 'flex';
      });

      avatarGallery.appendChild(img);
    });

    console.log('Galeria de avatares carregada com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar avatares:', error);
    avatarGallery.innerHTML = '<div class="avatar-loading">Erro ao carregar avatares. Verifique o console.</div>';
  }
}

// Upload area click handler
uploadArea.addEventListener('click', () => {
  if (!uploadedAvatar) {
    avatarUploadInput.click();
  }
});

// Handle file upload
avatarUploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file
  if (!file.type.startsWith('image/')) {
    alert('Por favor, selecione uma imagem válida');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Imagem muito grande. Máximo 5MB');
    return;
  }

  // Upload to server
  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const response = await fetch(`${SERVER_URL}/upload-avatar`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      uploadedAvatar = data.path;
      avatarPreview.src = `${SERVER_URL}${data.path}`;
      uploadPlaceholder.style.display = 'none';
      previewContainer.style.display = 'block';

      // Deselect gallery avatars
      document.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.remove('selected');
      });
      selectedAvatar = null;
    } else {
      alert('Erro ao fazer upload da imagem');
    }
  } catch (error) {
    console.error('Erro no upload:', error);
    alert('Erro ao fazer upload da imagem');
  }
});

// Remove uploaded avatar
removeAvatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  uploadedAvatar = null;
  avatarUploadInput.value = '';
  previewContainer.style.display = 'none';
  uploadPlaceholder.style.display = 'flex';
});

// Form submit handler
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const playerName = playerNameInput.value.trim();
  if (!playerName) {
    alert('Por favor, digite seu nome');
    return;
  }

  const avatar = uploadedAvatar || selectedAvatar;
  if (!avatar) {
    alert('Por favor, escolha um avatar');
    return;
  }

  // Join matchmaking queue
  joinMatchmaking(playerName, avatar);
});

// Join matchmaking
function joinMatchmaking(name, avatar) {
  isInQueue = true;

  // Hide form, show matchmaking status
  joinForm.style.display = 'none';
  matchmakingStatus.style.display = 'block';

  // Send join queue event
  socket.emit('fight:joinQueue', {
    name,
    avatar
  });

  console.log('Entrando na fila de matchmaking...');
}

// Initialize when DOM is ready
function initializeLobby() {
  console.log('Inicializando lobby...');

  // Initialize Socket.IO
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
  });

  // Setup socket event listeners
  socket.on('queueStatus', (data) => {
    queueCount.textContent = data.playersInQueue;
  });

  socket.on('matchFound', (data) => {
    console.log('Match encontrado!', data);
    localStorage.setItem('fightMatchData', JSON.stringify(data));
    window.location.href = 'game.html';
  });

  socket.on('connect', () => {
    console.log('Conectado ao servidor');
  });

  socket.on('disconnect', () => {
    console.log('Desconectado do servidor');
    if (isInQueue) {
      isInQueue = false;
      joinForm.style.display = 'block';
      matchmakingStatus.style.display = 'none';
      alert('Conexão perdida com o servidor');
    }
  });

  // Setup button handlers
  btnCancel.addEventListener('click', () => {
    if (isInQueue) {
      socket.emit('fight:leaveQueue');
      isInQueue = false;

      // Show form, hide matchmaking status
      joinForm.style.display = 'block';
      matchmakingStatus.style.display = 'none';
    }
  });

  // Load avatar gallery
  loadAvatarGallery();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLobby);
} else {
  initializeLobby();
}
