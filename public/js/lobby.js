// Elementos do DOM
const joinForm = document.getElementById('joinForm');
const playerNameInput = document.getElementById('playerName');
const avatarUpload = document.getElementById('avatarUpload');
const uploadArea = document.getElementById('uploadArea');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const previewContainer = document.getElementById('previewContainer');
const avatarPreview = document.getElementById('avatarPreview');
const removeAvatarBtn = document.getElementById('removeAvatar');
const btnPlay = document.getElementById('btnPlay');
const avatarGallery = document.getElementById('avatarGallery');

let uploadedAvatarPath = null;
let selectedPresetAvatar = null;
let availableAvatars = [];

// Upload de avatar
uploadArea.addEventListener('click', () => {
  avatarUpload.click();
});

avatarUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validar tamanho
  if (file.size > 5 * 1024 * 1024) {
    alert('A imagem deve ter no máximo 5MB');
    return;
  }

  // Desmarcar avatares presets
  document.querySelectorAll('.avatar-option').forEach(el => {
    el.classList.remove('selected');
  });
  selectedPresetAvatar = null;

  // Preview local
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.src = e.target.result;
    uploadPlaceholder.style.display = 'none';
    previewContainer.style.display = 'block';
  };
  reader.readAsDataURL(file);

  // Upload para o servidor
  const formData = new FormData();
  formData.append('avatar', file);

  try {
    btnPlay.disabled = true;
    btnPlay.innerHTML = '<span class="btn-text">⏳ Enviando...</span>';

    const response = await fetch('/upload-avatar', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      uploadedAvatarPath = data.path;
    } else {
      alert('Erro ao fazer upload da imagem');
      removeAvatar();
    }
  } catch (error) {
    console.error('Erro no upload:', error);
    alert('Erro ao fazer upload da imagem');
    removeAvatar();
  } finally {
    btnPlay.disabled = false;
    btnPlay.innerHTML = '<span class="btn-text">🚀 JOGAR</span>';
  }
});

// Remover avatar
removeAvatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  removeAvatar();
});

function removeAvatar() {
  avatarUpload.value = '';
  avatarPreview.src = '';
  uploadPlaceholder.style.display = 'flex';
  previewContainer.style.display = 'none';
  uploadedAvatarPath = null;
}

// Submeter formulário
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const playerName = playerNameInput.value.trim();

  if (!playerName) {
    alert('Por favor, digite seu nome');
    return;
  }

  // Determinar qual avatar usar (upload tem prioridade)
  const finalAvatar = uploadedAvatarPath || selectedPresetAvatar;

  // Salvar dados no localStorage
  localStorage.setItem('playerData', JSON.stringify({
    name: playerName,
    avatar: finalAvatar
  }));

  // Redirecionar para o jogo
  window.location.href = '/game.html';
});

// ============= GALERIA DE AVATARES =============

// Carregar avatares pré-definidos
async function loadAvatars() {
  try {
    const response = await fetch('/avatars/avatars.json');
    availableAvatars = await response.json();
    renderAvatarGallery();
  } catch (error) {
    console.error('Erro ao carregar avatares:', error);
    avatarGallery.innerHTML = '<div class="avatar-loading">Erro ao carregar avatares</div>';
  }
}

// Renderizar galeria de avatares
function renderAvatarGallery() {
  if (availableAvatars.length === 0) {
    avatarGallery.innerHTML = '<div class="avatar-loading">Nenhum avatar disponível</div>';
    return;
  }

  avatarGallery.innerHTML = '';

  availableAvatars.forEach(avatar => {
    const avatarOption = document.createElement('div');
    avatarOption.className = 'avatar-option';
    avatarOption.dataset.avatarId = avatar.id;

    const img = document.createElement('img');
    img.src = `/avatars/${avatar.file}`;
    img.alt = avatar.name;

    const nameLabel = document.createElement('div');
    nameLabel.className = 'avatar-name';
    nameLabel.textContent = avatar.name;

    avatarOption.appendChild(img);
    avatarOption.appendChild(nameLabel);

    // Click para selecionar avatar
    avatarOption.addEventListener('click', () => selectPresetAvatar(avatar));

    avatarGallery.appendChild(avatarOption);
  });
}

// Selecionar avatar pré-definido
function selectPresetAvatar(avatar) {
  // Desmarcar todos os avatares
  document.querySelectorAll('.avatar-option').forEach(el => {
    el.classList.remove('selected');
  });

  // Marcar o selecionado
  const selected = document.querySelector(`[data-avatar-id="${avatar.id}"]`);
  if (selected) {
    selected.classList.add('selected');
  }

  // Limpar upload customizado
  removeAvatar();

  // Salvar seleção
  selectedPresetAvatar = `/avatars/${avatar.file}`;
}

// ============= MODIFICAR FUNÇÕES EXISTENTES =============

// Modificar removeAvatar para limpar também avatar preset
const originalRemoveAvatar = removeAvatar;
function removeAvatar() {
  avatarUpload.value = '';
  avatarPreview.src = '';
  uploadPlaceholder.style.display = 'flex';
  previewContainer.style.display = 'none';
  uploadedAvatarPath = null;

  // NÃO limpar selectedPresetAvatar aqui
}

// ============= INICIALIZAÇÃO =============

// Restaurar nome anterior (se existir)
const savedData = localStorage.getItem('playerData');
if (savedData) {
  try {
    const data = JSON.parse(savedData);
    if (data.name) {
      playerNameInput.value = data.name;
    }
  } catch (error) {
    console.error('Erro ao restaurar dados:', error);
  }
}

// Carregar avatares na inicialização
loadAvatars();
